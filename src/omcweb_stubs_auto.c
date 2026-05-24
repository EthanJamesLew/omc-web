/* omc-web: AUTO-GENERATED stubs. Do not hand-edit.
 * Regenerate via: python3 scripts/gen-stubs.py
 * These return default values (0, NULL, "", mmc_mk_nil) for
 * functions whose proper implementation hasn't been ported yet.
 * Hand-written stubs in omcweb_stubs.c take precedence. */

#include "meta/meta_modelica.h"
#include "openmodelica.h"
#include <stdlib.h>
#include <string.h>

/* --- from Settings.h --- */
void SettingsImpl__setCompileCommand(const char*) {

}

void SettingsImpl__setInstallationDirectoryPath(const char*) {

}

void SettingsImpl__setModelicaPath(const char*) {

}

void SettingsImpl__setTempDirectoryPath(const char*) {

}

const char* Settings_getCompileCommand(void) {
  return "";
}

int Settings_getEcho(void) {
  return 0;
}

const char* Settings_getHomeDir(int) {
  return "";
}

const char* Settings_getInstallationDirectoryPath(void) {
  return "";
}

const char* Settings_getModelicaPath(int) {
  return "";
}

const char* Settings_getTempDirectoryPath(void) {
  return "";
}

const char* Settings_getVersionNr(void) {
  return "";
}

void Settings_setEcho(int) {

}

/* --- from System.h --- */
int SystemImpl__chdir(const char*) {
  return 0;
}

int SystemImpl__createDirectory(const char*) {
  return 0;
}

const char* SystemImpl__createTemporaryDirectory(const char*) {
  return "";
}

const char* SystemImpl__pwd(void) {
  return "";
}

void SystemImpl__setCCompiler(const char*) {

}

void SystemImpl__setCFlags(const char*) {

}

void SystemImpl__setCXXCompiler(const char*) {

}

void SystemImpl__setLDFlags(const char*) {

}

void SystemImpl__setLinker(const char*) {

}

int SystemImpl__systemCall(const char* , const char*) {
  return 0;
}

modelica_metatype SystemImpl__systemCallParallel(modelica_metatype , int) {
  return mmc_mk_nil();
}

void System_appendFile(const char* , const char*) {

}

void System_freeLibrary(int , int) {

}

const char* System_getCCompiler(void) {
  return "";
}

const char* System_getCFlags(void) {
  return "";
}

const char* System_getCXXCompiler(void) {
  return "";
}

const char* System_getLDFlags(void) {
  return "";
}

const char* System_getLinker(void) {
  return "";
}

const char* System_getOMPCCompiler(void) {
  return "";
}

int System_loadLibrary(const char* , int) {
  return 0;
}

int System_lookupFunction(int , const char*) {
  return 0;
}

const char* System_makeC89Identifier(const char*) {
  return "";
}

const char* System_readEnv(const char*) {
  return "";
}

const char* System_readFile(const char*) {
  return "";
}

modelica_metatype System_regex(const char* , const char* , int , int , int , int*) {
  return mmc_mk_nil();
}

int System_stringFind(const char* , const char*) {
  return 0;
}

const char* System_stringReplace(const char* , const char* , const char*) {
  return "";
}

int System_strncmp(const char* , const char* , int) {
  return 0;
}

modelica_metatype System_strtok(const char* , const char*) {
  return mmc_mk_nil();
}

modelica_metatype System_strtokIncludingDelimiters(const char* , const char*) {
  return mmc_mk_nil();
}

modelica_metatype System_subDirectories(const char*) {
  return mmc_mk_nil();
}

const char* System_tolower(const char*) {
  return "";
}

const char* System_toupper(const char*) {
  return "";
}

const char* System_trim(const char* , const char*) {
  return "";
}

const char* System_trimChar(const char* , const char*) {
  return "";
}

void System_writeFile(const char* , const char*) {

}

/* --- from ZeroMQ.h --- */
void ZeroMQ_close(modelica_metatype) {

}

const char* ZeroMQ_handleRequest(modelica_metatype) {
  return "";
}

modelica_metatype ZeroMQ_initialize(const char* , int , int) {
  return mmc_mk_nil();
}

void ZeroMQ_sendReply(modelica_metatype , const char*) {

}
