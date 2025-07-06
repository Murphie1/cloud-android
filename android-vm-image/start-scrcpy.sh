#!/bin/bash

# Run scrcpy in headless mode and stream it
/opt/ws-scrcpy/run-scrcpy-server.sh \
  --bit-rate 2M \
  --max-size 1280 \
  --always-on-top \
  --tcpip localhost:5555 \
  --port 8080
