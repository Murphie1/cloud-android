FROM ubuntu:22.04

RUN apt update && apt install -y \
  waydroid \
  adb \
  socat \
  curl \
  supervisor

COPY start.sh /start.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x /start.sh

CMD ["/usr/bin/supervisord"]
