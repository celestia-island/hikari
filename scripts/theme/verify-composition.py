#!/usr/bin/env python3
"""Composition equivalence verifier for the theme normalization.

Given two bundle compositions (ordered scss file lists), statically resolve
the winning value of every token (all sheets declare on :root at equal
specificity, so the LAST definition in bundle order wins — @use/@import
inlines sheets in order) and diff the two final value tables.

Usage:
  python3 scripts/theme/verify-composition.py \
    --old f1.scss f2.scss ... --new g1.scss g2.scss ...

Exit code 0 when every token resolves to the same value in both bundles
(allowlisted diffs excluded); 1 otherwise, printing each differing token.
"""
import argparse
import re
import sys


def strip_comments(source: str) -> str:
    source = re.sub(r"/\*[\s\S]*?\*/", "", source)
    return re.sub(r"^[ \t]*//.*$", "", source, flags=re.M)


def resolve_bundle(entry_files, base_dirs):
    """Flatten @use/@import of local .scss files depth-first, dedup @use."""
    ordered, seen = [], set()

    def load(path):
        real = path
        for base in base_dirs:
            candidate = os.path.join(base, path)
            if os.path.isfile(candidate):
                real = candidate
                break
        if real not in seen:
            seen.add(real)
            text = open(real).read()
            text = re.sub(r"^//.*$", "", text, flags=re.M)
            for m in re.finditer(r"@(?:use|import)\s+['\"]([^'\"]+)['\"]", text):
                target = m.group(1)
                if not target.endswith(".scss"):
                    target += ".scss"
                target = os.path.normpath(
                    os.path.join(os.path.dirname(real), target)
                )
                load(target)
            ordered.append(real)

    for entry in entry_files:
        load(entry)
    return ordered


def winning_values(files):
    values = {}
    for path in files:
        css = strip_comments(open(path).read())
        for m in re.finditer(r"(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);", css):
            values[m.group(1)] = re.sub(r"\s+", " ", m.group(2)).strip()
    return values


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", nargs="+", required=True)
    ap.add_argument("--new", nargs="+", required=True)
    ap.add_argument("--base", nargs="+", required=True,
                    help="directories used to resolve bundle-relative paths")
    ap.add_argument("--allow", default="",
                    help="comma-separated tokens allowed to differ")
    args = ap.parse_args()
    allow = set(filter(None, args.allow.split(",")))

    old_files = resolve_bundle(args.old, args.base)
    new_files = resolve_bundle(args.new, args.base)
    old_vals = winning_values(old_files)
    new_vals = winning_values(new_files)

    diffs = []
    for token in sorted(set(old_vals) | set(new_vals)):
        before, after = old_vals.get(token), new_vals.get(token)
        if before != after and token not in allow:
            diffs.append((token, before, after))

    print(f"old bundle: {len(old_files)} sheets, {len(old_vals)} tokens")
    print(f"new bundle: {len(new_files)} sheets, {len(new_vals)} tokens")
    for token, before, after in diffs:
        print(f"DIFF {token}\n  old: {before}\n  new: {after}")
    print(f"differing tokens: {len(diffs)}")
    sys.exit(1 if diffs else 0)


if __name__ == "__main__":
    main()
