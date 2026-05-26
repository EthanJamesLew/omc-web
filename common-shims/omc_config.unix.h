/* omc-web: hand-written stub for the autoconf-generated omc_config.unix.h.
 * Pinned values for the WebAssembly/emscripten target. Mirrors the layout
 * of upstream OMCompiler/omc_config.unix.h.in but with constant defines
 * since we don't run upstream's ./configure. */

#ifndef OPENMODELICA_CONFIG_UNIX_H
#define OPENMODELICA_CONFIG_UNIX_H

#define CONFIGURE_COMMANDLINE  "Configured for wasm32-unknown-emscripten (omc-web)"
#define CONFIG_DLL_EXT         ".wasm"
#define CONFIG_MODELICA_SPEC_PLATFORM       "wasm32"
#define CONFIG_OPENMODELICA_SPEC_PLATFORM   "wasm32-emscripten"
#define CONFIG_OPENMODELICA_SPEC_PLATFORM_ALTERNATIVE ""
#define CONFIG_TRIPLE          "wasm32-unknown-emscripten"
#define DEFAULT_CC             "emcc"
#define DEFAULT_CXX            "em++"
#define DEFAULT_OMPCC          "emcc"
#define DEFAULT_CFLAGS         "${MODELICAUSERCFLAGS}"
#define CONFIG_DEFAULT_OPENMODELICAHOME "/omc"
#define CONFIG_REVISION        "omc-web@55e1ec1"
#define CONFIG_WITH_OPENMP     0
#define WITH_SUNDIALS
#define WITH_HWLOC             0
#define WITH_DASSL
#define USE_GRAPH              0
#define USE_PATOH              0
#define USE_METIS              0

#endif /* OPENMODELICA_CONFIG_UNIX_H */
