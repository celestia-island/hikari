#!/usr/bin/env python3
"""
E2E Screenshot Capture v3 - FIXED
- Correct routes (with /index.html)
- Scroll the actual content container (.custom-scrollbar-content)
- Proper WASM/Dioxus interaction handling
- Full-page screenshots working
"""

import sys, time, os, json
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "http://localhost:52847"
OUT = Path("/mnt/sdb1/hikari/scripts/e2e/test_samples_v3")
OUT.mkdir(exist_ok=True)
VP = dict(width=1920, height=1080)
seq = [0]

def nid():
    seq[0] += 1; return f"{seq[0]:03d}"

def snap(page, name, sel=None, full_page=False):
    fn = f"{nid()}_{name}.png"
    p = str(OUT / fn)
    try:
        if full_page:
            page.screenshot(path=p, full_page=True)
        elif sel:
            e = page.query_selector(sel)
            if e: e.screenshot(path=p)
            else: page.screenshot(path=p)
        else:
            page.screenshot(path=p)
        s = os.path.getsize(p)
        print(f"  [{s:>8}] {fn}")
    except Exception as e:
        print(f"  [FAIL] {fn}: {e}")

def nav(page, route, wait_after=12):
    url = BASE + route
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=25000)
    except:
        pass
    time.sleep(wait_after)

def scroll_content(page, dy):
    """Scroll the main content container, not window."""
    page.evaluate(f"""
        () => {{
            const containers = document.querySelectorAll('.custom-scrollbar-content');
            for (const c of containers) {{
                if (c.scrollHeight > c.clientHeight + 50) {{
                    c.scrollTop += {dy};
                }}
            }}
        }}
    """)
    time.sleep(0.8)

def scroll_to(page, y):
    """Scroll content container to absolute position."""
    page.evaluate(f"""
        () => {{
            const containers = document.querySelectorAll('.custom-scrollbar-content');
            for (const c of containers) {{
                if (c.scrollHeight > c.clientHeight + 50) {{
                    c.scrollTop = {y};
                }}
            }}
        }}
    """)
    time.sleep(0.8)

def reset_scroll(page):
    scroll_to(page, 0)

def do_hover(page, selector):
    """Hover over an element - force CSS :hover via JS class for WASM components."""
    try:
        el = page.query_selector(selector)
        if el:
            el.hover(timeout=3000)
            # Also force hover state via JS for Dioxus components
            page.evaluate(f"""
                () => {{
                    const el = document.querySelector('{selector}');
                    if (el) {{
                        el.dispatchEvent(new MouseEvent('mouseenter', {{bubbles: true}}));
                        el.dispatchEvent(new MouseEvent('mouseover', {{bubbles: true}}));
                    }}
                }}
            """)
        else:
            page.evaluate(f"""
                () => {{
                    const el = document.querySelector('{selector}');
                    if (el) {{
                        el.dispatchEvent(new MouseEvent('mouseenter', {{bubbles: true}}));
                        el.dispatchEvent(new MouseEvent('mouseover', {{bubbles: true}}));
                    }}
                }}
            """)
        time.sleep(0.6)
    except Exception as e:
        print(f"    ! hover({selector}): {str(e)[:60]}")

def do_click(page, selector):
    """Click an element with proper event dispatching for WASM."""
    try:
        el = page.query_selector(selector)
        if el:
            el.click(timeout=5000)
        else:
            page.evaluate(f"document.querySelector('{selector}')?.click()")
        time.sleep(0.8)
    except Exception as e:
        print(f"    ! click({selector}): {str(e)[:80]}")

def do_type(page, selector, text):
    """Type text into input - works with WASM input handling."""
    try:
        el = page.query_selector(selector)
        if el:
            el.click(timeout=3000)
            time.sleep(0.15)
            # Triple-click to select all, then type replaces selection
            el.click(click_count=3)
            time.sleep(0.1)
            # Type using keyboard simulation (works better with WASM)
            page.keyboard.type(text, delay=30)
        else:
            # Fallback: JS-based value setting
            page.evaluate(f"""
                () => {{
                    const el = document.querySelector('{selector}');
                    if (el) {{
                        el.focus();
                        el.value = '{text}';
                        el.dispatchEvent(new Event('input', {{bubbles: true}}));
                        el.dispatchEvent(new Event('change', {{bubbles: true}}));
                    }}
                }}
            """)
        time.sleep(0.6)
    except Exception as e:
        print(f"    ! type({selector}): {str(e)[:80]}")

