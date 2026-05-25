#!/usr/bin/env python3
"""Generate C stub implementations for the `extern` C functions that OMC's
MetaModelica-generated C calls into. These are the "Compiler/runtime/"
shim layer that real OMC provides via hand-written .c/.cpp; we provide
no-op defaults so the wasm can link and run.

Strategy: scan the OMC bootstrap-sources build headers (a select set
that hosts the System/Settings/Print/etc. extern declarations) and emit
a default-value stub (`return 0`, `""`, `mmc_mk_nil()`, …) for every
function. Hand-written stubs in src/omcweb_stubs.c take precedence
(emitted as static inline shims of the same name would not — that
would cause linker conflicts — so we check the hand file and skip any
symbol it defines).

The output is src/omcweb_stubs_auto.c. Idempotent and complete: no
iteration with build/undefined-symbols.txt is needed.

  python3 scripts/gen-stubs.py
"""
from __future__ import annotations
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Which header files host the runtime-shim externs. These are the .h files
# in bootstrap-sources/build/ that correspond to OMC modules with
# `external "C"` MetaModelica bindings into Compiler/runtime/*. We
# intentionally do NOT scan every .h — most are pure-MetaModelica modules
# whose externs are within the bootstrap C itself, already linked.
SHIM_HEADERS = [
    "System.h", "Settings.h", "Print.h", "ErrorExt.h", "Error.h",
    "Curl.h", "FFI.h", "OMSimulatorExt.h", "ZeroMQ.h", "Socket.h",
    "Lapack.h", "BackendDAEEXT.h", "ASSCEXT.h", "ParserExt.h",
    "Database.h", "IOStreamExt.h", "JSONExt.h", "Dynload.h",
    "UnitParserExt.h", "PackageManagement.h", "FMIExt.h",
    "VarTransform.h", "Corba.h", "DiffAlgorithm.h",
    "TaskGraphResults.h", "HpcOmBenchmarkExt.h", "HpcOmSchedulerExt.h",
    "ZeroCrossings.h", "UnitChecker.h", "Unzip.h", "GraphML.h",
    "SimulationResults.h", "Refactor.h", "RewriteRules.h",
    "Figaro.h", "Obfuscate.h",
]
def _find_headers() -> Path:
    """Prefer OMBootstrapping (full compiler) — its headers cover signatures
    only referenced by the real Backend/SimCode. Fall back to the in-tree
    bootstrap headers if OMBootstrapping isn't present."""
    env = os.environ.get("OMC_BUILD_HEADERS")
    if env:
        return Path(env)
    candidates = [
        Path("/tmp/OMBootstrapping/bootstrap-sources/build"),
        Path("/tmp/OpenModelica/OMCompiler/Compiler/boot/bootstrap-sources/build"),
    ]
    for c in candidates:
        if c.is_dir():
            return c
    raise RuntimeError("no OMC bootstrap-sources/build directory found")

HEADERS_DIR = _find_headers()
STUB_FILE = ROOT / "src" / "omcweb_stubs_auto.c"
HAND_FILE = ROOT / "src" / "omcweb_stubs.c"

# Pattern matches:
#   extern <ret> <name>(<args>);
EXTERN_RE = re.compile(
    r"^extern\s+(?P<ret>[\w\s\*]+?)\s+(?P<name>[A-Za-z_]\w*)\s*\((?P<args>[^;]*)\)\s*;",
    re.MULTILINE,
)


def load_symbols(path: Path) -> list[str]:
    return [line.strip() for line in path.read_text().splitlines() if line.strip()]


