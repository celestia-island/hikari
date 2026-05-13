#!/usr/bin/env python3
"""
Visual Regression CI — Screenshot Comparison

Compares candidate screenshots against baseline images.
Generates diff heatmaps and a JSON result summary for CI consumption.

Usage:
    python3 compare_ci.py \
        --baseline-dir baselines/default \
        --candidate-dir target/screenshots \
        --output target/visual-diff
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageChops
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def pixel_diff(c1: tuple, c2: tuple) -> float:
    return sum((a - b) ** 2 for a, b in zip(c1[:3], c2[:3])) ** 0.5


def compare_images(
    baseline_path: str,
    candidate_path: str,
    diff_output: str = "",
    threshold: int = 30,
) -> dict:
    """Compare two images pixel-by-pixel."""
    if not PIL_AVAILABLE:
        return {"error": "Pillow not installed", "passed": False}

    try:
        bl = Image.open(baseline_path).convert("RGBA")
        ca = Image.open(candidate_path).convert("RGBA")
    except Exception as e:
        return {"error": f"Cannot load images: {e}", "passed": False}

    bw, bh = bl.size
    cw, ch = ca.size

    if (bw, bh) != (cw, ch):
        return {
            "error": f"Size mismatch: {bw}x{bh} vs {cw}x{ch}",
            "passed": False,
            "baseline_size": f"{bw}x{bh}",
            "candidate_size": f"{cw}x{ch}",
        }

    total = bw * bh
    bl_data = bl.load()
    ca_data = ca.load()

    diff_count = 0
    diff_sum = 0.0
    max_d = 0.0
    mask = [[False] * bh for _ in range(bw)]

    for y in range(bh):
        for x in range(bw):
            d = pixel_diff(bl_data[x, y], ca_data[x, y])
            if d > threshold:
                mask[x][y] = True
                diff_count += 1
                diff_sum += d
                if d > max_d:
                    max_d = d

    diff_pct = (diff_count / total * 100) if total else 0
    mean_d = (diff_sum / diff_count) if diff_count else 0.0
    passed = diff_pct <= 1.0

    result = {
        "identical": diff_count == 0,
        "passed": passed,
        "total_pixels": total,
        "different_pixels": diff_count,
        "diff_percentage": round(diff_pct, 4),
        "mean_diff": round(mean_d, 1),
        "max_diff": round(max_d, 1),
        "error": None,
    }

    if diff_output and diff_count > 0:
        overlay = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        for y in range(bh):
            for x in range(bw):
                if mask[x][y]:
                    draw.point((x, y), fill=(255, 0, 0, 180))
        diff_img = bl.convert("RGB").copy()
        diff_img.paste(Image.alpha_composite(Image.new("RGBA", bl.size, (0, 0, 0, 0)), overlay), (0, 0))
        Path(diff_output).parent.mkdir(parents=True, exist_ok=True)
        diff_img.save(diff_output)
        result["diff_image"] = diff_output

    return result


def run_comparison(
    baseline_dir: str,
    candidate_dir: str,
    output_dir: str = "",
    threshold: int = 30,
    max_diff_ratio: float = 0.01,
) -> dict:
    """Run batch comparison of all baseline/candidate pairs."""
    bl_dir = Path(baseline_dir)
    ca_dir = Path(candidate_dir)
    out = Path(output_dir) if output_dir else Path(".")
    out.mkdir(parents=True, exist_ok=True)

    if not bl_dir.exists():
        return {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "all_passed": True,
            "results": {},
            "error": f"Baseline directory not found: {bl_dir}",
        }

    baseline_files = sorted(bl_dir.glob("*.png"))
    results = {}
    all_passed = True
    total = len(baseline_files)
    passed = 0
    failed = 0

    for bl_path in baseline_files:
        name = bl_path.stem
        ca_path = ca_dir / f"{name}.png"

        if not ca_path.exists():
            results[name] = {
                "passed": False,
                "error": f"No candidate image for {name}",
                "diff_pct": None,
            }
            all_passed = False
            failed += 1
            continue

        diff_out = str(out / f"{name}_diff.png")
        result = compare_images(str(bl_path), str(ca_path), diff_out, threshold)

        cmp_passed = result.get("passed", False)
        if not cmp_passed:
            all_passed = False
            failed += 1
        else:
            passed += 1

        results[name] = {
            "passed": cmp_passed,
            "identical": result.get("identical", False),
            "diff_pct": result.get("diff_percentage"),
            "diff_pixels": result.get("different_pixels"),
            "total_pixels": result.get("total_pixels"),
            "mean_diff": result.get("mean_diff"),
            "max_diff": result.get("max_diff"),
            "diff_image": result.get("diff_image"),
            "error": result.get("error"),
        }

    summary = {
        "total": total,
        "passed": passed,
        "failed": failed,
        "all_passed": all_passed,
        "results": results,
    }

    result_json = str(out / "result.json")
    with open(result_json, "w") as f:
        json.dump(summary, f, indent=2)

    html_out = str(out / "report.html")
    _generate_html_report(html_out, summary)

    return summary


def _generate_html_report(path: str, summary: dict) -> None:
    """Generate an HTML report for visual inspection."""
    all_passed = summary.get("all_passed", True)
    banner_bg = "#2ecc71" if all_passed else "#e74c3c"
    banner_text = (
        f"\u2705 ALL {summary['total']} TESTS PASSED" if all_passed
        else f"\u274c {summary['failed']}/{summary['total']} TESTS FAILED"
    )

    rows = ""
    for name, info in sorted(summary.get("results", {}).items()):
        ok = info.get("passed", False)
        color = "#2ecc71" if ok else "#e74c3c"
        icon = "\u2705" if ok else "\u274c"
        pct = info.get("diff_pct")
        pct_str = f"{pct:.2f}%" if pct is not None else "N/A"
        diff_link = ""
        if info.get("diff_image"):
            diff_link = f'<a href="{Path(info["diff_image"]).name}" target="_blank">View diff</a>'
        err = f'<br><small style="color:#c039b0">{info["error"]}</small>' if info.get("error") else ""
        rows += f'''
        <tr style="color:{color}">
          <td>{icon}</td>
          <td><code>{name}</code></td>
          <td>{pct_str}</td>
          <td>{info.get("diff_pixels", 0)}</td>
          <td>{diff_link}{err}</td>
        </tr>'''

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Visual Regression Report</title>
<style>
body{{font-family:-apple-system,sans-serif;max-width:960px;margin:0 auto;padding:16px;background:#f5f5f5}}
h1{{color:#333}}.banner{{background:{banner_bg};color:white;padding:16px;border-radius:8px;text-align:center;font-size:18px;margin-bottom:16px}}
table{{width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}}
th{{background:#f8f9fa;padding:10px;text-align:left;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #eee}}
td{{padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px}}
tr:hover{{background:#fafafa}}.stat{{background:white;padding:14px;border-radius:8px;text-align:center;flex:1;min-width:80px}}
.stat-num{{font-size:24px;font-weight:bold}}.stat-label{{font-size:11px;color:#888;text-transform:uppercase}}
</style></head>
<body>
<h1>\U0001f3af Visual Regression Report</h1>
<div class="banner">{banner_text}</div>
<div style="display:flex;gap:12px;margin-bottom:16px">
  <div class="stat"><div class="stat-num">{summary['total']}</div><div class="stat-label">Total</div></div>
  <div class="stat"><div class="stat-num" style="color:#2ecc71">{summary['passed']}</div><div class="stat-label">Passed</div></div>
  <div class="stat"><div class="stat-num" style="color:#e74c3c">{summary['failed']}</div><div class="stat-label">Failed</div></div>
</div>
<table><thead><tr><th>Status</th><th>Name</th><th>Diff %</th><th>Pixels</th><th>Details</th></tr></thead>
<tbody>{rows}</tbody></table>
<footer style="text-align:center;color:#999;font-size:11px;margin-top:24px;padding:8px">
Generated by Hikari Visual Regression CI</footer>
</body></html>"""

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)


