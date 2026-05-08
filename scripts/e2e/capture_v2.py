#!/usr/bin/env python3
"""
Comprehensive E2E Screenshot Capture v2 - Playwright
Correct routes, proper WASM wait, full interaction coverage.
"""

import sys, time, os
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "http://localhost:52847"
OUT = Path("/mnt/sdb1/hikari/scripts/e2e/test_samples")
OUT.mkdir(exist_ok=True)
VP = dict(width=1920, height=1080)
seq = [0]

def nid():
    seq[0] += 1; return f"{seq[0]:03d}"

def snap(page, name, sel=None, clip=None):
    fn = f"{nid()}_{name}.png"
    p = str(OUT / fn)
    try:
        if clip:
            page.screenshot(path=p, clip=clip)
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

def nav(page, route, wait_after=10):
    url = BASE + route
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=20000)
    except:
        pass
    time.sleep(wait_after)

def sc(y):
    return f"window.scrollTo(0,{y})"

def sb(dy):
    return f"window.scrollBy(0,{dy})"

# ============================================================
# CORRECT ROUTES (from public/ directory structure)
# ============================================================
PLAN = [
    # --- HOME ---
    ("/", "home", [
        ("sv", "nav_home_0,0-1920,1080_initial"),
        ("sf", "nav_home_fullpage_full"),
        ("ex", sb(500)),
        ("sv", "scroll_home_0,500-1920,1580_scrolled500"),
        ("ex", sb(1000)),
        ("sv", "scroll_home_0,1500-1920,2580_scrolled1500"),
        ("ex", sb(1200)),
        ("sv", "scroll_home_0,2700-1920,3780_bottom"),
        ("ex", sc(0)),
    ]),
    # --- COMPONENTS OVERVIEW ---
    ("/components", "components-overview", [
        ("sv", "nav_components_0,0-1920,1080_initial"),
        ("sf", "nav_components_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_components_0,400-1920,1480_mid"),
        ("ex", sb(700)),
        ("sv", "scroll_components_0,1100-1920,2180_lower"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Basic Components ---
    ("/components/layer1", "layer1-overview", [
        ("sv", "nav_layer1_0,0-1920,1080_overview"),
        ("sf", "nav_layer1_fullpage_full"),
        ("ex", sb(600)),
        ("sv", "scroll_layer1_0,600-1920,1680_scrolled"),
        ("ex", sb(900)),
        ("sv", "scroll_layer1_0,1500-1920,2580_deep"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Button Demo ---
    ("/components/layer1/button", "button-demo", [
        ("sv", "nav_button_0,0-1920,1080_initial"),
        ("sf", "nav_button_fullpage_full"),
        ("hv", "button", "hover_button-firstBtn"),
        ("sv", "hover_button_0,0-1920,1080_hover-firstBtn"),
        ("ck", "text=Primary", "click_button-primary"),
        ("sv", "click_button_0,0-1920,1080_after-click-primary"),
        ("ex", sb(450)),
        ("sv", "scroll_button_0,450-1920,1530_more-btns"),
        ("ex", sb(550)),
        ("sv", "scroll_button_0,1000-1920,2080_btn-variations"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Form (Input) Demo ---
    ("/components/layer1/form", "form-input-demo", [
        ("sv", "nav_form_0,0-1920,1080_initial"),
        ("sf", "nav_form_fullpage_full"),
        ("ck", "input[type='text'], input:not([type]), textarea:first-of-type",
         "focus-first-input"),
        ("tp", "input[type='text'], input:not([type]):first-of-type",
         "Hello E2E Test!", "type_input-hello"),
        ("sv", "type_form_0,0-1920,1080_typed-hello"),
        ("tp", "input[type='text'], input:not([type]):first-of-type",
         "Longer test text for validation", "type_input-long"),
        ("sv", "type_form_0,0-1920,1080_typed-long"),
        ("ex", sb(500)),
        ("sv", "scroll_form_0,500-1920,1580_more-fields"),
        ("ex", sb(600)),
        ("sv", "scroll_form_0,1100-1920,2180_form-bottom"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Switch Demo ---
    ("/components/layer1/switch", "switch-demo", [
        ("sv", "nav_switch_0,0-1920,1080_initial"),
        ("sf", "nav_switch_fullpage_full"),
        ("ck", "[role='switch'], .switch-wrapper, label:has(input[type='checkbox'])",
         "toggle-switch-on"),
        ("sv", "click_switch_0,0-1920,1080_after-toggle-on"),
        ("ck", "[role='switch'], .switch-wrapper, label:has(input[type='checkbox'])",
         "toggle-switch-off"),
        ("sv", "click_switch_0,0-1920,1080_after-toggle-off"),
        ("ex", sb(400)),
        ("sv", "scroll_switch_0,400-1920,1480_more-switches"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Avatar Demo ---
    ("/components/layer1/avatar", "avatar-demo", [
        ("sv", "nav_avatar_0,0-1920,1080_initial"),
        ("sf", "nav_avatar_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_avatar_0,400-1920,1480_variations"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Tag Demo ---
    ("/components/layer1/tag", "tag-demo", [
        ("sv", "nav_tag_0,0-1920,1080_initial"),
        ("sf", "nav_tag_fullpage_full"),
        ("hv", ".tag, [class*='tag']", "hover_tag"),
        ("sv", "hover_tag_0,0-1920,1080_hover-tag"),
        ("ex", sb(350)),
        ("sv", "scroll_tag_0,350-1920,1430_more-tags"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Search Demo ---
    ("/components/layer1/search", "search-demo", [
        ("sv", "nav_search_0,0-1920,1080_initial"),
        ("sf", "nav_search_fullpage_full"),
        ("ck", "input[placeholder*='Search' i], input[placeholder*='搜索' i], .search-input",
         "focus-search"),
        ("tp", "input[placeholder*='Search' i], input[placeholder*='搜索' i], .search-input input",
         "test search query", "type_search-query"),
        ("sv", "type_search_0,0-1920,1080_typed-query"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Number Input ---
    ("/components/layer1/number-input", "number-input-demo", [
        ("sv", "nav_numberInput_0,0-1920,1080_initial"),
        ("sf", "nav_numberInput_fullpage_full"),
        ("ck", "input[type='number']", "click-number-input"),
        ("tp", "input[type='number']", "42", "type_number-42"),
        ("sv", "type_numInput_0,0-1920,1080_typed-42"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Empty State ---
    ("/components/layer1/empty", "empty-demo", [
        ("sv", "nav_empty_0,0-1920,1080_initial"),
        ("sf", "nav_empty_fullpage_full"),
        ("ex", sb(300)),
        ("sv", "scroll_empty_0,300-1920,1380_variants"),
        ("ex", sc(0)),
    ]),
    # --- LAYER1: Feedback ---
    ("/components/layer1/feedback", "feedback-demo", [
        ("sv", "nav_feedback_0,0-1920,1080_initial"),
        ("sf", "nav_feedback_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_feedback_0,400-1920,1480_alerts-toasts"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2 Overview ---
    ("/components/layer2", "layer2-overview", [
        ("sv", "nav_layer2_0,0-1920,1080_overview"),
        ("sf", "nav_layer2_fullpage_full"),
        ("ex", sb(500)),
        ("sv", "scroll_layer2_0,500-1920,1580_scrolled"),
        ("ex", sb(800)),
        ("sv", "scroll_layer2_0,1300-1920,2380_lower"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Table ---
    ("/components/layer2/table", "table-demo", [
        ("sv", "nav_table_0,0-1920,1080_initial"),
        ("sf", "nav_table_fullpage_full"),
        ("ex", sb(250)),
        ("sv", "scroll_table_0,250-1920,1330_body-visible"),
        ("ck", "tbody tr:first-child, tr:nth-child(2)", "click-row"),
        ("sv", "click_table_0,250-1920,1330_after-row-click"),
        ("ex", sb(500)),
        ("sv", "scroll_table_0,750-1920,1830_more-rows"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Navigation ---
    ("/components/layer2/navigation", "navigation-demo", [
        ("sv", "nav_navComp_0,0-1920,1080_initial"),
        ("sf", "nav_navComp_fullpage_full"),
        ("ck", "nav a[href]:not([href^='http']):first-child, .nav-item a, [class*='menu'] a",
         "click-nav-link"),
        ("sv", "click_navComp_0,0-1920,1080_after-click"),
        ("ex", sb(500)),
        ("sv", "scroll_navComp_0,500-1920,1580_scrolled"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Pagination ---
    ("/components/layer2/pagination", "pagination-demo", [
        ("sv", "nav_pagination_0,0-1920,1080_initial"),
        ("sf", "nav_pagination_fullpage_full"),
        ("ck", "[class*='pagination'] button, [class*='pagination'] a, [aria-label*='Page']",
         "click-page-btn"),
        ("sv", "click_pagination_0,0-1920,1080_after-page-click"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Tree ---
    ("/components/layer2/tree", "tree-demo", [
        ("sv", "nav_tree_0,0-1920,1080_initial"),
        ("sf", "nav_tree_fullpage_full"),
        ("ck", "[class*='tree'] [class*='expand'], [class*='tree'] .toggle, [role='treeitem']",
         "toggle-tree-node"),
        ("sv", "click_tree_0,0-1920,1080_after-expand"),
        ("ex", sb(350)),
        ("sv", "scroll_tree_0,350-1920,1430_tree-nodes"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Transfer ---
    ("/components/layer2/transfer", "transfer-demo", [
        ("sv", "nav_transfer_0,0-1920,1080_initial"),
        ("sf", "nav_transfer_fullpage_full"),
        ("ck", "[class*='transfer'] button, [class*='transfer'] [class*='arrow']",
         "click-transfer-arrow"),
        ("sv", "click_transfer_0,0-1920,1080_after-transfer"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Timeline ---
    ("/components/layer2/timeline", "timeline-demo", [
        ("sv", "nav_timeline_0,0-1920,1080_initial"),
        ("sf", "nav_timeline_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_timeline_0,400-1920,1480_entries"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Collapsible ---
    ("/components/layer2/collapsible", "collapsible-demo", [
        ("sv", "nav_collapsible_0,0-1920,1080_initial"),
        ("sf", "nav_collapsible_fullpage_full"),
        ("ck", "[class*='collapsible'] [class*='header'], [class*='collapse'] summary, details > summary",
         "toggle-collapse"),
        ("sv", "click_collapsible_0,0-1920,1080_after-toggle"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Cascader ---
    ("/components/layer2/cascader", "cascader-demo", [
        ("sv", "nav_cascader_0,0-1920,1080_initial"),
        ("sf", "nav_cascader_fullpage_full"),
        ("ck", "[class*='cascader'] input, [class*='cascader'] [class*='trigger']",
         "open-cascader"),
        ("sv", "click_cascader_0,0-1920,1080_opened"),
        ("ex", sc(0)),
    ]),
    # --- LAYER2: Data (Data Display) ---
    ("/components/layer2/data", "data-display-demo", [
        ("sv", "nav_data_0,0-1920,1080_initial"),
        ("sf", "nav_data_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_data_0,400-1920,1480_data-sections"),
        ("ex", sc(0)),
    ]),
    # --- LAYER3 Overview ---
    ("/components/layer3", "layer3-overview", [
        ("sv", "nav_layer3_0,0-1920,1080_overview"),
        ("sf", "nav_layer3_fullpage_full"),
        ("ex", sb(500)),
        ("sv", "scroll_layer3_0,500-1920,1580_scrolled"),
        ("ex", sb(800)),
        ("sv", "scroll_layer3_0,1300-1920,2380_lower"),
        ("ex", sc(0)),
    ]),
    # --- LAYER3: Editor (Markdown) ---
    ("/components/layer3/editor", "editor-demo", [
        ("sv", "nav_editor_0,0-1920,1080_initial"),
        ("sf", "nav_editor_fullpage_full"),
        ("ck", "textarea, [contenteditable], [class*='editor'] textarea",
         "focus-editor"),
        ("tp", "textarea, [contenteditable], [class*='editor'] textarea",
         "# Hello Markdown\n\nThis is **bold** and *italic*.", "type_markdown"),
        ("sv", "type_editor_0,0-1920,1080_typed-markdown"),
        ("ex", sb(400)),
        ("sv", "scroll_editor_0,400-1920,1480_editor-preview"),
        ("ex", sc(0)),
    ]),
    # --- LAYER3: Media (Video/Audio) ---
    ("/components/layer3/media", "media-demo", [
        ("sv", "nav_media_0,0-1920,1080_initial"),
        ("sf", "nav_media_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_media_0,400-1920,1480_media-components"),
        ("ex", sc(0)),
    ]),
    # --- LAYER3: User Guide ---
    ("/components/layer3/user-guide", "user-guide-demo", [
        ("sv", "nav_userGuide_0,0-1920,1080_initial"),
        ("sf", "nav_userGuide_fullpage_full"),
        ("ck", "[class*='guide'] button, [class*='step'] button, [class*='tour'] button",
         "click-guide-step"),
        ("sv", "click_userGuide_0,0-1920,1080_after-step"),
        ("ex", sb(400)),
        ("sv", "scroll_userGuide_0,400-1920,1480_guide-content"),
        ("ex", sc(0)),
    ]),
    # --- LAYER3: Visualization ---
    ("/components/layer3/visualization", "visualization-demo", [
        ("sv", "nav_viz_0,0-1920,1080_initial"),
        ("sf", "nav_viz_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_viz_0,400-1920,1480_charts-viz"),
        ("ex", sc(0)),
    ]),
    # --- LAYER3: Zoom Controls ---
    ("/components/layer3/zoom-controls", "zoom-controls-demo", [
        ("sv", "nav_zoomCtrl_0,0-1920,1080_initial"),
        ("sf", "nav_zoomCtrl_fullpage_full"),
        ("ck", "[class*='zoom'] button, [aria-label*='Zoom']", "click-zoom-in"),
        ("sv", "click_zoomCtrl_0,0-1920,1080_after-zoom-in"),
        ("ck", "[class*='zoom'] button, [aria-label*='Zoom']", "click-zoom-out"),
        ("sv", "click_zoomCtrl_0,0-1920,1080_after-zoom-out"),
        ("ex", sc(0)),
    ]),
    # --- SYSTEM: Palette ---
    ("/system/palette", "palette-colors", [
        ("sv", "nav_palette_0,0-1920,1080_initial"),
        ("sf", "nav_palette_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_palette_0,400-1920,1480_color-swatches"),
        ("ex", sb(700)),
        ("sv", "scroll_palette_0,1100-1920,2180_more-palettes"),
        ("ex", sb(700)),
        ("sv", "scroll_palette_0,1800-1920,2880_palette-bottom"),
        ("ex", sc(0)),
    ]),
    # --- SYSTEM: Icons ---
    ("/system/icons", "icons-demo", [
        ("sv", "nav_icons_0,0-1920,1080_initial"),
        ("sf", "nav_icons_fullpage_full"),
        ("ex", sb(500)),
        ("sv", "scroll_icons_0,500-1920,1580_icon-grid"),
        ("ex", sb(800)),
        ("sv", "scroll_icons_0,1300-1920,2380_more-icons"),
        ("ex", sc(0)),
    ]),
    # --- SYSTEM: CSS Variables ---
    ("/system/css", "css-vars-demo", [
        ("sv", "nav_cssVars_0,0-1920,1080_initial"),
        ("sf", "nav_cssVars_fullpage_full"),
        ("ex", sb(500)),
        ("sv", "scroll_cssVars_0,500-1920,1580_variables"),
        ("ex", sc(0)),
    ]),
    # --- SYSTEM: Animations ---
    ("/system/animations", "animations-demo", [
        ("sv", "nav_animations_0,0-1920,1080_initial"),
        ("sf", "nav_animations_fullpage_full"),
        ("ex", sb(400)),
        ("sv", "scroll_animations_0,400-1920,1480_animation-demos"),
        ("ex", sc(0)),
    ]),
    # --- SYSTEM: i18n ---
    ("/system/i18n", "i18n-demo", [
        ("sv", "nav_i18n_0,0-1920,1080_initial"),
        ("sf", "nav_i18n_fullpage_full"),
        ("ck", "select, [class*='lang'] button, [class*='i18n'] select",
         "change-lang"),
        ("sv", "click_i18n_0,0-1920,1080_after-lang-change"),
        ("ex", sc(0)),
    ]),
    # --- DEMOS: Dashboard ---
    ("/demos/dashboard", "dashboard-demo", [
        ("sv", "nav_dashboard_0,0-1920,1080_initial"),
        ("sf", "nav_dashboard_fullpage_full"),
        ("ex", sb(500)),
        ("sv", "scroll_dashboard_0,500-1920,1580_widgets"),
        ("ex", sb(800)),
        ("sv", "scroll_dashboard_0,1300-1920,2380_charts-area"),
        ("ex", sb(800)),
        ("sv", "scroll_dashboard_0,2100-1920,3180_bottom"),
        ("ex", sc(0)),
    ]),
    # --- DEMOS: Form ---
    ("/demos/form", "demo-form", [
        ("sv", "nav_demoForm_0,0-1920,1080_initial"),
        ("sf", "nav_demoForm_fullpage_full"),
        ("ck", "input[name], form input[type='text']:first-of-type",
         "fill-form-field"),
        ("tp", "input[name], form input[type='text']:first-of-type",
         "John Doe", "type_form-name"),
        ("sv", "type_demoForm_0,0-1920,1080_filled-name"),
        ("ex", sb(500)),
        ("sv", "scroll_demoForm_0,500-1920,1580_more-fields"),
        ("ex", sb(600)),
        ("sv", "scroll_demoForm_0,1100-1920,2180_submit-area"),
        ("ex", sc(0)),
    ]),
    # --- INTERACTIVE ---
    ("/interactive", "interactive-demo", [
        ("sv", "nav_interactive_0,0-1920,1080_initial"),
        ("sf", "nav_interactive_fullpage_full"),
        ("ex", sb(500)),
        ("sv", "scroll_interactive_0,500-1920,1580_interactions"),
        ("ex", sb(700)),
        ("sv", "scroll_interactive_0,1200-1920,2280_more"),
        ("ex", sc(0)),
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
        try:
            pg.goto(BASE + route, wait_until="domcontentloaded", timeout=20000)
        except:
            pass
        time.sleep(10)

        for act in actions:
            t = act[0]; total += 1
            try:
                if   t == "sv": snap(pg, act[1]); ok += 1
                elif t == "sf": snap(pg, act[1], full_page=True); ok += 1
                elif t == "ex": pg.evaluate(act[1]); time.sleep(0.6)
                elif t == "hv":
                    try:
                        el = pg.query_selector(act[1])
                        if el: el.hover()
                        else: pg.evaluate(f"document.querySelector('{act[1]}')?.dispatchEvent(new MouseEvent('mouseover',{{bubbles:true}}))")
                        time.sleep(0.5)
                    except: pass
                elif t == "ck":
                    try:
                        el = pg.query_selector(act[1])
                        if el: el.click(timeout=5000)
                        else: pg.evaluate(f"document.querySelector('{act[1]}')?.click()")
                        time.sleep(0.6)
                    except Exception as e:
                        print(f"    ! click({act[1]}): {str(e)[:60]}")
                elif t == "tp":
                    try:
                        sel, txt = act[1], act[2]
                        el = pg.query_selector(sel)
                        if el:
                            el.click(); time.sleep(0.2)
                            el.evaluate("el => {el.value='';el.dispatchEvent(new Event('input',{bubbles:true}))}")
                            el.type_text(txt, delay=20)
                        else:
                            pg.evaluate(f"""
                                const el=document.querySelector('{sel}');
                                if(el){{el.value='{txt}';el.dispatchEvent(new Event('input',{{bubbles:true}}));el.dispatchEvent(new Event('change',{{bubbles:true}}))}}
                            """)
                        time.sleep(0.5)
                    except Exception as e:
                        print(f"    ! type({act[1]}): {str(e)[:60]}")
                else:
                    print(f"  ? Unknown: {t}"); fails.append(str(act))
            except Exception as e:
                print(f"  ERROR [{act[1]}]: {e}")
                fails.append(act[1])

    br.close()

print(f"\n{'='*70}")
print(f"DONE: {ok}/{total} screenshots")
if fails: print(f"Fails ({len(fails)}): {fails[:15]}")
files = sorted(OUT.glob("*.png"))
sz = sum(f.stat().st_size for f in files)
print(f"Files: {len(files)}, Size: {sz/1024/1024:.1f}MB, Dir: {OUT}")
