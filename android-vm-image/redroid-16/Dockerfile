# Scrcpy + ws-scrcpy dedicated image
FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl git supervisor adb \
    build-essential meson ninja-build \
    libsdl2-dev pkg-config libusb-1.0-0-dev \
    ffmpeg libavcodec-dev libavformat-dev libavutil-dev \
    && rm -rf /var/lib/apt/lists/*

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

# Entrypoint config
COPY start-scrcpy.sh /start-scrcpy.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x /start-scrcpy.sh

EXPOSE 5555 5900 8080
CMD ["/usr/bin/supervisord"]
