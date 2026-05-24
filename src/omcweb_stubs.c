/* omc-web: minimal stubs for the System/SystemImpl runtime symbols that
 * upstream systemimpl.c/System_omc.c would normally provide.
 *
 * We don't compile systemimpl.c yet — it pulls in alarm(), iconv(), gettext(),
 * dladdr(), Unix process control, etc. that either don't exist in
 * emscripten/wasi-libc or aren't meaningful in the browser. These stubs
 * provide just enough behaviour to let omc.wasm link and run for the
 * parse-and-flatten use case.
 *
 * Behaviour:
 *  - File I/O stat/rename/realpath: use real emscripten libc which goes
 *    through MEMFS/IDBFS, so they actually work for files in the VFS.
 *  - Threads / signals / iconv / gettext: no-op stubs.
 *  - dladdr / numProcessors / terminal width: trivial constants.
 *
 * Anything in here can later be replaced by porting systemimpl.c properly.
 */

#define ADD_METARECORD_DEFINITIONS static  /* keep records.h externs satisfied */

#include "meta/meta_modelica.h"
#include "openmodelica.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <time.h>

/* ---- file-ish I/O — pass through to libc / emscripten FS ---------------- */

int SystemImpl__stat(const char* filename, double* out_size, double* out_mtime) {
  /* Note: <sys/stat.h> defines st_mtime as a macro, so do not name params
   * `st_size`/`st_mtime`. The upstream signature is 3 args, not 4. */
  struct stat sb;
  if (stat(filename, &sb) != 0) { *out_size = 0; *out_mtime = 0; return 0; }
  *out_size  = (double) sb.st_size;
  *out_mtime = (double) sb.st_mtime;
  return 1;
}

int SystemImpl__rename(const char* src, const char* dst) {
  return rename(src, dst) == 0;
}

int SystemImpl__fileContentsEqual(const char* a, const char* b) {
  FILE *fa = fopen(a, "rb"), *fb = fopen(b, "rb");
  if (!fa || !fb) { if (fa) fclose(fa); if (fb) fclose(fb); return 0; }
  int eq = 1, ca, cb;
  do {
    ca = fgetc(fa); cb = fgetc(fb);
    if (ca != cb) { eq = 0; break; }
  } while (ca != EOF && cb != EOF);
  fclose(fa); fclose(fb);
  return eq;
}

int System_fileIsNewerThan(const char* a, const char* b) {
  struct stat sa, sb;
  if (stat(a, &sa) != 0 || stat(b, &sb) != 0) return 0;
  return sa.st_mtime > sb.st_mtime;
}

const char* System_realpath(const char* path) {
  char* buf = (char*) malloc(4096);
  if (!buf) return path;
  if (realpath(path, buf) == NULL) {
    strncpy(buf, path, 4095); buf[4095] = 0;
  }
  return buf;
}

int SystemImpl__reopenStandardStream(int stream, const char* filename) {
  FILE* target = (stream == 1) ? stdout : (stream == 2) ? stderr : stdin;
  return freopen(filename, (stream == 0) ? "rb" : "wb", target) != NULL;
}

/* ---- no-op / trivial-constant stubs ------------------------------------- */

int SystemImpl__alarm(int seconds) {
  (void) seconds;
  return 0;  /* no signals in browser */
}

const char* SystemImpl__ctime(double t) {
  static char buf[64];
  time_t tt = (time_t) t;
  struct tm* tm = gmtime(&tt);
  if (!tm) { buf[0] = 0; return buf; }
  strftime(buf, sizeof(buf), "%a %b %d %H:%M:%S %Y", tm);
  return buf;
}

void SystemImpl__dladdr(modelica_metatype symbol, const char** file, const char** name) {
  (void) symbol;
  *file = "(omc-web: no dladdr)";
  *name = "(unknown)";
}

const char* SystemImpl__gettext(const char* msgid) {
  return msgid;  /* identity — no translation */
}

void SystemImpl__gettextInit(const char* locale) {
  (void) locale;
}

const char* SystemImpl__iconv(const char* s, const char* from, const char* to, int len_in) {
  (void) from; (void) to; (void) len_in;
  /* Identity copy: assume input is already UTF-8. */
  size_t n = strlen(s) + 1;
  char* out = (char*) malloc(n);
  if (!out) return s;
  memcpy(out, s, n);
  return out;
}

int System_getTerminalWidth(void) {
  return 80;
}

const char* System_getSimulationHelpTextSphinx(int detailed, int sphinx) {
  (void) detailed; (void) sphinx;
  return "(omc-web: simulation help text not bundled)";
}

void System_initGarbageCollector(void) {
  /* Boehm GC initialised by mmc_init. Nothing extra to do. */
}

int System_numProcessors(void) {
  return 1;  /* browser sees one logical thread */
}

const char* System_snprintff(const char* format, int maxlen, double val) {
  char* buf = (char*) malloc((size_t) maxlen + 1);
  if (!buf) return "";
  int n = snprintf(buf, (size_t) maxlen + 1, format, val);
  if (n < 0) buf[0] = 0;
  return buf;
}

