#!/usr/bin/env python3
"""
E2E Screenshot Capture v4 — Animation Testing
- All v3 fixes (correct routes, scroll container, type)
- Animation control via JS requestAnimationFrame override
- Freeze/seek/step for testing mid-animation states
"""

import sys, time, os, json
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "http://localhost:52847"
OUT = Path("/mnt/sdb1/hikari/scripts/e2e/test_samples_v4")
OUT.mkdir(exist_ok=True)
VP = dict(width=1920, height=1080)
seq = [0]

INJECT_ANIM_CONTROL = """
// Animation control bridge — injected before WASM loads
window.__HIKARI_ANIM__ = {
    _frozen: false,
    _pendingCallbacks: [],
    _origRAF: window.requestAnimationFrame.bind(window),
    _origRAFTS: null,

    freeze: function() {
        this._frozen = true;
        // Also pause all CSS animations
        document.querySelectorAll('*').forEach(el => {
            el.style.animationPlayState = 'paused';
            el.style.transitionPlayState = 'paused';
        });
    },

    unfreeze: function() {
        this._frozen = false;
        // Resume CSS animations
        document.querySelectorAll('*').forEach(el => {
            el.style.animationPlayState = '';
            el.style.transitionPlayState = '';
        });
        // Flush pending callbacks
        const pending = this._pendingCallbacks.slice();
        this._pendingCallbacks = [];
        pending.forEach(cb => this._origRAF(cb));
    },

    isFrozen: function() { return this._frozen; },

    // Step: advance time by delta_ms and run one frame of all pending callbacks
    step: function(delta_ms) {
        const now = performance.now();
        const pending = this._pendingCallbacks.slice();
        this._pendingCallbacks = [];
        pending.forEach(cb => {
            if (typeof cb === 'function') cb(now + delta_ms);
        });
    },

    // Seek: force all CSS animations to a specific progress
    seekCSS: function(progress) {
        document.querySelectorAll('[style*="animation"]').forEach(el => {
            const computed = getComputedStyle(el);
            const duration = parseFloat(computed.animationDuration) || 1;
            const delay = progress * duration;
            el.style.animationDelay = '-' + delay + 's';
        });
    },

    getState: function() {
        return {
            frozen: this._frozen,
            pendingCount: this._pendingCallbacks.length
        };
    }
};

// Override requestAnimationFrame to intercept WASM animation callbacks
window.requestAnimationFrame = function(callback) {
    if (window.__HIKARI_ANIM__._frozen) {
        window.__HIKARI_ANIM__._pendingCallbacks.push(callback);
        return -1;
    }
    return window.__HIKARI_ANIM__._origRAF(callback);
};
"""

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

def anim_freeze(page):
    page.evaluate("window.__HIKARI_ANIM__.freeze()")
    time.sleep(0.3)

def anim_unfreeze(page):
    page.evaluate("window.__HIKARI_ANIM__.unfreeze()")
    time.sleep(0.3)

def anim_step(page, delta_ms):
    page.evaluate(f"window.__HIKARI_ANIM__.step({delta_ms})")
    time.sleep(0.3)

def anim_state(page):
    return page.evaluate("window.__HIKARI_ANIM__.getState()")

def do_click(page, selector):
    try:
        el = page.query_selector(selector)
        if el: el.click(timeout=5000)
        else: page.evaluate(f"document.querySelector('{selector}')?.click()")
        time.sleep(0.8)
    except Exception as e:
        print(f"    ! click({selector}): {str(e)[:60]}")

def do_type(page, selector, text):
    try:
        el = page.query_selector(selector)
        if el:
            el.click(timeout=3000)
            time.sleep(0.15)
            el.click(click_count=3)
            time.sleep(0.1)
            page.keyboard.type(text, delay=30)
        time.sleep(0.6)
    except Exception as e:
        print(f"    ! type({selector}): {str(e)[:60]}")

