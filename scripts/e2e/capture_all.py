#!/usr/bin/env python3
"""
Comprehensive E2E Screenshot Capture Script

Captures systematic screenshots across all routes with interactions.
Output: scripts/e2e/test_samples/
Naming: sNNN_opType_coords_region_details.png
"""

import sys
sys.path.insert(0, "/mnt/sdb1/hikari/scripts/e2e")

import time
from pathlib import Path
from browser import TairitsuBrowser

BASE_URL = "http://localhost:52847"
DEBUG_PORT = 52848
OUT_DIR = Path("/mnt/sdb1/hikari/scripts/e2e/test_samples")
OUT_DIR.mkdir(parents=True, exist_ok=True)

browser = TairitsuBrowser(debug_port=DEBUG_PORT)

seq = [0]
def next_id():
    seq[0] += 1
    return f"{seq[0]:03d}"

def snap(name, selector=None, full_page=False):
    """Take a screenshot and save with naming convention."""
    fname = f"{next_id()}_{name}.png"
    path = str(OUT_DIR / fname)
    r = browser.screenshot(path, full_page=full_page, selector=selector)
    ok = r.get("success", False)
    size = r.get("size_bytes", 0)
    status = "OK" if ok else "FAIL"
    print(f"  [{status}] {fname} ({size}b)")
    return path, ok

def nav(route, wait_ms=8000):
    """Navigate to a route."""
    r = browser.navigate_route(BASE_URL, route, wait_ms)
    time.sleep(2)
    return r.get("success", False)

def click_sel(selector):
    """Click an element."""
    r = browser.click(selector)
    time.sleep(0.5)
    return r.get("success", False)

def type_sel(selector, text):
    """Type into element."""
    r = browser.type_text(selector, text)
    time.sleep(0.5)
    return r.get("success", False)

def press_key(key):
    """Press key."""
    r = browser.press_key(key)
    time.sleep(0.3)
    return r.get("success", False)

def scroll_page(y):
    """Scroll page."""
    r = browser.scroll(0, y)
    time.sleep(0.5)
    return r.get("success", False)

def eval_js(expr):
    """Evaluate JS."""
    r = browser.evaluate(expr)
    return r.get("success", False), r

# ============================================================
# TEST PLAN
# ============================================================
tests = []

# --- Route 1: Home Page (/) ---
tests.append(("Home Page", [
    ("nav", "/", 10000),
    ("snap_viewport", "home_initial_viewport_0,0-1920,1080"),
    ("snap_full", "home_fullpage_full"),
    ("scroll", 500),
    ("snap_viewport", "home_scrolled500_0,500-1920,1580"),
    ("scroll", 1000),
    ("snap_viewport", "home_scrolled1500_0,1500-1920,2580"),
    ("scroll", 0),
]))

# --- Route 2: Components Overview ---
tests.append(("Components Overview", [
    ("nav", "/components", 8000),
    ("snap_viewport", "components_overview_0,0-1920,1080"),
    ("snap_full", "components_overview_full"),
    ("scroll", 400),
    ("snap_viewport", "components_scrolled400_0,400-1920,1480"),
    ("scroll", 0),
]))

# --- Route 3: Layer1 Components ---
tests.append(("Layer1 Components", [
    ("nav", "/components/layer1", 8000),
    ("snap_viewport", "layer1_initial_0,0-1920,1080"),
    ("snap_full", "layer1_fullpage_full"),
    ("scroll", 600),
    ("snap_viewport", "layer1_scrolled600_0,600-1920,1680"),
    ("scroll", 1200),
    ("snap_viewport", "layer1_scrolled1200_0,1200-1920,2280"),
    ("scroll", 0),
]))

# --- Route 4: Layer2 Components ---
tests.append(("Layer2 Components", [
    ("nav", "/components/layer2", 8000),
    ("snap_viewport", "layer2_initial_0,0-1920,1080"),
    ("snap_full", "layer2_fullpage_full"),
    ("scroll", 600),
    ("snap_viewport", "layer2_scrolled600_0,600-1920,1680"),
    ("scroll", 0),
]))

