/* Minimal hand-written sundials_config.h for the OMC simulation runtime
 * to include the sundials *types* (realtype, sunindextype, etc.) without
 * actually building sundials. The wasm build doesn't link sundials
 * solvers (OMC_MINIMAL_RUNTIME=1), but the SimulationRuntime headers
 * still #include <sundials/sundials_types.h> via simulation_data.h.
 *
 * If/when we add real sundials, regenerate via its CMake instead. */
/* Note: NO header guard. sundials_types.h defines _SUNDIALS_CONFIG_H
 * *before* including us, so a guard here would skip the whole file.
 * Letting the includer guard us is the upstream-intended pattern. */
#define SUNDIALS_VERSION "5.4.0"
#define SUNDIALS_VERSION_MAJOR 5
#define SUNDIALS_VERSION_MINOR 4
#define SUNDIALS_VERSION_PATCH 0
#define SUNDIALS_VERSION_LABEL ""

#define SUNDIALS_F77_FUNC(name,NAME) name ## _
#define SUNDIALS_F77_FUNC_(name,NAME) name ## _

#define SUNDIALS_DOUBLE_PRECISION 1
#define SUNDIALS_INT32_T 1
typedef int sunindextype_int_t;
#define SUNDIALS_HAVE_POSIX_TIMERS 0
#define SUNDIALS_BUILD_PACKAGE_FUSED_KERNELS 0
#define SUNDIALS_BUILD_WITH_MONITORING 0
#define SUNDIALS_BUILD_WITH_PROFILING 0
#define SUNDIALS_LOGGING_LEVEL 0
#define SUNDIALS_INDEX_SIZE 32
#define SUNDIALS_INDEX_TYPE int

/* Visibility/linkage tokens — sundials's CMake normally fills these in. */
#define SUNDIALS_EXPORT extern
#define SUNDIALS_STATIC_DEFINE 1
