/* omc-web: minimal expat_config.h for wasm32-emscripten. Mirrors
 * what expat's autoconf would emit on a modern Linux/musl system. */
#ifndef EXPAT_CONFIG_H
#define EXPAT_CONFIG_H

#define BYTEORDER 1234
#define HAVE_MEMMOVE 1
#define HAVE_BCOPY 1
#define HAVE_DLFCN_H 1
#define HAVE_FCNTL_H 1
#define HAVE_INTTYPES_H 1
#define HAVE_MEMORY_H 1
#define HAVE_STDINT_H 1
#define HAVE_STDLIB_H 1
#define HAVE_STRING_H 1
#define HAVE_STRINGS_H 1
#define HAVE_SYS_STAT_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_UNISTD_H 1
#define STDC_HEADERS 1

#define XML_NS 1
#define XML_DTD 1
#define XML_CONTEXT_BYTES 1024
#define XML_DEV_URANDOM "/dev/urandom"

#endif
