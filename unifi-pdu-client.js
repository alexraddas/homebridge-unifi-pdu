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
    // Use outlet_table instead of outlet_overrides to get power monitoring capabilities
    // outlet_table includes outlet_caps which indicates if power monitoring is supported
    const outlets = deviceInfo.outlet_table || deviceInfo.outlet_overrides || [];
    
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
  
  /**
   * Get outlet statistics (current, power, voltage, etc.)
   * Power stats are available in outlet_table for outlets with outlet_caps >= 3
   * Outlets with outlet_caps = 1 (USB outlets) don't have power monitoring
   * @param {string} mac - Device MAC address
   * @param {number} outletIndex - Outlet index (optional, if not provided returns all outlets)
   * @returns {Promise<Object|Array>}
   */
  async getOutletStats(mac, outletIndex = null) {
    await this.ensureAuth();
    
    // Get device info which contains outlet_table with power stats
    const deviceInfo = await this.getDeviceInfo(mac);
    
    if (!deviceInfo.outlet_table || !Array.isArray(deviceInfo.outlet_table)) {
      return outletIndex !== null ? null : [];
    }
    
    let stats = deviceInfo.outlet_table;
    
    // Filter by outlet index if specified
    if (outletIndex !== null) {
      stats = stats.filter(s => s.index === outletIndex);
      return stats.length > 0 ? stats[0] : null;
    }
    
    return stats;
  }
  
  /**
   * Check if an outlet supports power monitoring
   * @param {string} mac - Device MAC address
   * @param {number} outletIndex - Outlet index
   * @returns {Promise<boolean>}
   */
  async outletSupportsPowerMonitoring(mac, outletIndex) {
    const outlet = await this.getOutletStats(mac, outletIndex);
    if (!outlet) return false;
    
    // outlet_caps: 1 = basic outlet (no power monitoring)
    // outlet_caps: 3 = smart outlet (has power monitoring)
    return outlet.outlet_caps >= 3;
  }
  
  /**
   * Get power statistics for an outlet (voltage, current, power, power factor)
   * Returns null if outlet doesn't support power monitoring
   * @param {string} mac - Device MAC address
   * @param {number} outletIndex - Outlet index
   * @returns {Promise<Object|null>}
   */
  async getOutletPowerStats(mac, outletIndex) {
    const outlet = await this.getOutletStats(mac, outletIndex);
    if (!outlet || outlet.outlet_caps < 3) {
      return null; // Outlet doesn't support power monitoring
    }
    
    return {
      voltage: parseFloat(outlet.outlet_voltage) || 0,
      current: parseFloat(outlet.outlet_current) || 0,
      power: parseFloat(outlet.outlet_power) || 0,
      powerFactor: parseFloat(outlet.outlet_power_factor) || 0,
      index: outlet.index,
      name: outlet.name
    };
  }
}

module.exports = UniFiPDUClient;
