/* omc-web: custom entry point that disables GC under emscripten.
 *
 * Boehm GC under emscripten defines STACK_NOT_SCANNED — it CANNOT walk
 * the wasm shadow stack to find live roots. Without that, every
 * MetaModelica list/string/record allocated to a C stack variable is
 * invisible to GC: a single mmc_alloc_words during runtime initialisation
 * can collect argv-derived strings before omc_FlagsUtil_readArgs reads
 * them, manifesting as the "memory access out of bounds in
 * omc_FlagsUtil_readArgs" we have been chasing.
 *
 * Workaround: call GC_disable() once after MMC_INIT so the GC never
 * collects. For trivial-to-medium models this stays within the 256 MB
 * linear-memory budget; the proper fix is wasm-aware GC root management
 * (e.g. GC_push_all over a registered shadow-stack range).
 *
 * Compiled WITHOUT OMC_ENTRYPOINT_STATIC so it provides __omc_main(),
 * which `main` in _main-entry.o calls.
 */
#include <stdio.h>
#include <openmodelica.h>
#include <meta/meta_modelica.h>
#include <gc.h>

extern void omc_Main_main(threadData_t*, modelica_metatype);

static int rml_execution_failed(void) {
  fflush(NULL);
  fprintf(stderr, "Execution failed!\n");
  fflush(NULL);
  return 1;
}

DLLDirection int __omc_main(int argc, char **argv) {
  MMC_INIT(0);

  /* Disable GC immediately after init. The wasm shadow stack is invisible
   * to BDWGC, so collection would mistakenly free live roots. */
  GC_disable();

  void *lst = mmc_mk_nil();
  for (int i = argc - 1; i > 0; i--) {
    lst = mmc_mk_cons(mmc_mk_scon(argv[i]), lst);
  }

  MMC_TRY_TOP()
    MMC_TRY_STACK()
      omc_Main_main(threadData, lst);
    MMC_ELSE()
      rml_execution_failed();
      fprintf(stderr, "Stack overflow detected and was not caught.\n");
      printStacktraceMessages();
      fflush(NULL);
      return 1;
    MMC_CATCH_STACK()
  MMC_CATCH_TOP(return rml_execution_failed());

  fflush(NULL);
  EXIT(0);
  return 0;
}
