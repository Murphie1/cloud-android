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

RUN chmod +x /start.sh

CMD ["/usr/bin/supervisord"]
