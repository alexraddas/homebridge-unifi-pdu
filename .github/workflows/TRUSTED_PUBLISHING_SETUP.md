# Setting Up npm Trusted Publishing

Trusted publishing uses OpenID Connect (OIDC) to authenticate GitHub Actions workflows without storing npm tokens as secrets. This is more secure than using static tokens.

## Setup Steps

### 1. Enable Trusted Publishing on npm

1. Go to: https://www.npmjs.com/settings/YOUR_USERNAME/access-tokens
2. Click on the **"Automation"** tab (or look for "Trusted Publishing")
3. Click **"Add GitHub Actions"** or **"Configure Trusted Publishing"**
4. Select your GitHub organization/user: `alexraddas`
5. Select repository: `homebridge-unifi-pdu`
6. Select workflow file: `.github/workflows/publish.yml`
7. Click **"Save"** or **"Add"**

### 2. Verify Workflow Configuration

The workflow file (`.github/workflows/publish.yml`) is already configured to use trusted publishing:
- Uses `actions/setup-node@v4` with `registry-url`
- Has `id-token: write` permission (required for OIDC)
- No token secret needed once trusted publishing is enabled

### 3. Test the Setup

1. Create a test release or run the workflow manually
2. Check the Actions tab to see if it publishes successfully
3. If it works, you can remove the `NPM_TOKEN` secret (it's not needed anymore)

## Benefits of Trusted Publishing

- ✅ **More Secure**: No long-lived tokens stored as secrets
- ✅ **Automatic**: Works seamlessly with GitHub Actions
- ✅ **Scoped**: Only works for the specific repository/workflow
- ✅ **Auditable**: All publishes are tied to specific GitHub Actions runs

## Fallback

If trusted publishing isn't set up yet, the workflow will fall back to using `NPM_TOKEN` secret. Once trusted publishing is configured, you can remove the secret.

## Troubleshooting

- **"403 Forbidden"**: Make sure trusted publishing is configured correctly on npm
- **"401 Unauthorized"**: Check that the workflow file path matches exactly
- **Still using token**: Remove `NODE_AUTH_TOKEN` env var from workflow once trusted publishing works