def index_headers(dir: Path, only: list[str] | None = None) -> dict[str, tuple[str, str, str]]:
    """Return {name: (return_type, args_text, header_file)}. If `only` is
    given, restrict to that list of header filenames."""
    idx: dict[str, tuple[str, str, str]] = {}
    headers = [dir / n for n in only] if only else list(dir.glob("*.h"))
    for hdr in headers:
        if not hdr.exists():
            continue
        try:
            text = hdr.read_text()
        except UnicodeDecodeError:
            continue
        for m in EXTERN_RE.finditer(text):
            name = m.group("name")
            if name in idx:
                continue
            ret = " ".join(m.group("ret").split())
            args = re.sub(r"/\*.*?\*/", "", m.group("args")).strip()
            args = " ".join(args.split())
            idx[name] = (ret, args, hdr.name)
    return idx


def hand_provided(path: Path) -> set[str]:
    """Functions already defined in a stubs file."""
    text = path.read_text() if path.exists() else ""
    # Anchor at the start of a line; OMC stubs are System_* / SystemImpl__* /
    # Settings_* / Settings__Impl style identifiers — uppercase-prefixed.
    return set(re.findall(
        r"^[\w\s\*]+?\s([A-Z][A-Za-z_0-9]*)\s*\([^)]*\)\s*\{",
        text, re.MULTILINE,
    ))


def default_return(ret: str) -> str:
    r = ret.replace("const", "").strip()
    if r in ("void", "void\n"):
        return ""
    if "char*" in r or "char *" in r:
        return 'return "";'
    if r in ("int", "long", "modelica_integer", "modelica_boolean"):
        return "return 0;"
    if r in ("double", "modelica_real", "float"):
        return "return 0.0;"
    if "metatype" in r:
        return "return mmc_mk_nil();"
    if "*" in r:
        return "return 0;"
    return "return 0;"


def emit_stub(name: str, ret: str, args: str, trace: bool = False) -> str:
    """Emit a C stub function. If `trace`, prepend a fprintf so we can see
    which stubs get called during a run (useful for debugging crashes
    deep inside OMC)."""
    args_clean = args.strip()
    if args_clean in ("", "void"):
        args_clean = "void"
    body = default_return(ret)
    body_line = "  " + body if body else ""
    trace_line = ""
    if trace:
        trace_line = f'  fprintf(stderr, "[stub] {name}\\n");\n'
    return f"{ret} {name}({args_clean}) {{\n{trace_line}{body_line}\n}}\n"


def _externals_in_file(path: Path) -> set[str]:
    """Function names DEFINED in a source/object .c file (so we don't
    duplicate them)."""
    if not path.exists():
        return set()
    text = path.read_text(errors="replace")
    return set(re.findall(r"^\s*(?:extern\s+)?[\w\s\*]+?\s([A-Z][A-Za-z_0-9]*)\s*\([^)]*\)\s*\{", text, re.MULTILINE))


def _symbols_in_archive(ar: Path) -> set[str]:
    """`T` (text) symbols defined in a .a archive. Need emsdk env activated."""
    if not ar.exists():
        return set()
    import subprocess
    r = subprocess.run(["emnm", str(ar)], capture_output=True, text=True)
    if r.returncode != 0:
        return set()
    out = set()
    for line in r.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[1] in ("T", "W"):
            out.add(parts[2])
    return out


# libc / POSIX names that OMC declares extern but where we want
# emscripten's real implementation, not our zero-return stub.
# (`setenv` deliberately NOT here: OMC's MetaModelica `setenv` external
# calls back to libc setenv via the wrapper in OMBootstrapping. Allowing
# our auto-stub to override is harmless — at worst env vars don't get
# set, which we don't need in the wasm anyway.)
LIBC_NAMES = {
    "fputs", "fopen", "fclose", "fread", "fwrite",
    "alarm", "rename", "remove", "unlink",
    "access", "stat", "chmod",
    "strlen", "strcmp", "strncmp", "strchr",
    "malloc", "free", "calloc", "realloc",
    "exit", "atexit",
}


