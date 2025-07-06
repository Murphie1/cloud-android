#!/bin/bash
set -e

echo "[waydroid-controller] Starting Waydroid container on host..."

# Mount host and run everything in host namespace
chroot /host /usr/bin/bash -c "
  systemctl start waydroid-container || true
  sleep 2
  waydroid session start || true
  sleep 2
  adb start-server
  adb connect 127.0.0.1:5555
"

# Start WebSocket-based screen stream
echo "[waydroid-controller] Starting scrcpy WebSocket stream..."
/usr/bin/scrcpy --serial 127.0.0.1:5555 --tcpip=127.0.0.1 --port=8080
