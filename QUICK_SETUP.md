# Quick Setup: npm Trusted Publishing

## Step-by-Step

1. **Go to npm Access Tokens page:**
   ```
   https://www.npmjs.com/settings/YOUR_USERNAME/access-tokens
   ```
   (Replace YOUR_USERNAME with your npm username)

2. **Find "Trusted Publishing" section:**
   - Look for a section called "Trusted Publishing" or "GitHub Actions"
   - If you don't see it, check the "Automation" tab

3. **Add GitHub Actions trusted publisher:**
   - Click "Add GitHub Actions" or "Add trusted publisher"
   - Fill in:
     - **Repository owner:** `alexraddas`
     - **Repository name:** `homebridge-unifi-pdu`
     - **Workflow filename:** `.github/workflows/publish.yml`
   - Click "Add" or "Save"

4. **Test it:**
   - Go to: https://github.com/alexraddas/homebridge-unifi-pdu/actions
   - Run the "Publish to npm" workflow manually
   - Or create a release with tag `v1.0.0`

5. **Once it works:**
   - You can remove the `NPM_TOKEN` secret from GitHub (no longer needed)
   - Remove the `NODE_AUTH_TOKEN` env var from the workflow file

## What This Does

- Uses OpenID Connect (OIDC) for authentication
- No long-lived tokens to manage
- More secure than static tokens
- Automatically works with GitHub Actions

## Current Status

✅ Workflow is configured for trusted publishing
✅ Has `id-token: write` permission
✅ Uses `actions/setup-node@v4` with registry-url
⏳ Waiting for you to configure trusted publishing on npm
