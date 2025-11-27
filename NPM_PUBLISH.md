# Publishing to npm

## Prerequisites

1. **Create an npm account** (if you don't have one):
   - Go to https://www.npmjs.com/signup
   - Create a free account

2. **Login to npm**:
   ```bash
   npm login
   ```
   Enter your username, password, and email when prompted.

## Publishing Steps

1. **Verify package.json**:
   ```bash
   npm run test  # Run any tests (if you add them later)
   ```

2. **Check package name availability**:
   ```bash
   npm view homebridge-unifi-pdu
   ```
   If it returns "404 Not Found", the name is available.

3. **Publish to npm**:
   ```bash
   npm publish
   ```

   This will publish version 1.0.0 to npm.

## Updating the Package

When you make changes and want to publish a new version:

1. **Update version in package.json**:
   ```bash
   npm version patch  # For bug fixes (1.0.0 -> 1.0.1)
   npm version minor  # For new features (1.0.0 -> 1.1.0)
   npm version major  # For breaking changes (1.0.0 -> 2.0.0)
   ```

2. **Publish the new version**:
   ```bash
   npm publish
   ```

## After Publishing

Once published, users can install your plugin via:

```bash
npm install -g homebridge-unifi-pdu
```

Or through the Homebridge UI by searching for "homebridge-unifi-pdu".

## Notes

- The package name `homebridge-unifi-pdu` must be unique on npm
- Make sure you're logged in with `npm login` before publishing
- The first publish will create the package, subsequent publishes will update it
- You can unpublish within 72 hours if needed: `npm unpublish homebridge-unifi-pdu@<version>`
