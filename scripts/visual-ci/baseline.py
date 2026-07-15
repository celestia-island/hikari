#!/usr/bin/env python3
"""Visual regression baseline management utilities."""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def cmd_accept(args):
    dst = Path("tests/visual/baseline/default")
    dst.mkdir(parents=True, exist_ok=True)
    src = Path(args.candidate_dir) / f"{args.name}.png"
    if not src.exists():
        print(f"ERROR: {src} not found", file=sys.stderr)
        return 1
    shutil.copy2(src, dst / f"{args.name}.png")
    print(f"  ✓ {args.name} accepted")
    return 0


def cmd_accept_all(args):
    src_dir = Path(args.candidate_dir)
    dst_dir = Path("tests/visual/baseline/default")
    dst_dir.mkdir(parents=True, exist_ok=True)

    if not src_dir.exists():
        print(f"ERROR: {src_dir} not found", file=sys.stderr)
        return 1

    count = 0
    for f in sorted(src_dir.glob("*.png")):
        shutil.copy2(f, dst_dir / f.name)
        print(f"  ✓ {f.name}")
        count += 1

    total = len(list(dst_dir.glob("*.png")))
    print(f"Done. {total} baselines in {dst_dir}")
    return 0


def cmd_init(args):
    dst = Path("tests/visual/baseline/default")
    dst.mkdir(parents=True, exist_ok=True)
    keep = dst / ".gitkeep"
    keep.touch(exist_ok=True)
    print(f"  ✓ Baseline dir ready: {dst}/")
    return 0


def main():
    ap = argparse.ArgumentParser(description="Visual regression baseline management")
    sub = ap.add_subparsers(dest="action")

    p_init = sub.add_parser("init")  # noqa: F841  (argparse subparser registration)
    p_accept = sub.add_parser("accept")
    p_accept.add_argument("--name", required=True)
    p_accept.add_argument("--candidate-dir", default="target/screenshots")
    p_accept_all = sub.add_parser("accept-all")
    p_accept_all.add_argument("--candidate-dir", default="target/screenshots")

    args = ap.parse_args()

    if args.action == "init":
        return cmd_init(args)
    elif args.action == "accept":
        return cmd_accept(args)
    elif args.action == "accept-all":
        return cmd_accept_all(args)
    else:
        ap.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
