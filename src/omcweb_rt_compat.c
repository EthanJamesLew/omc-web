/* omc-web: under OMC_EMCC, upstream rtclock.c builds cleanly and
 * provides all rt_* symbols. We still need the embedded_server
 * function-pointer globals (declared in embedded_server.h as
 * `extern void (*name)(...)`), and stubs for solver alternatives
 * that solver_main.c dispatches to but bouncing ball never selects
 * (gbode, sym_solver_ssc, real_time_sync). */
#include <stddef.h>
#include <stdio.h>

/* These are function-POINTER globals declared in embedded_server.h.
 * solver_main.c calls them unconditionally (e.g.
 *   data->embeddedServerState = embedded_server_init(...);
 *   wait_for_step(data->embeddedServerState);
 *   embedded_server_deinit(...);
 * ) without first checking the pointer. We can't leave them NULL —
 * that'd trap with "unreachable" under wasm strict indirect-call. So
 * point them at real no-op functions instead. */
static void* es_init_noop(void *data, double tout, double step,
                          const char *argv_0,
                          void (*omc_real_time_sync_update)(void*, double),
                          int port) {
  (void) data; (void) tout; (void) step; (void) argv_0;
  (void) omc_real_time_sync_update; (void) port;
  return NULL;
}
static void  es_wait_noop  (void *handle) { (void) handle; }
static void  es_deinit_noop(void *handle) { (void) handle; }
static int   es_update_noop(void *handle, double tout, int *terminate) {
  (void) handle; (void) tout;
  if (terminate) *terminate = 0;
  return 0;
}

void* (*embedded_server_init)(void *, double, double, const char *,
                              void (*)(void*, double), int) = es_init_noop;
void  (*wait_for_step)(void *) = es_wait_noop;
void  (*embedded_server_deinit)(void *) = es_deinit_noop;
int   (*embedded_server_update)(void *, double, int *) = es_update_noop;

void* embedded_server_load_functions(const char *name) { (void) name; return NULL; }
void  embedded_server_unload_functions(void *dllHandle) { (void) dllHandle; }

/* solver_main.c indirect-dispatches to these based on Config flags.
 * For bouncing ball (CVODE/DASSL) they're never selected — but the
 * linker still demands the symbols exist. Loud stubs if invoked. */
static int unsupported_solver(const char *name) {
  fprintf(stderr, "[omc-web] FATAL: solver path '%s' is not in the wasm build.\n", name);
  return -1;
}
int  gbode_main(void *data, void *threadData, void *solverInfo) {
  (void) data; (void) threadData; (void) solverInfo;
  return unsupported_solver("gbode_main");
}
int  sym_solver_ssc_step(void *data, void *threadData, void *solverInfo) {
  (void) data; (void) threadData; (void) solverInfo;
  return unsupported_solver("sym_solver_ssc_step");
}
int  allocateSymSolverSsc(void *si, int size) { (void) si; (void) size; return 0; }
int  freeSymSolverSsc(void *si) { (void) si; return 0; }
int  gbode_allocateData(void *si, void *data, void *threadData) {
  (void) si; (void) data; (void) threadData; return 0;
}
int  gbode_freeData(void *si) { (void) si; return 0; }
int  omc_real_time_sync_init(void *data, void *threadData) {
  (void) data; (void) threadData; return 0;
}
/* solver_main.c calls omc_real_time_sync_update directly. No-op (wasm
 * has no real-time concept). */
void omc_real_time_sync_update(void *data, double scaling) {
  (void) data; (void) scaling;
}
double rt_ext_tp_sync_nanosec(void *tp) { (void) tp; return 0.0; }