def main():
    parser = argparse.ArgumentParser(description="CI Visual Comparison")
    parser.add_argument("--baseline-dir", required=True, help="Baseline directory")
    parser.add_argument("--candidate-dir", required=True, help="Candidate screenshots dir")
    parser.add_argument("--output", "-o", default="./visual-diff", help="Output directory")
    parser.add_argument("--threshold", type=int, default=30, help="Pixel threshold (0-255)")
    parser.add_argument("--max-diff-ratio", type=float, default=0.01, help="Max allowed diff ratio")
    args = parser.parse_args()

    result = run_comparison(
        args.baseline_dir,
        args.candidate_dir,
        args.output,
        args.threshold,
        args.max_diff_ratio,
    )

    print(f"\nResults: {result['passed']}/{result['total']} passed, {result['failed']} failed")
    print(f"All passed: {result['all_passed']}")
    if result.get("error"):
        print(f"Warning: {result['error']}")

    for name, info in result.get("results", {}).items():
        if not info.get("passed"):
            reason = info.get("error") or f"{info.get('diff_pct', '?')}% diff"
            print(f"  FAIL: {name} — {reason}")

    print(f"\nReport: {args.output}/report.json")

    sys.exit(0 if result.get("all_passed", False) else 1)


if __name__ == "__main__":
    main()
