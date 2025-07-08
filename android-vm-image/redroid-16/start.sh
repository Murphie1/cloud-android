#!/bin/bash

# Wait for the Android emulator to boot
echo "⏳ Waiting for device..."
adb wait-for-device

# Optionally restart ADB in TCP mode (already done by budtmo usually)
adb tcpip 5555
adb connect 127.0.0.1:5555

# Start ws-scrcpy server
echo "🚀 Starting ws-scrcpy..."
/opt/ws-scrcpy/run-scrcpy-server.sh \
  --bit-rate 2M \
  --max-size 1280 \
  --always-on-top \
  --tcpip 127.0.0.1:5555 \
  --port 8080
