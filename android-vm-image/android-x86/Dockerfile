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

  # Add this after ADB install in Dockerfile
RUN apt-get update && apt-get install -y \
  ffmpeg \
  meson \
  ninja-build \
  libsdl2-dev \
  libavcodec-dev \
  libavformat-dev \
  libavutil-dev \
  pkg-config \
  git \
  && apt-get clean

# Install dependencies
RUN apt update && apt install -y \
  build-essential meson cmake ninja-build pkg-config \
  libavdevice-dev \
  libswscale-dev libavfilter-dev libusb-1.0-0-dev \
  libsdl2-dev openjdk-11-jdk \
  adb wget unzip \
  && apt clean

# Clone and build scrcpy
RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy && \
    cd /opt/scrcpy && \
    meson setup build --buildtype release && \
    ninja -C build && \
    ninja -C build install

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
