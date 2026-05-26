# docker/Dockerfile — omc-web build environment.
#
# Bakes in everything heavy:
#   - emsdk 3.1.24 + 3.1.74 (both versions, side-by-side under /opt/emsdk/)
#   - python3, brotli, node, ccache, zip, openjdk (ANTLR3 tool),
#     cmake, make, git
# The repo is bind-mounted at /work (via compose). `make all` inside the
# container is the source of truth for a clean build.
#
# Native OMC for reference regeneration lives in a SEPARATE image,
# docker/Dockerfile.native-omc — kept separate so the everyday build
# image stays under ~2 GB.

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential ca-certificates ccache cmake curl git \
      brotli openjdk-17-jre-headless make nodejs npm python3 \
      python3-pip unzip xz-utils zip \
    && rm -rf /var/lib/apt/lists/*

# Install both emsdks under /opt/emsdk/.
ENV EMSDK_ROOT=/opt/emsdk
RUN git clone --depth 1 https://github.com/emscripten-core/emsdk.git $EMSDK_ROOT
RUN cd $EMSDK_ROOT && ./emsdk install 3.1.24 && ./emsdk install 3.1.74

# Per-project emsdk activation: scripts source $EMSDK_DIR/emsdk_env.sh.
# Default is the older 3.1.24 (used by sim-runtime); omc-wasm's Makefile
# overrides EMSDK_DIR to point at 3.1.74's install. Both live under
# /opt/emsdk/upstream/* — we symlink per-version installs.
RUN ln -sf $EMSDK_ROOT /opt/emsdk-3.1.24 \
    && ln -sf $EMSDK_ROOT /opt/emsdk-3.1.74

# Allow non-root user writes to /work (compose mounts repo here).
WORKDIR /work

# Make the active emsdk default to 3.1.24 for shell sessions.
RUN cd $EMSDK_ROOT && ./emsdk activate 3.1.24
ENV PATH=/opt/emsdk/upstream/emscripten:/opt/emsdk:/opt/emsdk/node/current/bin:$PATH
ENV EMSDK_DIR=/opt/emsdk

CMD ["bash"]
