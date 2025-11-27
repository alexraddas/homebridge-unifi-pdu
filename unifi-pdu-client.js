/**
 * UniFi PDU Client - Node.js implementation
 * 
 * Based on HAR file analysis, the power cycle uses:
 * POST /proxy/network/api/s/{site}/cmd/devmgr
 * Body: {
 *     "mac": "device_mac",
 *     "outlet_table": [{"index": outlet_index}],
 *     "cmd": "outlet-ctl"
 * }
 */

const axios = require('axios');
const https = require('https');

class UniFiPDUClient {
  constructor(options = {}) {
    this.controllerUrl = (options.controllerUrl || 'https://192.168.1.1').replace(/\/$/, '');
    this.apiKey = options.apiKey || null;
    this.username = options.username || null;
    this.password = options.password || null;
    this.site = options.site || 'default';
    this.verifySsl = options.verifySsl !== false; // Default to true, but allow disabling
    
    this.csrfToken = null;
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: this.verifySsl
      }),
      timeout: 10000
    });
  }
  
  /**
   * Login to UniFi controller (for username/password auth)
   * @returns {Promise<boolean>}
   */
  async login() {
    if (!this.username || !this.password) {
      throw new Error('Username and password required for login');
    }
    
    const loginEndpoints = [
      `${this.controllerUrl}/api/login`,
      `${this.controllerUrl}/proxy/network/api/login`,
    ];
    
    const payload = {
      username: this.username,
      password: this.password
    };
    
    for (const loginUrl of loginEndpoints) {
      try {
        const response = await this.axiosInstance.post(loginUrl, payload);
        
        if (response.status === 200) {
          // Get CSRF token from response headers
          this.csrfToken = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token'] || '';
          
          // Axios handles cookies automatically via the instance
          // Store any cookies from set-cookie header
          if (response.headers['set-cookie']) {
            // Cookies are automatically handled by axios
          }
          
          return true;
        }
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // Try next endpoint
          continue;
        }
        // Log error but continue to next endpoint
        console.error(`Login error at ${loginUrl}:`, error.message);
      }
    }
    
    return false;
  }
  
  /**
   * Get request headers with authentication
   * @returns {Object}
   */
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    } else if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }
    
    return headers;
  }
  
  /**
   * Ensure authentication is set up
   * @returns {Promise<void>}
   */
  async ensureAuth() {
    if (this.apiKey) {
      return; // API key auth, no login needed
    }
    
    if (!this.csrfToken) {
      const loggedIn = await this.login();
      if (!loggedIn) {
        throw new Error('Authentication failed');
      }
    }
  }
  
  /**
   * Power cycle a PDU outlet
   * @param {string} mac - Device MAC address
   * @param {number} outletIndex - Outlet index (1-based)
   * @returns {Promise<Object>}
   */
  async powerCycleOutlet(mac, outletIndex) {
    await this.ensureAuth();
    
    const url = `${this.controllerUrl}/proxy/network/api/s/${this.site}/cmd/devmgr`;
    
    const payload = {
      mac: mac,
      outlet_table: [
        {
          index: outletIndex
        }
      ],
      cmd: 'outlet-ctl'
    };
    
    try {
      const response = await this.axiosInstance.post(url, payload, {
        headers: this.getAuthHeaders()
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Power cycle failed: ${error.message}`);
    }
  }
  
  /**
   * Get device information
   * @param {string} mac - Device MAC address
   * @returns {Promise<Object>}
   */
  async getDeviceInfo(mac) {
    await this.ensureAuth();
    
    const endpoints = [
      `${this.controllerUrl}/proxy/network/api/s/${this.site}/stat/device/${mac}`,
      `${this.controllerUrl}/api/s/${this.site}/stat/device/${mac}`,
    ];
    
    for (const url of endpoints) {
      try {
        const response = await this.axiosInstance.get(url, {
          headers: this.getAuthHeaders()
        });
        
        if (response.status === 200) {
          const data = response.data;
          if (data.meta && data.meta.rc === 'ok') {
            const devices = data.data || [];
            return devices[0] || {};
          }
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // Try next endpoint
          continue;
        }
        // Log error but continue to next endpoint
        console.error(`Error getting device info from ${url}:`, error.message);
      }
    }
    
    return {};
  }
  
  /**
   * Get list of all outlets
   * @param {string} mac - Device MAC address
   * @returns {Promise<Array>}
   */
  async getOutlets(mac) {
    const deviceInfo = await this.getDeviceInfo(mac);
    const outlets = deviceInfo.outlet_overrides || [];
    
    // Return outlets sorted by index
    return outlets.sort((a, b) => (a.index || 0) - (b.index || 0));
  }
  
  /**
   * Get a specific outlet by index
   * @param {string} mac - Device MAC address
   * @param {number} outletIndex - Outlet index
   * @returns {Promise<Object|null>}
   */
  async getOutlet(mac, outletIndex) {
    const outlets = await this.getOutlets(mac);
    return outlets.find(o => o.index === outletIndex) || null;
  }
}

module.exports = UniFiPDUClient;
