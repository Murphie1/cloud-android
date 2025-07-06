#!/bin/bash

qemu-system-x86_64 \
  -enable-kvm \
  -m 2048 \
  -smp 2 \
  -cdrom /opt/aosp.iso \
  -net nic -net user,hostfwd=tcp::5555-:5555 \
  -vnc :0 \
  -boot d \
  -no-reboot
