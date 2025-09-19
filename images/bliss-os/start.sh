#!/bin/bash
# Boot Bliss OS in QEMU

qemu-system-x86_64 \
  -enable-kvm \
  -m 2048 \
  -smp 2 \
  -hda /data/bliss.img \
  -cdrom /opt/bliss.iso \
  -boot d \
  -net nic -net user,hostfwd=tcp::5555-:5555 \
  -vnc :0 \
  -no-reboot
