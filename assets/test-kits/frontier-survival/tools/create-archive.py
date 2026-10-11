#!/usr/bin/env python3
"""Package the finished test kit without changing any image pixels."""
from pathlib import Path
import hashlib
import json
import zipfile

kit = Path(__file__).resolve().parent.parent
for required in ("index.html", "manifest.json", "README.md", "vector-rig/rig-preview.html"):
    if not (kit / required).is_file():
        raise SystemExit(f"Kit incomplete: missing {required}")
destination = kit.parent / "frontier-survival.zip"
files = sorted(p for p in kit.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for source in files:
        info = zipfile.ZipInfo(f"frontier-survival/{source.relative_to(kit).as_posix()}", date_time=(2026, 10, 11, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, source.read_bytes())
with zipfile.ZipFile(destination) as archive:
    damaged = archive.testzip()
    if damaged:
        raise SystemExit(f"Archive integrity failure: {damaged}")
print(json.dumps({"archive": str(destination), "files": len(files), "bytes": destination.stat().st_size,
                  "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "integrity": "passed"}, indent=2))
