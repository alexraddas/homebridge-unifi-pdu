# Installing Plugin in Homebridge Docker Container (Synology NAS)

Since Homebridge is running in a Docker container with strict plugin resolution, you need to install the plugin inside the container.

## Method 1: Copy Files into Container (Development)

1. **Find your Homebridge container name:**
   ```bash
   docker ps | grep homebridge
   ```

2. **Copy the plugin directory into the container:**
   ```bash
   # From your local machine, copy the plugin files
   docker cp /Users/alexraddas/Documents/unifi_pdu_integration/homebridge <container_name>:/var/lib/homebridge/node_modules/homebridge-unifi-pdu
   ```

3. **Install dependencies inside the container:**
   ```bash
   docker exec -it <container_name> sh -c "cd /var/lib/homebridge/node_modules/homebridge-unifi-pdu && npm install"
   ```

4. **Restart Homebridge** via the UI or:
   ```bash
   docker restart <container_name>
   ```

## Method 2: Use Homebridge UI (Recommended for Production)

1. **Publish to npm first** (if not already published):
   ```bash
   npm publish
   ```

2. **Install via Homebridge UI:**
   - Open Homebridge UI
   - Go to Plugins
   - Search for "homebridge-unifi-pdu"
   - Click Install

## Method 3: Install from Tarball in Container

1. **Copy the tarball into the container:**
   ```bash
   docker cp homebridge-unifi-pdu-1.0.4.tgz <container_name>:/tmp/
   ```

2. **Install inside the container:**
   ```bash
   docker exec -it <container_name> sh -c "cd /var/lib/homebridge && npm install /tmp/homebridge-unifi-pdu-1.0.4.tgz"
   ```

3. **Restart Homebridge**

## Method 4: Mount Plugin Directory (Best for Active Development)

If you're actively developing, you can mount your local plugin directory:

1. **Stop the Homebridge container**

2. **Edit the container settings** in Synology Docker UI:
   - Add a volume mount:
     - Source: `/Users/alexraddas/Documents/unifi_pdu_integration/homebridge`
     - Destination: `/var/lib/homebridge/node_modules/homebridge-unifi-pdu`

3. **Start the container**

4. **Install dependencies inside container:**
   ```bash
   docker exec -it <container_name> sh -c "cd /var/lib/homebridge/node_modules/homebridge-unifi-pdu && npm install"
   ```

Note: Replace `<container_name>` with your actual Homebridge container name.

