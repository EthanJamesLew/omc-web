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

/* --- from Corba.h --- */
void Corba_close(void) {

}

int Corba_haveCorba(void) {
  return 0;
}

void Corba_initialize(void) {

}

void Corba_sendreply(const char*) {

}

void Corba_setObjectReferenceFilePath(const char*) {

}

void Corba_setSessionName(const char*) {

}

const char* Corba_waitForCommand(void) {
  return "";
}

/* --- from Curl.h --- */
int om_curl_multi_download(modelica_metatype , int) {
  return 0;
}

/* --- from Dynload.h --- */
modelica_metatype DynLoad_executeFunction(OpenModelica_threadData_ThreadData*, int , modelica_metatype , int) {
  return mmc_mk_nil();
}

/* --- from ErrorExt.h --- */
void ErrorImpl__clearMessages(OpenModelica_threadData_ThreadData*) {

}

void ErrorImpl__delCheckpoint(OpenModelica_threadData_ThreadData*, const char*) {

}

void ErrorImpl__deleteNumCheckpoints(OpenModelica_threadData_ThreadData*, int) {

}

void ErrorImpl__freeMessages(OpenModelica_threadData_ThreadData*, modelica_metatype) {

}

modelica_metatype ErrorImpl__getCheckpointMessages(OpenModelica_threadData_ThreadData*) {
  return mmc_mk_nil();
}

int ErrorImpl__getNumCheckpoints(OpenModelica_threadData_ThreadData*) {
  return 0;
}

int ErrorImpl__getNumErrorMessages(OpenModelica_threadData_ThreadData*) {
  return 0;
}

int ErrorImpl__getNumWarningMessages(OpenModelica_threadData_ThreadData*) {
  return 0;
}

int ErrorImpl__isTopCheckpoint(OpenModelica_threadData_ThreadData*, const char*) {
  return 0;
}

modelica_metatype ErrorImpl__pop(OpenModelica_threadData_ThreadData*, const char*) {
  return mmc_mk_nil();
}

void ErrorImpl__pushMessages(OpenModelica_threadData_ThreadData*, modelica_metatype) {

}

void ErrorImpl__rollBack(OpenModelica_threadData_ThreadData*, const char*) {

}

void ErrorImpl__rollbackNumCheckpoints(OpenModelica_threadData_ThreadData*, int) {

}

void ErrorImpl__setCheckpoint(OpenModelica_threadData_ThreadData*, const char*) {

}

void Error_addSourceMessage(OpenModelica_threadData_ThreadData*, int , modelica_metatype , modelica_metatype , int , int , int , int , int , const char* , const char* , modelica_metatype) {

}

modelica_metatype Error_getMessages(OpenModelica_threadData_ThreadData*) {
  return mmc_mk_nil();
}

int Error_getNumMessages(OpenModelica_threadData_ThreadData*) {
  return 0;
}

void Error_initAssertionFunctions(void) {

}

void Error_moveMessagesToParentThread(OpenModelica_threadData_ThreadData*) {

}

const char* Error_printCheckpointMessagesStr(OpenModelica_threadData_ThreadData*, int) {
  return "";
}

const char* Error_printErrorsNoWarning(OpenModelica_threadData_ThreadData*) {
  return "";
}

const char* Error_printMessagesStr(OpenModelica_threadData_ThreadData*, int) {
  return "";
}

void Error_registerModelicaFormatError(void) {

}

void Error_setShowErrorMessages(OpenModelica_threadData_ThreadData*, int) {

}

/* --- from FFI.h --- */
modelica_metatype FFI_callFunction(int , modelica_metatype , modelica_metatype , modelica_metatype , modelica_metatype*) {
  return mmc_mk_nil();
}

/* --- from IOStreamExt.h --- */
void IOStreamExt_appendBuffer(int , const char*) {

}

void IOStreamExt_appendFile(int , const char*) {

}

const char* IOStreamExt_appendReversedList(modelica_metatype) {
  return "";
}

void IOStreamExt_clearBuffer(int) {

}

void IOStreamExt_clearFile(int) {

}

void IOStreamExt_closeFile(int) {

}

int IOStreamExt_createBuffer(void) {
  return 0;
}

int IOStreamExt_createFile(const char*) {
  return 0;
}

void IOStreamExt_deleteBuffer(int) {

}

void IOStreamExt_deleteFile(int) {

}

void IOStreamExt_printBuffer(int , int) {

}

void IOStreamExt_printFile(int , int) {

}

void IOStreamExt_printReversedList(modelica_metatype , int) {

}

const char* IOStreamExt_readBuffer(int) {
  return "";
}

const char* IOStreamExt_readFile(int) {
  return "";
}

