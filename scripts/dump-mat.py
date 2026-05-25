#!/usr/bin/env python3
"""Dump an OMC <Model>_res.mat (MAT4) to CSV-on-stdout. Uses scipy.io."""
import sys, scipy.io as sio, numpy as np

m = sio.loadmat(sys.argv[1] if len(sys.argv) > 1 else "build/bouncing/BouncingBall_res.mat")

names_raw = m["name"]
# OMC MAT4 stores 'name' as shape (max_namelen,) where each element is
# a fixed-width string of length n_vars — chars laid out column-major.
# Reconstruct each variable name by walking across the array.
if names_raw.dtype.kind in ("U", "S"):
    n_vars_guess = len(names_raw[0]) if len(names_raw) else 0
    names = []
    for v in range(n_vars_guess):
        s = "".join(str(row)[v] if v < len(str(row)) else "" for row in names_raw)
        names.append(s.rstrip("\x00 ").strip())
else:
    names = ["".join(chr(int(c)) for c in row if c).strip() for row in names_raw]
data2 = m["data_2"]                    # shape (n_vars, n_steps)
n_vars, n_steps = data2.shape
print(f"=== {sys.argv[1] if len(sys.argv)>1 else 'res.mat'}: {n_vars} variables × {n_steps} time steps")
print(",".join(names[:n_vars]))
for s in range(n_steps):
    print(",".join(f"{data2[i,s]:.6g}" for i in range(n_vars)))
