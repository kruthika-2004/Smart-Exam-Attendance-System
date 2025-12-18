# Fixing Connection Timeout Issue

## Problem
Getting `ERR_CONNECTION_TIMED_OUT` when trying to access from another laptop.

## Solution

### Step 1: Find Your Correct IP Address

Run this command on your server laptop:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Your actual IP appears to be: `192.168.1.180`** (not 192.168.29.44)

### Step 2: Fix Firewall (Mac)

**Option A: Allow Node.js through firewall**
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/bin/node
```

**Option B: Temporarily disable firewall (for testing)**
1. System Settings → Network → Firewall
2. Turn off firewall temporarily to test
3. If it works, re-enable and use Option A

**Option C: Allow specific ports**
```bash
# Allow port 5173 (frontend)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport
sudo pfctl -d  # Disable packet filter (requires admin)

# Or use a simpler approach - allow Node.js
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

### Step 3: Use the Correct IP Address

**On the other laptop, use:**
```
http://192.168.1.180:5173
```

**NOT:**
```
http://192.168.29.44:5173  ❌ (Wrong IP)
```

### Step 4: Verify Server is Running

On server laptop, check:
```bash
lsof -i :5173
```

Should show:
```
node  ...  TCP *:5173 (LISTEN)
```

### Step 5: Test Connection

From the other laptop, test:
```bash
curl http://192.168.1.180:5173
```

Or open in browser:
```
http://192.168.1.180:5173
```

## Quick Fix Commands

```bash
# 1. Find your IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# 2. Allow Node.js through firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/bin/node

# 3. Restart Vite server
# Stop current server (Ctrl+C) then:
npm run dev
```

## Alternative: Use Different Port

If firewall is too restrictive, you can change the port in `vite.config.ts`:

```typescript
server: {
  host: '0.0.0.0',
  port: 3000, // Change to 3000 or another port
}
```

Then access at: `http://192.168.1.180:3000`

