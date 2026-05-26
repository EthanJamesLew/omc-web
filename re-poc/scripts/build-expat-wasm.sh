#!/usr/bin/env bash
# Build expat 2.1.0 (XML parser) as a wasm static archive. OMC's
# simulation_input_xml.c uses it to read the <Model>_init.xml emitted
# by CodegenC. Sources are bundled under FMIL/ThirdParty/Expat.
set -uo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

EXPAT_SRC="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}/FMIL/ThirdParty/Expat/expat-2.1.0"
B=build/deps/expat
INSTALL="$B/install"
mkdir -p "$B/objs" "$INSTALL/lib" "$INSTALL/include"

CFLAGS=(-O2 -w -DHAVE_EXPAT_CONFIG_H=1)
INCS=(-I "$(pwd)/src" -I "$EXPAT_SRC/lib")

emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$EXPAT_SRC/lib/xmlparse.c" -o "$B/objs/xmlparse.o" 2>>build/build-expat-wasm.log
emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$EXPAT_SRC/lib/xmlrole.c"  -o "$B/objs/xmlrole.o"  2>>build/build-expat-wasm.log
emcc -c "${CFLAGS[@]}" "${INCS[@]}" "$EXPAT_SRC/lib/xmltok.c"   -o "$B/objs/xmltok.o"   2>>build/build-expat-wasm.log

emar rcs "$INSTALL/lib/libexpat.a" "$B/objs"/*.o
cp "$EXPAT_SRC/lib"/{expat.h,expat_external.h} "$INSTALL/include/"
ls -la "$INSTALL/lib/libexpat.a" 2>&1
