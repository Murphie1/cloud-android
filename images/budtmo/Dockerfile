FROM budtmo/docker-android:emulator_14.0

USER root

# Install required tools for scrcpy and ws-scrcpy
RUN apt-get update && apt-get install -y \
  git curl unzip ffmpeg build-essential meson ninja-build \
  libsdl2-dev pkg-config libusb-1.0-0-dev \
  libavcodec-dev libavformat-dev libavutil-dev libavdevice-dev libswscale-dev libavfilter-dev
  # NodeJS 20.x LTS
    ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Android SDK tools if not already included
RUN mkdir -p /opt/android-sdk/cmdline-tools && \
    cd /opt/android-sdk && \
    wget https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip -O cmdline-tools.zip && \
    unzip cmdline-tools.zip -d cmdline-tools && \
    mv cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest && \
    rm cmdline-tools.zip

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools"

# Build scrcpy
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

COPY start-scrcpy.sh /start-scrcpy.sh
RUN chmod +x /start-scrcpy.sh

# -------------------------
# WebSocket Agent (new, TypeScript)
# -------------------------
WORKDIR /opt/pod-agent

# Copy only what we need first (for cache efficiency)
COPY package*.json tsconfig.json /opt/pod-agent/

# Install deps (including TS + Fastify)
RUN npm install --production=false \
    && npm install typescript ts-node @types/node --save-dev \
    && npm install fastify @fastify/websocket ws

# Copy source
COPY server.ts /opt/pod-agent/

# Build to dist/
RUN npx tsc

# Remove dev deps to slim image
RUN npm prune --production

# Default run points to built JS
#CMD ["node", "dist/server.js"]



COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 5555 5900 8080 3000
CMD ["/usr/bin/supervisord"]
