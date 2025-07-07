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
    
COPY aosp.iso /opt/aosp.iso
COPY start.sh /start.sh
COPY start-scrcpy.sh /start-scrcpy.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chmod +x /start.sh /start-scrcpy.sh

CMD ["/usr/bin/supervisord"]
