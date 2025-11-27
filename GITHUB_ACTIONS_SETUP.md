# GitHub Actions Setup for npm Publishing

## Quick Setup

1. **Create npm token:**
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token" → Select "Automation"
   - Copy the token (starts with `npm_`)

2. **Add secret to GitHub:**
   - Go to: https://github.com/alexraddas/homebridge-unifi-pdu/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

## Publishing

### Option 1: Create a Release (Recommended)

1. Go to: https://github.com/alexraddas/homebridge-unifi-pdu/releases/new
2. Click "Choose a tag" → "Create new tag"
3. Enter: `v1.0.0` (must start with `v`)
4. Fill in release title/description
5. Click "Publish release"
6. ✅ Workflow automatically publishes to npm!

### Option 2: Manual Workflow Dispatch

1. Go to: https://github.com/alexraddas/homebridge-unifi-pdu/actions
2. Select "Publish to npm"
3. Click "Run workflow"
4. Choose version bump (patch/minor/major)
5. Click "Run workflow"
6. ✅ Workflow bumps version and publishes!

## How It Works

- **On Release:** Extracts version from tag (e.g., `v1.0.0` → `1.0.0`)
- **Manual Dispatch:** Bumps version automatically, commits, then publishes
- Uses `NPM_TOKEN` secret for authentication
- Publishes to public npm registry
