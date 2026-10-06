#!/usr/bin/env python3
"""Simple E2E test for system pages only.

Converted from scripts/test_system_pages.sh on 2026-10-06 per the
workspace tooling-script policy (AGENTS.md §7.5, extended 2026-10-06).
"""

import sys
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Treat 3xx as a final answer (curl without -L): return it instead
    of following, so the body print matches the original empty-body
    behavior."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

ROUTES = [
    "system",
    "system/css",
    "system/icons",
    "system/palette",
    "system/animations",
]

# `curl -s <url> 2>&1 | head -20` kept the first 20 lines of the response
# body (-s muted even curl's own error messages).
HEAD_LINES = 20


def fetch_head(url: str) -> str:
    try:
        # No redirect following: the original `curl -s` had no -L, so a
        # 302 answered an empty body — urllib would silently follow it
        # and print the redirect target instead (R1 finding).
        opener = urllib.request.build_opener(NoRedirect)
        with opener.open(url) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
    except urllib.error.URLError:
        body = ""
    return "".join(body.splitlines(keepends=True)[:HEAD_LINES])


def main() -> int:
    print("Testing system pages...")

    for route in ROUTES:
        print(f"Testing: {route}")
        sys.stdout.write(fetch_head(f"http://localhost:3000/{route}"))
        sys.stdout.write("\n")

    print("Done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
