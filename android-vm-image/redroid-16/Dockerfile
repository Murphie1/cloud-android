# Stage 1: Build scrcpy + ws-scrcpy in Alpine
FROM alpine AS builder

RUN apk update && apk add --no-cache \
  git curl unzip ffmpeg build-base meson ninja \
  sdl2-dev pkgconf libusb-dev ffmpeg-dev

RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy && \
    cd /opt/scrcpy && \
    meson setup build --buildtype release --strip -Db_lto=true && \
    meson compile -C build && \
    meson install -C build

RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy

# Stage 2: Use the actual Redroid base
FROM redroid/redroid:16.0.0-latest

COPY --from=builder /usr/local/bin/scrcpy /usr/local/bin/scrcpy
COPY --from=builder /opt/ws-scrcpy /opt/ws-scrcpy
COPY start-scrcpy.sh /start-scrcpy.sh
COPY entrypoint.sh /entrypoint.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chmod +x /start-scrcpy.sh /entrypoint.sh

EXPOSE 5555 5900
CMD ["/entrypoint.sh"]
