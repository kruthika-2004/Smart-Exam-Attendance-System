# Fixing Camera Access from Network Devices

## Problem
Browsers require **HTTPS** (or localhost) to access the camera. When accessing from another device via `http://192.168.1.180:5173`, the browser blocks camera access for security reasons.

## Solutions

### ✅ Solution 1: Use Server Laptop for Attendance (Easiest)

**On the server laptop:**
1. Open: `http://localhost:5173`
2. Log in and use the attendance link
3. Camera will work because it's localhost

**On other laptops:**
- Use `http://192.168.1.180:5173` for viewing/managing data
- Use the server laptop for taking attendance (camera access)

### ✅ Solution 2: Set Up HTTPS (For Network Camera Access)

#### Quick Setup with mkcert (Recommended)

1. **Install mkcert:**
   ```bash
   # On Mac
   brew install mkcert
   
   # Create local CA
   mkcert -install
   ```

2. **Generate certificate:**
   ```bash
   cd /Users/preethamreddy/Downloads/puttu
   mkcert localhost 192.168.1.180
   ```
   
   This creates:
   - `localhost+1.pem` (certificate)
   - `localhost+1-key.pem` (private key)

3. **Update Vite config** (`vite.config.ts`):
   ```typescript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import fs from 'fs';
   import path from 'path';

   export default defineConfig({
     plugins: [react()],
     server: {
       host: '0.0.0.0',
       port: 5173,
       https: {
         key: fs.readFileSync(path.resolve(__dirname, 'localhost+1-key.pem')),
         cert: fs.readFileSync(path.resolve(__dirname, 'localhost+1.pem')),
       },
     },
   });
   ```

4. **Restart Vite:**
   ```bash
   npm run dev
   ```

5. **Access via HTTPS:**
   - Server laptop: `https://localhost:5173`
   - Other devices: `https://192.168.1.180:5173`
   - Accept the security warning (it's a self-signed certificate)

### ✅ Solution 3: Use ngrok (Temporary HTTPS Tunnel)

1. **Install ngrok:**
   ```bash
   brew install ngrok
   # Or download from https://ngrok.com
   ```

2. **Create tunnel:**
   ```bash
   ngrok http 5173
   ```

3. **Use the HTTPS URL provided by ngrok** (e.g., `https://abc123.ngrok.io`)

### ✅ Solution 4: Browser-Specific Workarounds

#### Chrome/Edge:
1. Open: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Add: `http://192.168.1.180:5173`
3. Enable the flag
4. Restart browser

**⚠️ Warning:** This reduces security. Only use for development.

#### Firefox:
1. Open: `about:config`
2. Search: `media.getusermedia.insecure.enabled`
3. Set to: `true`
4. Restart browser

**⚠️ Warning:** This reduces security. Only use for development.

## Recommended Approach

**For Production/Real Use:**
- Use **Solution 1**: Take attendance on the server laptop
- Other devices can view/manage data via network

**For Development:**
- Use **Solution 2** (mkcert) for proper HTTPS setup
- Or use **Solution 1** for simplicity

## Current Status

✅ **Fixed:** Better error messages when camera access fails
✅ **Fixed:** Clear instructions on why camera doesn't work over HTTP

The app will now show a helpful error message explaining why camera access failed and what to do.

