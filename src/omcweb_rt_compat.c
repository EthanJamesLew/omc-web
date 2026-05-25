/* omc-web: shim for the gap between OMC_MINIMAL_RUNTIME's inline-stubbed
 * rtclock interface (rt_tick / rt_accumulate as no-op inlines) and the
 * non-inline rt_accumulated/rt_init/etc. that simulation_result_csv.cpp,
 * simulation_result_mat4.cpp, solver_main.c and simulation_runtime.cpp
 * still call unconditionally. Building rtclock.c proper drags in clocks /
 * perf-counters / mingw shims; we don't want any of that, so we just
 * provide the missing symbols as no-ops here. */
#include <stddef.h>

double rt_accumulated(int ix) { (void) ix; return 0.0; }
void   rt_init(int numTimer) { (void) numTimer; }
void   rt_clear_total(int ix) { (void) ix; }
double rt_total(int ix) { (void) ix; return 0.0; }
double rt_max_accumulated(int ix) { (void) ix; return 0.0; }
double rt_max_accumulated_resetMax(int ix) { (void) ix; return 0.0; }
unsigned int rt_ncall(int ix) { (void) ix; return 0; }
unsigned int rt_ncall_min(int ix) { (void) ix; return 0; }
unsigned int rt_ncall_max(int ix) { (void) ix; return 0; }
unsigned int rt_ncall_total(int ix) { (void) ix; return 0; }
void rt_add_ncall(int ix, int n) { (void) ix; (void) n; }
void rt_measure_overhead(int ix) { (void) ix; }
void rt_clock_overhead(void) { }