# ============================================================
# CORRECT ROUTES (all with /index.html from public/ structure)
# ============================================================
PLAN = [
    # --- HOME ---
    ("/", "home", [
        ("sv", "nav_home_0,0-1920,1080_initial"),
        ("sf", "nav_home_fullpage_full"),
        ("sc", 500, "scroll_home_0,500-1920,1580_scrolled500"),
        ("sc", 1200, "scroll_home_0,1200-1920,2280_scrolled1200"),
        ("sc", 2000, "scroll_home_0,2000-1920,3080_bottom"),
        ("rs",),
    ]),
    # --- COMPONENTS OVERVIEW ---
    ("/components/index.html", "components-overview", [
        ("sv", "nav_components_0,0-1920,1080_initial"),
        ("sf", "nav_components_fullpage_full"),
        ("sc", 400, "scroll_components_0,400-1920,1480_mid"),
        ("sc", 900, "scroll_components_0,900-1920,1980_lower"),
        ("rs",),
    ]),
    # --- LAYER1: Button Demo ---
    ("/components/layer1/button/index.html", "button-demo", [
        ("sv", "nav_button_0,0-1920,1080_initial"),
        ("sf", "nav_button_fullpage_full"),
        ("hv", "button:first-of-type", "hover_button-firstBtn"),
        ("sv", "hover_button_0,0-1920,1080_hover-firstBtn"),
        ("ck", "button:first-of-type", "click_button-primary"),
        ("sv", "click_button_0,0-1920,1080_after-click-primary"),
        ("sc", 500, "scroll_button_0,500-1920,1580_more-btns"),
        ("sc", 1000, "scroll_button_0,1000-1920,2080_btn-variations"),
        ("rs",),
    ]),
    # --- LAYER1: Form (Input) Demo ---
    ("/components/layer1/form/index.html", "form-input-demo", [
        ("sv", "nav_form_0,0-1920,1080_initial"),
        ("sf", "nav_form_fullpage_full"),
        ("ck", "input[type='text'], input:not([type]):first-of-type", "focus-first-input"),
        ("tp", "input[type='text'], input:not([type]):first-of-type",
         "Hello E2E Test!", "type_input-hello"),
        ("sv", "type_form_0,0-1920,1080_typed-hello"),
        ("tp", "input[type='text'], input:not([type]):first-of-type",
         "Longer test text validation", "type_input-long"),
        ("sv", "type_form_0,0-1920,1080_typed-long"),
        ("sc", 500, "scroll_form_0,500-1920,1580_more-fields"),
        ("sc", 1100, "scroll_form_0,1100-1920,2180_form-bottom"),
        ("rs",),
    ]),
    # --- LAYER1: Switch Demo ---
    ("/components/layer1/switch/index.html", "switch-demo", [
        ("sv", "nav_switch_0,0-1920,1080_initial"),
        ("sf", "nav_switch_fullpage_full"),
        ("ck", "[role='switch'], .hi-switch, label:has(input[type='checkbox'])",
         "toggle-switch-on"),
        ("sv", "click_switch_0,0-1920,1080_after-toggle-on"),
        ("ck", "[role='switch'], .hi-switch, label:has(input[type='checkbox'])",
         "toggle-switch-off"),
        ("sv", "click_switch_0,0-1920,1080_after-toggle-off"),
        ("sc", 400, "scroll_switch_0,400-1920,1480_more-switches"),
        ("rs",),
    ]),
    # --- LAYER1: Avatar Demo ---
    ("/components/layer1/avatar/index.html", "avatar-demo", [
        ("sv", "nav_avatar_0,0-1920,1080_initial"),
        ("sf", "nav_avatar_fullpage_full"),
        ("sc", 400, "scroll_avatar_0,400-1920,1480_variations"),
        ("rs",),
    ]),
    # --- LAYER1: Tag Demo ---
    ("/components/layer1/tag/index.html", "tag-demo", [
        ("sv", "nav_tag_0,0-1920,1080_initial"),
        ("sf", "nav_tag_fullpage_full"),
        ("hv", ".hi-tag, [class*='tag']", "hover_tag"),
        ("sv", "hover_tag_0,0-1920,1080_hover-tag"),
        ("sc", 350, "scroll_tag_0,350-1920,1430_more-tags"),
        ("rs",),
    ]),
    # --- LAYER1: Search Demo ---
    ("/components/layer1/search/index.html", "search-demo", [
        ("sv", "nav_search_0,0-1920,1080_initial"),
        ("sf", "nav_search_fullpage_full"),
        ("ck", "input, .search-input", "focus-search"),
        ("tp", "input:first-of-type", "test search query", "type_search-query"),
        ("sv", "type_search_0,0-1920,1080_typed-query"),
        ("rs",),
    ]),
    # --- LAYER1: Number Input ---
    ("/components/layer1/number-input/index.html", "number-input-demo", [
        ("sv", "nav_numberInput_0,0-1920,1080_initial"),
        ("sf", "nav_numberInput_fullpage_full"),
        ("ck", "input", "click-number-input"),
        ("tp", "input:first-of-type", "42", "type_number-42"),
        ("sv", "type_numInput_0,0-1920,1080_typed-42"),
        ("rs",),
    ]),
    # --- LAYER1: Empty State ---
    ("/components/layer1/empty/index.html", "empty-demo", [
        ("sv", "nav_empty_0,0-1920,1080_initial"),
        ("sf", "nav_empty_fullpage_full"),
        ("sc", 300, "scroll_empty_0,300-1920,1380_variants"),
        ("rs",),
    ]),
    # --- LAYER1: Feedback ---
    ("/components/layer1/feedback/index.html", "feedback-demo", [
        ("sv", "nav_feedback_0,0-1920,1080_initial"),
        ("sf", "nav_feedback_fullpage_full"),
        ("sc", 400, "scroll_feedback_0,400-1920,1480_alerts-toasts"),
        ("rs",),
    ]),
    # --- LAYER2: Table ---
    ("/components/layer2/table/index.html", "table-demo", [
        ("sv", "nav_table_0,0-1920,1080_initial"),
        ("sf", "nav_table_fullpage_full"),
        ("sc", 250, "scroll_table_0,250-1920,1330_body-visible"),
        ("ck", "tbody tr:first-child td, tbody tr:nth-child(1)", "click-row"),
        ("sv", "click_table_0,250-1920,1330_after-row-click"),
        ("sc", 500, "scroll_table_0,750-1920,1830_more-rows"),
        ("rs",),
    ]),
    # --- LAYER2: Navigation ---
    ("/components/layer2/navigation/index.html", "navigation-demo", [
        ("sv", "nav_navComp_0,0-1920,1080_initial"),
        ("sf", "nav_navComp_fullpage_full"),
        ("ck", ".hi-tabs button, [role='tab']:first-of-type", "click-nav-link"),
        ("sv", "click_navComp_0,0-1920,1080_after-click"),
        ("sc", 500, "scroll_navComp_0,500-1920,1580_scrolled"),
        ("rs",),
    ]),
    # --- LAYER2: Pagination ---
    ("/components/layer2/pagination/index.html", "pagination-demo", [
        ("sv", "nav_pagination_0,0-1920,1080_initial"),
        ("sf", "nav_pagination_fullpage_full"),
        ("ck", "button, [aria-label]", "click-page-btn"),
        ("sv", "click_pagination_0,0-1920,1080_after-page-click"),
        ("rs",),
    ]),
    # --- LAYER2: Tree ---
    ("/components/layer2/tree/index.html", "tree-demo", [
        ("sv", "nav_tree_0,0-1920,1080_initial"),
        ("sf", "nav_tree_fullpage_full"),
        ("ck", "button, [class*='toggle'], [class*='expand']", "toggle-tree-node"),
        ("sv", "click_tree_0,0-1920,1080_after-expand"),
        ("sc", 350, "scroll_tree_0,350-1920,1430_tree-nodes"),
        ("rs",),
    ]),
    # --- LAYER2: Transfer ---
    ("/components/layer2/transfer/index.html", "transfer-demo", [
        ("sv", "nav_transfer_0,0-1920,1080_initial"),
        ("sf", "nav_transfer_fullpage_full"),
        ("ck", "button", "click-transfer-arrow"),
        ("sv", "click_transfer_0,0-1920,1080_after-transfer"),
        ("rs",),
    ]),
    # --- LAYER2: Timeline ---
    ("/components/layer2/timeline/index.html", "timeline-demo", [
        ("sv", "nav_timeline_0,0-1920,1080_initial"),
        ("sf", "nav_timeline_fullpage_full"),
        ("sc", 400, "scroll_timeline_0,400-1920,1480_entries"),
        ("rs",),
    ]),
    # --- LAYER2: Collapsible ---
    ("/components/layer2/collapsible/index.html", "collapsible-demo", [
        ("sv", "nav_collapsible_0,0-1920,1080_initial"),
        ("sf", "nav_collapsible_fullpage_full"),
        ("ck", "summary, [class*='header'] button, details > summary", "toggle-collapse"),
        ("sv", "click_collapsible_0,0-1920,1080_after-toggle"),
        ("rs",),
    ]),
    # --- LAYER2: Cascader ---
    ("/components/layer2/cascader/index.html", "cascader-demo", [
        ("sv", "nav_cascader_0,0-1920,1080_initial"),
        ("sf", "nav_cascader_fullpage_full"),
        ("ck", "input, [class*='trigger']", "open-cascader"),
        ("sv", "click_cascader_0,0-1920,1080_opened"),
        ("rs",),
    ]),
    # --- LAYER2: Data Display ---
    ("/components/layer2/data/index.html", "data-display-demo", [
        ("sv", "nav_data_0,0-1920,1080_initial"),
        ("sf", "nav_data_fullpage_full"),
        ("sc", 400, "scroll_data_0,400-1920,1480_data-sections"),
        ("rs",),
    ]),
    # --- LAYER3: Editor (Markdown) ---
    ("/components/layer3/editor/index.html", "editor-demo", [
        ("sv", "nav_editor_0,0-1920,1080_initial"),
        ("sf", "nav_editor_fullpage_full"),
        ("ck", "textarea, [contenteditable='true']", "focus-editor"),
        ("tp", "textarea, [contenteditable='true']",
         "# Hello Markdown\n\nThis is **bold** text.", "type_markdown"),
        ("sv", "type_editor_0,0-1920,1080_typed-markdown"),
        ("sc", 400, "scroll_editor_0,400-1920,1480_editor-preview"),
        ("rs",),
    ]),
    # --- LAYER3: Media ---
    ("/components/layer3/media/index.html", "media-demo", [
        ("sv", "nav_media_0,0-1920,1080_initial"),
        ("sf", "nav_media_fullpage_full"),
        ("sc", 400, "scroll_media_0,400-1920,1480_media-components"),
        ("rs",),
    ]),
    # --- LAYER3: User Guide ---
    ("/components/layer3/user-guide/index.html", "user-guide-demo", [
        ("sv", "nav_userGuide_0,0-1920,1080_initial"),
        ("sf", "nav_userGuide_fullpage_full"),
        ("ck", "button, [class*='step'] button", "click-guide-step"),
        ("sv", "click_userGuide_0,0-1920,1080_after-step"),
        ("sc", 400, "scroll_userGuide_0,400-1920,1480_guide-content"),
        ("rs",),
    ]),
    # --- LAYER3: Visualization ---
    ("/components/layer3/visualization/index.html", "visualization-demo", [
        ("sv", "nav_viz_0,0-1920,1080_initial"),
        ("sf", "nav_viz_fullpage_full"),
        ("sc", 400, "scroll_viz_0,400-1920,1480_charts-viz"),
        ("rs",),
    ]),
    # --- LAYER3: Zoom Controls ---
    ("/components/layer3/zoom-controls/index.html", "zoom-controls-demo", [
        ("sv", "nav_zoomCtrl_0,0-1920,1080_initial"),
        ("sf", "nav_zoomCtrl_fullpage_full"),
        ("ck", "button:first-of-type", "click-zoom-in"),
        ("sv", "click_zoomCtrl_0,0-1920,1080_after-zoom-in"),
        ("ck", "button:last-of-type", "click-zoom-out"),
        ("sv", "click_zoomCtrl_0,0-1920,1080_after-zoom-out"),
        ("rs",),
    ]),
    # --- SYSTEM: Palette ---
    ("/system/palette/index.html", "palette-colors", [
        ("sv", "nav_palette_0,0-1920,1080_initial"),
        ("sf", "nav_palette_fullpage_full"),
        ("sc", 400, "scroll_palette_0,400-1920,1480_color-swatches"),
        ("sc", 1100, "scroll_palette_0,1100-1920,2180_more-palettes"),
        ("sc", 1800, "scroll_palette_0,1800-1920,2880_palette-bottom"),
        ("rs",),
    ]),
    # --- SYSTEM: Icons ---
    ("/system/icons/index.html", "icons-demo", [
        ("sv", "nav_icons_0,0-1920,1080_initial"),
        ("sf", "nav_icons_fullpage_full"),
        ("sc", 500, "scroll_icons_0,500-1920,1580_icon-grid"),
        ("sc", 1300, "scroll_icons_0,1300-1920,2380_more-icons"),
        ("rs",),
    ]),
    # --- SYSTEM: CSS Variables ---
    ("/system/css/index.html", "css-vars-demo", [
        ("sv", "nav_cssVars_0,0-1920,1080_initial"),
        ("sf", "nav_cssVars_fullpage_full"),
        ("sc", 500, "scroll_cssVars_0,500-1920,1580_variables"),
        ("rs",),
    ]),
    # --- SYSTEM: Animations ---
    ("/system/animations/index.html", "animations-demo", [
        ("sv", "nav_animations_0,0-1920,1080_initial"),
        ("sf", "nav_animations_fullpage_full"),
        ("sc", 400, "scroll_animations_0,400-1920,1480_animation-demos"),
        ("rs",),
    ]),
    # --- SYSTEM: i18n ---
    ("/system/i18n/index.html", "i18n-demo", [
        ("sv", "nav_i18n_0,0-1920,1080_initial"),
        ("sf", "nav_i18n_fullpage_full"),
        ("ck", "select, button, [class*='lang']", "change-lang"),
        ("sv", "click_i18n_0,0-1920,1080_after-lang-change"),
        ("rs",),
    ]),
    # --- DEMOS: Dashboard ---
    ("/demos/dashboard/index.html", "dashboard-demo", [
        ("sv", "nav_dashboard_0,0-1920,1080_initial"),
        ("sf", "nav_dashboard_fullpage_full"),
        ("sc", 500, "scroll_dashboard_0,500-1920,1580_widgets"),
        ("sc", 1300, "scroll_dashboard_0,1300-1920,2380_charts-area"),
        ("sc", 2100, "scroll_dashboard_0,2100-1920,3180_bottom"),
        ("rs",),
    ]),
    # --- DEMOS: Form ---
    ("/demos/form/index.html", "demo-form", [
        ("sv", "nav_demoForm_0,0-1920,1080_initial"),
        ("sf", "nav_demoForm_fullpage_full"),
        ("ck", "input[type='text'], input:not([type]):first-of-type", "fill-form-field"),
        ("tp", "input[type='text'], input:not([type]):first-of-type",
         "John Doe", "type_form-name"),
        ("sv", "type_demoForm_0,0-1920,1080_filled-name"),
        ("sc", 500, "scroll_demoForm_0,500-1920,1580_more-fields"),
        ("sc", 1100, "scroll_demoForm_0,1100-1920,2180_submit-area"),
        ("rs",),
    ]),
]

