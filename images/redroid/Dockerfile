# Scrcpy + ws-scrcpy + NodeJS agent
FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
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
    # NodeJS 20.x LTS
    ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Android SDK (platform-tools only)
RUN mkdir -p /opt/android-sdk/cmdline-tools && \
    cd /opt/android-sdk && \
    wget https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip -O cmdline-tools.zip && \
    unzip cmdline-tools.zip -d cmdline-tools && \
    mv cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest && \
    rm cmdline-tools.zip

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN yes | sdkmanager --licenses && sdkmanager "platform-tools"

# Install scrcpy with prebuilt server
ARG SCRCPY_VER=3.3.1
ARG SERVER_HASH="a0f70b20aa4998fbf658c94118cd6c8dab6abbb0647a3bdab344d70bc1ebcbb8"

RUN curl -L -o /scrcpy-server \
    https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VER}/scrcpy-server-v${SCRCPY_VER} && \
    echo "${SERVER_HASH}  /scrcpy-server" | sha256sum -c -

RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy && \
    cd /opt/scrcpy && \
    meson setup build \
        --buildtype release \
        --strip \
        -Db_lto=true \
        -Dprebuilt_server=/scrcpy-server && \
    meson compile -C build && \
    meson install -C build

# Add ws-scrcpy
RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy

WORKDIR /opt/pod-agent
COPY agent.js /opt/pod-agent/agent.js
RUN npm init -y && npm install ws

# Entrypoint config
COPY start-scrcpy.sh /start-scrcpy.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x /start-scrcpy.sh

EXPOSE 5555 5900 8080 8081
CMD ["/usr/bin/supervisord"]
