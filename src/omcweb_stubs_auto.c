/* omc-web: AUTO-GENERATED stubs. Do not hand-edit.
 * Regenerate via: python3 scripts/gen-stubs.py
 * Default-value stubs (0, NULL, "", mmc_mk_nil) for the
 * runtime-shim externs OMC's MetaModelica-generated C calls into.
 * Hand-written stubs in omcweb_stubs.c take precedence.
 * Tracing: disabled (set OMCWEB_STUB_TRACE=1 to enable) */

#include "meta/meta_modelica.h"
#include "openmodelica.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* --- from Curl.h --- */
int om_curl_multi_download(modelica_metatype , int) {
  return 0;
}

/* --- from FFI.h --- */
modelica_metatype FFI_callFunction(int , modelica_metatype , modelica_metatype , modelica_metatype , modelica_metatype*) {
  return mmc_mk_nil();
}

/* --- from OMSimulatorExt.h --- */
int OMSimulator_loadDLL(void) {
  return 0;
}

int OMSimulator_oms_RunFile(const char*) {
  return 0;
}

int OMSimulator_oms_addBus(const char*) {
  return 0;
}

int OMSimulator_oms_addConnection(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_addConnector(const char* , int , int) {
  return 0;
}

int OMSimulator_oms_addConnectorToBus(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_addConnectorToTLMBus(const char* , const char* , const char*) {
  return 0;
}

int OMSimulator_oms_addDynamicValueIndicator(const char* , const char* , const char* , double) {
  return 0;
}

int OMSimulator_oms_addEventIndicator(const char*) {
  return 0;
}

int OMSimulator_oms_addExternalModel(const char* , const char* , const char*) {
  return 0;
}

int OMSimulator_oms_addSignalsToResults(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_addStaticValueIndicator(const char* , double , double , double) {
  return 0;
}

int OMSimulator_oms_addSubModel(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_addSystem(const char* , int) {
  return 0;
}

int OMSimulator_oms_addTLMBus(const char* , int , int , int) {
  return 0;
}

int OMSimulator_oms_addTLMConnection(const char* , const char* , double , double , double , double) {
  return 0;
}

int OMSimulator_oms_addTimeIndicator(const char*) {
  return 0;
}

int OMSimulator_oms_compareSimulationResults(const char* , const char* , const char* , double , double) {
  return 0;
}

int OMSimulator_oms_copySystem(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_delete(const char*) {
  return 0;
}

int OMSimulator_oms_deleteConnection(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_deleteConnectorFromBus(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_deleteConnectorFromTLMBus(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_export(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_exportDependencyGraphs(const char* , const char* , const char* , const char*) {
  return 0;
}

int OMSimulator_oms_exportSnapshot(const char* , const char**) {
  return 0;
}

int OMSimulator_oms_extractFMIKind(const char* , int*) {
  return 0;
}

int OMSimulator_oms_faultInjection(const char* , int , double) {
  return 0;
}

int OMSimulator_oms_getBoolean(const char* , int*) {
  return 0;
}

int OMSimulator_oms_getFixedStepSize(const char* , double*) {
  return 0;
}

int OMSimulator_oms_getInteger(const char* , int*) {
  return 0;
}

int OMSimulator_oms_getModelState(const char* , int*) {
  return 0;
}

int OMSimulator_oms_getReal(const char* , double*) {
  return 0;
}

int OMSimulator_oms_getSolver(const char* , int*) {
  return 0;
}

int OMSimulator_oms_getStartTime(const char* , double*) {
  return 0;
}

int OMSimulator_oms_getStopTime(const char* , double*) {
  return 0;
}

int OMSimulator_oms_getSubModelPath(const char* , const char**) {
  return 0;
}

int OMSimulator_oms_getSystemType(const char* , int*) {
  return 0;
}

int OMSimulator_oms_getTolerance(const char* , double* , double*) {
  return 0;
}

int OMSimulator_oms_getVariableStepSize(const char* , double* , double* , double*) {
  return 0;
}

const char* OMSimulator_oms_getVersion(void) {
  return "";
}

int OMSimulator_oms_importFile(const char* , const char**) {
  return 0;
}

int OMSimulator_oms_importSnapshot(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_initialize(const char*) {
  return 0;
}

int OMSimulator_oms_instantiate(const char*) {
  return 0;
}

int OMSimulator_oms_list(const char* , const char**) {
  return 0;
}

int OMSimulator_oms_listUnconnectedConnectors(const char* , const char**) {
  return 0;
}

int OMSimulator_oms_loadSnapshot(const char* , const char* , const char**) {
  return 0;
}

int OMSimulator_oms_newModel(const char*) {
  return 0;
}

int OMSimulator_oms_removeSignalsFromResults(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_rename(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_reset(const char*) {
  return 0;
}

int OMSimulator_oms_setBoolean(const char* , int) {
  return 0;
}

int OMSimulator_oms_setCommandLineOption(const char*) {
  return 0;
}

int OMSimulator_oms_setFixedStepSize(const char* , double) {
  return 0;
}

int OMSimulator_oms_setInteger(const char* , int) {
  return 0;
}

int OMSimulator_oms_setLogFile(const char*) {
  return 0;
}

int OMSimulator_oms_setLoggingInterval(const char* , double) {
  return 0;
}

int OMSimulator_oms_setLoggingLevel(int) {
  return 0;
}

int OMSimulator_oms_setReal(const char* , double) {
  return 0;
}

int OMSimulator_oms_setRealInputDerivative(const char* , double) {
  return 0;
}

int OMSimulator_oms_setResultFile(const char* , const char* , int) {
  return 0;
}

int OMSimulator_oms_setSignalFilter(const char* , const char*) {
  return 0;
}

int OMSimulator_oms_setSolver(const char* , int) {
  return 0;
}

int OMSimulator_oms_setStartTime(const char* , double) {
  return 0;
}

int OMSimulator_oms_setStopTime(const char* , double) {
  return 0;
}

int OMSimulator_oms_setTLMPositionAndOrientation(const char* , double , double , double , double , double , double , double , double , double , double , double , double) {
  return 0;
}

int OMSimulator_oms_setTLMSocketData(const char* , const char* , int , int) {
  return 0;
}

int OMSimulator_oms_setTempDirectory(const char*) {
  return 0;
}

int OMSimulator_oms_setTolerance(const char* , double , double) {
  return 0;
}

int OMSimulator_oms_setVariableStepSize(const char* , double , double , double) {
  return 0;
}

int OMSimulator_oms_setWorkingDirectory(const char*) {
  return 0;
}

int OMSimulator_oms_simulate(const char*) {
  return 0;
}

int OMSimulator_oms_stepUntil(const char* , double) {
  return 0;
}

int OMSimulator_oms_terminate(const char*) {
  return 0;
}

int OMSimulator_unloadDLL(void) {
  return 0;
}

/* --- from Settings.h --- */
int Settings_getEcho(void) {
  return 0;
}

void Settings_setEcho(int) {

}

/* --- from System.h --- */
int SystemImpl__chdir(const char*) {
  return 0;
}

int SystemImpl__covertTextFileToCLiteral(const char* , const char* , const char*) {
  return 0;
}

int SystemImpl__createDirectory(const char*) {
  return 0;
}

const char* SystemImpl__createTemporaryDirectory(const char*) {
  return "";
}

int SystemImpl__dgesv(modelica_metatype , modelica_metatype , modelica_metatype*) {
  return 0;
}

double SystemImpl__getCurrentTime(void) {
  return 0.0;
}

void SystemImpl__loadModelCallBack(OpenModelica_threadData_ThreadData*, const char*) {

}

int SystemImpl__loadModelCallBackDefined(OpenModelica_threadData_ThreadData*) {
  return 0;
}

void SystemImpl__plotCallBack(OpenModelica_threadData_ThreadData*, int , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char* , const char*) {

}

int SystemImpl__plotCallBackDefined(OpenModelica_threadData_ThreadData*) {
  return 0;
}

const char* SystemImpl__pwd(void) {
  return "";
}

double SystemImpl__realRand(void) {
  return 0.0;
}

int SystemImpl__relocateFunctions(const char* , modelica_metatype) {
  return 0;
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

int SystemImpl__spawnCall(const char* , const char*) {
  return 0;
}

int SystemImpl__systemCall(const char* , const char*) {
  return 0;
}

modelica_metatype SystemImpl__systemCallParallel(modelica_metatype , int) {
  return mmc_mk_nil();
}

void SystemImpl__waitForInput(void) {

}

const char* SystemImpl__winGetSystemDirectoryA(void) {
  return "";
}

void System_appendFile(const char* , const char*) {

}

void System_freeFunction(int , int) {

}

void System_freeLibrary(int , int) {

}

const char* System_gccDumpMachine(void) {
  return "";
}

const char* System_gccVersion(void) {
  return "";
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

const char* System_getClassnamesForSimulation(void) {
  return "";
}

void System_getCurrentDateTime(int* , int* , int* , int* , int* , int*) {

}

const char* System_getCurrentTimeStr(void) {
  return "";
}

modelica_metatype System_getFileModificationTime(const char*) {
  return mmc_mk_nil();
}

int System_getHasOverconstrainedConnectors(void) {
  return 0;
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

double System_getTimerCummulatedTime(void) {
  return 0.0;
}

double System_getTimerElapsedTime(void) {
  return 0.0;
}

double System_getTimerIntervalTime(void) {
  return 0.0;
}

int System_getTimerStackIndex(void) {
  return 0;
}

const char* System_getUUIDStr(void) {
  return "";
}

double System_getVariableValue(double , modelica_metatype , modelica_metatype) {
  return 0.0;
}

int System_getuid(void) {
  return 0;
}

int System_loadLibrary(const char* , int , int) {
  return 0;
}

int System_lookupFunction(int , const char*) {
  return 0;
}

const char* System_makeC89Identifier(const char*) {
  return "";
}

const char* System_openModelicaPlatformAlternative(void) {
  return "";
}

const char* System_popen(OpenModelica_threadData_ThreadData*, const char* , int*) {
  return "";
}

const char* System_readEnv(const char*) {
  return "";
}

const char* System_readFile(const char*) {
  return "";
}

double System_realtimeAccumulate(int) {
  return 0.0;
}

double System_realtimeAccumulated(int) {
  return 0.0;
}

modelica_metatype System_regex(const char* , const char* , int , int , int , int*) {
  return mmc_mk_nil();
}

void System_resetTimer(void) {

}

void System_setClassnamesForSimulation(const char*) {

}

void System_setUsesCardinality(int) {

}

const char* System_sprintff(const char* , double) {
  return "";
}

void System_startTimer(void) {

}

void System_stopTimer(void) {

}

int System_strcmp(const char* , const char*) {
  return 0;
}

int System_strcmp_offset(const char* , int , int , const char* , int , int) {
  return 0;
}

const char* System_stringFindString(const char* , const char*) {
  return "";
}

modelica_metatype System_subDirectories(const char*) {
  return mmc_mk_nil();
}

void System_threadFail(OpenModelica_threadData_ThreadData*) {

}

void System_writeFile(const char* , const char*) {

}

int setenv(const char* , const char* , int) {
  return 0;
}

/* --- from Unzip.h --- */
int om_unzip(const char* , const char* , const char*) {
  return 0;
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
