FROM ubuntu:22.04

RUN apt update && apt install -y \
  qemu-system-x86 \
  adb \
  curl \
  wget \
  unzip \
  supervisor \
  socat \
  libvirt-daemon-system \
  && apt clean

COPY aosp.iso /opt/aosp.iso
COPY start.sh /start.sh
COPY start-scrcpy.sh /start-scrcpy.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chmod +x /start.sh /start-scrcpy.sh

CMD ["/usr/bin/supervisord"]
