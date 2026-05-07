"""
E2E Test Runner

JSON-driven test suite executor that uses TairitsuBrowser for browser automation
and ScreenshotComparator for visual regression. Test suites are defined as JSON files.

Test suite JSON format:
{
  "name": "My Test Suite",
  "description": "...",
  "base_url": "http://localhost:3000",
  "viewport": "1920x1080",
  "wait_ms": 8000,
  "compare": {
    "pixel_threshold": 30,
    "max_diff_ratio": 0.01
  },
  "tests": [
    {
      "id": "home_page",
      "name": "Home Page Visual Check",
      "route": "/",
      "actions": [
        {"action": "navigate", "route": "/"},
        {"action": "screenshot", "output": "home.png", "full_page": true},
        {"action": "check"}
      ],
      "expected_baseline": "home.png",
      "visual_analysis_prompt": "Check layout alignment..."
    }
  ]
}

Supported actions:
  navigate, screenshot, click, type, press, evaluate,
  wait, snapshot, check, hover (via evaluate)
"""

from __future__ import annotations

import json
import time
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, Any

try:
    from .browser import TairitsuBrowser
    from .compare import ScreenshotComparator, ComparisonResult
    from .baseline import BaselineManager
except ImportError:
    from browser import TairitsuBrowser
    from compare import ScreenshotComparator, ComparisonResult
    from baseline import BaselineManager


@dataclass
class StepResult:
    step_index: int = 0
    action: str = ""
    success: bool = False
    duration_ms: int = 0
    output_path: Optional[str] = None
    error: Optional[str] = None
    data: dict = field(default_factory=dict)


@dataclass
class TestResult:
    test_id: str = ""
    name: str = ""
    route: str = ""
    status: str = "pending"
    steps: list[StepResult] = field(default_factory=list)
    comparison: Optional[ComparisonResult] = None
    screenshot_path: Optional[str] = None
    error: Optional[str] = None
    duration_ms: int = 0


@dataclass
class SuiteResult:
    suite_name: str = ""
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    tests: list[TestResult] = field(default_factory=list)
    started_at: str = ""
    finished_at: str = ""


