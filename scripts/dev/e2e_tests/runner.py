# E2E Testing Framework for Hikari UI
# 
# This framework provides:
# - Interactive browser testing (hover, click, input)
# - Visual quality analysis (shadows, alignment, colors, spacing)
# - Component state validation (hover, focus, disabled states)
# - Integration with GLM Vision Analysis MCP
#
# Requirements:
# - GLM_API_KEY environment variable
# - Chrome/Chromium installed
# - Running dev server

from __future__ import annotations

import os
import json
import time
import subprocess
import base64
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, Any
from enum import Enum

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.remote.webelement import WebElement
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


class TestStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class TestStep:
    action: str
    params: dict
    result: Optional[dict] = field(default=None)
    status: TestStatus = TestStatus.PENDING
    error: Optional[str] = None


@dataclass
class TestCase:
    id: str
    name: str
    route: str
    description: Optional[str] = None
    steps: list = field(default_factory=list)
    status: TestStatus = TestStatus.PENDING
    result: Optional[dict] = None


class GLMVisionAnalyzer:
    """Integration with GLM Vision Analysis via MCP"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GLM_API_KEY")
        if not self.api_key:
            raise ValueError("GLM_API_KEY environment variable is required for visual analysis")
    
    def analyze_screenshot(self, image_path: str, prompt: str) -> dict:
        """Analyze screenshot using GLM Vision API"""
        if not REQUESTS_AVAILABLE:
            return {"success": False, "error": "requests library not available"}
        
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()
        
        # Note: This is a placeholder - actual implementation would call GLM API
        # through the MCP server. The MCP tool should be called externally.
        return {
            "success": True,
            "method": "mcp_required",
            "prompt": prompt,
            "image_path": image_path,
            "note": "Use zai-mcp-server_analyze_image MCP tool with this prompt and image"
        }


class BrowserController:
    """Controls browser for E2E testing"""
    
    def __init__(self, base_url: str = "http://localhost:3000", headless: bool = True):
        if not SELENIUM_AVAILABLE:
            raise ImportError("Selenium is required. Install with: pip install selenium")
        
        self.base_url = base_url
        self.headless = headless
        self.driver: Optional[webdriver.Chrome] = None
        self.wait: Optional[WebDriverWait] = None
    
    def start(self):
        """Initialize browser"""
        options = webdriver.ChromeOptions()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-gpu")
        
        self.driver = webdriver.Chrome(options=options)
        self.wait = WebDriverWait(self.driver, 10)
        return self
    
    def stop(self):
        """Close browser"""
        if self.driver:
            self.driver.quit()
            self.driver = None
    
    def navigate(self, route: str) -> bool:
        """Navigate to route"""
        url = f"{self.base_url}{route}"
        self.driver.get(url)
        # Wait for WASM to load
        time.sleep(8)
        return True
    
    def wait_for_selector(self, selector: str, timeout: int = 10000) -> Optional[WebElement]:
        """Wait for element to appear"""
        try:
            element = WebDriverWait(self.driver, timeout / 1000).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            return element
        except Exception:
            return None
    
    def hover(self, selector: str) -> bool:
        """Hover over element"""
        try:
            element = self.wait_for_selector(selector)
            if element:
                ActionChains(self.driver).move_to_element(element).perform()
                time.sleep(0.5)
                return True
            return False
        except Exception as e:
            print(f"Hover failed: {e}")
            return False
    
    def click(self, selector: str) -> bool:
        """Click element"""
        try:
            element = self.wait_for_selector(selector)
            if element:
                element.click()
                time.sleep(0.3)
                return True
            return False
        except Exception as e:
            print(f"Click failed: {e}")
            return False
    
    def input_text(self, selector: str, text: str) -> bool:
        """Input text into element"""
        try:
            element = self.wait_for_selector(selector)
            if element:
                element.clear()
                element.send_keys(text)
                time.sleep(0.3)
                return True
            return False
        except Exception as e:
            print(f"Input failed: {e}")
            return False
    
    def screenshot(self, output_path: str) -> bool:
        """Take screenshot"""
        try:
            self.driver.save_screenshot(output_path)
            return True
        except Exception as e:
            print(f"Screenshot failed: {e}")
            return False
    
    def execute_script(self, script: str) -> Any:
        """Execute JavaScript"""
        return self.driver.execute_script(script)
    
    def get_element_styles(self, selector: str) -> dict:
        """Get computed styles of element"""
        script = f"""
        const el = document.querySelector('{selector}');
        if (!el) return null;
        const styles = window.getComputedStyle(el);
        return {{
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            position: styles.position,
            boxShadow: styles.boxShadow,
            borderRadius: styles.borderRadius,
            border: styles.border,
            margin: styles.margin,
            padding: styles.padding,
            width: styles.width,
            height: styles.height,
            fontSize: styles.fontSize,
            fontFamily: styles.fontFamily,
            color: styles.color,
            backgroundColor: styles.backgroundColor,
            textAlign: styles.textAlign,
            verticalAlign: styles.verticalAlign
        }};
        """
        return self.execute_script(script) or {}


class VisualQualityPrompts:
    """Predefined prompts for visual quality analysis"""
    
    # Shadow analysis prompts
    SHADOW_CHECK = """分析这个UI组件的阴影效果，检查以下问题：
