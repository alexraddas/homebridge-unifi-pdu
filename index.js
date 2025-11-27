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
    this.outlets.forEach((outlet, index) => {
      // Include PDU MAC in UUID to ensure uniqueness across multiple PDUs
      this.log.info(`[DEBUG] Processing outlet ${index + 1}/${this.outlets.length}: PDU ${outlet.pduMac}, index ${outlet.index}`);
      const uuid = this.api.hap.uuid.generate(`unifi-pdu-${outlet.pduMac}-${outlet.index}`);
      this.log.info(`[DEBUG] Generated UUID: ${uuid}`);
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
        // Use api.platformAccessory() instead of new Accessory() for platform accessories
        const accessory = new this.api.platformAccessory(displayName, uuid);
        
        const switchService = accessory.addService(Service.Switch, displayName);
        this.setupOutletService(switchService, outlet.index, outlet.pduMac);
        
        // Add power monitoring for outlets that support it (outlet_caps >= 3)
        if (outlet.outlet_caps >= 3) {
          this.setupPowerMonitoring(accessory, outlet.index, outlet.pduMac);
        }
        
        this.api.registerPlatformAccessories('homebridge-unifi-pdu', 'UniFiPDU', [accessory]);
        this.accessories.push(accessory);
        
        // Update reachability to ensure HomeKit sees the accessory
        accessory.updateReachability(true);
      }
    });
    
    // Force HomeKit to refresh by updating all accessories
    this.accessories.forEach(accessory => {
      accessory.updateReachability(true);
    });
    
    this.log.info(`Registered ${this.accessories.length} accessory(ies) with HomeKit`);
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
      
      // Check if outlet supports power monitoring and add power characteristics
      // Find the outlet in our loaded outlets to check outlet_caps
      const outlet = this.outlets.find(o => 
        o.index === outletInfo.outletIndex && o.pduMac === outletInfo.pduMac
      );
      
      if (outlet && outlet.outlet_caps >= 3) {
        this.setupPowerMonitoring(accessory, outletInfo.outletIndex, outletInfo.pduMac);
      } else {
        // Try async check as fallback
        this.client.outletSupportsPowerMonitoring(outletInfo.pduMac, outletInfo.outletIndex)
          .then(supportsPower => {
            if (supportsPower) {
              this.setupPowerMonitoring(accessory, outletInfo.outletIndex, outletInfo.pduMac);
            }
          })
          .catch(error => {
            // Silently fail - outlet might not support power monitoring
          });
      }
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
  
  setupPowerMonitoring(accessory, outletIndex, pduMac) {
    // Remove any old LightSensor services that might have been created for power monitoring
    const lightSensorService = accessory.getService(Service.LightSensor);
    if (lightSensorService && lightSensorService.subtype === 'power-monitoring') {
      this.log.info(`Removing old LightSensor service for outlet ${outletIndex}`);
      accessory.removeService(lightSensorService);
    }
    
    // Also remove any service with the name "Power Monitoring" that isn't a Switch
    const services = accessory.services.filter(s => s.displayName === 'Power Monitoring' && s.UUID !== Service.Switch.UUID);
    services.forEach(service => {
      this.log.info(`Removing old Power Monitoring service for outlet ${outletIndex}`);
      accessory.removeService(service);
    });
    
    // Add power monitoring characteristics directly to the Switch service
    // This avoids creating a separate service that might be misinterpreted
    const switchService = accessory.getService(Service.Switch);
    if (!switchService) {
      this.log.error(`Switch service not found for outlet ${outletIndex}`);
      return;
    }
    
    // Add Current (Amps) characteristic to the Switch service
    // Using custom UUIDs for power monitoring characteristics
    const CurrentUUID = 'E863F126-079E-48FF-8F27-9C1195C4E5B6'; // Custom UUID for Current
    let currentChar = switchService.getCharacteristic(CurrentUUID);
    if (!currentChar) {
      currentChar = switchService.addCharacteristic(
        new Characteristic('Current', CurrentUUID, {
          format: Characteristic.Formats.FLOAT,
          unit: 'A',
          minValue: 0,
          maxValue: 20,
          minStep: 0.001,
          perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        })
      );
    }
    
    // Add Voltage (Volts) characteristic to the Switch service
    const VoltageUUID = 'E863F10D-079E-48FF-8F27-9C1195C4E5B6'; // Custom UUID for Voltage
    let voltageChar = switchService.getCharacteristic(VoltageUUID);
    if (!voltageChar) {
      voltageChar = switchService.addCharacteristic(
        new Characteristic('Voltage', VoltageUUID, {
          format: Characteristic.Formats.FLOAT,
          unit: 'V',
          minValue: 0,
          maxValue: 250,
          minStep: 0.1,
          perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        })
      );
    }
    
    // Add Power (Watts) characteristic to the Switch service
    const PowerUUID = 'E863F10C-079E-48FF-8F27-9C1195C4E5B6'; // Custom UUID for Power (Watts)
    let powerChar = switchService.getCharacteristic(PowerUUID);
    if (!powerChar) {
      powerChar = switchService.addCharacteristic(
        new Characteristic('Power', PowerUUID, {
          format: Characteristic.Formats.FLOAT,
          unit: 'W',
          minValue: 0,
          maxValue: 2000,
          minStep: 0.1,
          perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        })
      );
    }
    
    // Setup get handlers for all power characteristics
    const updatePowerStats = async () => {
      try {
        const powerStats = await this.client.getOutletPowerStats(pduMac, outletIndex);
        if (powerStats) {
          currentChar.updateValue(powerStats.current);
          voltageChar.updateValue(powerStats.voltage);
          powerChar.updateValue(powerStats.power);
        }
      } catch (error) {
        this.log.error(`Failed to update power stats for outlet ${outletIndex} on PDU ${pduMac}: ${error.message}`);
      }
    };
    
    currentChar.on('get', async (callback) => {
      try {
        const powerStats = await this.client.getOutletPowerStats(pduMac, outletIndex);
        callback(null, powerStats ? powerStats.current : 0);
      } catch (error) {
        this.log.error(`Failed to get current for outlet ${outletIndex}: ${error.message}`);
        callback(error);
      }
    });
    
    voltageChar.on('get', async (callback) => {
      try {
        const powerStats = await this.client.getOutletPowerStats(pduMac, outletIndex);
        callback(null, powerStats ? powerStats.voltage : 0);
      } catch (error) {
        this.log.error(`Failed to get voltage for outlet ${outletIndex}: ${error.message}`);
        callback(error);
      }
    });
    
    powerChar.on('get', async (callback) => {
      try {
        const powerStats = await this.client.getOutletPowerStats(pduMac, outletIndex);
        callback(null, powerStats ? powerStats.power : 0);
      } catch (error) {
        this.log.error(`Failed to get power for outlet ${outletIndex}: ${error.message}`);
        callback(error);
      }
    });
    
    // Update power stats periodically (every 30 seconds)
    const updateInterval = setInterval(updatePowerStats, 30000);
    
    // Store interval ID on accessory for cleanup
    if (!accessory._powerUpdateInterval) {
      accessory._powerUpdateInterval = updateInterval;
    }
    
    // Initial update
    updatePowerStats();
  }
}