const char* System_openModelicaPlatform(void) { return "wasm32-emscripten"; }
const char* System_modelicaPlatform(void)     { return "wasm32"; }

/* ---- path helpers (POSIX basename/dirname) ------------------------------ */

const char* System_basename(const char* p) {
  const char* s = strrchr(p, '/');
  return s ? s + 1 : p;
}

const char* System_dirname(const char* p) {
  const char* s = strrchr(p, '/');
  if (!s) { return "."; }
  size_t n = (size_t)(s - p);
  char* out = (char*) malloc(n + 1);
  if (!out) return ".";
  memcpy(out, p, n); out[n] = 0;
  return out;
}

int System_userIsRoot(void) { return 0; }

/* SystemImpl__basename: same idea as System_basename but distinct symbol
 * (Compiler/runtime/printimpl.c and SimulationResults.c call this directly). */
const char* SystemImpl__basename(const char* p) {
  const char* s = strrchr(p, '/');
  return s ? s + 1 : p;
}

int SystemImpl__regularFileWritable(const char* p) {
  return access(p, W_OK) == 0;
}

const char* SystemImpl__iconv__ascii(const char* s) {
  /* Identity copy — assume input is already ASCII-clean. */
  size_t n = strlen(s) + 1;
  char* out = (char*) malloc(n);
  if (!out) return s;
  memcpy(out, s, n);
  return out;
}

/* lookup_ptr: declared in Compiler/runtime/systemimpl.h as
 *   modelica_ptr_t lookup_ptr(modelica_integer index);
 * `modelica_ptr_t` is `void*` (a pointer into a pointer-table; NULL means
 * "not found"). The bootstrap variant doesn't dynamically load Modelica
 * external functions, so always returning NULL is correct. */
void* lookup_ptr(int idx) {
  (void) idx;
  return 0;
}

int System_getHasInnerOuterDefinitions(void) { return 0; }

void System_uriToClassAndPath(const char* uri, const char** scheme,
                              const char** classname, const char** pathname) {
  /* Minimal: just point everything at the URI string. Correct parsing
   * (modelica://, file://) is needed later — for parse-only smoke tests
   * the bootstrap compiler rarely calls this. */
  *scheme = "file";
  *classname = "";
  *pathname = uri;
}

/* ---- string escape helpers ---------------------------------------------- */

const char* System_unquoteIdentifier(const char* s) {
  if (s[0] != '\'') return s;
  size_t n = strlen(s);
  if (n < 2 || s[n-1] != '\'') return s;
  char* out = (char*) malloc(n - 1);
  if (!out) return s;
  memcpy(out, s + 1, n - 2); out[n - 2] = 0;
  return out;
}

const char* System_escapedString(const char* s, int unescapeNewline) {
  /* Identity for now — the bootstrap compiler uses this for diagnostic
   * pretty-printing. Wrong but non-fatal. */
  (void) unescapeNewline;
  return s;
}

const char* System_unescapedString(const char* s) {
  return s;  /* identity */
}

int SystemImpl__unescapedStringLength(const char* s) {
  return (int) strlen(s);
}

/* ---- additional filesystem helpers -------------------------------------- */

int SystemImpl__directoryExists(const char* p) {
  struct stat sb;
  return (stat(p, &sb) == 0) && S_ISDIR(sb.st_mode);
}

int SystemImpl__regularFileExists(const char* p) {
  struct stat sb;
  return (stat(p, &sb) == 0) && S_ISREG(sb.st_mode);
}

int SystemImpl__removeFile(const char* p) {
  return unlink(p) == 0;
}

int SystemImpl__removeDirectory(const char* p) {
  return rmdir(p) == 0;
}

int SystemImpl__copyFile(const char* src, const char* dst) {
  FILE* fs = fopen(src, "rb"); if (!fs) return 0;
  FILE* fd = fopen(dst, "wb"); if (!fd) { fclose(fs); return 0; }
  char buf[4096]; size_t n;
  while ((n = fread(buf, 1, sizeof(buf), fs)) > 0) {
    if (fwrite(buf, 1, n, fd) != n) { fclose(fs); fclose(fd); return 0; }
  }
  fclose(fs); fclose(fd); return 1;
}

const char* SystemImpl__readFileNoNumeric(const char* in) {
  /* Strip numeric chars; the upstream uses this to detect copyright headers
   * etc. For now return a copy unchanged. */
  size_t n = strlen(in) + 1;
  char* out = (char*) malloc(n);
  if (!out) return in;
  memcpy(out, in, n);
  return out;
}

double SystemImpl__time(void) {
  struct timespec ts;
  if (clock_gettime(CLOCK_REALTIME, &ts) != 0) return 0.0;
  return (double) ts.tv_sec + (double) ts.tv_nsec / 1.0e9;
}

/* ---- compile-state flags (single global per process) -------------------- */
static int omcweb_hasExpandableConnectors = 0;
static int omcweb_hasStreamConnectors = 0;
static int omcweb_hasInnerOuterDefinitions = 0;
static int omcweb_hasOverconstrainedConnectors = 0;
static int omcweb_partialInstantiation = 0;
static int omcweb_usesCardinality = 0;