1. **阴影深度**: 阴影是否明显深于周围元素？是否存在"脏"或"模糊"的阴影？
2. **阴影方向**: 阴影方向是否自然？是否符合光源逻辑？
3. **边角溢出**: 阴影是否在边角处有异常溢出或截断？
4. **阴影颜色**: 阴影颜色是否与背景协调？
请具体指出任何异常之处。"""

    ALIGNMENT_CHECK = """分析这个UI组件的对齐情况：
1. **水平对齐**: 元素是否在水平方向正确对齐？
2. **垂直对齐**: 元素是否在垂直方向正确对齐？
3. **文字对齐**: 文字是否在容器内正确居中或对齐？
4. **图标对齐**: 图标与文字的相对位置是否正确？
请指出任何对齐问题。"""

    COLOR_CONSISTENCY = """分析这个UI组件的颜色一致性：
1. **颜色统一性**: 同类元素颜色是否一致？
2. **对比度**: 文字与背景的对比度是否足够？
3. **主题协调**: 颜色是否符合整体设计主题？
4. **状态颜色**: 不同状态（hover/active/disabled）的颜色区分是否清晰？"""

    SPACING_CHECK = """分析这个UI组件的间距：
1. **内边距**: padding是否适当？是否过大或过小？
2. **外边距**: margin是否一致？元素间距是否均匀？
3. **组件间距**: 组件之间的间距是否合理？
4. **拥挤/松散**: 布局是否过于拥挤或过于松散？"""

    TYPOGRAPHY_CHECK = """分析这个UI组件的排版：
1. **字体大小**: 字体大小是否合适？层级是否清晰？
2. **行高**: line-height是否舒适？
3. **字重**: font-weight是否与层级匹配？
4. **字体一致性**: 是否使用了过多不同的字体？"""

    BORDER_RADIUS_CHECK = """分析这个UI组件的圆角：
1. **圆角大小**: border-radius是否与设计风格一致？
2. **圆角统一性**: 相似元素的圆角是否一致？
3. **溢出问题**: 内容是否在圆角处溢出？"""

    OVERALL_QUALITY = """对这个UI组件进行全面的视觉质量评估：
1. **布局结构**: 整体布局是否合理？
2. **视觉层次**: 是否有清晰的视觉层次？
3. **细节处理**: 边角、阴影、边框等细节是否精细？
4. **专业度**: 整体是否给人专业的视觉感受？
请详细描述发现的问题和改进建议。"""

    # Component-specific prompts
    BUTTON_HOVER_STATE = """分析按钮的悬停状态：
1. 悬停时是否有视觉反馈？
2. 背景色变化是否明显但不过度？
3. 是否有光晕或边框效果？
4. 光标是否变为指针？"""

    FORM_INPUT_FOCUS = """分析表单输入框的聚焦状态：
1. 聚焦时边框是否变化？
2. 是否有光晕效果？
3. placeholder是否正确处理？
4. 错误状态的样式是否清晰？"""

    CARD_HOVER_EFFECT = """分析卡片的悬停效果：
