# Stage 1: Build scrcpy in Debian (glibc compatible)
FROM debian:12-slim AS scrcpy-builder

RUN apt-get update && apt-get install -y \
    git curl meson ninja-build build-essential \
    libsdl2-dev pkg-config libusb-1.0-0-dev \
    ffmpeg libavcodec-dev libavformat-dev libavutil-dev \
    openjdk-17-jdk

ARG SCRCPY_VER=3.3.1
ARG SERVER_HASH="a0f70b20aa4998fbf658c94118cd6c8dab6abbb0647a3bdab344d70bc1ebcbb8"

# Download prebuilt server
RUN curl -L -o /scrcpy-server \
    https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VER}/scrcpy-server-v${SCRCPY_VER} && \
    echo "${SERVER_HASH}  /scrcpy-server" | sha256sum -c -

# Build client
RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy --depth 1 --branch "v${SCRCPY_VER}"
WORKDIR /opt/scrcpy
RUN meson setup build \
    --buildtype=release \
    -Dprebuilt_server=/scrcpy-server \
    -Db_lto=true \
    -Dstrip=true
RUN meson compile -C build
RUN meson install -C build

# Stage 2: Build ws-scrcpy
FROM node:20-bookworm-slim AS ws-builder

RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy
WORKDIR /opt/ws-scrcpy
RUN npm install
RUN npm run build  # If build step exists

# Stage 3: Final image
FROM redroid/redroid:16.0.0-latest

# Install required dependencies
RUN apt-get update && apt-get install -y \
    supervisor \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Copy scrcpy
COPY --from=scrcpy-builder /usr/local/bin/scrcpy /usr/local/bin/scrcpy

# Copy ws-scrcpy (only necessary files)
COPY --from=ws-builder /opt/ws-scrcpy /opt/ws-scrcpy
WORKDIR /opt/ws-scrcpy
RUN npm install --omit=dev  # Install production dependencies

# Copy scripts and configs
COPY start-scrcpy.sh /start-scrcpy.sh
COPY entrypoint.sh /entrypoint.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set permissions
RUN chmod +x /start-scrcpy.sh /entrypoint.sh

EXPOSE 5555 5900
CMD ["/entrypoint.sh"]
