FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install all system dependencies with required X11 libraries
RUN apt-get update && apt-get install -y \
  wget unzip curl git \
  build-essential ninja-build meson cmake pkg-config \
  libavcodec-dev libavformat-dev libavutil-dev libavdevice-dev libswscale-dev libavfilter-dev \
  libusb-1.0-0-dev libsdl2-dev \
  tigervnc-standalone-server xfce4 x11vnc \
  qemu-system-x86 net-tools supervisor ffmpeg \
  openjdk-17-jdk \
  adb \
  # Add missing X11 development libraries
  libxcursor-dev \
  libxinerama-dev \
  libxrandr-dev \
  libxi-dev \
  && apt-get clean

# -------------------------
# Android SDK Setup
# -------------------------

# Install command line tools
RUN mkdir -p /opt/android-sdk/cmdline-tools && \
    cd /opt/android-sdk && \
    wget https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip -O cmdline-tools.zip && \
    unzip cmdline-tools.zip -d cmdline-tools && \
    mv cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest && \
    rm cmdline-tools.zip

# Set Android SDK environment variables
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# Accept licenses and install required SDK packages (updated to 34.0.0)
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools" "build-tools;34.0.0" "platforms;android-34"

# -------------------------
# scrcpy build
# -------------------------

# Clone and build scrcpy with fixed JAVA_HOME
RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy && \
    echo "sdk.dir=$ANDROID_HOME" > /opt/scrcpy/local.properties && \
    cd /opt/scrcpy && \
    # Explicitly set JAVA_HOME to OpenJDK 17 location
    export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which javac)))) && \
    ./gradlew assembleDebug && \
    meson setup build --buildtype release && \
    ninja -C build && \
    ninja -C build install

# -------------------------
# ws-scrcpy (WebSocket wrapper)
# -------------------------
RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy

# -------------------------
# Android-x86 ISO
# -------------------------
RUN mkdir -p /android && \
    wget -O /android/android-x86.iso https://osdn.net/projects/android-x86/downloads/77982/android-x86_64-9.0-r2.iso/

# -------------------------
# Entrypoint + supervisor
# -------------------------
COPY start.sh /start.sh
RUN chmod +x /start.sh

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ADB and VNC
EXPOSE 5555 5900

CMD ["/usr/bin/supervisord"]
