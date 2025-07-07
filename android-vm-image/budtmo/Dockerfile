FROM budtmo/docker-android-x86-14.0

USER root

# Install required tools for scrcpy and ws-scrcpy
RUN apt-get update && apt-get install -y \
  git curl unzip ffmpeg build-essential meson ninja-build \
  libsdl2-dev pkg-config libusb-1.0-0-dev \
  libavcodec-dev libavformat-dev libavutil-dev libavdevice-dev libswscale-dev libavfilter-dev

# Install Android SDK tools if not already included
RUN mkdir -p /opt/android-sdk/cmdline-tools && \
    cd /opt/android-sdk && \
    wget https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip -O cmdline-tools.zip && \
    unzip cmdline-tools.zip -d cmdline-tools && \
    mv cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest && \
    rm cmdline-tools.zip

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools"

# Build scrcpy
ARG SCRCPY_VER=3.3.1
ARG SERVER_HASH="a0f70b20aa4998fbf658c94118cd6c8dab6abbb0647a3bdab344d70bc1ebcbb8"

RUN curl -L -o /scrcpy-server \
    https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VER}/scrcpy-server-v${SCRCPY_VER} && \
    echo "${SERVER_HASH}  /scrcpy-server" | sha256sum -c -

RUN git clone https://github.com/Genymobile/scrcpy.git /opt/scrcpy && \
    cd /opt/scrcpy && \
    meson setup build \
        --buildtype release \
        --strip \
        -Db_lto=true \
        -Dprebuilt_server=/scrcpy-server && \
    meson compile -C build && \
    meson install -C build

# Add ws-scrcpy
RUN git clone https://github.com/NetrisTV/ws-scrcpy.git /opt/ws-scrcpy

COPY start-scrcpy.sh /start-scrcpy.sh
RUN chmod +x /start-scrcpy.sh

EXPOSE 5555 8080
CMD ["/start-scrcpy.sh"]
