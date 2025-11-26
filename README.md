# homebridge-unifi-pdu

Homebridge plugin for controlling UniFi PDU outlets.

## Features

- Exposes each PDU outlet as a switch in HomeKit
- **Supports multiple PDUs** - configure multiple PDU devices in one plugin instance
- Power cycle outlets via HomeKit
- Dynamic outlet discovery
- Filter which outlets to expose per PDU
- Automatic state synchronization
- Pure Node.js implementation - no Python required

## Installation

1. Install the plugin via Homebridge UI or:
   ```bash
   npm install -g homebridge-unifi-pdu
   ```

2. Configure the plugin in Homebridge `config.json`:

**Multiple PDUs (Recommended):**
```json
{
  "platforms": [
    {
      "platform": "UniFiPDU",
      "name": "UniFi PDU",
      "controllerUrl": "https://192.168.1.1",
      "apiKey": "your_api_key_here",
      "site": "default",
      "verifySsl": false,
      "pdus": [
        {
          "mac": "aa:bb:cc:dd:ee:01",
          "name": "PDU 1",
          "outletFilter": [1, 2, 5, 10]
        },
        {
          "mac": "aa:bb:cc:dd:ee:02",
          "name": "PDU 2",
          "outletFilter": [1, 3, 5]
        }
      ]
    }
  ]
}
```

**Single PDU (Backward Compatible):**
```json
{
  "platforms": [
    {
      "platform": "UniFiPDU",
      "name": "UniFi PDU",
      "pduMac": "aa:bb:cc:dd:ee:01",
      "controllerUrl": "https://192.168.1.1",
      "apiKey": "your_api_key_here",
      "site": "default",
      "outletFilter": [1, 2, 5, 10],
      "verifySsl": false
    }
  ]
}
```

## Configuration

### Platform-Level Options

- **platform** (required): Must be `"UniFiPDU"`
- **name** (required): Display name for the platform
- **controllerUrl** (required): URL of your UniFi controller
- **apiKey** (optional): API key for authentication (preferred)
- **username** (optional): Username for authentication (if no API key)
- **password** (optional): Password for authentication (if no API key)
- **site** (optional): Site name (default: "default")
- **verifySsl** (optional): Whether to verify SSL certificates (default: true, set to false for self-signed certs)

### PDU Configuration

**Option 1: Multiple PDUs (Recommended)**
- **pdus** (required): Array of PDU configurations, each with:
  - **mac** (required): MAC address of the PDU device
  - **name** (optional): Display name for this PDU (used in outlet names)
  - **outletFilter** (optional): Array of outlet indices to expose (e.g., `[1, 2, 5, 10]`)

**Option 2: Single PDU (Backward Compatible)**
- **pduMac** (required): MAC address of your PDU device
- **pduName** (optional): Display name for the PDU
- **outletFilter** (optional): Array of outlet indices to expose (e.g., `[1, 2, 5, 10]`)

## Requirements

- Node.js >= 14.0.0
- Homebridge >= 1.3.0
- No Python required - pure Node.js implementation

## How It Works

1. Plugin uses a pure Node.js client to communicate directly with UniFi API
2. Plugin discovers outlets via the UniFi API
3. Each outlet is exposed as a HomeKit switch
4. Toggling a switch power cycles the corresponding outlet

## Troubleshooting

- Check Homebridge logs for errors
- Verify API key/credentials are correct
- Check that PDU MAC address is correct
- Ensure network connectivity to UniFi controller
- If using self-signed certificates, set `verifySsl: false`

## License

MIT License - see LICENSE file for details
