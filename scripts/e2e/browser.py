"""
Tairitsu Debug HTTP API Client

Communicates with the tairitsu-debug middleware (typically port 3001)
to control a headless browser for screenshot capture, DOM inspection,
interaction, and diagnostics. This replaces the Rust-based hikari-e2e
binaries (hikari-browser-debug, hikari-visual-debug-wry, etc.).

API endpoints mirror the tairitsu-debug protocol:
  GET  /health          - Server health check
  GET  /info            - Server info (version, platform)
  POST /navigate        - Navigate to URL
  POST /screenshot      - Capture screenshot (viewport/full/pixel)
  POST /click           - Click element by selector
  POST /type            - Type text into element
  POST /press           - Press keyboard key
  POST /evaluate        - Execute JavaScript
  GET  /console         - Get console messages
  GET  /snapshot        - Accessibility tree snapshot
  GET  /errors          - Page errors
  POST /resize          - Resize viewport
"""

from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Optional, Any
from dataclasses import dataclass

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


@dataclass
class ScreenshotResult:
    path: str
    width: int = 0
    height: int = 0
    format: str = "png"
    size_bytes: int = 0


@dataclass
class ConsoleMessage:
    level: str
    text: str
    timestamp: Optional[str] = None


@dataclass
class PageError:
    message: str
    source: Optional[str] = None
    line: Optional[int] = None


