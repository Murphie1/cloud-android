#!/bin/bash

# Start virtual display
vncserver :0 -geometry 1280x720 -depth 24

# Boot Android-x86 in QEMU (headless, with ADB and VNC)
qemu-system-x86_64 \
  -m 2048 \
  -cdrom /android/android-x86.iso \
  -boot d \
  -vnc :0 \
  -enable-kvm \
  -smp 2 \
  -net nic -net user,hostfwd=tcp::5555-:5555 \
  -no-reboot \
  -serial stdio
