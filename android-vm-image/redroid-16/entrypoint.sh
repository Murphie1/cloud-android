#!/bin/bash

# Start the Redroid Android system in the background
# This might vary based on the specific Redroid image's internal entrypoint.
# A common pattern for Redroid is that simply running the container will start Android.
# We'll assume the base Redroid image handles the Android startup.
# If not, you might need to find Redroid's actual startup command (e.g., /usr/bin/redroid_run).
# For most redroid images, simply running the container does the trick.

# You might need to wait for adb to be ready before starting supervisord processes.
/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
