#!/bin/bash

adb connect localhost:5555
sleep 2
ws-scrcpy --bit-rate 6M --max-fps 30 --serial localhost:5555 --port 8080
