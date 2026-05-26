/* omc-web: drop-in replacement for libgc.a on wasm.
 *
 * Boehm GC under emscripten defines STACK_NOT_SCANNED, so collection
 * cannot find live roots on the wasm shadow stack and will free still-
 * referenced objects. Rather than fight that, we provide a no-collect
 * allocator: every alloc is plain malloc, free is plain free, every
 * collection entry point is a no-op. The result leaks until the wasm
 * exits, but the wasm IS a short-lived one-shot compiler process, and
 * with ALLOW_MEMORY_GROWTH the 256 MB initial budget grows as needed.
 *
 * This object MUST be passed to the linker before build/deps/gc/libomcgc.a
 * so its definitions are picked first (or build without libomcgc.a at all).
 */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <stdarg.h>
#include <stddef.h>

typedef struct {
  unsigned long heapsize_full;
  unsigned long free_bytes_full;
  unsigned long unmapped_bytes;
  unsigned long bytes_allocd_since_gc;
  unsigned long allocd_bytes_before_gc;
  unsigned long non_gc_bytes;
  unsigned long gc_no;
  unsigned long markers_m1;
  unsigned long bytes_reclaimed_since_gc;
  unsigned long reclaimed_bytes_before_gc;
  unsigned long expl_freed_bytes_since_gc;
} GC_prof_stats_s;

void  GC_init(void)                            { /* no-op */ }
void  GC_disable(void)                         { /* no-op */ }
void  GC_enable(void)                          { /* no-op */ }
void  GC_gcollect(void)                        { /* no-op */ }
void  GC_gcollect_and_unmap(void)              { /* no-op */ }
void  GC_register_displacement(unsigned long n){ (void) n; }
int   GC_expand_hp(unsigned long n)            { (void) n; return 1; }
void  GC_set_max_heap_size(unsigned long n)    { (void) n; }
void  GC_set_force_unmap_on_gcollect(int v)    { (void) v; }
int   GC_get_force_unmap_on_gcollect(void)     { return 0; }
void  GC_set_free_space_divisor(unsigned long n) { (void) n; }

void* GC_malloc(size_t n)                      { return calloc(1, n); }
void* GC_malloc_atomic(size_t n)               { return malloc(n); }
void* GC_malloc_uncollectable(size_t n)        { return calloc(1, n); }
void* GC_malloc_atomic_ignore_off_page(size_t n) { return malloc(n); }
void* GC_malloc_ignore_off_page(size_t n)      { return calloc(1, n); }
void  GC_free(void* p)                         { free(p); }

char* GC_strdup(const char* s)                 { return strdup(s); }

size_t GC_get_prof_stats(GC_prof_stats_s* p, size_t sz)
{
  if (p && sz >= sizeof(GC_prof_stats_s)) memset(p, 0, sizeof(*p));
  return sizeof(GC_prof_stats_s);
}

/* GC_asprintf comes from libomcsimrt.a/modelica_string.o — don't redefine. */
