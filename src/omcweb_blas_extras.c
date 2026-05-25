/* omc-web: BLAS functions sundials tests / uses but that OMC's bundled
 * f2c BLAS subset (3rdParty/dgesv/blas/) doesn't ship. We provide them
 * as straight C implementations matching the Fortran/f2c ABI
 * (lowercase, trailing underscore, in/out pointers, all sizes via
 * pointer-to-int). */

void dcopy_(int *n, const double *x, const int *incx,
            double *y, const int *incy) {
  int i, nn = *n, sx = *incx, sy = *incy;
  if (sx == 1 && sy == 1) {
    for (i = 0; i < nn; i++) y[i] = x[i];
  } else {
    int ix = (sx >= 0) ? 0 : (1 - nn) * sx;
    int iy = (sy >= 0) ? 0 : (1 - nn) * sy;
    for (i = 0; i < nn; i++, ix += sx, iy += sy) y[iy] = x[ix];
  }
}

double dnrm2_(int *n, const double *x, const int *incx) {
  int i, nn = *n, sx = *incx;
  double ssq = 0.0, scale = 0.0;
  if (nn < 1 || sx < 1) return 0.0;
  for (i = 0; i < nn; i++) {
    double xi = x[i * sx];
    if (xi != 0.0) {
      double ax = xi < 0 ? -xi : xi;
      if (scale < ax) {
        double r = scale / ax;
        ssq = 1.0 + ssq * r * r;
        scale = ax;
      } else {
        double r = ax / scale;
        ssq += r * r;
      }
    }
  }
  return scale * __builtin_sqrt(ssq);
}

double ddot_(int *n, const double *x, const int *incx,
             const double *y, const int *incy) {
  int i, nn = *n, sx = *incx, sy = *incy;
  double s = 0.0;
  if (sx == 1 && sy == 1) {
    for (i = 0; i < nn; i++) s += x[i] * y[i];
  } else {
    int ix = (sx >= 0) ? 0 : (1 - nn) * sx;
    int iy = (sy >= 0) ? 0 : (1 - nn) * sy;
    for (i = 0; i < nn; i++, ix += sx, iy += sy) s += x[ix] * y[iy];
  }
  return s;
}

void daxpy_(int *n, double *alpha, const double *x, const int *incx,
            double *y, const int *incy) {
  int i, nn = *n, sx = *incx, sy = *incy;
  double a = *alpha;
  if (a == 0.0) return;
  if (sx == 1 && sy == 1) {
    for (i = 0; i < nn; i++) y[i] += a * x[i];
  } else {
    int ix = (sx >= 0) ? 0 : (1 - nn) * sx;
    int iy = (sy >= 0) ? 0 : (1 - nn) * sy;
    for (i = 0; i < nn; i++, ix += sx, iy += sy) y[iy] += a * x[ix];
  }
}