# --- Route 5: Layer3 Components ---
tests.append(("Layer3 Components", [
    ("nav", "/components/layer3", 8000),
    ("snap_viewport", "layer3_initial_0,0-1920,1080"),
    ("snap_full", "layer3_fullpage_full"),
    ("scroll", 600),
    ("snap_viewport", "layer3_scrolled600_0,600-1920,1680"),
    ("scroll", 0),
]))

# --- Route 6: Button ---
tests.append(("Button Page", [
    ("nav", "/button", 8000),
    ("snap_viewport", "button_initial_0,0-1920,1080"),
    ("snap_full", "button_fullpage_full"),
    # Hover first button via JS
    ("eval", "document.querySelectorAll('button')[0]?.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));'ok'"),
    ("snap_viewport", "button_hover-firstBtn_0,0-1920,1080"),
    # Click first button
    ("click", "button:first-of-type"),
    ("snap_viewport", "button_click-firstBtn_0,0-1920,1080"),
    # Scroll to see more buttons
    ("scroll", 500),
    ("snap_viewport", "button_scrolled500_0,500-1920,1580"),
    ("scroll", 0),
]))

# --- Route 7: Input ---
tests.append(("Input Page", [
    ("nav", "/input", 8000),
    ("snap_viewport", "input_initial_0,0-1920,1080"),
    ("snap_full", "input_fullpage_full"),
    # Type into first input
    ("type", "input:not([type='hidden']):not([type='checkbox']):not([type='radio']), textarea", "Hello E2E Test!"),
    ("snap_viewport", "input_typed-HelloE2ETest_0,0-1920,1080"),
    # Clear and type more
    ("eval", "const el=document.querySelector('input:not([type=\"hidden\"]):not([type=\"checkbox\"]):not([type=\"radio\"),textarea');if(el){el.value='';el.dispatchEvent(new Event('input',{bubbles:true}))}'done'"),
    ("type", "input:not([type='hidden']):not([type='checkbox']):not([type='radio']), textarea", "Testing input with longer text content"),
    ("snap_viewport", "input_typed-longtext_0,0-1920,1080"),
    ("scroll", 400),
    ("snap_viewport", "input_scrolled400_0,400-1920,1480"),
    ("scroll", 0),
]))

# --- Route 8: Card ---
tests.append(("Card Page", [
    ("nav", "/card", 8000),
    ("snap_viewport", "card_initial_0,0-1920,1080"),
    ("snap_full", "card_fullpage_full"),
    # Hover card
    ("eval", "const c=document.querySelector('[class*=card],.card,[role=article]');if(c)c.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));'ok'"),
    ("snap_viewport", "card_hover-card_0,0-1920,1080"),
    ("scroll", 500),
    ("snap_viewport", "card_scrolled500_0,500-1920,1580"),
    ("scroll", 0),
]))

# --- Route 9: Table ---
tests.append(("Table Page", [
    ("nav", "/table", 8000),
    ("snap_viewport", "table_initial_0,0-1920,1080"),
    ("snap_full", "table_fullpage_full"),
    ("scroll", 400),
    ("snap_viewport", "table_scrolled400_0,400-1920,1480"),
    # Click a table row if exists
    ("eval", "const row=document.querySelector('tbody tr');if(row){row.click();'clicked'}else{'no-row'}"),
    ("snap_viewport", "table_click-row_0,400-1920,1480"),
    ("scroll", 0),
]))

# --- Route 10: Switch ---
tests.append(("Switch Page", [
    ("nav", "/switch", 8000),
    ("snap_viewport", "switch_initial_0,0-1920,1080"),
    ("snap_full", "switch_fullpage_full"),
    # Click/toggle first switch
    ("click", "[role=switch], .switch input, [class*=switch] button, [class*=toggle]"),
    ("snap_viewport", "switch_toggle-first_0,0-1920,1080"),
    # Toggle again
    ("click", "[role=switch], .switch input, [class*=switch] button, [class*=toggle]"),
    ("snap_viewport", "switch_toggle-back_0,0-1920,1080"),
    ("scroll", 400),
    ("snap_viewport", "switch_scrolled400_0,400-1920,1480"),
    ("scroll", 0),
]))

