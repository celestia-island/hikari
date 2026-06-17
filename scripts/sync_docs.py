#!/usr/bin/env python3
"""Sync markdown documentation from root docs/ to examples/website/public/docs/.

Locale mapping (short code -> BCP 47):
  en   -> en-US
  zhs  -> zh-CHS
  zht  -> zh-CHT
  ja   -> ja-JP
  ko   -> ko-KR
  fr   -> fr-FR
  es   -> es-ES
  ru   -> ru-RU
  ar   -> ar-SA
"""

import shutil
import sys
from pathlib import Path

LOCALE_MAP = {
    "en": "en-US",
    "zhs": "zh-CHS",
    "zht": "zh-CHT",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "fr": "fr-FR",
    "es": "es-ES",
    "ru": "ru-RU",
    "ar": "ar-SA",
}

REPO_ROOT = Path(__file__).resolve().parent.parent
DOCS_SRC = REPO_ROOT / "docs"
PUBLIC_DST = REPO_ROOT / "examples" / "website" / "public" / "docs"


def sync_locale(src_locale: Path, dst_locale: Path) -> int:
    count = 0
    if dst_locale.exists():
        shutil.rmtree(dst_locale)
    for md_file in src_locale.rglob("*.md"):
        rel = md_file.relative_to(src_locale)
        dest = dst_locale / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(md_file, dest)
        count += 1
    return count


def main() -> None:
    if not DOCS_SRC.is_dir():
        print(f"docs source not found: {DOCS_SRC}", file=sys.stderr)
        sys.exit(1)

    total = 0
    for short, bcp47 in LOCALE_MAP.items():
        src = DOCS_SRC / short
        if not src.is_dir():
            continue
        dst = PUBLIC_DST / bcp47
        n = sync_locale(src, dst)
        print(f"  {short} -> {bcp47}: {n} files")
        total += n

    print(f"synced {total} doc files total")


if __name__ == "__main__":
    main()
