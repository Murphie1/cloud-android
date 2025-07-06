FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && apt install -y \
    adb \
    curl \
    supervisor \
    socat \
    net-tools \
    iputils-ping \
    scrcpy \
    && apt clean

COPY start.sh /start.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x /start.sh

CMD ["/usr/bin/supervisord"]
