#!/bin/bash
# Script to fix firewall for FaceXam server

echo "🔧 Fixing firewall for FaceXam..."

# Find Node.js path
NODE_PATH=$(which node)
echo "📍 Node.js found at: $NODE_PATH"

# Add Node.js to firewall exceptions
echo "🔓 Adding Node.js to firewall exceptions..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$NODE_PATH"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$NODE_PATH"

echo "✅ Firewall configured!"
echo ""
echo "📡 Your server IP: 192.168.1.180"
echo "🌐 Access from other devices: http://192.168.1.180:5173"
echo "🔌 Backend API: http://192.168.1.180:3001"

