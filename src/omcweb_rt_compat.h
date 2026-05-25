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

/* Enum that lives outside the minimal block in upstream rtclock.h but
 * gets referenced by simulation_runtime.cpp regardless of mode. */
enum omc_rt_clock_t {
  OMC_CLOCK_REALTIME = 0,
  OMC_CLOCK_CPUTIME  = 1,
  OMC_CPU_CYCLES     = 2
};

/* Function bodies in omcweb_rt_compat.c. */
double rt_accumulated(int ix);
void   rt_init(int numTimer);
void   rt_clear_total(int ix);
double rt_total(int ix);
double rt_max_accumulated(int ix);
double rt_max_accumulated_resetMax(int ix);
unsigned int rt_ncall(int ix);
unsigned int rt_ncall_min(int ix);
unsigned int rt_ncall_max(int ix);
unsigned int rt_ncall_total(int ix);
void rt_add_ncall(int ix, int n);
void rt_measure_overhead(int ix);
void rt_clock_overhead(void);

/* Used by simulation_runtime.cpp; under minimal mode picking a clock
 * isn't meaningful — always pretend success. */
static inline int rt_set_clock(enum omc_rt_clock_t clk) { (void) clk; return 0; }

#ifdef __cplusplus
}
#endif

#endif
