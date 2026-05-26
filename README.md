# OpenModelica WASM Port

**OpenModelica compiler + C CodeGen + simulator running entirely in a web browser.**
The user types Modelica in the page, presses Build / Compile / Run, and
gets a `.mat` trace back. There is no server, no upload.

## Status

* Most MSL examples run
* Only Euler and Runge Kutta solvers are functioning
* Requires a lot of browser memory (issue with static site approach)

## Try it

[**Demo Site**](https://ethanjameslew.github.io/omc-web/)

## License

OpenModelica source code is OSMC-PL / AGPLv3 (per upstream). Our glue
code is under the same licenses for compatibility — see source headers.