class E2ERunner:
    """
    Execute E2E test suites against a running tairitsu-debug server.

    Usage:
        runner = E2ERunner(debug_port=3001)
        result = runner.run_suite("tests/visual_quality.json")
        print(result.passed, "/", result.total)
    """

    def __init__(
        self,
        debug_port: int = 3001,
        base_url: str = "http://localhost:3000",
        output_dir: str = "e2e_output",
        baseline_dir: str = "baselines",
        comparator: Optional[ScreenshotComparator] = None,
    ):
        self.debug_port = debug_port
        self.base_url = base_url
        self.output_dir = Path(output_dir)
        self.baseline_dir = baseline_dir
        self.comparator = comparator or ScreenshotComparator()
        self.browser: Optional[TairitsuBrowser] = None
        self.suite_name = ""

    def _connect(self) -> bool:
        if self.browser is None:
            self.browser = TairitsuBrowser(debug_port=self.debug_port)
        health = self.browser.health()
        return health.get("success", False)

    def load_suite(self, path: str) -> dict:
        with open(path) as f:
            return json.load(f)

    def run_test(self, test_def: dict, suite_config: dict) -> TestResult:
        """Execute a single test case."""
        start = time.time()
        test_id = test_def.get("id", "unknown")
        name = test_def.get("name", test_id)
        route = test_def.get("route", "/")
        actions = test_def.get("actions", [])
        expected_baseline = test_def.get("expected_baseline", "")
        wait_ms = suite_config.get("wait_ms", 8000)

        print(f"  \033[1m[{test_id}]\033[0m {name} ({route})")

        result = TestResult(
            test_id=test_id,
            name=name,
            route=route,
            status="running",
        )

        screenshots_dir = self.output_dir / "screenshots" / self.suite_name / test_id
        screenshots_dir.mkdir(parents=True, exist_ok=True)

        for i, action in enumerate(actions):
            t0 = time.time()
            step = StepResult(step_index=i, action=action.get("action", "?"))

            try:
                atype = action.get("action", "")

                if atype == "navigate":
                    r = action.get("route", route)
                    res = self.browser.navigate_route(self.base_url, r, action.get("wait_ms", wait_ms))
                    step.success = res.get("success", False)
                    if not step.success:
                        step.error = res.get("error", "Navigate failed")

                elif atype == "screenshot":
                    out_name = action.get("output", f"step_{i}.png")
                    out_path = str(screenshots_dir / out_name)
                    full_page = action.get("full_page", True)
                    sel = action.get("selector")
                    if sel:
                        res = self.browser.screenshot_element(sel, out_path)
                    else:
                        res = self.browser.screenshot(out_path, full_page=full_page)
                    step.success = res.get("success", False)
                    step.output_path = res.get("saved_to") or out_path
                    if step.output_path:
                        result.screenshot_path = step.output_path
                    if not step.success:
                        step.error = res.get("error", "Screenshot failed")

                elif atype == "click":
                    target = action.get("target", action.get("selector", ""))
                    res = self.browser.click(target)
                    step.success = res.get("success", False)
                    step.error = res.get("error") if not step.success else None

                elif atype == "type":
                    target = action.get("target", action.get("selector", ""))
                    res = self.browser.type_text(target, action.get("text", ""))
                    step.success = res.get("success", False)

                elif atype == "press":
                    res = self.browser.press_key(action.get("key", "Enter"))
                    step.success = res.get("success", False)

                elif atype == "evaluate":
                    expr = action.get("script", action.get("expression", ""))
                    res = self.browser.evaluate(expr)
                    step.success = res.get("success", False)
                    step.data["result"] = res.get("result", res.get("raw"))

                elif atype == "wait":
                    dur = action.get("duration", action.get("seconds", 1))
                    time.sleep(dur)
                    step.success = True

                elif atype == "snapshot":
                    res = self.browser.snapshot()
                    step.success = res.get("success", False)
                    step.data["snapshot"] = res.get("result", res)[:2000] if isinstance(res, str) else str(res)[:2000]

                elif atype == "check":
                    errors = self.browser.errors()
                    console = self.browser.console_messages(level="error")
                    has_errors = (
                        not errors.get("success", True)
                        or len(errors.get("errors", [])) > 0
                        or len(console.get("messages", [])) > 0
                    )
                    step.success = not has_errors
                    step.data["page_errors"] = errors
                    step.data["console_errors"] = console
                    if has_errors:
                        step.error = f"Page has {len(errors.get('errors', []))} errors, {len(console.get('messages', []))} console warnings"

                elif atype == "hover":
                    sel = action.get("selector", "")
                    js = f"""
                    const el = document.querySelector('{sel}');
                    if(el){{el.dispatchEvent(new MouseEvent('mouseover',{{bubbles:true}}));'ok'}}else{{null}}
                    """
                    res = self.browser.evaluate(js)
                    step.success = res.get("success", False)

                else:
                    step.success = False
                    step.error = f"Unknown action: {atype}"

            except Exception as e:
                step.success = False
                step.error = str(e)

            step.duration_ms = int((time.time() - t0) * 1000)
            result.steps.append(step)

            icon = "\u2713" if step.success else "\u2717"
            extra = f" -> {step.output_path}" if step.output_path else ""
            err = f" ({step.error})" if step.error else ""
            print(f"    {icon} [{atype}]{extra}{err}")

        if expected_baseline and result.screenshot_path:
            bl_mgr = BaselineManager(self.baseline_dir, self.suite_name)
            bl_path = bl_mgr.get_baseline_path(expected_baseline)
            if bl_path:
                diff_dir = self.output_dir / "diffs" / self.suite_name / test_id
                diff_dir.mkdir(parents=True, exist_ok=True)
                diff_path = str(diff_dir / f"{expected_baseline}_diff.png")
                result.comparison = self.comparator.compare(
                    str(bl_path), result.screenshot_path, diff_path
                )
                cmp_status = "PASS" if result.comparison.passed else "FAIL"
                print(f"    \033[93m[COMPARE]\033[0m {cmp_status}: {result.comparison.summary}")

        all_ok = all(s.success for s in result.steps)
        cmp_ok = result.comparison is None or result.comparison.passed
        result.status = "passed" if (all_ok and cmp_ok) else "failed"
        result.duration_ms = int((time.time() - start) * 1000)

        status_icon = "\u2705" if result.status == "passed" else "\u274c"
        print(f"  {status_icon} \033[{1 if result.status == 'passed' else 31}m{result.status.upper()}\033[0m ({result.duration_ms}ms)")
        return result

    def run_suite(self, suite_path: str) -> SuiteResult:
        """Run an entire test suite from a JSON file."""
        suite = self.load_suite(suite_path)
        self.suite_name = suite.get("name", Path(suite_path).stem)
        tests = suite.get("tests", [])
        config = {
            "base_url": suite.get("base_url", self.base_url),
            "viewport": suite.get("viewport", "1920x1080"),
            "wait_ms": suite.get("wait_ms", 8000),
            "compare": suite.get("compare", {}),
        }

        compare_cfg = config["compare"]
        if compare_cfg:
            self.comparator = ScreenshotComparator(
                pixel_threshold=compare_cfg.get("pixel_threshold", 30),
                max_diff_ratio=compare_cfg.get("max_diff_ratio", 0.01),
            )

        started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        print(f"\n{'='*60}")
        print(f" Suite: {self.suite_name}")
        print(f" Tests: {len(tests)} | URL: {config['base_url']}")
        print(f"{'='*60}\n")

        if not self._connect():
            print("ERROR: Cannot connect to tairitsu-debug server.")
            print("Make sure 'just dev --daemon' is running with debug support.")
            return SuiteResult(
                suite_name=self.suite_name,
                total=len(tests),
                failed=len(tests),
                started_at=started,
                finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            )

        vp = config["viewport"].split("x")
        if len(vp) == 2:
            self.browser.resize(int(vp[0]), int(vp[1]))

        result = SuiteResult(
            suite_name=self.suite_name,
            total=len(tests),
            started_at=started,
        )

        try:
            for test_def in tests:
                if test_def.get("skip", False):
                    result.skipped += 1
                    result.tests.append(TestResult(
                        test_id=test_def.get("id", ""),
                        name=test_def.get("name", ""),
                        status="skipped",
                    ))
                    continue
                tr = self.run_test(test_def, config)
                result.tests.append(tr)
                if tr.status == "passed":
                    result.passed += 1
                else:
                    result.failed += 1
        except KeyboardInterrupt:
            print("\nInterrupted by user.")
        finally:
            pass

        result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        print(f"\n{'='*60}")
        print(f" Results: {result.passed} passed, {result.failed} failed, {result.skipped} skipped")
        print(f" Total:   {result.total} tests")
        print(f"{'='*60}\n")

        return result

    def run_batch_capture(
        self,
        routes: list[str],
        base_url: str = "http://localhost:3000",
        output_dir: str = "",
        wait_ms: int = 8000,
        full_page: bool = True,
    ) -> dict:
        """Capture screenshots for a batch of routes (no comparison)."""
        out = Path(output_dir or str(self.output_dir / "batch_captures"))
        out.mkdir(parents=True, exist_ok=True)

        if not self._connect():
            return {"success": False, "error": "Cannot connect to tairitsu-debug"}

        results = {}
        for route in routes:
            name = route.strip("/").replace("/", "_") or "home"
            out_path = str(out / f"{name}.png")
            res = self.browser.capture_and_save(route, out_path, base_url, wait_ms, full_page)
            results[name] = {
                "route": route,
                "path": out_path,
                "success": res.get("success", False),
                "size_bytes": res.get("size_bytes", 0),
            }
            icon = "\u2713" if res.get("success") else "\u2717"
            print(f"  {icon} {route} -> {name}.png")

        return {
            "success": True,
            "total": len(routes),
            "captured": sum(1 for r in results.values() if r["success"]),
            "output_dir": str(out),
            "results": results,
        }
