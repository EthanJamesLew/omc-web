/* omc-web: hand-written antlr3config.h for emscripten/wasm32.
 * Replaces the autoconf/cmake-generated header.
 * Set to match what emscripten's musl libc provides. */

#ifndef ANTLR3_CONFIG_H
#define ANTLR3_CONFIG_H

#define ANTLR_C_VERSION_3_2

#define ANTLR3_NODEBUGGER 1
#define ANTLR3_USE_64BIT  1

/* Headers — present in emscripten/wasi-libc (musl-derived) */
#define HAVE_CTYPE_H 1
#define HAVE_DLFCN_H 1
#define HAVE_INTTYPES_H 1
/* macOS has no <malloc.h>; emscripten/glibc/musl do. */
#if !defined(__APPLE__)
#define HAVE_MALLOC_H 1
#endif
#define HAVE_MEMORY_H 1
#define HAVE_STDARG_H 1
#define HAVE_STDINT_H 1
#define HAVE_STDLIB_H 1
#define HAVE_STRINGS_H 1
#define HAVE_STRING_H 1
#define HAVE_SYS_STAT_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_UNISTD_H 1
#define STDC_HEADERS 1

/* Networking headers. antlr3defs.h uses `#ifdef`, so absence (rather than
 * `#define X 0`) is the way to tell antlr the header isn't there. We only
 * define what genuinely exists in emscripten's musl-derived libc. */
#define HAVE_NETDB_H 1
#define HAVE_NETINET_IN_H 1
#define HAVE_NETINET_TCP_H 1
#define HAVE_SYS_SOCKET_H 1
/* Intentionally NOT defined: HAVE_SOCKET_H, HAVE_ARPA_NAMESER_H,
 * HAVE_RESOLV_H, HAVE_SYS_MALLOC_H — emscripten has none of these. */

/* Functions */
#define HAVE_MEMMOVE 1
#define HAVE_MEMSET 1
#define HAVE_STRDUP 1

/* Types — wasm32 is LP32 with 64-bit long long */
#define HAVE_INTPTR_T 1
#define HAVE_UINTPTR_T 1

/* Stays as actual C tokens */
/* #undef const     */
/* #undef inline    */
/* #undef int16_t   */
/* #undef int32_t   */
/* #undef int64_t   */
/* #undef int8_t    */
/* #undef intptr_t  */

#endif /* ANTLR3_CONFIG_H */
