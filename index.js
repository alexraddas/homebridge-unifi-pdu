const UniFiPDUClient = require('./unifi-pdu-client');

let Service, Characteristic, Accessory;

module.exports = (api) => {
  Service = api.hap.Service;
  Characteristic = api.hap.Characteristic;
  Accessory = api.hap.Accessory;
  
  api.registerPlatform('homebridge-unifi-pdu', 'UniFiPDU', UniFiPDUPlatform);
};

class UniFiPDUPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    
    // Configuration - support multiple PDUs
    this.name = config.name || 'UniFi PDU';
    this.controllerUrl = config.controllerUrl || 'https://192.168.1.1';
    this.apiKey = config.apiKey || '';
    this.username = config.username || '';
    this.password = config.password || '';
    this.site = config.site || 'default';
    this.verifySsl = config.verifySsl !== false; // Default to true
    
    // Support both single PDU (backward compatible) and multiple PDUs
    if (config.pdus && Array.isArray(config.pdus)) {
      this.pdus = config.pdus;
    } else if (config.pduMac) {
      // Single PDU - backward compatibility
      this.pdus = [{
        mac: config.pduMac,
        name: config.pduName || null,
        outletFilter: config.outletFilter || null
      }];
    } else {
      throw new Error('Either pduMac or pdus array is required');
    }
    
    // Validate authentication
    if (!this.apiKey && (!this.username || !this.password)) {
      throw new Error('Either API key or username/password is required');
    }
    
    // Validate PDUs
    for (const pdu of this.pdus) {
      if (!pdu.mac) {
        throw new Error('PDU MAC address is required for all PDUs');
      }
    }
    
    // State
    this.outlets = [];
    this.accessories = [];
    
    // Create UniFi PDU client (shared across all PDUs)
    this.client = new UniFiPDUClient({
      controllerUrl: this.controllerUrl,
      apiKey: this.apiKey,
      username: this.username,
      password: this.password,
      site: this.site,
      verifySsl: this.verifySsl
    });
    
    this.log.info(`Initializing UniFi PDU platform: ${this.name} with ${this.pdus.length} PDU(s)`);
    
    // Load outlets from all PDUs
    this.loadOutlets();
    
    // Register platform
    this.api.on('didFinishLaunching', () => {
      this.log.info('Homebridge finished launching');
    });
  }
  
  async loadOutlets() {
    try {
      const allOutlets = [];
      
      // Load outlets from each PDU
      for (const pdu of this.pdus) {
        try {
          let outlets = await this.client.getOutlets(pdu.mac);
          
          // Filter outlets if configured for this PDU
          if (pdu.outletFilter && Array.isArray(pdu.outletFilter)) {
            outlets = outlets.filter(o => pdu.outletFilter.includes(o.index));
          }
          
          // Add PDU info to each outlet
          outlets.forEach(outlet => {
            outlet.pduMac = pdu.mac;
            outlet.pduName = pdu.name || null;
            allOutlets.push(outlet);
          });
          
          this.log.info(`Loaded ${outlets.length} outlet(s) from PDU ${pdu.mac}${pdu.name ? ` (${pdu.name})` : ''}`);
        } catch (error) {
          this.log.error(`Failed to load outlets from PDU ${pdu.mac}: ${error.message}`);
        }
      }
      
      this.outlets = allOutlets;
      this.log.info(`Total: ${allOutlets.length} outlet(s) from ${this.pdus.length} PDU(s)`);
      
      // Register accessories
      this.registerAccessories();
    } catch (error) {
      this.log.error(`Failed to load outlets: ${error.message}`);
      // Retry after 5 seconds
      setTimeout(() => this.loadOutlets(), 5000);
    }
  }
  
  registerAccessories() {
    // Use module-level Accessory, Characteristic, Service set during plugin initialization
    // These are set in module.exports when the plugin loads
    if (!Accessory) {
      this.log.error('Accessory is not available, retrying...');
      setTimeout(() => this.registerAccessories(), 1000);
      return;
    }
    
    if (!Service) {
      this.log.error('Service is not available, retrying...');
      setTimeout(() => this.registerAccessories(), 1000);
      return;
    }
    
    // Use this.api.hap.uuid.generate() for UUID generation (standard Homebridge method)
    if (!this.api || !this.api.hap || !this.api.hap.uuid || typeof this.api.hap.uuid.generate !== 'function') {
      this.log.error('UUID generator is not available, retrying...');
      setTimeout(() => this.registerAccessories(), 1000);
      return;
    }
    
    this.outlets.forEach(outlet => {
      // Include PDU MAC in UUID to ensure uniqueness across multiple PDUs
      const uuid = this.api.hap.uuid.generate(`unifi-pdu-${outlet.pduMac}-${outlet.index}`);
      const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);
      
      // Create display name - include PDU name if multiple PDUs
      let displayName = outlet.name || `Outlet ${outlet.index}`;
      if (this.pdus.length > 1 && outlet.pduName) {
        displayName = `${outlet.pduName} ${displayName}`;
      }
      
      if (existingAccessory) {
        this.log.info(`Reusing existing accessory: ${displayName}`);
        this.configureAccessory(existingAccessory);
      } else {
        this.log.info(`Adding new accessory: ${displayName}`);
        const accessory = new Accessory(displayName, uuid);
        
        accessory.addService(Service.Switch, displayName);
        this.setupOutletService(accessory.getService(Service.Switch), outlet.index, outlet.pduMac);
        
        this.api.registerPlatformAccessories('homebridge-unifi-pdu', 'UniFiPDU', [accessory]);
        this.accessories.push(accessory);
      }
    });
  }
  
  configureAccessory(accessory) {
    // Called when Homebridge restarts and finds existing accessories
    // Use module-level Service set during plugin initialization
    
    this.log.info(`Configuring accessory: ${accessory.displayName}`);
    
    let service = accessory.getService(Service.Switch);
    if (!service) {
      service = accessory.addService(Service.Switch);
    }
    
    const outletInfo = this.extractOutletInfo(accessory);
    if (outletInfo) {
      this.setupOutletService(service, outletInfo.outletIndex, outletInfo.pduMac);
    }
  }
  
  extractOutletInfo(accessory) {
    // Extract outlet index and PDU MAC from accessory UUID
    const uuid = accessory.UUID;
    // UUID format: unifi-pdu-{mac}-{index}
    const match = uuid.match(/unifi-pdu-([\w:]+)-(\d+)/);
    if (match) {
      return {
        pduMac: match[1],
        outletIndex: parseInt(match[2])
      };
    }
    return null;
  }
  
  setupOutletService(service, outletIndex, pduMac) {
    // Use module-level Characteristic set during plugin initialization
    
    service.getCharacteristic(Characteristic.On)
      .on('get', async (callback) => {
        try {
          const outlet = await this.client.getOutlet(pduMac, outletIndex);
          if (outlet) {
            callback(null, outlet.relay_state || false);
          } else {
            callback(new Error(`Outlet ${outletIndex} not found on PDU ${pduMac}`));
          }
        } catch (error) {
          this.log.error(`Failed to get outlet ${outletIndex} state from PDU ${pduMac}: ${error.message}`);
          callback(error);
        }
      })
      .on('set', async (value, callback) => {
        try {
          // Power cycle the outlet
          await this.client.powerCycleOutlet(pduMac, outletIndex);
          this.log.info(`Power cycled outlet ${outletIndex} on PDU ${pduMac}`);
          
          // Update state after a delay
          setTimeout(async () => {
            try {
              const outlet = await this.client.getOutlet(pduMac, outletIndex);
              if (outlet) {
                service.updateCharacteristic(Characteristic.On, outlet.relay_state || false);
              }
            } catch (error) {
              this.log.error(`Failed to update outlet ${outletIndex} state from PDU ${pduMac}: ${error.message}`);
            }
          }, 2000);
          
          callback(null);
        } catch (error) {
          this.log.error(`Failed to power cycle outlet ${outletIndex} on PDU ${pduMac}: ${error.message}`);
          callback(error);
        }
      });
  }
}
