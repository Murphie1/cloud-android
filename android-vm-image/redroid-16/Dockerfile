# Use a Redroid base image for ARM64 (Ampere)
# We'll use Android 14 for consistency, but you can choose any version Redroid supports.
# The 'aosp-arm64' tag ensures it's built for ARM64 architecture.
FROM redroid/redroid:16.0.0-latest

USER root

# Redroid images usually come with essential Android tools (like adb).
# However, we still need to ensure scrcpy dependencies are met.
# Some build dependencies might be slightly different for ARM64/Alpine-based Redroid images
# so we'll adapt the install commands.
# Redroid images are typically based on Alpine Linux, not Debian/Ubuntu,
# so we use 'apk' instead of 'apt-get'.

# Install required tools for scrcpy and ws-scrcpy
# Note: Alpine uses 'apk add' and package names might differ slightly.
# 'build-base' provides essential build tools like gcc, g++, make.
# 'meson' and 'ninja' are usually separate packages.
RUN apk update && apk add --no-cache \
  git curl unzip ffmpeg build-base meson ninja \
  sdl2-dev pkgconf libusb-dev \
  ffmpeg-dev # This combines all the libav*dev packages


# Android SDK Tools: Redroid usually has platform-tools pre-installed or easily accessible.
# We'll remove the extensive SDK manager download as it's often not needed.
# If you still need specific SDK components later, you might add them.
# For now, let's assume 'adb' and 'fastboot' are part of the base Redroid image.
# ENV ANDROID_HOME=/opt/android-sdk # No longer strictly necessary if adb is in PATH
# ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools # Already handled by Redroid base

# Build scrcpy
ARG SCRCPY_VER=3.3.1
ARG SERVER_HASH="a0f70b20aa4998fbf658c94118cd6c8dab6abbb0647a3bdab344d70bc1ebcbb8"

# Redroid containers already have adb running within them to connect to the Android instance.
# So, no need for the server download, as scrcpy client will connect via host adb.
# However, we might still need the server binary if we plan to manually start it within the container.
# For simplicity, let's assume scrcpy will connect to the redroid instance.
# We will still build scrcpy for the client part to be used, if desired.

# For scrcpy client to connect to Redroid, Redroid's adb server needs to be running.
# The `redroid/redroid` images typically start adb automatically.

# Note: The prebuilt server for scrcpy is for the Android device. Since Redroid *is* the Android device,
# it handles its own internal adb server. The scrcpy client built here will connect to the Redroid instance
# *as if* it were a physical device or emulator.

# Let's adjust the scrcpy build part. We still want to build the scrcpy *client* if you intend to run it
# directly within this Docker container to connect to the Redroid instance.
# If you plan to run scrcpy on your host machine to connect to theroid container,
# then you might not even need to build scrcpy here.
# For a full self-contained solution, building scrcpy is good.

RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy && \
    cd /opt/scrcpy && \
    # Remove the prebuilt_server arg, as we're building the client here.
    # The scrcpy client will then connect to the running Redroid instance's ADB.
    meson setup build \
        --buildtype release \
        --strip \
        -Db_lto=true && \
    meson compile -C build && \
    meson install -C build

# Add ws-scrcpy
RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy

# Redroid containers typically start the Android system as their CMD/ENTRYPOINT.
# If you want to run supervisord, you'll need to run Redroid's entrypoint in the background
# or manage it through supervisord.
# For Redroid, the primary purpose is the Android instance itself.
# Your `start-scrcpy.sh` and `supervisord.conf` need to be adjusted to manage scrcpy/ws-scrcpy
# alongside the Redroid's Android instance, not replace it.

# Keep these if you want to run scrcpy/ws-scrcpy *within* this same container.
# If you plan to run scrcpy/ws-scrcpy from your host and connect to the Redroid container,
# you might not need them here.
COPY start-scrcpy.sh /start-scrcpy.sh
RUN chmod +x /start-scrcpy.sh

# This supervisord setup needs to be careful not to conflict with Redroid's own startup.
# A common approach is to have supervisord start *after* Redroid's primary process.
# Alternatively, you can run Redroid in one container and your scrcpy/ws-scrcpy in another,
# linking them via the network. For a single container, we need to adapt.
# For simplicity, let's assume the primary purpose of this container is Redroid,
# and scrcpy/ws-scrcpy are secondary processes that connect to it.

# Adjust supervisord.conf: You'll need to ensure Redroid's own Android process is running.
# This often means either running Redroid's default ENTRYPOINT/CMD in the background
# or having supervisord manage it. This can be tricky.
# A simpler approach is to use a `start.sh` that calls Redroid's entrypoint, then supervisord.
# Or, even better, just run the Redroid image directly and then run a separate container
# for ws-scrcpy that connects to the Redroid container via its ADB port.

# For a single container, let's override the CMD, but we need to ensure Redroid starts.
# Redroid's default CMD is usually `/entrypoint.sh` or similar, which starts the Android system.
# We'll need a custom entrypoint that first starts Android, then supervisord.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 5555 5900
# Change the CMD to our custom entrypoint
CMD ["/entrypoint.sh"]