# ============================================================
# TEST PLAN
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
    # --- SPIN: Animation freeze/seek test ---
    ("/components/layer1/feedback/index.html", "spin-anim", [
        ("sv", "nav_spin_0,0-1920,1080_initial"),
        # Let spin run for a moment
        ("wait", 2.0),
        ("freeze",),
        ("sv", "spin_frozen_0,0-1920,1080_frozen_at_frame"),
        ("step", 100, "spin_step100_0,0-1920,1080_after-step100ms"),
        ("step", 200, "spin_step200_0,0-1920,1080_after-step200ms"),
        ("step", 300, "spin_step300_0,0-1920,1080_after-step300ms"),
        ("step", 450, "spin_step450_0,0-1920,1080_after-step450ms"),
        ("unfreeze",),
        ("wait", 1.0),
        ("sv", "spin_resumed_0,0-1920,1080_after-resume"),
    ]),
    # --- PROGRESS: Active pulse freeze test ---
    ("/components/layer2/table/index.html", "progress-anim", [
        ("sv", "nav_table_0,0-1920,1080_initial"),
        ("freeze",),
        ("sv", "table_frozen_0,0-1920,1080_frozen"),
        ("unfreeze",),
    ]),
    # --- BUTTON: All states ---
    ("/components/layer1/button/index.html", "button-demo", [
        ("sv", "nav_button_0,0-1920,1080_initial"),
        ("sf", "nav_button_fullpage_full"),
        ("sc", 500, "scroll_button_0,500-1920,1530_more-btns"),
        ("sc", 1000, "scroll_button_0,1000-1920,2080_btn-variations"),
        ("rs",),
    ]),
    # --- FORM: Type test ---
    ("/components/layer1/form/index.html", "form-input-demo", [
        ("sv", "nav_form_0,0-1920,1080_initial"),
        ("sf", "nav_form_fullpage_full"),
        ("tp", "input[type='text'], input:not([type]):first-of-type",
         "Hello E2E Test!", "type_input-hello"),
        ("sv", "type_form_0,0-1920,1080_typed-hello"),
        ("sc", 500, "scroll_form_0,500-1920,1580_more-fields"),
        ("rs",),
    ]),
    # --- SWITCH ---
    ("/components/layer1/switch/index.html", "switch-demo", [
        ("sv", "nav_switch_0,0-1920,1080_initial"),
        ("sf", "nav_switch_fullpage_full"),
        ("ck", "[role='switch'], .hi-switch, label:has(input[type='checkbox'])",
         "toggle-switch-on"),
        ("sv", "click_switch_0,0-1920,1080_after-toggle-on"),
        ("sc", 400, "scroll_switch_0,400-1920,1480_more-switches"),
        ("rs",),
    ]),
    # --- AVATAR ---
    ("/components/layer1/avatar/index.html", "avatar-demo", [
        ("sv", "nav_avatar_0,0-1920,1080_initial"),
        ("sf", "nav_avatar_fullpage_full"),
        ("sc", 400, "scroll_avatar_0,400-1920,1480_variations"),
        ("rs",),
    ]),
    # --- TAG ---
    ("/components/layer1/tag/index.html", "tag-demo", [
        ("sv", "nav_tag_0,0-1920,1080_initial"),
        ("sf", "nav_tag_fullpage_full"),
        ("sc", 350, "scroll_tag_0,350-1920,1430_more-tags"),
        ("rs",),
    ]),
    # --- SEARCH ---
    ("/components/layer1/search/index.html", "search-demo", [
        ("sv", "nav_search_0,0-1920,1080_initial"),
        ("tp", "input:first-of-type", "test search query", "type_search-query"),
        ("sv", "type_search_0,0-1920,1080_typed-query"),
        ("rs",),
    ]),
    # --- NUMBER INPUT ---
    ("/components/layer1/number-input/index.html", "number-input-demo", [
        ("sv", "nav_numberInput_0,0-1920,1080_initial"),
        ("tp", "input:first-of-type", "42", "type_number-42"),
        ("sv", "type_numInput_0,0-1920,1080_typed-42"),
        ("rs",),
    ]),
    # --- EMPTY ---
    ("/components/layer1/empty/index.html", "empty-demo", [
        ("sv", "nav_empty_0,0-1920,1080_initial"),
        ("sf", "nav_empty_fullpage_full"),
        ("sc", 300, "scroll_empty_0,300-1920,1380_variants"),
        ("rs",),
    ]),
    # --- FEEDBACK ---
    ("/components/layer1/feedback/index.html", "feedback-demo", [
        ("sv", "nav_feedback_0,0-1920,1080_initial"),
        ("sf", "nav_feedback_fullpage_full"),
        ("sc", 400, "scroll_feedback_0,400-1920,1480_alerts-toasts"),
        ("rs",),
    ]),
    # --- TABLE ---
    ("/components/layer2/table/index.html", "table-demo", [
        ("sv", "nav_table_0,0-1920,1080_initial"),
        ("sf", "nav_table_fullpage_full"),
        ("sc", 250, "scroll_table_0,250-1920,1330_body-visible"),
        ("sc", 500, "scroll_table_0,750-1920,1830_more-rows"),
        ("rs",),
    ]),
    # --- NAVIGATION ---
    ("/components/layer2/navigation/index.html", "navigation-demo", [
        ("sv", "nav_navComp_0,0-1920,1080_initial"),
        ("sf", "nav_navComp_fullpage_full"),
        ("ck", ".hi-tabs button, [role='tab']:first-of-type", "click-nav-link"),
        ("sv", "click_navComp_0,0-1920,1080_after-click"),
        ("sc", 500, "scroll_navComp_0,500-1920,1580_scrolled"),
        ("rs",),
    ]),
    # --- TIMELINE ---
    ("/components/layer2/timeline/index.html", "timeline-demo", [
        ("sv", "nav_timeline_0,0-1920,1080_initial"),
        ("sf", "nav_timeline_fullpage_full"),
        ("sc", 400, "scroll_timeline_0,400-1920,1480_entries"),
        ("rs",),
    ]),
    # --- EDITOR ---
    ("/components/layer3/editor/index.html", "editor-demo", [
        ("sv", "nav_editor_0,0-1920,1080_initial"),
        ("sf", "nav_editor_fullpage_full"),
        ("tp", "textarea, [contenteditable='true']",
         "# Hello Markdown\n\nThis is **bold** text.", "type_markdown"),
        ("sv", "type_editor_0,0-1920,1080_typed-markdown"),
        ("sc", 400, "scroll_editor_0,400-1920,1480_editor-preview"),
        ("rs",),
    ]),
    # --- MEDIA ---
    ("/components/layer3/media/index.html", "media-demo", [
        ("sv", "nav_media_0,0-1920,1080_initial"),
        ("sf", "nav_media_fullpage_full"),
        ("sc", 400, "scroll_media_0,400-1920,1480_media-components"),
        ("rs",),
    ]),
    # --- USER GUIDE ---
    ("/components/layer3/user-guide/index.html", "user-guide-demo", [
        ("sv", "nav_userGuide_0,0-1920,1080_initial"),
        ("sf", "nav_userGuide_fullpage_full"),
        ("freeze",),
        ("sv", "guide_frozen_0,0-1920,1080_frozen"),
        ("unfreeze",),
        ("sc", 400, "scroll_userGuide_0,400-1920,1480_guide-content"),
        ("rs",),
    ]),
    # --- VISUALIZATION ---
    ("/components/layer3/visualization/index.html", "visualization-demo", [
        ("sv", "nav_viz_0,0-1920,1080_initial"),
        ("sf", "nav_viz_fullpage_full"),
        ("sc", 400, "scroll_viz_0,400-1920,1480_charts-viz"),
        ("rs",),
    ]),
    # --- ZOOM CONTROLS ---
    ("/components/layer3/zoom-controls/index.html", "zoom-controls-demo", [
        ("sv", "nav_zoomCtrl_0,0-1920,1080_initial"),
        ("sf", "nav_zoomCtrl_fullpage_full"),
        ("rs",),
    ]),
    # --- PALETTE ---
    ("/system/palette/index.html", "palette-colors", [
        ("sv", "nav_palette_0,0-1920,1080_initial"),
        ("sf", "nav_palette_fullpage_full"),
        ("sc", 400, "scroll_palette_0,400-1920,1480_color-swatches"),
        ("sc", 1100, "scroll_palette_0,1100-1920,2180_more-palettes"),
        ("rs",),
    ]),
    # --- ICONS ---
    ("/system/icons/index.html", "icons-demo", [
        ("sv", "nav_icons_0,0-1920,1080_initial"),
        ("sf", "nav_icons_fullpage_full"),
        ("sc", 500, "scroll_icons_0,500-1920,1580_icon-grid"),
        ("sc", 1300, "scroll_icons_0,1300-1920,2380_more-icons"),
        ("rs",),
    ]),
    # --- CSS VARIABLES ---
    ("/system/css/index.html", "css-vars-demo", [
        ("sv", "nav_cssVars_0,0-1920,1080_initial"),
        ("sf", "nav_cssVars_fullpage_full"),
        ("sc", 500, "scroll_cssVars_0,500-1920,1580_variables"),
        ("rs",),
    ]),
    # --- ANIMATIONS (system page) ---
    ("/system/animations/index.html", "animations-demo", [
        ("sv", "nav_animations_0,0-1920,1080_initial"),
        ("sf", "nav_animations_fullpage_full"),
        ("sc", 400, "scroll_animations_0,400-1920,1480_animation-demos"),
        ("freeze",),
        ("sv", "animations_frozen_0,0-1920,1080_frozen"),
        ("unfreeze",),
        ("rs",),
    ]),
    # --- I18N ---
    ("/system/i18n/index.html", "i18n-demo", [
        ("sv", "nav_i18n_0,0-1920,1080_initial"),
        ("sf", "nav_i18n_fullpage_full"),
        ("rs",),
    ]),
    # --- DASHBOARD ---
    ("/demos/dashboard/index.html", "dashboard-demo", [
        ("sv", "nav_dashboard_0,0-1920,1080_initial"),
        ("sf", "nav_dashboard_fullpage_full"),
        ("sc", 500, "scroll_dashboard_0,500-1920,1580_widgets"),
        ("sc", 1300, "scroll_dashboard_0,1300-1920,2380_charts-area"),
        ("rs",),
    ]),
    # --- DEMO FORM ---
    ("/demos/form/index.html", "demo-form", [
        ("sv", "nav_demoForm_0,0-1920,1080_initial"),
        ("sf", "nav_demoForm_fullpage_full"),
        ("tp", "input[type='text'], input:not([type]):first-of-type",
         "John Doe", "type_form-name"),
        ("sv", "type_demoForm_0,0-1920,1080_filled-name"),
        ("sc", 500, "scroll_demoForm_0,500-1920,1580_more-fields"),
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
    ctx = br.new_context(viewport=VP)
    ctx.add_init_script(INJECT_ANIM_CONTROL)
    pg = ctx.new_page()

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
                elif t == "ck": do_click(pg, act[1])
                elif t == "tp": do_type(pg, act[1], act[2])
                elif t == "freeze": anim_freeze(pg)
                elif t == "unfreeze": anim_unfreeze(pg)
                elif t == "step": anim_step(pg, act[1])
                elif t == "wait": time.sleep(act[1])
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