/* --- from Lapack.h --- */
void LapackImpl__dgbsv(int , int , int , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgeev(const char* , const char* , int , modelica_metatype , int , int , int , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgegv(const char* , const char* , int , modelica_metatype , int , modelica_metatype , int , int , int , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgels(const char* , int , int , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgelsx(int , int , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype , double , modelica_metatype , modelica_metatype* , modelica_metatype* , modelica_metatype* , int* , int*) {

}

void LapackImpl__dgelsy(int , int , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype , double , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , int* , modelica_metatype* , int*) {

}

void LapackImpl__dgeqpf(int , int , modelica_metatype , int , modelica_metatype , modelica_metatype , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgesv(int , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgesvd(const char* , const char* , int , int , modelica_metatype , int , int , int , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgetrf(int , int , modelica_metatype , int , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgetri(int , modelica_metatype , int , modelica_metatype , modelica_metatype , int , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgetrs(const char* , int , int , modelica_metatype , int , modelica_metatype , modelica_metatype , int , modelica_metatype* , int*) {

}

void LapackImpl__dgglse(int , int , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype , modelica_metatype , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dgtsv(int , int , modelica_metatype , modelica_metatype , modelica_metatype , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dhseqr(const char* , const char* , int , int , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype , int , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , int*) {

}

void LapackImpl__dorgqr(int , int , int , modelica_metatype , int , modelica_metatype , modelica_metatype , int , modelica_metatype* , modelica_metatype* , int*) {

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

/* --- from Print.h --- */
void Print_clearBuf(OpenModelica_threadData_ThreadData*) {

}

void Print_clearErrorBuf(OpenModelica_threadData_ThreadData*) {

}

int Print_getBufLength(OpenModelica_threadData_ThreadData*) {
  return 0;
}

const char* Print_getErrorString(OpenModelica_threadData_ThreadData*) {
  return "";
}

const char* Print_getString(OpenModelica_threadData_ThreadData*) {
  return "";
}

int Print_hasBufNewLineAtEnd(OpenModelica_threadData_ThreadData*) {
  return 0;
}

void Print_printBufLen(OpenModelica_threadData_ThreadData*, const char* , int) {

}

void Print_printBufNewLine(OpenModelica_threadData_ThreadData*) {

}

void Print_printBufSpace(OpenModelica_threadData_ThreadData*, int) {

}

void Print_printErrorBuf(OpenModelica_threadData_ThreadData*, const char*) {

}

void Print_restoreBuf(OpenModelica_threadData_ThreadData*, int) {

}

int Print_saveAndClearBuf(OpenModelica_threadData_ThreadData*) {
  return 0;
}

void Print_writeBuf(OpenModelica_threadData_ThreadData*, const char*) {

}

void Print_writeBufConvertLines(OpenModelica_threadData_ThreadData*, const char*) {

}

/* --- from Settings.h --- */
int Settings_getEcho(void) {
  return 0;
}

void Settings_setEcho(int) {

}

/* --- from SimulationResults.h --- */
void SimulationResults_close(void) {

}

modelica_metatype SimulationResults_cmpSimulationResults(int , const char* , const char* , const char* , double , double , modelica_metatype) {
  return mmc_mk_nil();
}

double SimulationResults_deltaSimulationResults(const char* , const char* , const char* , modelica_metatype) {
  return 0.0;
}

modelica_metatype SimulationResults_diffSimulationResults(int , const char* , const char* , const char* , double , double , double , modelica_metatype , int , int*) {
  return mmc_mk_nil();
}

const char* SimulationResults_diffSimulationResultsHtml(int , const char* , const char* , const char* , double , double , double) {
  return "";
}

int SimulationResults_filterSimulationResults(const char* , const char* , modelica_metatype , int , int , int) {
  return 0;
}

modelica_metatype SimulationResults_readDataset(const char* , modelica_metatype , int) {
  return mmc_mk_nil();
}

int SimulationResults_readSimulationResultSize(const char*) {
  return 0;
}

modelica_metatype SimulationResults_readVariables(const char* , int , int) {
  return mmc_mk_nil();
}

double SimulationResults_val(const char* , const char* , double) {
  return 0.0;
}

/* --- from Socket.h --- */
void Socket_cleanup(void) {

}

void Socket_close(int) {

}

const char* Socket_handlerequest(int) {
  return "";
}

void Socket_sendreply(int , const char*) {

}

int Socket_waitforconnect(int) {
  return 0;
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

double SystemImpl__getSizeOfData(modelica_metatype , double* , double*) {
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

double System_getMemorySize(void) {
  return 0.0;
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

/* --- from UnitParserExt.h --- */
void UnitParserExtImpl__addBase(const char*) {

}

void UnitParserExtImpl__addDerived(const char* , const char*) {

}

void UnitParserExtImpl__addDerivedWeight(const char* , const char* , double) {

}

modelica_metatype UnitParserExtImpl__allUnitSymbols(void) {
  return mmc_mk_nil();
}

void UnitParserExtImpl__checkpoint(void) {

}

void UnitParserExtImpl__clear(void) {

}

void UnitParserExtImpl__commit(void) {

}

void UnitParserExtImpl__initSIUnits(void) {

}

void UnitParserExtImpl__registerWeight(const char* , double) {

}

void UnitParserExtImpl__rollback(void) {

}

void UnitParserExt_str2unit(const char* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , modelica_metatype* , double* , double*) {

}

const char* UnitParserExt_unit2str(modelica_metatype , modelica_metatype , modelica_metatype , modelica_metatype , modelica_metatype , double , double) {
  return "";
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
