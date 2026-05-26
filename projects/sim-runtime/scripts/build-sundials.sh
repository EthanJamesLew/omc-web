#!/usr/bin/env bash
# Build sundials 5.4.0 as wasm static archives. CVODE, IDA(S), KINSOL.
# LAPACK + KLU sundials/<solver>/* tightly bound to our prebuilt
# liblapack/libomcss; configure must be told their paths.
#
# Output: $BUILD_DIR/deps/sundials/install/lib/lib{sundials_cvode,…,
#         sundials_sunlinsol*,sundials_sunmatrix*,sundials_sunnonlinsol*,
#         sundials_generic}.a + headers under .../install/include/.
set -euo pipefail

. "${EMSDK_DIR:?EMSDK_DIR must point to an emsdk dir with 3.1.24 active}/emsdk_env.sh" > /dev/null 2>&1

SRC="$THIRDPARTY/sundials-5.4.0"
B="$BUILD_DIR/deps/sundials"
INSTALL="$B/install"
LAPACK="$BUILD_DIR/deps/lapack/install"
SS="$BUILD_DIR/deps/suitesparse/install"
mkdir -p "$B" "$BUILD_DIR/logs"
LOG="$BUILD_DIR/logs/build-sundials.log"
: > "$LOG"

emcmake cmake -S "$SRC" -B "$B/cmake" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$INSTALL" \
  -DCMAKE_INSTALL_LIBDIR=lib \
  -DCMAKE_INSTALL_INCLUDEDIR=include \
  -DBUILD_SHARED_LIBS=OFF \
  -DSUNDIALS_BUILD_STATIC_LIBS=ON \
  -DSUNDIALS_BUILD_SHARED_LIBS=OFF \
  -DBUILD_ARKODE=OFF -DBUILD_CVODE=ON -DBUILD_CVODES=OFF \
  -DBUILD_IDA=ON -DBUILD_IDAS=ON -DBUILD_KINSOL=ON \
  -DEXAMPLES_ENABLE_C=OFF -DEXAMPLES_ENABLE_CXX=OFF -DEXAMPLES_INSTALL=OFF \
  -DSUNDIALS_EXAMPLES_ENABLE_C=OFF -DSUNDIALS_EXAMPLES_ENABLE_CXX=OFF \
  -DBUILD_TESTING=OFF -DSUNDIALS_TEST_INSTALL=OFF \
  -DSUNDIALS_MPI_ENABLE=OFF -DSUNDIALS_OPENMP_ENABLE=OFF \
  -DSUNDIALS_PTHREAD_ENABLE=OFF -DCUDA_ENABLE=OFF \
  -DSUNDIALS_LAPACK_ENABLE=ON \
  -DLAPACK_LIBRARIES="$LAPACK/lib/liblapack.a;$LAPACK/lib/libblas.a" \
  -DBLAS_LIBRARIES="$LAPACK/lib/libblas.a" \
  -DBLA_VENDOR=Generic \
  -DSUNDIALS_F77_FUNC_CASE=LOWER \
  -DSUNDIALS_F77_FUNC_UNDERSCORES=ONE \
  -DSUNDIALS_KLU_ENABLE=ON \
  -DKLU_INCLUDE_DIR="$SS/include/suitesparse" \
  -DSUNDIALS_KLU_LIBRARY_DIR="$SS/lib" \
  -DKLU_LIBRARY="$SS/lib/libklu.a" \
  -DAMD_LIBRARY="$SS/lib/libamd.a" \
  -DBTF_LIBRARY="$SS/lib/libbtf.a" \
  -DCOLAMD_LIBRARY="$SS/lib/libcolamd.a" \
  -DSUITESPARSECONFIG_LIBRARY="$SS/lib/libsuitesparseconfig.a" \
  -DSUNDIALS_SUPERLUMT_ENABLE=OFF -DSUPERLUDIST_ENABLE=OFF \
  -DPETSC_ENABLE=OFF -DHYPRE_ENABLE=OFF -DRAJA_ENABLE=OFF \
  -DSUNDIALS_INDEX_SIZE=32 -DSUNDIALS_INDEX_TYPE=int32_t \
  -DSUNDIALS_PRECISION=DOUBLE \
  -DHAS_int32_t=4 -DHAS_int=4 -DHAS_long=4 \
  -DUSE_GENERIC_MATH=ON \
  -DF77_INTERFACE_ENABLE=OFF -DF2003_INTERFACE_ENABLE=OFF \
  >>"$LOG" 2>&1

echo "[sundials] configured; building..."
emmake cmake --build "$B/cmake" -j"$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)" >>"$LOG" 2>&1
cmake --install "$B/cmake" >>"$LOG" 2>&1

echo "[sundials] artifacts:"
ls "$INSTALL/lib"/*.a | wc -l
