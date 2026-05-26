#!/usr/bin/env bash
# Build sundials 5.4.0 as wasm static archives.
#
# Output: build/deps/sundials/install/lib/lib{sundials_cvode,sundials_ida,
#         sundials_kinsol,sundials_nvecserial,sundials_sunlinsol*,
#         sundials_sunmatrix*,sundials_sunnonlinsol*,sundials_generic}.a
# Plus headers under build/deps/sundials/install/include/.
#
# Built solvers: CVODE, IDA, KINSOL (the ones OMC's minimal runtime uses).
# Skipped: ARKODE, CVODES, IDAS (variant solvers OMC doesn't link).
# Skipped: MPI, OpenMP, CUDA, KLU/LAPACK/SuperLU/SuperLU-DIST, examples,
#          tests, fortran. All disabled by default but pin them off
#          explicitly for clarity.
set -euo pipefail

cd "$(dirname "$0")/.."
. emsdk/emsdk_env.sh > /dev/null 2>&1

THIRDPARTY="${THIRDPARTY:-/tmp/OMCompiler-3rdParty}"
SRC="$THIRDPARTY/sundials-5.4.0"
B=build/deps/sundials
INSTALL="$B/install"

mkdir -p "$B"

emcmake cmake -S "$SRC" -B "$B/cmake" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$(pwd)/$INSTALL" \
  -DCMAKE_INSTALL_LIBDIR=lib \
  -DCMAKE_INSTALL_INCLUDEDIR=include \
  -DBUILD_SHARED_LIBS=OFF \
  -DSUNDIALS_BUILD_STATIC_LIBS=ON \
  -DSUNDIALS_BUILD_SHARED_LIBS=OFF \
  -DBUILD_ARKODE=OFF \
  -DBUILD_CVODE=ON \
  -DBUILD_CVODES=OFF \
  -DBUILD_IDA=ON \
  -DBUILD_IDAS=ON \
  -DBUILD_KINSOL=ON \
  -DEXAMPLES_ENABLE_C=OFF \
  -DEXAMPLES_ENABLE_CXX=OFF \
  -DEXAMPLES_INSTALL=OFF \
  -DSUNDIALS_EXAMPLES_ENABLE_C=OFF \
  -DSUNDIALS_EXAMPLES_ENABLE_CXX=OFF \
  -DBUILD_TESTING=OFF \
  -DSUNDIALS_TEST_INSTALL=OFF \
  -DSUNDIALS_MPI_ENABLE=OFF \
  -DSUNDIALS_OPENMP_ENABLE=OFF \
  -DSUNDIALS_PTHREAD_ENABLE=OFF \
  -DCUDA_ENABLE=OFF \
  -DSUNDIALS_LAPACK_ENABLE=ON \
  -DLAPACK_LIBRARIES="$(pwd)/build/deps/lapack/install/lib/liblapack.a;$(pwd)/build/deps/lapack/install/lib/libblas.a" \
  -DBLAS_LIBRARIES="$(pwd)/build/deps/lapack/install/lib/libblas.a" \
  -DBLA_VENDOR=Generic \
  -DSUNDIALS_F77_FUNC_CASE=LOWER \
  -DSUNDIALS_F77_FUNC_UNDERSCORES=ONE \
  -DSUNDIALS_KLU_ENABLE=ON \
  -DKLU_INCLUDE_DIR="$(pwd)/build/deps/suitesparse/install/include/suitesparse" \
  -DSUNDIALS_KLU_LIBRARY_DIR="$(pwd)/build/deps/suitesparse/install/lib" \
  -DKLU_LIBRARY="$(pwd)/build/deps/suitesparse/install/lib/libklu.a" \
  -DAMD_LIBRARY="$(pwd)/build/deps/suitesparse/install/lib/libamd.a" \
  -DBTF_LIBRARY="$(pwd)/build/deps/suitesparse/install/lib/libbtf.a" \
  -DCOLAMD_LIBRARY="$(pwd)/build/deps/suitesparse/install/lib/libcolamd.a" \
  -DSUITESPARSECONFIG_LIBRARY="$(pwd)/build/deps/suitesparse/install/lib/libsuitesparseconfig.a" \
  -DSUNDIALS_SUPERLUMT_ENABLE=OFF \
  -DSUPERLUDIST_ENABLE=OFF \
  -DPETSC_ENABLE=OFF \
  -DHYPRE_ENABLE=OFF \
  -DRAJA_ENABLE=OFF \
  -DSUNDIALS_INDEX_SIZE=32 \
  -DSUNDIALS_INDEX_TYPE=int32_t \
  -DSUNDIALS_PRECISION=DOUBLE \
  -DHAS_int32_t=4 \
  -DHAS_int=4 \
  -DHAS_long=4 \
  -DUSE_GENERIC_MATH=ON \
  -DF77_INTERFACE_ENABLE=OFF \
  -DF2003_INTERFACE_ENABLE=OFF \
  2>&1 | tail -20

echo "[sundials] configured; building..."
emmake cmake --build "$B/cmake" -j"$(sysctl -n hw.logicalcpu 2>/dev/null || nproc)" 2>&1 | tail -10

echo "[sundials] installing..."
cmake --install "$B/cmake" 2>&1 | tail -5

echo "[sundials] artifacts:"
ls -la "$INSTALL/lib"/*.a 2>&1