# --- Route 11: Palette ---
tests.append(("Palette Page", [
    ("nav", "/palette", 8000),
    ("snap_viewport", "palette_initial_0,0-1920,1080"),
    ("snap_full", "palette_fullpage_full"),
    ("scroll", 500),
    ("snap_viewport", "palette_scrolled500_0,500-1920,1580"),
    ("scroll", 1000),
    ("snap_viewport", "palette_scrolled1000_0,1000-1920,2080"),
    ("scroll", 0),
]))

# --- Route 12: Navigation ---
tests.append(("Navigation Page", [
    ("nav", "/navigation", 8000),
    ("snap_viewport", "nav_initial_0,0-1920,1080"),
    ("snap_full", "nav_fullpage_full"),
    # Click a nav item
    ("eval", "const link=document.querySelector('nav a, [nav] a, .sidebar a');if(link){link.click();'clicked'}else{'none'}"),
    ("snap_viewport", "nav_click-link_0,0-1920,1080"),
    ("scroll", 500),
    ("snap_viewport", "nav_scrolled500_0,500-1920,1580"),
    ("scroll", 0),
]))

# --- Route 13: Select/Dropdown ---
tests.append(("Select Page", [
    ("/select", 8000),  # try this route
]))
tests.append(("Select Page fallback", [
    ("nav", "/components/layer1", 8000),
    ("snap_viewport", "select_fallback-layer1_0,0-1920,1080"),
]))

# --- Route 14: Guides/Getting Started ---
tests.append(("Getting Started Guide", [
    ("nav", "/guides/getting-started", 8000),
    ("snap_viewport", "guide_getting-started_0,0-1920,1080"),
    ("snap_full", "guide_getting-started_full"),
    ("scroll", 600),
    ("snap_viewport", "guide_scroll600_0,600-1920,1680"),
    ("scroll", 1200),
    ("snap_viewport", "guide_scroll1200_0,1200-1920,2280"),
    ("scroll", 1800),
    ("snap_viewport", "guide_scroll1800_0,1800-1920,2880"),
    ("scroll", 0),
]))

# ============================================================
# EXECUTE
# ============================================================
print(f"Output directory: {OUT_DIR}")
print(f"Base URL: {BASE_URL}")
print(f"Debug port: {DEBUG_PORT}")
print("=" * 60)

health = browser.health()
print(f"Server health: {health.get('health', {}).get('data', {}).get('status', 'unknown')}")

total_snaps = 0
total_ok = 0
failed_tests = []

for test_name, actions in tests:
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

    test_ok = True
    for action in actions:
        atype = action[0]

        try:
            if atype == "nav":
                ok = nav(action[1], action[2] if len(action) > 2 else 8000)
                print(f"  navigate -> {action[1]} {'OK' if ok else 'FAIL'}")
                if not ok:
                    test_ok = False

            elif atype == "snap_viewport":
                p, ok = snap(action[1])
                total_snaps += 1
                if ok:
                    total_ok += 1
                else:
                    test_ok = False

            elif atype == "snap_full":
                p, ok = snap(action[1], full_page=True)
                total_snaps += 1
                if ok:
                    total_ok += 1
                else:
                    test_ok = False

            elif atype == "scroll":
                ok = scroll_page(action[1])

            elif atype == "click":
                ok = click_sel(action[1])
                print(f"  click({action[1]}) -> {'OK' if ok else 'FAIL'}")

            elif atype == "type":
                ok = type_sel(action[1], action[2])
                print(f"  type('{action[2]}') -> {'OK' if ok else 'FAIL'}")

            elif atype == "press":
                ok = press_key(action[1])

            elif atype == "eval":
                ok, res = eval_js(action[1])

            else:
                print(f"  UNKNOWN action: {atype}")
                test_ok = False

        except Exception as e:
            print(f"  ERROR in {atype}: {e}")
            test_ok = False

    if not test_ok:
        failed_tests.append(test_name)

print(f"\n{'='*60}")
print(f"DONE: {total_ok}/{total_snaps} screenshots captured")
if failed_tests:
    print(f"Failed tests: {failed_tests}")
else:
    print("All tests passed!")
print(f"Output: {OUT_DIR}")
print(f"Files: {len(list(OUT_DIR.glob('*.png')))}")
