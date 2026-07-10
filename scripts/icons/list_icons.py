#!/usr/bin/env python3
from __future__ import annotations

import io
import sys
import urllib.request

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

GITHUB_API = "https://api.github.com/repos/lucide-icons/lucide/contents/icons"


def fetch_icon_list() -> list[str]:
    req = urllib.request.Request(
        GITHUB_API,
        headers={"Accept": "application/vnd.github.v3+json", "User-Agent": "Hikari-Icon-Lister/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        import json

        data = json.loads(resp.read().decode("utf-8"))
    return sorted(item["name"].removesuffix(".svg") for item in data if item["name"].endswith(".svg"))


def main():
    icons = fetch_icon_list()
    print(f"Total: {len(icons)} icons\n")
    print("First 20:")
    for icon in icons[:20]:
        print(f"  - {icon}")


if __name__ == "__main__":
    main()
