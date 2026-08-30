"""Regenerate ``app/data/locations.py`` from the frontend's location list.

The listing form, the filters and Uyiz AI all have to agree on what a
district is called, or a search will silently never match. The frontend file
is the source of truth because it is what the form writes onto a listing; this
copies it into a Python module the backend can import.

    python -m scripts.sync_locations          # rewrite the module
    python -m scripts.sync_locations --check  # fail if it is out of date

The --check form is the one worth wiring into CI: it turns "someone added a
district and forgot the backend" into a failed build instead of an assistant
that cannot find anything there.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "src" / "data" / "mockLocations.ts"
TARGET = Path(__file__).resolve().parents[1] / "app" / "data" / "locations.py"

_REGION = re.compile(
    r"\{\s*id:\s*'([^']+)',\s*name:\s*'((?:[^'\\]|\\.)*)',\s*"
    r"districts:\s*\[(.*?)\]\s*\}",
    re.S,
)
_STATIONS = re.compile(r"stations:\s*\[(.*?)\]", re.S)
#: A single-quoted TS string, allowing backslash escapes inside it.
_STRING = re.compile(r"'((?:[^'\\]|\\.)*)'")

HEADER = '''"""Where Uzbekistan actually is.

Uyiz AI used to know twelve district names — the ones in Tashkent city — and
nothing else, so "Samarqandda uy kere" parsed as a request with no location at
all. This is the full administrative map: 14 regions, every district, and the
Tashkent metro.

Generated from ``src/data/mockLocations.ts``, which the listing form and the
filters already write onto listings, so the assistant recognises exactly the
places a listing can be filed under.

Do not edit by hand. Regenerate with::

    python -m scripts.sync_locations
"""

from __future__ import annotations

'''


def _unescape(value: str) -> str:
    """Turn a TS single-quoted literal's body into the text it denotes."""
    return re.sub(r"\\(.)", r"\1", value)


def _strings(blob: str) -> list[str]:
    return [_unescape(m.group(1)) for m in _STRING.finditer(blob)]


def _wrap(items: list[str], indent: str, width: int = 84) -> list[str]:
    """Lay values out several per line so the file stays readable."""
    lines: list[str] = []
    row = indent
    for item in items:
        piece = f"{item!r}, "
        if len(row) + len(piece) > width and row.strip():
            lines.append(row.rstrip())
            row = indent
        row += piece
    if row.strip():
        lines.append(row.rstrip())
    return lines


def render() -> str:
    source = SOURCE.read_text(encoding="utf-8")

    regions = [
        (_unescape(name), _strings(districts))
        for _id, name, districts in _REGION.findall(source)
    ]
    if not regions:
        raise SystemExit(f"No regions found in {SOURCE}")

    stations = sorted({s for block in _STATIONS.findall(source) for s in _strings(block)})

    out = [HEADER]
    out.append("#: Region -> its districts, exactly as they are stored on a listing.")
    out.append("REGIONS: dict[str, tuple[str, ...]] = {")
    for name, districts in regions:
        out.append(f"    {name!r}: (")
        out.extend(_wrap(districts, "        "))
        out.append("    ),")
    out.append("}")
    out.append("")
    out.append("#: Tashkent metro stations. People describe where they want to live by")
    out.append('#: the nearest one at least as often as by district ("Bodomzor yaqinida").')
    out.append("METRO_STATIONS: tuple[str, ...] = (")
    out.extend(_wrap(stations, "    "))
    out.append(")")
    out.append("")
    out.append("#: Flat lookup: district -> the region it belongs to.")
    out.append("DISTRICT_TO_REGION: dict[str, str] = {")
    out.append("    district: region")
    out.append("    for region, districts in REGIONS.items()")
    out.append("    for district in districts")
    out.append("}")
    out.append("")
    out.append("ALL_DISTRICTS: tuple[str, ...] = tuple(DISTRICT_TO_REGION)")
    out.append("ALL_REGIONS: tuple[str, ...] = tuple(REGIONS)")
    out.append("")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if the generated module is out of date",
    )
    args = parser.parse_args()

    rendered = render()
    current = TARGET.read_text(encoding="utf-8") if TARGET.exists() else ""

    if args.check:
        if rendered != current:
            print(
                f"{TARGET.name} is out of date with {SOURCE.name}.\n"
                "Run: python -m scripts.sync_locations",
                file=sys.stderr,
            )
            return 1
        print(f"{TARGET.name} is up to date")
        return 0

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(rendered, encoding="utf-8")
    regions = rendered.count("': (")
    print(f"Wrote {TARGET.relative_to(ROOT)} — {regions} regions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
