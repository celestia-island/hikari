#!/usr/bin/env python3
"""
Comprehensive E2E Screenshot Capture - Playwright Edition

Uses Playwright directly (bypasses tairitsu-debug API browser issues).
Covers all routes with interactions: scroll, click, hover, type.

Naming convention:
  sNNN_opType_coords_region_details.png
  e.g. s001_nav_home_0,0-1920,1080_initial.png
      s047_click_nav-link_120,340-280,380_after-click.png
"""

import time
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE_URL = "http://localhost:52847"
OUT_DIR = Path("/mnt/sdb1/hikari/scripts/e2e/test_samples")
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1920, "height": 1080}
seq = [0]

def nid():
    seq[0] += 1
    return f"{seq[0]:03d}"

def snap(page, name, selector=None, full_page=False):
    """Screenshot with naming convention."""
    fname = f"{nid()}_{name}.png"
    path = str(OUT_DIR / fname)
    try:
        if selector:
            el = page.query_selector(selector)
            if el:
                el.screenshot(path=path)
            else:
                page.screenshot(path=path, full_page=full_page)
        else:
            page.screenshot(path=path, full_page=full_page)
        size = os.path.getsize(path)
        print(f"  [{size:>8}b] {fname}")
        return path
    except Exception as e:
        print(f"  [  FAIL ] {fname}: {e}")
        return None

def go(page, route, wait=8000):
    """Navigate to route."""
    url = f"{BASE_URL}{route}" if route.startswith("/") else f"{BASE_URL}/{route}"
    page.goto(url, wait_until="networkidle", timeout=wait)
    time.sleep(3)

def scroll_to(page, y):
    page.evaluate(f"window.scrollTo(0, {y})")
    time.sleep(0.8)

def scroll_by(page, dy):
    page.evaluate(f"window.scrollBy(0, {dy})")
    time.sleep(0.8)

def click_el(page, selector, desc=""):
    try:
        el = page.query_selector(selector)
        if el:
            el.click()
            time.sleep(0.6)
            return True
        # fallback: JS click
        page.evaluate(f"document.querySelector('{selector}')?.click()")
        time.sleep(0.6)
        return True
    except Exception as e:
        print(f"    click({selector}): {e}")
        return False

def type_el(page, selector, text, desc=""):
    try:
        el = page.query_selector(selector)
        if el:
            el.click()
            el.fill("")
            el.type_text(text, delay=30)
            time.sleep(0.5)
            return True
        page.evaluate(f"""
            const el = document.querySelector('{selector}');
            if(el){{el.value='{text}';el.dispatchEvent(new Event('input',{{bubbles:true}}));el.dispatchEvent(new Event('change',{{bubbles:true}}))}}
        """)
        time.sleep(0.5)
        return True
    except Exception as e:
        print(f"    type({selector}): {e}")
        return False

def hover_el(page, selector):
    try:
        el = page.query_selector(selector)
        if el:
            el.hover()
            time.sleep(0.5)
            return True
        page.evaluate(f"document.querySelector('{selector}')?.dispatchEvent(new MouseEvent('mouseover',{{bubbles:true}}))")
        time.sleep(0.5)
        return True
    except:
        return False

def get_scroll_height(page):
    return page.evaluate("document.documentElement.scrollHeight")

# ============================================================
# TEST PLAN: (route, description, actions list)
# Each action: ('type', args...) where type is one of:
#   'snap_viewport', 'snap_full', 'snap_el',
#   'scroll_to', 'scroll_by',
#   'click', 'type_in', 'hover',
#   'press_key', 'eval'
# ============================================================