class TairitsuBrowser:
    """HTTP client for tairitsu-debug browser automation server."""

    def __init__(self, debug_port: int = 3001, base_url: str = "http://localhost"):
        if not REQUESTS_AVAILABLE:
            raise ImportError(
                "requests library required. Install with: pip install requests"
            )
        self.debug_port = debug_port
        self.base_url = f"{base_url}:{debug_port}"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
        timeout: float = 30.0,
    ) -> dict:
        url = f"{self.base_url}{endpoint}"
        try:
            resp = self.session.request(
                method, url, params=params, json=json_data, timeout=timeout
            )
            if resp.status_code == 200:
                try:
                    return resp.json()
                except Exception:
                    return {"success": True, "raw": resp.text}
            return {
                "success": False,
                "error": f"HTTP {resp.status_code}",
                "body": resp.text[:500],
            }
        except requests.ConnectionError:
            return {
                "success": False,
                "error": f"Cannot connect to tairitsu-debug at {self.base_url}. "
                f"Is the dev server running with debug enabled?",
            }
        except requests.Timeout:
            return {"success": False, "error": f"Request to {endpoint} timed out"}

    def health(self) -> dict:
        """Check if tairitsu-debug server is alive."""
        return self._request("GET", "/health")

    def info(self) -> dict:
        """Get server info."""
        return self._request("GET", "/info")

    def ready(self) -> dict:
        """Check if browser is ready for commands."""
        return self._request("GET", "/ready")

    def navigate(self, url: str, wait_ms: int = 0) -> dict:
        """Navigate to URL, optionally wait for hydration."""
        return self._request(
            "POST", "/navigate", json_data={"url": url, "waitMs": wait_ms}
        )

    def navigate_route(
        self, base_url: str = "http://localhost:3000", route: str = "/", wait_ms: int = 8000
    ) -> dict:
        """Navigate to a route on the dev server."""
        url = f"{base_url}{route}" if route.startswith("/") else f"{base_url}/{route}"
        return self.navigate(url, wait_ms=wait_ms)

    def screenshot(
        self,
        output_path: str = "",
        full_page: bool = True,
        selector: Optional[str] = None,
    ) -> dict:
        """Capture screenshot. Returns dict with 'image' (base64) or saves to file."""
        payload: dict[str, Any] = {"fullPage": full_page}
        if selector:
            payload["selector"] = selector

        result = self._request("POST", "/screenshot", json_data=payload)

        image_data = result.get("image") or result.get("data")
        if image_data and output_path:
            raw = base64.b64decode(image_data)
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(raw)
            result["saved_to"] = output_path
            result["size_bytes"] = len(raw)

        return result

    def screenshot_element(self, selector: str, output_path: str = "") -> dict:
        """Screenshot a specific element by CSS selector."""
        return self.screenshot(output_path=output_path, full_page=False, selector=selector)

    def click(self, target: str) -> dict:
        """Click element by CSS selector or reference."""
        return self._request("POST", "/click", json_data={"target": target})

    def type_text(self, target: str, text: str, submit: bool = False) -> dict:
        """Type text into an element."""
        return self._request(
            "POST",
            "/type",
            json_data={"target": target, "text": text, "submit": submit},
        )

    def press_key(self, key: str) -> dict:
        """Press a keyboard key (Enter, Tab, Escape, ArrowUp, etc.)."""
        return self._request("POST", "/press", json_data={"key": key})

    def evaluate(self, expression: str) -> dict:
        """Execute JavaScript and return result."""
        return self._request("POST", "/evaluate", json_data={"function": expression})

    def snapshot(self, target: Optional[str] = None) -> dict:
        """Get accessibility tree snapshot of the page."""
        params = {"target": target} if target else None
        return self._request("GET", "/snapshot", params=params)

    def console_messages(self, level: Optional[str] = None) -> dict:
        """Get console log entries, optionally filtered by level."""
        params = {"level": level} if level else None
        return self._request("GET", "/console", params=params)

    def errors(self) -> dict:
        """Get page errors."""
        return self._request("GET", "/errors")

    def resize(self, width: int, height: int) -> dict:
        """Resize browser viewport."""
        return self._request("POST", "/resize", json_data={"width": width, "height": height})

    def scroll(self, x: int = 0, y: int = 0) -> dict:
        """Scroll the page."""
        return self._request("POST", "/scroll", json_data={"x": x, "y": y})

    def go_back(self) -> dict:
        """Go back in history."""
        return self._request("POST", "/navigate/back")

    def go_forward(self) -> dict:
        """Go forward in history."""
        return self._request("POST", "/navigate/forward")

    def wait_for(
        self,
        pattern: Optional[str] = None,
        seconds: Optional[float] = None,
        timeout: float = 30.0,
    ) -> dict:
        """Wait for text to appear on screen or fixed duration."""
        payload: dict[str, Any] = {}
        if pattern:
            payload["pattern"] = pattern
        if seconds is not None:
            payload["seconds"] = seconds
        return self._request("POST", "/wait", json_data=payload, timeout=max(timeout, seconds or 0) + 5)

    def capture_and_save(
        self,
        route: str,
        output_path: str,
        base_url: str = "http://localhost:3000",
        wait_ms: int = 8000,
        full_page: bool = True,
    ) -> dict:
        """Convenience: navigate + wait + screenshot + save."""
        nav_result = self.navigate_route(base_url, route, wait_ms)
        if not nav_result.get("success"):
            return nav_result
        time.sleep(1)
        return self.screenshot(output_path=output_path, full_page=full_page)

    def interactive_session(
        self,
        actions: list[dict],
        base_url: str = "http://localhost:3000",
        output_dir: str = ".",
    ) -> list[dict]:
        """Run a sequence of actions (navigate, click, screenshot, etc.)."""
        results = []
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        for i, action in enumerate(actions):
            action_type = action.get("action", "unknown")
            result = {"step": i, "action": action_type, "params": action}

            try:
                if action_type == "navigate":
                    route = action.get("route", "/")
                    result.update(self.navigate_route(base_url, route, action.get("wait_ms", 8000)))

                elif action_type == "screenshot":
                    name = action.get("output", f"step_{i}.png")
                    out = str(Path(output_dir) / name)
                    result.update(self.screenshot(out, full_page=action.get("full_page", True)))

                elif action_type == "click":
                    result.update(self.click(action.get("target", action.get("selector", ""))))

                elif action_type == "type":
                    result.update(self.type_text(
                        action.get("target", action.get("selector", "")),
                        action.get("text", ""),
                    ))

                elif action_type == "press":
                    result.update(self.press_key(action.get("key", "Enter")))

                elif action_type == "evaluate":
                    result.update(self.evaluate(action.get("script", action.get("expression", ""))))

                elif action_type == "wait":
                    dur = action.get("duration", action.get("seconds", 1))
                    time.sleep(dur)
                    result["success"] = True

                elif action_type == "snapshot":
                    result.update(self.snapshot())

                elif action_type == "check":
                    result.update(self.errors())
                    console = self.console_messages(level="error")
                    result["console_errors"] = console

                else:
                    result["success"] = False
                    result["error"] = f"Unknown action: {action_type}"

            except Exception as e:
                result["success"] = False
                result["error"] = str(e)

            results.append(result)

        return results
