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
    // Use Map to track cached accessories (like the official template)
    this.cachedAccessories = new Map();
    
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
    
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already.
    this.api.on('didFinishLaunching', () => {
      this.log.info('Homebridge finished launching');
      // Now discover and register accessories
      this.loadOutlets();
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
    this.log.info('[DEBUG] registerAccessories() called');
    this.log.info(`[DEBUG] Module-level Accessory: ${!!Accessory}, Service: ${!!Service}, Characteristic: ${!!Characteristic}`);
    this.log.info(`[DEBUG] this.api: ${!!this.api}, this.api.hap: ${!!this.api.hap}`);
    
    // Use module-level Accessory, Characteristic, Service set during plugin initialization
    // These are set in module.exports when the plugin loads
    if (!Accessory) {
      this.log.error('[DEBUG] Accessory is not available, retrying...');
      setTimeout(() => this.registerAccessories(), 1000);
      return;
    }
    
    if (!Service) {
      this.log.error('[DEBUG] Service is not available, retrying...');
      setTimeout(() => this.registerAccessories(), 1000);
      return;
    }
    
    // Use this.api.hap.uuid.generate() for UUID generation (standard Homebridge method)
    if (!this.api) {
      this.log.error('[DEBUG] this.api is undefined');
      setTimeout(() => this.registerAccessories(), 1000);
      return;
    }
    
    if (!this.api.hap) {
      this.log.error('[DEBUG] this.api.hap is undefined');
      setTimeout(() => this.registerAccessories(), 1000);
      return;
    }
    
    this.log.info(`[DEBUG] this.api.hap keys: ${Object.keys(this.api.hap || {}).join(', ')}`);
    this.log.info(`[DEBUG] this.api.hap.uuid: ${!!this.api.hap.uuid}`);
    
    if (this.api.hap.uuid) {
      this.log.info(`[DEBUG] this.api.hap.uuid type: ${typeof this.api.hap.uuid}`);
      this.log.info(`[DEBUG] this.api.hap.uuid keys: ${Object.keys(this.api.hap.uuid || {}).join(', ')}`);
      this.log.info(`[DEBUG] this.api.hap.uuid.generate: ${typeof this.api.hap.uuid.generate}`);
    }
    
    if (!this.api.hap.uuid || typeof this.api.hap.uuid.generate !== 'function') {
      this.log.error('[DEBUG] UUID generator is not available');
      this.log.error(`[DEBUG]   this.api.hap.uuid exists: ${!!this.api.hap.uuid}`);
      this.log.error(`[DEBUG]   this.api.hap.uuid.generate type: ${typeof (this.api.hap.uuid && this.api.hap.uuid.generate)}`);
      setTimeout(() => this.registerAccessories(), 1000);
      return;
    }
    
    this.log.info('[DEBUG] UUID generator is available, proceeding with accessory registration');
    
    this.log.info(`[DEBUG] Registering ${this.outlets.length} outlet(s)`);
    const discoveredUUIDs = [];
    
    this.outlets.forEach((outlet, index) => {
      // Include PDU MAC in UUID to ensure uniqueness across multiple PDUs
      this.log.info(`[DEBUG] Processing outlet ${index + 1}/${this.outlets.length}: PDU ${outlet.pduMac}, index ${outlet.index}`);
      const uuid = this.api.hap.uuid.generate(`unifi-pdu-${outlet.pduMac}-${outlet.index}`);
      this.log.info(`[DEBUG] Generated UUID: ${uuid}`);
      
      // See if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.cachedAccessories.get(uuid);
      
      // Create display name - include PDU name if multiple PDUs
      let displayName = outlet.name || `Outlet ${outlet.index}`;
      if (this.pdus.length > 1 && outlet.pduName) {
        displayName = `${outlet.pduName} ${displayName}`;
      }
      
      if (existingAccessory) {
        // The accessory already exists - restore it and set up handlers
        this.log.info(`Restoring existing accessory from cache: ${displayName}`);
        
        // Get or create the Switch service
        let service = existingAccessory.getService(Service.Switch);
        if (!service) {
          service = existingAccessory.addService(Service.Switch, displayName);
        }
        
        // Set up the outlet service handlers
        this.setupOutletService(service, outlet.index, outlet.pduMac);
      } else {
        // The accessory does not yet exist, so we need to create it
        this.log.info(`Adding new accessory: ${displayName}`);
        
        // Create a new accessory
        const accessory = new this.api.platformAccessory(displayName, uuid);
        
        // Store outlet info in context for later reference
        accessory.context.outlet = {
          index: outlet.index,
          pduMac: outlet.pduMac,
          pduName: outlet.pduName
        };
        
        // Add the Switch service
        const service = accessory.addService(Service.Switch, displayName);
        this.setupOutletService(service, outlet.index, outlet.pduMac);
        
        // Link the accessory to your platform
        this.api.registerPlatformAccessories('homebridge-unifi-pdu', 'UniFiPDU', [accessory]);
        
        // Add to cached accessories map
        this.cachedAccessories.set(uuid, accessory);
      }
      
      discoveredUUIDs.push(uuid);
    });
    
    // Remove accessories that are no longer present in the config
    for (const [uuid, accessory] of this.cachedAccessories) {
      if (!discoveredUUIDs.includes(uuid)) {
        this.log.info(`Removing existing accessory from cache: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories('homebridge-unifi-pdu', 'UniFiPDU', [accessory]);
        this.cachedAccessories.delete(uuid);
      }
    }
    
    this.log.info(`Registered ${this.cachedAccessories.size} accessory(ies) with HomeKit`);
  }
  
  configureAccessory(accessory) {
    // This function is invoked when homebridge restores cached accessories from disk at startup.
    // It should be used to store the accessory, NOT set up handlers yet.
    // Handlers will be set up in loadOutlets() after didFinishLaunching fires.
    this.log.info(`Loading accessory from cache: ${accessory.displayName}`);
    
    // Add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.cachedAccessories.set(accessory.UUID, accessory);
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
