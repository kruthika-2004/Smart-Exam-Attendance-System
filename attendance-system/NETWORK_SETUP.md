# Network Setup Guide - Using FaceXam on Multiple Devices

## Overview
FaceXam runs in two parts:
1. **Frontend (Vite Dev Server)**: Port 5173 - The web interface
2. **Backend (API Server)**: Port 3001 - The database server

## Step 1: Find Your Server Laptop's IP Address

### On Mac/Linux:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```
Or:
```bash
ipconfig getifaddr en0
```

### On Windows:
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**Example IP:** `192.168.1.100` or `10.0.0.5`

## Step 2: Start the Servers on Your Main Laptop

Make sure both servers are running:

```bash
# Terminal 1: Start the backend API server
npm run server

# Terminal 2: Start the frontend dev server
npm run dev
```

You should see:
- Backend: `🚀 FaceXam Server running on port 3001`
- Frontend: `Local: http://localhost:5173/`

## Step 3: Access from Another Laptop

### Option A: Access Frontend on Another Laptop

1. **Make sure both laptops are on the same Wi-Fi network**

2. **On the other laptop, open a web browser and go to:**
   ```
   http://[YOUR_IP_ADDRESS]:5173
   ```
   
   Example: `http://192.168.1.100:5173`

3. **The frontend will load, but you need to connect to the backend server**

### Option B: Connect to Backend Server

1. **In the FaceXam app (on the other laptop), go to:**
   - Admin Dashboard → Settings
   - Find "Network Server Settings"

2. **Enter the backend server URL:**
   ```
   http://[YOUR_IP_ADDRESS]:3001
   ```
   
   Example: `http://192.168.1.100:3001`

3. **Click "Connect to Server"**

4. **Once connected, all devices will share the same database!**

## Step 4: Verify Connection

### Check if servers are accessible:

**From another laptop, test the backend:**
```bash
curl http://[YOUR_IP]:3001/api/health
```

**Or open in browser:**
```
http://[YOUR_IP]:3001/api/health
```

You should see:
```json
{
  "status": "ok",
  "message": "FaceXam Server is running"
}
```

## Troubleshooting

### "Cannot connect to server"
1. **Check firewall**: Make sure ports 3001 and 5173 are not blocked
2. **Check network**: Both devices must be on the same network
3. **Check IP address**: Use `ifconfig` or `ipconfig` to verify
4. **Check servers are running**: Both `npm run server` and `npm run dev` must be running

### "Cannot GET /" on port 3001
- This is normal! Port 3001 is an API server, not a web page
- Access the frontend on port 5173 instead
- Or use the API endpoints like `/api/health`

### Firewall Settings

**On Mac:**
```bash
# Allow incoming connections on ports 3001 and 5173
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/bin/node
```

**On Windows:**
- Go to Windows Firewall → Advanced Settings
- Add inbound rules for ports 3001 and 5173

**On Linux:**
```bash
sudo ufw allow 3001
sudo ufw allow 5173
```

## Quick Reference

| Component | Port | URL |
|-----------|------|-----|
| Frontend | 5173 | `http://[IP]:5173` |
| Backend API | 3001 | `http://[IP]:3001` |
| Health Check | 3001 | `http://[IP]:3001/api/health` |
| Server Info | 3001 | `http://[IP]:3001/api/info` |

## Example Workflow

1. **Main Laptop (Server):**
   - IP: `192.168.1.100`
   - Running: `npm run server` and `npm run dev`

2. **Other Laptop:**
   - Open browser: `http://192.168.1.100:5173`
   - Login to FaceXam
   - Go to Settings → Network Server Settings
   - Enter: `http://192.168.1.100:3001`
   - Click "Connect to Server"
   - ✅ Now sharing the same database!

## Important Notes

- **Data Persistence**: When connected to the server, all data is stored in `server/facexam.db` on the main laptop
- **Offline Mode**: If the server is not available, the app falls back to local IndexedDB
- **Multiple Devices**: All devices connected to the same server share the same data in real-time