def main() -> int:
    # Index every extern in the shim headers. We emit a stub for every one,
    # then let the linker pick up only the symbols actually referenced —
    # this avoids the "iterate until convergence" drift entirely.
    index = index_headers(HEADERS_DIR, only=SHIM_HEADERS)
    skip = hand_provided(HAND_FILE) | LIBC_NAMES

    # Skip anything OMBootstrapping already defines in FakeBoostrappingExternals.c
    # to avoid duplicate-symbol link errors.
    fake_path = HEADERS_DIR / "FakeBoostrappingExternals.c"
    skip |= _externals_in_file(fake_path)

    # Skip anything we already provide via OMC archives, the OMBootstrapping
    # fake-externals shim, or the antlr3/ryu/gc/parser deps. Otherwise the
    # linker takes the auto-stub's NULL-returning impl OVER the real one
    # in the archive (object files beat archive contents). The parser case
    # was the bouncing-ball crash: ParserExt_parse was being stubbed to
    # mmc_mk_nil(), shadowing the real ANTLR-generated parser.
    for ar_path in (
        ROOT / "build" / "libomcruntime.a",
        ROOT / "build" / "libomcsimrt.a",
        ROOT / "build" / "libomcbootstrap.a",
        ROOT / "build" / "parser-gen" / "libomcparser.a",
        ROOT / "build" / "deps" / "antlr3" / "libomantlr3.a",
        ROOT / "build" / "deps" / "gc" / "libomcgc.a",
        ROOT / "build" / "deps" / "ryu" / "libomcryu.a",
    ):
        skip |= _symbols_in_archive(ar_path)

    symbols = sorted(index.keys())
    previously_auto = set()  # unused now; kept for compatibility

    missing_sig = []
    emitted: list[tuple[str, str, str, str]] = []
    # Always include previously-emitted auto-stubs.
    for name in sorted(previously_auto):
        if name in index:
            ret, args, hdr = index[name]
            emitted.append((name, ret, args, hdr))
    # Add newly-undefined symbols.
    seen = {n for n, _, _, _ in emitted}
    for s in symbols:
        if s in skip or s in seen:
            continue
        if s not in index:
            missing_sig.append(s)
            continue
        ret, args, hdr = index[s]
        emitted.append((s, ret, args, hdr))
        seen.add(s)

    trace = os.environ.get("OMCWEB_STUB_TRACE") == "1"
    out = []
    out.append("/* omc-web: AUTO-GENERATED stubs. Do not hand-edit.")
    out.append(" * Regenerate via: python3 scripts/gen-stubs.py")
    out.append(" * Default-value stubs (0, NULL, \"\", mmc_mk_nil) for the")
    out.append(" * runtime-shim externs OMC's MetaModelica-generated C calls into.")
    out.append(" * Hand-written stubs in omcweb_stubs.c take precedence.")
    out.append(f" * Tracing: {'ENABLED — fprintf on every call' if trace else 'disabled (set OMCWEB_STUB_TRACE=1 to enable)'} */")
    out.append("")
    out.append("#include \"meta/meta_modelica.h\"")
    out.append("#include \"openmodelica.h\"")
    out.append("#include <stdio.h>")
    out.append("#include <stdlib.h>")
    out.append("#include <string.h>")
    out.append("")
    by_hdr: dict[str, list[tuple[str, str, str]]] = {}
    for name, ret, args, hdr in emitted:
        by_hdr.setdefault(hdr, []).append((name, ret, args))
    for hdr in sorted(by_hdr):
        out.append(f"/* --- from {hdr} --- */")
        for name, ret, args in sorted(by_hdr[hdr]):
            out.append(emit_stub(name, ret, args, trace=trace))
    STUB_FILE.write_text("\n".join(out))

    print(f"wrote {STUB_FILE}: {len(emitted)} stubs")
    if missing_sig:
        print(f"  no signature found for {len(missing_sig)} symbols:")
        for s in missing_sig[:20]:
            print(f"    {s}")
        if len(missing_sig) > 20:
            print(f"    ... and {len(missing_sig) - 20} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
