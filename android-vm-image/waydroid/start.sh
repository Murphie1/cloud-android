#!/bin/bash
set -e

# Start Waydroid on host
chroot /host /usr/bin/bash -c "
  systemctl start waydroid-container
  waydroid session start
  sleep 3
  adb connect 127.0.0.1:5555
"

/usr/bin/scrcpy --serial 127.0.0.1:5555 --tcpip=127.0.0.1 --port=8080
