# GitHub Actions Workflows

## Publishing to npm

This repository includes a GitHub Actions workflow that automatically publishes the package to npm.

### Setup

1. **Create an npm token:**
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token" → "Automation"
   - Copy the token

2. **Add the token to GitHub:**
   - Go to your repository: https://github.com/alexraddas/homebridge-unifi-pdu/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

### Publishing Methods

#### Method 1: Create a GitHub Release (Recommended)

1. Go to https://github.com/alexraddas/homebridge-unifi-pdu/releases/new
2. Click "Choose a tag" → "Create new tag"
3. Enter tag name: `v1.0.0` (must start with `v`)
4. Fill in release title and description
5. Click "Publish release"
6. The workflow will automatically:
   - Extract the version from the tag
   - Update package.json
   - Publish to npm

#### Method 2: Manual Workflow Dispatch

1. Go to https://github.com/alexraddas/homebridge-unifi-pdu/actions
2. Select "Publish to npm" workflow
3. Click "Run workflow"
4. Choose version bump type (patch/minor/major)
5. Click "Run workflow"
6. The workflow will:
   - Bump the version in package.json
   - Commit and push the change
   - Publish to npm

### Version Format

- Tags must start with `v` (e.g., `v1.0.0`)
- The workflow extracts the version number and updates package.json
- For manual dispatch, version is bumped automatically

### Notes

- The workflow uses `npm ci` for faster, reliable installs
- Publishing requires the `NPM_TOKEN` secret to be set
- The workflow runs on Ubuntu latest with Node.js 18