TEST_PLAN = [
    # ===== HOME PAGE (/) =====
    ("/", "home", [
        ("snap_viewport", "nav_home_0,0-1920,1080_initial"),
        ("snap_full", "nav_home_fullpage_full"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_home_0,500-1920,1580_scrolled-500px"),
        ("scroll_by", 800),
        ("snap_viewport", "scroll_home_0,1300-1920,2380_scrolled-1300px"),
        ("scroll_by", 1000),
        ("snap_viewport", "scroll_home_0,2300-1920,3380_bottom-area"),
        ("scroll_to", 0),
    ]),

    # ===== COMPONENTS OVERVIEW =====
    ("/components", "components-overview", [
        ("snap_viewport", "nav_components_0,0-1920,1080_initial"),
        ("snap_full", "nav_components_fullpage_full"),
        ("scroll_by", 400),
        ("snap_viewport", "scroll_components_0,400-1920,1480_mid-page"),
        ("scroll_by", 600),
        ("snap_viewport", "scroll_components_0,1000-1920,2080_lower-page"),
        ("scroll_to", 0),
    ]),

    # ===== LAYER1 (Basic Components) =====
    ("/components/layer1", "layer1-basic", [
        ("snap_viewport", "nav_layer1_0,0-1920,1080_initial"),
        ("snap_full", "nav_layer1_fullpage_full"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_layer1_0,500-1920,1580_scrolled"),
        ("scroll_by", 700),
        ("snap_viewport", "scroll_layer1_0,1200-1920,2280_deeper"),
        ("scroll_by", 900),
        ("snap_viewport", "scroll_layer1_0,2100-1920,3180_near-bottom"),
        ("scroll_to", 0),
    ]),

    # ===== LAYER2 (Data/Entry) =====
    ("/components/layer2", "layer2-data-entry", [
        ("snap_viewport", "nav_layer2_0,0-1920,1080_initial"),
        ("snap_full", "nav_layer2_fullpage_full"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_layer2_0,500-1920,1580_scrolled"),
        ("scroll_by", 800),
        ("snap_viewport", "scroll_layer2_0,1300-1920,2380_lower"),
        ("scroll_to", 0),
    ]),

    # ===== LAYER3 (Advanced) =====
    ("/components/layer3", "layer3-advanced", [
        ("snap_viewport", "nav_layer3_0,0-1920,1080_initial"),
        ("snap_full", "nav_layer3_fullpage_full"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_layer3_0,500-1920,1580_scrolled"),
        ("scroll_by", 800),
        ("snap_viewport", "scroll_layer3_0,1300-1920,2380_lower"),
        ("scroll_to", 0),
    ]),

    # ===== BUTTON PAGE =====
    ("/button", "button-demos", [
        ("snap_viewport", "nav_button_0,0-1920,1080_initial"),
        ("snap_full", "nav_button_fullpage_full"),
        ("hover", "button:first-of-type", "hover_first-button"),
        ("snap_viewport", "hover_button_0,0-1920,1080_hover-firstBtn"),
        ("click", "button:first-of-type", "click-first-button"),
        ("snap_viewport", "click_button_0,0-1920,1080_after-click-firstBtn"),
        ("scroll_by", 400),
        ("snap_viewport", "scroll_button_0,400-1920,1480_showing-more-buttons"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_button_0,900-1920,1980_button-variations"),
        ("scroll_to", 0),
    ]),

    # ===== INPUT PAGE =====
    ("/input", "input-demos", [
        ("snap_viewport", "nav_input_0,0-1920,1080_initial"),
        ("snap_full", "nav_input_fullpage_full"),
        ("type_in", "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='range']), textarea",
         "Hello E2E Test!", "type-hello-text"),
        ("snap_viewport", "type_input_0,0-1920,1080_typed-HelloE2ETest"),
        ("type_in", "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='range']), textarea",
         "Testing with longer content for input field validation", "type-long-text"),
        ("snap_viewport", "type_input_0,0-1920,1080_typed-long-text-content"),
        ("scroll_by", 400),
        ("snap_viewport", "scroll_input_0,400-1920,1480_more-input-fields"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_input_0,900-1920,1980_input-bottom-section"),
        ("scroll_to", 0),
    ]),

    # ===== CARD PAGE =====
    ("/card", "card-demos", [
        ("snap_viewport", "nav_card_0,0-1920,1080_initial"),
        ("snap_full", "nav_card_fullpage_full"),
        ("hover", "[class*=card], [class*=Card], article, .card-wrapper",
         "hover-card-element"),
        ("snap_viewport", "hover_card_0,0-1920,1080_hover-card-effect"),
        ("scroll_by", 450),
        ("snap_viewport", "scroll_card_0,450-1920,1530_more-cards"),
        ("scroll_by", 600),
        ("snap_viewport", "scroll_card_0,1050-1920,2130_card-grid-bottom"),
        ("scroll_to", 0),
    ]),

    # ===== TABLE PAGE =====
    ("/table", "table-demos", [
        ("snap_viewport", "nav_table_0,0-1920,1080_initial"),
        ("snap_full", "nav_table_fullpage_full"),
        ("scroll_by", 300),
        ("snap_viewport", "scroll_table_0,300-1920,1380_table-body-visible"),
        ("click", "tbody tr:first-child, table tr:nth-child(2)",
         "click-table-row"),
        ("snap_viewport", "click_table_0,300-1920,1380_after-row-click"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_table_0,800-1920,1880_table-lower-rows"),
        ("scroll_to", 0),
    ]),

    # ===== SWITCH PAGE =====
    ("/switch", "switch-demos", [
        ("snap_viewport", "nav_switch_0,0-1920,1080_initial"),
        ("snap_full", "nav_switch_fullpage_full"),
        ("click", "[role=switch], [class*=switch] button, [class*=toggle], label[class*=switch]",
         "toggle-switch-on"),
        ("snap_viewport", "click_switch_0,0-1920,1080_after-toggle-on"),
        ("click", "[role=switch], [class*=switch] button, [class*=toggle], label[class*=switch]",
         "toggle-switch-off"),
        ("snap_viewport", "click_switch_0,0-1920,1080_after-toggle-off"),
        ("scroll_by", 400),
        ("snap_viewport", "scroll_switch_0,400-1920,1480_more-switches"),
        ("scroll_to", 0),
    ]),

    # ===== PALETTE PAGE =====
    ("/palette", "palette-colors", [
        ("snap_viewport", "nav_palette_0,0-1920,1080_initial"),
        ("snap_full", "nav_palette_fullpage_full"),
        ("scroll_by", 400),
        ("snap_viewport", "scroll_palette_0,400-1920,1480_color-swatches"),
        ("scroll_by", 600),
        ("snap_viewport", "scroll_palette_0,1000-1920,2080_more-palettes"),
        ("scroll_by", 800),
        ("snap_viewport", "scroll_palette_0,1800-1920,2880_palette-bottom"),
        ("scroll_to", 0),
    ]),

    # ===== NAVIGATION PAGE =====
    ("/navigation", "navigation-demos", [
        ("snap_viewport", "nav_navigation_0,0-1920,1080_initial"),
        ("snap_full", "nav_navigation_fullpage_full"),
        ("click", "nav a[href]:first-child, sidebar a, [class*=nav] a[href]",
         "click-nav-link"),
        ("snap_viewport", "click_nav_0,0-1920,1080_after-nav-click"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_nav_0,500-1920,1580_nav-scrolled"),
        ("scroll_to", 0),
    ]),

    # ===== GETTING STARTED GUIDE =====
    ("/guides/getting-started", "guide-getting-started", [
        ("snap_viewport", "nav_guide_0,0-1920,1080_initial"),
        ("snap_full", "nav_guide_fullpage_full"),
        ("scroll_by", 500),
        ("snap_viewport", "scroll_guide_0,500-1920,1580_section2"),
        ("scroll_by", 700),
        ("snap_viewport", "scroll_guide_0,1200-1920,2280_section3"),
        ("scroll_by", 700),
        ("snap_viewport", "scroll_guide_0,1900-1920,2980_section4"),
        ("scroll_by", 700),
        ("snap_viewport", "scroll_guide_0,2600-1920,3680_section5"),
        ("scroll_by", 700),
        ("snap_viewport", "scroll_guide_0,3300-1920,4380_bottom-guide"),
        ("scroll_to", 0),
    ]),
]

# ============================================================
# RUN
# ============================================================

print(f"Output: {OUT_DIR}")
print(f"URL:    {BASE_URL}")
print(f"Size:   {VIEWPORT['width']}x{VIEWPORT['height']}")
print("=" * 70)

total = 0
ok_count = 0
failures = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport=VIEWPORT)

    for route, desc, actions in TEST_PLAN:
        print(f"\n{'─'*70}")
        print(f"  [{desc}] {route}")
        print(f"{'─'*70}")

        try:
            go(page, route)
        except PWTimeout:
            print("  ! Navigation timeout, using current state")
            time.sleep(3)

        for action in actions:
            atype = action[0]
            total += 1

            try:
                if atype == "snap_viewport":
                    r = snap(page, action[1])
                    if r: ok_count += 1
                    else: failures.append(action[1])

                elif atype == "snap_full":
                    r = snap(page, action[1], full_page=True)
                    if r: ok_count += 1
                    else: failures.append(action[1])

                elif atype == "snap_el":
                    r = snap(page, action[1], selector=action[2])
                    if r: ok_count += 1
                    else: failures.append(action[1])

                elif atype == "scroll_to":
                    scroll_to(page, action[1])

                elif atype == "scroll_by":
                    scroll_by(page, action[1])

                elif atype == "click":
                    sel = action[1]
                    d = action[2] if len(action) > 2 else ""
                    if not click_el(page, sel, d):
                        failures.append(f"click:{sel}")

                elif atype == "type_in":
                    sel = action[1]
                    txt = action[2]
                    d = action[3] if len(action) > 3 else ""
                    if not type_el(page, sel, txt, d):
                        failures.append(f"type:{sel}")

                elif atype == "hover":
                    sel = action[1]
                    d = action[2] if len(action) > 2 else ""
                    hover_el(page, sel)

                elif atype == "press_key":
                    page.keyboard.press(action[1])
                    time.sleep(0.3)

                elif atype == "eval":
                    page.evaluate(action[1])

                else:
                    print(f"  ? Unknown action: {atype}")
                    failures.append(f"unknown:{atype}")

            except Exception as e:
                print(f"  ERROR [{action[1]}]: {e}")
                failures.append(f"err:{action[1]}")

    browser.close()

# Summary
print(f"\n{'='*70}")
print(f"DONE: {ok_count}/{total} screenshots captured")
if failures:
    print(f"Failures ({len(failures)}):")
    for f in failures[:20]:
        print(f"  - {f}")
files = sorted(OUT_DIR.glob("*.png"))
total_size = sum(f.stat().st_size for f in files)
print(f"Total files: {len(files)}, Total size: {total_size / 1024 / 1024:.1f}MB")
print(f"Output dir: {OUT_DIR}")