int  System_getHasExpandableConnectors(void) { return omcweb_hasExpandableConnectors; }
void System_setHasExpandableConnectors(int v){ omcweb_hasExpandableConnectors = v; }
int  System_getHasStreamConnectors(void)     { return omcweb_hasStreamConnectors; }
void System_setHasStreamConnectors(int v)    { omcweb_hasStreamConnectors = v; }
void System_setHasInnerOuterDefinitions(int v){ omcweb_hasInnerOuterDefinitions = v; }
void System_setHasOverconstrainedConnectors(int v){ omcweb_hasOverconstrainedConnectors = v; }
int  System_getPartialInstantiation(void)    { return omcweb_partialInstantiation; }
void System_setPartialInstantiation(int v)   { omcweb_partialInstantiation = v; }
int  System_getUsesCardinality(void)         { return omcweb_usesCardinality; }

/* ---- module / file enumeration ------------------------------------------ */

void System_getLoadModelPath(const char* className, modelica_metatype prios,
                             modelica_metatype mps, int requireExactVersion,
                             const char** dir, const char** name, int* isDir) {
  (void) className; (void) prios; (void) mps; (void) requireExactVersion;
  /* Empty result — MSL not yet bundled in VFS. */
  *dir = ""; *name = ""; *isDir = 0;
}

modelica_metatype System_moFiles(const char* dir) {
  (void) dir;
  return mmc_mk_nil();
}

modelica_metatype System_mocFiles(const char* dir) {
  (void) dir;
  return mmc_mk_nil();
}

/* ---- realtime clocks (no-op timing) ------------------------------------- */

void System_realtimeClear(int idx) { (void) idx; }
void System_realtimeTick(int idx)  { (void) idx; }
double System_realtimeTock(int idx) { (void) idx; return 0.0; }
int System_realtimeNtick(int idx) { (void) idx; return 0; }

/* ---- tmpTick: small per-thread integer counters ------------------------- */
/* The bootstrap compiler uses up to ~10 indices for generating temporary
 * names. Real upstream stores these in threadData; for single-threaded
 * wasm we keep them in a static array. */
#define OMCWEB_TMPTICK_SLOTS 64
static int omcweb_tmpticks[OMCWEB_TMPTICK_SLOTS];
static int omcweb_tmptick_maxima[OMCWEB_TMPTICK_SLOTS];

int SystemImpl_tmpTickIndex(threadData_t* td, int idx) {
  (void) td;
  if (idx < 0 || idx >= OMCWEB_TMPTICK_SLOTS) return 0;
  int v = omcweb_tmpticks[idx]++;
  if (omcweb_tmpticks[idx] > omcweb_tmptick_maxima[idx]) {
    omcweb_tmptick_maxima[idx] = omcweb_tmpticks[idx];
  }
  return v;
}

int SystemImpl_tmpTickIndexReserve(threadData_t* td, int idx, int reserve) {
  (void) td;
  if (idx < 0 || idx >= OMCWEB_TMPTICK_SLOTS) return 0;
  int v = omcweb_tmpticks[idx];
  omcweb_tmpticks[idx] += reserve;
  if (omcweb_tmpticks[idx] > omcweb_tmptick_maxima[idx]) {
    omcweb_tmptick_maxima[idx] = omcweb_tmpticks[idx];
  }
  return v;
}

int SystemImpl_tmpTickMaximum(threadData_t* td, int idx) {
  (void) td;
  if (idx < 0 || idx >= OMCWEB_TMPTICK_SLOTS) return 0;
  return omcweb_tmptick_maxima[idx];
}

void SystemImpl_tmpTickReset(threadData_t* td, int start) {
  (void) td;
  for (int i = 0; i < OMCWEB_TMPTICK_SLOTS; i++) {
    omcweb_tmpticks[i] = start;
    omcweb_tmptick_maxima[i] = start;
  }
}

void SystemImpl_tmpTickResetIndex(threadData_t* td, int start, int idx) {
  (void) td;
  if (idx < 0 || idx >= OMCWEB_TMPTICK_SLOTS) return;
  omcweb_tmpticks[idx] = start;
  omcweb_tmptick_maxima[idx] = start;
}

void SystemImpl_tmpTickSetIndex(threadData_t* td, int v, int idx) {
  (void) td;
  if (idx < 0 || idx >= OMCWEB_TMPTICK_SLOTS) return;
  omcweb_tmpticks[idx] = v;
  if (v > omcweb_tmptick_maxima[idx]) omcweb_tmptick_maxima[idx] = v;
}

/* ---- parallel tasks: run sequentially ----------------------------------- */
extern modelica_metatype omc_List_map(threadData_t*, modelica_metatype, modelica_fnptr);

modelica_metatype System_launchParallelTasks(threadData_t* td, int numThreads,
                                             modelica_metatype inData,
                                             modelica_fnptr func)
{
  (void) numThreads;
  /* Equivalent of List.map(inData, func) — single threaded. The bootstrap
   * compiler only uses this for parallel codegen; sequential is correct
   * just slower. */
  return omc_List_map(td, inData, func);
}
