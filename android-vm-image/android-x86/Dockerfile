FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install all system dependencies
RUN apt-get update && apt-get install -y \
  wget unzip curl git \
  build-essential ninja-build meson cmake pkg-config \
  libavcodec-dev libavformat-dev libavutil-dev libavdevice-dev libswscale-dev libavfilter-dev \
  libusb-1.0-0-dev libsdl2-dev \
  tigervnc-standalone-server xfce4 x11vnc \
  qemu-system-x86 net-tools supervisor ffmpeg \
  openjdk-17-jdk \
  adb \
  libxcursor-dev \
  libxinerama-dev \
  libxrandr-dev \
  libxi-dev \
  && apt-get clean

# -------------------------
# Android SDK Setup (simplified)
# -------------------------
RUN mkdir -p /opt/android-sdk/cmdline-tools && \
    cd /opt/android-sdk && \
    wget https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip -O cmdline-tools.zip && \
    unzip cmdline-tools.zip -d cmdline-tools && \
    mv cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest && \
    rm cmdline-tools.zip

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Only install essential packages (remove build-tools)
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools"

# -------------------------
# scrcpy build (fixed using official method)
# -------------------------
ARG SCRCPY_VER=3.3.1
ARG SERVER_HASH="a0f70b20aa4998fbf658c94118cd6c8dab6abbb0647a3bdab344d70bc1ebcbb8"

# Download prebuilt server binary
RUN curl -L -o /scrcpy-server \
    https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VER}/scrcpy-server-v${SCRCPY_VER} && \
    echo "${SERVER_HASH}  /scrcpy-server" | sha256sum -c -

# Build client only with prebuilt server
RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy && \
    cd /opt/scrcpy && \
    meson setup build \
        --buildtype release \
        --strip \
        -Db_lto=true \
        -Dprebuilt_server=/scrcpy-server && \
    meson compile -C build && \
    meson install -C build

# -------------------------
# ws-scrcpy (WebSocket wrapper)
# -------------------------
RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy

# -------------------------
# Android-x86 ISO
# -------------------------
RUN mkdir -p /android && \
     wget -O /android/android-x86.iso \
     https://downloads.sourceforge.net/project/android-x86/Release%209.0/android-x86_64-9.0-r2.iso
# -------------------------
# Entrypoint + supervisor
# -------------------------
COPY start.sh /start.sh
RUN chmod +x /start.sh

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 5555 5900
CMD ["/usr/bin/supervisord"]
