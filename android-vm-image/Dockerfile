FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install QEMU, ADB, VNC server and dependencies
RUN apt-get update && apt-get install -y \
  qemu-system-x86 \
  android-sdk-platform-tools \
  wget \
  unzip \
  tigervnc-standalone-server \
  xfce4 \
  x11vnc \
  net-tools \
  supervisor \
  && apt-get clean

# Download Android-x86 ISO
RUN mkdir -p /android && \
    wget -O /android/android-x86.iso https://osdn.net/projects/android-x86/downloads/77982/android-x86_64-9.0-r2.iso/

# Add entrypoint script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Supervisor config for running QEMU and VNC
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 5555 5900

CMD ["/usr/bin/supervisord"]