# ============================================================
# RUN
# ============================================================
print(f"Output: {OUT}\nURL: {BASE}\nSize: {VP['width']}x{VP['height']}")
print("=" * 70)

total = 0; ok = 0; fails = []

with sync_playwright() as pw:
    br = pw.chromium.launch(headless=True)
    pg = br.new_page(viewport=VP)

    for route, desc, actions in PLAN:
        print(f"\n{'─'*70}\n  [{desc}] {route}\n{'─'*70}")
        nav(pg, route)

        for act in actions:
            t = act[0]; total += 1
            try:
                if   t == "sv": snap(pg, act[1]); ok += 1
                elif t == "sf": snap(pg, act[1], full_page=True); ok += 1
                elif t == "sc": scroll_content(pg, act[1]); snap(pg, act[2]); ok += 1
                elif t == "rs": reset_scroll(pg)
                elif t == "hv": do_hover(pg, act[1])
                elif t == "ck": do_click(pg, act[1])
                elif t == "tp": do_type(pg, act[1], act[2])
                else:
                    print(f"  ? Unknown: {t}"); fails.append(str(act))
            except Exception as e:
                print(f"  ERROR [{act}]: {e}")
                fails.append(str(act))

    br.close()

print(f"\n{'='*70}")
print(f"DONE: {ok}/{total} screenshots")
if fails: print(f"Fails ({len(fails)}): {fails[:20]}")
files = sorted(OUT.glob("*.png"))
sz = sum(f.stat().st_size for f in files)
print(f"Files: {len(files)}, Size: {sz/1024/1024:.1f}MB, Dir: {OUT}")
