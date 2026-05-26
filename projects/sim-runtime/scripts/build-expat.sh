#!/usr/bin/env bash
# Build expat 2.1.0 (XML parser) as a wasm static archive. OMC's
# simulation_input_xml.c uses it to read the <Model>_init.xml emitted
# by CodegenC. Sources are bundled under FMIL/ThirdParty/Expat.
set -uo pipefail

. "${EMSDK_DIR:?EMSDK_DIR must point to an emsdk dir with 3.1.24 active}/emsdk_env.sh" > /dev/null 2>&1

EXPAT_SRC="$THIRDPARTY/FMIL/ThirdParty/Expat/expat-2.1.0"
B="$BUILD_DIR/deps/expat"
INSTALL="$B/install"
mkdir -p "$B/objs" "$INSTALL/lib" "$INSTALL/include" "$BUILD_DIR/logs"
LOG="$BUILD_DIR/logs/build-expat.log"
: > "$LOG"

CFLAGS=(-O2 -w -DHAVE_EXPAT_CONFIG_H=1)
INCS=(-I "$SHIMS_DIR" -I "$EXPAT_SRC/lib")

for u in xmlparse xmlrole xmltok; do
  emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$EXPAT_SRC/lib/${u}.c" -o "$B/objs/${u}.o" 2>>"$LOG"
done

emar rcs "$INSTALL/lib/libexpat.a" "$B/objs"/*.o
cp "$EXPAT_SRC/lib"/{expat.h,expat_external.h} "$INSTALL/include/"
ls -la "$INSTALL/lib/libexpat.a"
