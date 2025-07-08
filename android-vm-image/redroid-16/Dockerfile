# Dedicated scrcpy container with all required tools
FROM debian:12-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    supervisor \
    nodejs \
    npm \
    adb \
    git \
    meson \
    build-essential \
    libsdl2-dev \
    pkg-config \
    libusb-1.0-0-dev \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    && rm -rf /var/lib/apt/lists/*

# Install scrcpy
ARG SCRCPY_VER=3.3.1
RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy --depth 1 --branch "v${SCRCPY_VER}"
WORKDIR /opt/scrcpy
RUN meson setup build \
    --buildtype=release \
    -Db_lto=true \
    -Dstrip=true
RUN meson compile -C build
RUN meson install -C build

# Install ws-scrcpy
RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy
WORKDIR /opt/ws-scrcpy
RUN npm install

# Configure supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY start-scrcpy.sh /start-scrcpy.sh
RUN chmod +x /start-scrcpy.sh

EXPOSE 5900 8080
CMD ["/usr/bin/supervisord"]
