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
    # NodeJS 20.x LTS
    ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*
    && apt clean

COPY start.sh /start.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x /start.sh

CMD ["/usr/bin/supervisord"]
