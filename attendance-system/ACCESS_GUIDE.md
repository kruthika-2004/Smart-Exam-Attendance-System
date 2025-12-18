# How to Access FaceXam Website

## Understanding the URLs

### On the Server Laptop (Main Machine)
- **Localhost URL**: `http://localhost:5173` ✅
- **Network IP URL**: `http://192.168.29.44:5173` (may not work from same machine)

### On Other Laptops/Devices
- **Network IP URL**: `http://192.168.29.44:5173` ✅
- **Localhost URL**: `http://localhost:5173` ❌ (This won't work - it refers to the other device, not the server)

## Quick Access Guide

### Scenario 1: You're on the Server Laptop
```
Open browser → http://localhost:5173
```

### Scenario 2: You're on Another Laptop/Device
```
Open browser → http://192.168.29.44:5173
```

## Why This Happens

- **localhost** always refers to the current device you're using
- **192.168.29.44** is the actual network address of your server laptop
- When you're on another device, you need to use the server's network IP to reach it

## Troubleshooting

### "Can't access from other laptop"
1. ✅ Make sure both devices are on the same Wi-Fi network
2. ✅ Make sure the server is running: `npm run dev`
3. ✅ Check firewall isn't blocking port 5173
4. ✅ Try accessing: `http://192.168.29.44:5173/api/health` (should show server info)

### "Can't access from server laptop"
- Use `http://localhost:5173` instead of the network IP
- The network IP is for OTHER devices to connect

## Summary

| Your Location | Use This URL |
|---------------|--------------|
| Server Laptop | `http://localhost:5173` |
| Other Device | `http://192.168.29.44:5173` |

Both URLs point to the same server, but you use different ones depending on which device you're on!

