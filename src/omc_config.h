/* Thin wrapper so SimulationRuntime/c/*.c can `#include "omc_config.h"`.
 * The autoconf-generated upstream omc_config.h on Linux is identical to
 * omc_config.unix.h; the wasm build maintains a hand-written
 * omc_config.unix.h with pinned values. */
#include "omc_config.unix.h"
