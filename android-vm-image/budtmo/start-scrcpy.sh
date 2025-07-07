#!/bin/bash

# Wait for Android emulator to be ready
adb wait-for-device

# Restart ADB in TCP mode
adb tcpip 5555
adb connect 127.0.0.1:5555

# Start scrcpy headlessly over ws-scrcpy
/opt/ws-scrcpy/run-scrcpy-server.sh \
  --bit-rate 2M \
  --max-size 1280 \
  --always-on-top \
  --tcpip 127.0.0.1:5555 \
  --port 8080
