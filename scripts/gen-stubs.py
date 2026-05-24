#!/usr/bin/env python3
"""Generate C stub implementations for `extern` C symbols that the OMC
bootstrap C expects from the Compiler/runtime/ shim layer.

Reads a list of unresolved symbols from build/undefined-symbols.txt, looks
up each one's signature in the bootstrap-sources/build/*.h headers, and
emits a stub function returning a default value (0, NULL, mmc_mk_nil(), ...).

The output goes to src/omcweb_stubs_auto.c. It's intentionally a SEPARATE
file from the hand-written src/omcweb_stubs.c so a human-written stub
always takes precedence (the auto stubs only get linked for symbols not
already provided).

Usage:
  python3 scripts/gen-stubs.py
"""
from __future__ import annotations
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNRESOLVED = ROOT / "build" / "undefined-symbols.txt"
HEADERS_DIR = Path(os.environ.get(
    "OMC_BUILD_HEADERS",
    "/tmp/OpenModelica/OMCompiler/Compiler/boot/bootstrap-sources/build",
))
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


def index_headers(dir: Path) -> dict[str, tuple[str, str, str]]:
    """Return {name: (return_type, args_text, header_file)}."""
    idx: dict[str, tuple[str, str, str]] = {}
    for hdr in dir.glob("*.h"):
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


def emit_stub(name: str, ret: str, args: str) -> str:
    # Argument list — keep types but drop names so unused-warns are silent.
    # If `args` is empty or just "void", emit "void".
    args_clean = args.strip()
    if args_clean in ("", "void"):
        args_clean = "void"
    body = default_return(ret)
    body_line = "  " + body if body else ""
    return f"{ret} {name}({args_clean}) {{\n{body_line}\n}}\n"


def main() -> int:
    if not UNRESOLVED.exists():
        print(f"missing {UNRESOLVED}; run scripts/link.sh first", file=sys.stderr)
        return 1
    symbols = load_symbols(UNRESOLVED)
    index = index_headers(HEADERS_DIR)
    skip = hand_provided(HAND_FILE) | hand_provided(STUB_FILE)
    # Keep previously-emitted auto-stubs by re-adding them as already-emitted.
    previously_auto = hand_provided(STUB_FILE)

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

    out = []
    out.append("/* omc-web: AUTO-GENERATED stubs. Do not hand-edit.")
    out.append(" * Regenerate via: python3 scripts/gen-stubs.py")
    out.append(" * These return default values (0, NULL, \"\", mmc_mk_nil) for")
    out.append(" * functions whose proper implementation hasn't been ported yet.")
    out.append(" * Hand-written stubs in omcweb_stubs.c take precedence. */")
    out.append("")
    out.append("#include \"meta/meta_modelica.h\"")
    out.append("#include \"openmodelica.h\"")
    out.append("#include <stdlib.h>")
    out.append("#include <string.h>")
    out.append("")
    by_hdr: dict[str, list[tuple[str, str, str]]] = {}
    for name, ret, args, hdr in emitted:
        by_hdr.setdefault(hdr, []).append((name, ret, args))
    for hdr in sorted(by_hdr):
        out.append(f"/* --- from {hdr} --- */")
        for name, ret, args in sorted(by_hdr[hdr]):
            out.append(emit_stub(name, ret, args))
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
