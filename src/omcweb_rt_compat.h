/* omc-web: fill the gap between OMC_MINIMAL_RUNTIME's inline-stub rtclock
 * interface and the symbols simulation_runtime.cpp / solver_main.c /
 * simulation_result_csv.cpp / simulation_result_mat4.cpp / modelinfo.c
 * still reference. -include this header for those TUs so we don't have
 * to patch upstream sources.
 *
 * Pair with src/omcweb_rt_compat.c which provides the function bodies. */
#ifndef OMCWEB_RT_COMPAT_H
#define OMCWEB_RT_COMPAT_H

#ifdef __cplusplus
extern "C" {
#endif

/* Under OMC_EMCC, upstream rtclock.h declares the enum and the full
 * rtclock API itself; this header used to fill those gaps for
 * OMC_MINIMAL_RUNTIME but is now empty for OMC_EMCC mode. Keeping the
 * file as a no-op so the -include line in build-sim-runtime.sh doesn't
 * need to track conditional inclusion. */

#ifdef __cplusplus
}
#endif

#endif
