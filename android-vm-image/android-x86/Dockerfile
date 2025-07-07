FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies (QEMU, Android tools, scrcpy deps, etc.)
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
  ffmpeg \
  meson \
  cmake \
  ninja-build \
  pkg-config \
  git \
  build-essential \
  libavcodec-dev \
  libavformat-dev \
  libavutil-dev \
  libavdevice-dev \
  libswscale-dev \
  libavfilter-dev \
  libusb-1.0-0-dev \
  libsdl2-dev \
  openjdk-17-jdk \
  gradle \
  adb \
  && apt-get clean

# Set JAVA_HOME for Java 17
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

# Clone and build scrcpy
RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy && \
    cd /opt/scrcpy && \
    ./gradlew assembleDebug && \
    meson setup build --buildtype release && \
    ninja -C build && \
    ninja -C build install

# Clone ws-scrcpy
RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy

# Download Android-x86 ISO
RUN mkdir -p /android && \
    wget -O /android/android-x86.iso https://osdn.net/projects/android-x86/downloads/77982/android-x86_64-9.0-r2.iso/

# Copy startup script and supervisor config
COPY start.sh /start.sh
RUN chmod +x /start.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ADB and VNC ports
EXPOSE 5555 5900

# Start supervisor on container boot
CMD ["/usr/bin/supervisord"]