1. 是否有轻微的上浮效果？
2. 阴影是否增强？
3. 边框是否变化？
4. 整体过渡是否流畅？"""


class E2ETestRunner:
    """Main test runner for E2E tests"""
    
    def __init__(self, config_path: str = None):
        self.config_path = Path(config_path) if config_path else None
        self.browser: Optional[BrowserController] = None
        self.results: list[dict] = []
        self.screenshot_dir = Path("scripts/dev/e2e_tests/reports/screenshots")
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)
    
    def load_test_suite(self, suite_path: str) -> dict:
        """Load test suite from JSON file"""
        with open(suite_path) as f:
            return json.load(f)
    
    def execute_step(self, step: dict) -> dict:
        """Execute a single test step"""
        action = step.get("action")
        params = step.get("params", {})
        result = {"action": action, "params": params, "success": False}
        
        try:
            if action == "navigate":
                result["success"] = self.browser.navigate(params.get("route", "/"))
            
            elif action == "wait_for_selector":
                element = self.browser.wait_for_selector(
                    params.get("selector"),
                    params.get("timeout", 10000)
                )
                result["success"] = element is not None
            
            elif action == "hover":
                result["success"] = self.browser.hover(params.get("selector"))
            
            elif action == "click":
                result["success"] = self.browser.click(params.get("selector"))
            
            elif action == "input":
                result["success"] = self.browser.input_text(
                    params.get("selector"),
                    params.get("text", "")
                )
            
            elif action == "screenshot":
                output = params.get("output", f"screenshot_{int(time.time())}.png")
                output_path = self.screenshot_dir / output
                result["success"] = self.browser.screenshot(str(output_path))
                result["output_path"] = str(output_path)
            
            elif action == "execute_script":
                script_result = self.browser.execute_script(params.get("script", ""))
                result["success"] = True
                result["script_result"] = script_result
            
            elif action == "get_styles":
                styles = self.browser.get_element_styles(params.get("selector"))
                result["success"] = styles is not None
                result["styles"] = styles
            
            elif action == "wait":
                time.sleep(params.get("duration", 1))
                result["success"] = True
            
            elif action == "visual_analysis":
                # This step requires external MCP call
                result["success"] = True
                result["requires_mcp"] = True
                result["prompt"] = params.get("prompt", "")
                result["image_path"] = params.get("image_path", "")
                result["note"] = "Use zai-mcp-server_analyze_image MCP tool"
            
            else:
                result["error"] = f"Unknown action: {action}"
        
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    def run_test(self, test_case: dict) -> dict:
        """Run a single test case"""
        test_id = test_case.get("id", "unknown")
        test_name = test_case.get("name", test_id)
        route = test_case.get("route", "/")
        steps = test_case.get("steps", [])
        
        print(f"\n{'='*60}")
        print(f"Running test: {test_name}")
        print(f"Route: {route}")
        print(f"Steps: {len(steps)}")
        print(f"{'='*60}")
        
        results = {
            "id": test_id,
            "name": test_name,
            "route": route,
            "status": "running",
            "steps": []
        }
        
        # Navigate to route first
        if not self.browser.navigate(route):
            results["status"] = "failed"
            results["error"] = "Failed to navigate to route"
            return results
        
        # Execute each step
        all_passed = True
        for i, step in enumerate(steps):
            print(f"  Step {i+1}/{len(steps)}: {step.get('action', 'unknown')}")
            step_result = self.execute_step(step)
            results["steps"].append(step_result)
            
            if not step_result.get("success", False):
                all_passed = False
                print(f"    ❌ Failed: {step_result.get('error', 'Unknown error')}")
            else:
                print(f"    ✓ Passed")
        
        results["status"] = "passed" if all_passed else "failed"
        print(f"\nTest {test_name}: {results['status'].upper()}")
        
        return results
    
    def run_suite(self, suite_path: str) -> dict:
        """Run all tests in a suite"""
        suite = self.load_test_suite(suite_path)
        suite_name = suite.get("name", "Unnamed Suite")
        tests = suite.get("tests", [])
        
        print(f"\n{'#'*60}")
        print(f"# Test Suite: {suite_name}")
        print(f"# Tests: {len(tests)}")
        print(f"{'#'*60}")
        
        # Start browser
        self.browser = BrowserController(headless=True)
        self.browser.start()
        
        results = {
            "suite": suite_name,
            "total_tests": len(tests),
            "passed": 0,
            "failed": 0,
            "tests": []
        }
        
        try:
            for test in tests:
                test_result = self.run_test(test)
                results["tests"].append(test_result)
                if test_result["status"] == "passed":
                    results["passed"] += 1
                else:
                    results["failed"] += 1
        finally:
            self.browser.stop()
        
        print(f"\n{'#'*60}")
        print(f"# Suite Complete: {suite_name}")
        print(f"# Passed: {results['passed']}/{results['total_tests']}")
        print(f"{'#'*60}")
        
        return results
    
    def save_results(self, results: dict, output_path: str = None):
        """Save test results to JSON"""
        if output_path is None:
            output_path = f"scripts/dev/e2e_tests/reports/results_{int(time.time())}.json"
        
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"Results saved to: {output_path}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Hikari E2E Test Runner")
    parser.add_argument("suite", help="Path to test suite JSON file")
    parser.add_argument("--output", "-o", help="Output file for results")
    parser.add_argument("--no-headless", action="store_true", help="Run with visible browser")
    
    args = parser.parse_args()
    
    runner = E2ETestRunner()
    results = runner.run_suite(args.suite)
    
    if args.output:
        runner.save_results(results, args.output)
    
    # Exit with error code if any tests failed
    exit(0 if results["failed"] == 0 else 1)


if __name__ == "__main__":
    main()
