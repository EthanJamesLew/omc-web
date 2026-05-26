/* omc-web: empty blaswrap.h — overrides the 3rdParty/dgesv version
 * which #defines every BLAS/LAPACK symbol as `f2c_<name>`. We want the
 * standard Fortran-style `<name>_` symbols visible so OMC's
 * SimulationRuntime (which references dscal_/dgemm_/dgetrf_/etc.) and
 * sundials's lapack_dense (which links against liblapack) link cleanly. */
#ifndef BLASWRAP_H
#define BLASWRAP_H
#endif
