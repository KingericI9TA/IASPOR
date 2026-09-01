#!/usr/bin/env python3
"""Declara INTERNET y ACCESS_NETWORK_STATE en el AndroidManifest de Bubblewrap."""

from pathlib import Path
import re
import sys

def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    manifest = root / "app/src/main/AndroidManifest.xml"
    if not manifest.exists():
        print(f"Falta {manifest}", file=sys.stderr)
        return 1
    text = manifest.read_text()
    needed = [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
    ]
    insert = "\n".join(
        f'    <uses-permission android:name="{name}" />'
        for name in needed
        if name not in text
    )
    if not insert:
        print("permisos de red ya estaban")
        return 0
    updated, n = re.subn(r"(<manifest\b[^>]*>)", r"\1\n" + insert, text, count=1)
    if n != 1:
        print("No se pudo declarar INTERNET en AndroidManifest.xml", file=sys.stderr)
        return 1
    manifest.write_text(updated)
    print("permisos de red añadidos")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
