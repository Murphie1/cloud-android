#!/bin/bash

# Retry until ReDroid ADB is ready
until adb connect android:5555; do
  echo "🕒 Waiting for redroid at android:5555..."
  sleep 2
done

# Start ws-scrcpy WebSocket stream
exec /opt/ws-scrcpy/run-scrcpy-server.sh \
  --bit-rate 2M \
  --max-size 1280 \
  --always-on-top \
  --tcpip android:5555 \
  --port 8080
