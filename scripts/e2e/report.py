"""
Report Generator for E2E Test Results

Generates human-readable and machine-readable reports from test results:
  - JSON report with full details
  - HTML report with embedded screenshots and diff images
  - Console summary with pass/fail/timing info
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Optional

try:
    from .runner import SuiteResult, TestResult
except ImportError:
    from runner import SuiteResult, TestResult


class ReportGenerator:
    """Generate reports from E2E test suite results."""

    def __init__(self, output_dir: str = "e2e_output"):
        self.output_dir = Path(output_dir)
        self.reports_dir = self.output_dir / "reports"
        self.reports_dir.mkdir(parents=True, exist_ok=True)

    def generate_json(self, result: SuiteResult, filename: Optional[str] = None) -> str:
        """Generate a detailed JSON report."""
        if filename is None:
            ts = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
            filename = f"report_{ts}.json"

        path = self.reports_dir / filename
        data = {
            "suite": result.suite_name,
            "summary": {
                "total": result.total,
                "passed": result.passed,
                "failed": result.failed,
                "skipped": result.skipped,
                "all_passed": result.failed == 0,
            },
            "timing": {
                "started_at": result.started_at,
                "finished_at": result.finished_at,
            },
            "tests": [],
        }

        for tr in result.tests:
            test_data: dict = {
                "id": tr.test_id,
                "name": tr.name,
                "route": tr.route,
                "status": tr.status,
                "duration_ms": tr.duration_ms,
                "steps": [
                    {
                        "step": s.step_index,
                        "action": s.action,
                        "success": s.success,
                        "duration_ms": s.duration_ms,
                        "output_path": s.output_path,
                        "error": s.error,
                    }
                    for s in tr.steps
                ],
            }
            if tr.comparison:
                test_data["comparison"] = {
                    "identical": tr.comparison.identical,
                    "passed": tr.comparison.passed,
                    "diff_percentage": round(tr.comparison.diff_percentage, 2),
                    "different_pixels": tr.comparison.different_pixels,
                    "total_pixels": tr.comparison.total_pixels,
                    "diff_image": tr.comparison.diff_image_path,
                    "regions_count": len(tr.comparison.regions),
                    "error": tr.comparison.error,
                }
            if tr.screenshot_path:
                test_data["screenshot"] = tr.screenshot_path
            if tr.error:
                test_data["error"] = tr.error
            data["tests"].append(test_data)

        with open(path, "w") as f:
            json.dump(data, f, indent=2)

        return str(path)

    def generate_html(self, result: SuiteResult, filename: Optional[str] = None) -> str:
        """Generate an HTML report with embedded screenshots."""
        if filename is None:
            ts = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
            filename = f"report_{ts}.html"

        path = self.reports_dir / filename

        def _test_card(tr: TestResult) -> str:
            status_color = "#2ecc71" if tr.status == "passed" else (
                "#e74c3c" if tr.status == "failed" else "#95a5a6"
            )
            status_icon = "\u2705" if tr.status == "passed" else (
                "\u274c" if tr.status == "failed" else "\u23f3"
            )
            steps_html = ""
            for s in tr.steps:
                sicon = "\u2713" if s.success else "\u2717"
                scolor = "#27ae60" if s.success else "#c0392b"
                out_link = ""
                if s.output_path and Path(s.output_path).exists():
                    rel = Path(s.output_path).resolve().relative_to(Path(self.output_dir).resolve())
                    out_link = f' <a href="../../{rel}" target="_blank">\U0001f5bc\ufe0f</a>'
                err_line = f'<br><small style="color:#c0392b">{s.error}</small>' if s.error else ""
                steps_html += (
                    f'<div style="margin-left:20px;padding:2px 0;font-size:12px;'
                    f'color:{scolor}">{sicon} {s.action}'
                    f'{out_link}{err_line}</div>\n'
                )

            cmp_html = ""
            if tr.comparison:
                cmp_color = "#2ecc71" if tr.comparison.passed else "#e74c3c"
                cmp_text = tr.comparison.summary.replace("PASS", "").replace("FAIL", "")
                diff_img = ""
                if tr.comparison.diff_image_path and Path(tr.comparison.diff_image_path).exists():
                    rel = Path(tr.comparison.diff_image_path).resolve().relative_to(
                        Path(self.output_dir).resolve()
                    )
                    diff_img = (
                        f'<br><img src="../../{rel}" style="max-width:100%;'
                        f'margin-top:4px;border:1px solid #ddd">'
                    )
                cmp_html = (
                    f'<div style="margin-top:6px;padding:6px;background:{cmp_color}18;'
                    f'border-radius:4px;font-size:12px">'
                    f'<strong>Visual:</strong> '
                    f'<span style="color:{cmp_color}">{tr.comparison.summary}</span>'
                    f'{diff_img}</div>\n'
                )

            screenshot_img = ""
            if tr.screenshot_path and Path(tr.screenshot_path).exists():
                try:
                    rel = Path(tr.screenshot_path).resolve().relative_to(
                        Path(self.output_dir).resolve()
                    )
                    screenshot_img = (
                        f'<br><img src="../../{rel}" style="max-width:100%;'
                        f'margin-top:4px;border:1px solid #ddd;border-radius:4px">'
                    )
                except ValueError:
                    pass

            return f'''
            <div style="border:1px solid #ddd;border-radius:8px;margin:8px 0;
                        padding:12px;background:#fff">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span>
                  <strong>{status_icon} {tr.name}</strong>
                  <code style="background:#eee;padding:1px 6px;border-radius:3px;
                               font-size:11px;margin-left:6px">{tr.route}</code>
                </span>
                <span style="background:{status_color};color:white;padding:2px 10px;
                             border-radius:10px;font-size:11px;font-weight:bold">
                  {tr.status.upper()}
                </span>
              </div>
              <div style="font-size:11px;color:#666;margin-top:4px">
                {tr.duration_ms}ms | {len(tr.steps)} steps
              </div>
              <div style="margin-top:6px">{steps_html}</div>
              {cmp_html}
              {screenshot_img}
            </div>'''

        all_passed = result.failed == 0
        banner_bg = "#2ecc71" if all_passed else "#e74c3c"
        banner_text = (
            f"\u2705 ALL {result.total} TESTS PASSED" if all_passed
            else f"\u274c {result.failed}/{result.total} TESTS FAILED"
        )

        tests_html = "".join(_test_card(tr) for tr in result.tests)

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>E2E Report: {result.suite_name}</title>
<style>
  body {{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         max-width:960px;margin:0 auto;padding:16px;background:#f5f5f5 }}
  h1 {{ color:#333 }}
  .banner {{ background:{banner_bg};color:white;padding:16px;border-radius:8px;
             text-align:center;font-size:18px;font-weight:bold;margin-bottom:16px }}
  .summary {{ display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px }}
  .stat {{ background:white;padding:12px 20px;border-radius:8px;flex:1;min-width:100px;
           text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1) }}
  .stat-num {{ font-size:24px;font-weight:bold }}
  .stat-label {{ font-size:11px;color:#888;text-transform:uppercase }}
</style>
</head>
<body>
<h1>\U0001f3af E2E Test Report</h1>
<div class="banner">{banner_text}</div>
<div class="summary">
  <div class="stat"><div class="stat-num">{result.total}</div><div class="stat-label">Total</div></div>
  <div class="stat"><div class="stat-num" style="color:#2ecc71">{result.passed}</div><div class="stat-label">Passed</div></div>
  <div class="stat"><div class="stat-num" style="color:#e74c3c">{result.failed}</div><div class="stat-label">Failed</div></div>
  <div class="stat"><div class="stat-num" style="color:#95a5a6">{result.skipped}</div><div class="stat-label">Skipped</div></div>
</div>
{tests_html}
<footer style="text-align:center;color:#999;font-size:11px;margin-top:24px;padding:8px">
  Generated by Hikari E2E Framework | {result.started_at} - {result.finished_at}
</footer>
</body>
</html>"""

        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

        return str(path)

    def print_summary(self, result: SuiteResult) -> None:
        """Print a concise summary to stdout."""
        print(f"\n\033[1m{'='*56}\033[0m")
        print(f" \033[1mE2E Report: {result.suite_name}\033[0m")
        print(f"{'='*56}")
        print(f" Total:     {result.total}")
        print(f" \033[32m Passed:   {result.passed}\033[0m")
        if result.failed > 0:
            print(f" \033[31m Failed:   {result.failed}\033[0m")
        else:
            print(f" Failed:   {result.failed}")
        if result.skipped > 0:
            print(f" Skipped:  {result.skipped}")

        failed_tests = [t for t in result.tests if t.status == "failed"]
        if failed_tests:
            print("\n \033[31mFailed tests:\033[0m")
            for t in failed_tests:
                reason_parts = []
                if not all(s.success for s in t.steps):
                    failed_steps = [s for s in t.steps if not s.success]
                    reason_parts.append(
                        f"steps failed: {', '.join(s.action for s in failed_steps)}"
                    )
                if t.comparison and not t.comparison.passed:
                    reason_parts.append(f"visual diff: {t.comparison.summary}")
                if t.error:
                    reason_parts.append(t.error)
                print(f"   - [{t.test_id}] {t.name}: {'; '.join(reason_parts)}")

        print(f"\n Time: {result.started_at} -> {result.finished_at}")
        print(f"{'='*56}\n")
