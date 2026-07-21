#!/usr/bin/env python3
"""
E2E Screenshot Capture — Animation Testing
Uses tairitsu debug HTTP API (same layer as MCP browser tools).
No raw Playwright, no direct JS eval.
"""

import sys
import time
import os
import base64
import json
import urllib.request
import urllib.error
from pathlib import Path

BASE = "http://localhost:52848"
DEBUG = "http://localhost:52849"
OUT = Path("/mnt/sdb1/hikari/scripts/e2e/test_samples")
OUT.mkdir(exist_ok=True)
VP_W, VP_H = 1920, 1080
seq = [0]
_current_group = "misc"

# Animation control script — injected once via /evaluate before any test actions.
# This is test infra setup, not app code. It lives in the browser context
# and intercepts RAF so CSS animations can be frozen/stepped deterministically.
ANIM_BRIDGE = """
if (!window.__HIKARI_ANIM__) {
window.__HIKARI_ANIM__ = {
    _frozen: false,
    _pendingCallbacks: [],
    _origRAF: window.requestAnimationFrame.bind(window),
    _frozenCSSAnimations: [],
    freeze() {
        this._frozen = true;
        this._frozenCSSAnimations = [];
        document.getAnimations().forEach(a => { a.pause()
        this._frozenCSSAnimations.push(a)
        })
    },
    unfreeze() {
        this._frozen = false;
        this._frozenCSSAnimations.forEach(a => { try { a.play()
        } catch(e) {} })
        this._frozenCSSAnimations = [];
        var p = this._pendingCallbacks.slice();
        this._pendingCallbacks = [];
        p.forEach(cb => this._origRAF(cb));
    },
    step(ms) {
        var d = ms || 0;
        this._frozenCSSAnimations.forEach(a => {
            try { var t = a.effect.getTiming().duration || 600
            a.currentTime = ((a.currentTime||0)+d)%t
            } catch(e) {}
        });
        var p = this._pendingCallbacks.slice();
        this._pendingCallbacks = [];
        p.forEach(cb => { if (typeof cb==='function') cb(performance.now()+d)
        })
    },
    seek(p) {
        this._frozenCSSAnimations.forEach(a => {
            try { var t = a.effect.getTiming().duration||600
            a.currentTime = p*t
            } catch(e) {}
        });
    }
};
window.requestAnimationFrame = function(cb) {
    if (window.__HIKARI_ANIM__._frozen) {
        window.__HIKARI_ANIM__._pendingCallbacks.push(cb);
        return -1;
    }
    return window.__HIKARI_ANIM__._origRAF(cb);
};
}
"""


def api_post(endpoint, data):
    """POST to debug API, return parsed JSON."""
    url = DEBUG + "/" + endpoint
    req = urllib.request.Request(url, data=json.dumps(data).encode())
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return json.loads(body) if body.startswith("{") else {"ok": False, "error": f"HTTP {e.code}: {body[:200]}"}


def api_get(endpoint):
    """GET from debug API."""
    url = DEBUG + "/" + endpoint
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return json.loads(body) if body.startswith("{") else {"ok": False, "error": f"HTTP {e.code}"}


def nid():
    seq[0] += 1
    return f"{seq[0]:03d}"


def snap(name, selector=None, full_page=False):
    group = _current_group
    group_dir = OUT / group
    group_dir.mkdir(parents=True, exist_ok=True)
    fn = f"{nid()}_{name}.png"
    p = str(group_dir / fn)
    params = {"full_page": full_page}
    if selector:
        params["selector"] = selector
    resp = api_post("screenshot", params)
    if resp.get("ok") and resp.get("data", {}).get("data"):
        img = base64.b64decode(resp["data"]["data"])
        with open(p, "wb") as f:
            f.write(img)
        s = os.path.getsize(p)
        print(f"  [{s:>8}] {group}/{fn}")
    else:
        print(f"  [FAIL] {group}/{fn}: {resp.get('error', 'unknown')}")


def nav(route, wait_after=15):
    api_post("navigate", {"url": route})
    time.sleep(2)
    api_post("resize", {"width": VP_W, "height": VP_H})
    time.sleep(max(0, wait_after - 2))


def scroll_content(dy):
    api_post("scroll", {
        "selector": ".custom-scrollbar-content",
        "direction": "down",
        "amount": dy,
    })
    time.sleep(0.8)


def scroll_to(y):
    api_post("scroll", {
        "selector": ".custom-scrollbar-content",
        "x": 0,
        "y": y,
    })
    time.sleep(0.8)


def reset_scroll():
    scroll_to(0)


def anim_freeze():
    api_post("evaluate", {"expression": "window.__HIKARI_ANIM__.freeze()"})
    time.sleep(0.3)


def anim_unfreeze():
    api_post("evaluate", {"expression": "window.__HIKARI_ANIM__.unfreeze()"})
    time.sleep(0.3)


def anim_step(delta_ms):
    api_post("evaluate", {"expression": f"window.__HIKARI_ANIM__.step({delta_ms})"})
    time.sleep(0.3)


def do_click(selector):
    resp = api_post("click", {"selector": selector})
    if not resp.get("ok"):
        print(f"    ! click({selector}): {resp.get('error','')[:60]}")
    time.sleep(0.8)


def do_type(selector, text):
    # Use debug API type endpoint (goes through glue layer, dispatches native input events)
    resp = api_post("type", {
        "selector": selector,
        "text": text,
        "clear_first": True,
    })
    if not resp.get("ok"):
        print(f"    ! type({selector}): {resp.get('error','')[:80]}")
    time.sleep(0.6)


# ------
# TEST PLAN
# ------
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
    # --- SPIN ---
    ("/components/layer1/feedback/index.html", "spin-anim", [
        ("sv", "nav_spin_0,0-1920,1080_initial"),
        ("wait", 2.0),
        ("freeze",),
        ("sv", "spin_frozen_0,0-1920,1080_frozen_at_frame"),
        ("step", 100, "spin_step100_0,0-1920,1080_after-step100ms"),
        ("step", 200, "spin_step200_0,0-1920,1080_after-step200ms"),
        ("step", 300, "spin_step300_0,0-1920,1080_after-step300ms"),
        ("step", 450, "spin_step450_0,0-1920,1080-after-step450ms"),
        ("unfreeze",),
        ("wait", 1.0),
        ("sv", "spin_resumed_0,0-1920,1080_after-resume"),
    ]),
    # --- PROGRESS ---
    ("/components/layer2/table/index.html", "progress-anim", [
        ("sv", "nav_table_0,0-1920,1080_initial"),
        ("freeze",),
        ("sv", "table_frozen_0,0-1920,1080_frozen"),
        ("unfreeze",),
    ]),
    # --- BUTTON ---
    ("/components/layer1/button/index.html", "button-demo", [
        ("sv", "nav_button_0,0-1920,1080_initial"),
        ("sf", "nav_button_fullpage_full"),
        ("sc", 500, "scroll_button_0,500-1920,1530_more-btns"),
        ("sc", 1000, "scroll_button_0,1000-1920,2080_btn-variations"),
        ("rs",),
    ]),
    # --- FORM ---
    ("/components/layer1/form/index.html", "form-input-demo", [
        ("sv", "nav_form_0,0-1920,1080_initial"),
        ("sf", "nav_form_fullpage_full"),
        ("tp", "input.hi-input:first-of-type",
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
        ("tp", "#page-component-search input[type='search'][placeholder='Search...']", "test search query", "type_search-query"),
        ("sv", "type_search_0,0-1920,1080_typed-query"),
        ("rs",),
    ]),
    # --- NUMBER INPUT ---
    ("/components/layer1/number-input/index.html", "number-input-demo", [
        ("sv", "nav_numberInput_0,0-1920,1080_initial"),
        ("tp", ".hi-number-input-input", "42", "type_number-42"),
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
        ("sc", 750, "scroll_table_0,750-1920,1830_more-rows"),
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
        ("tp", "textarea.hi-editor__textarea",
         "Hello Markdown, this is bold text", "type_markdown"),
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
    # --- CSS UTILITIES ---
    ("/system/css/index.html", "css-utilities-demo", [
        ("sv", "nav_cssUtils_0,0-1920,1080_initial"),
        ("sf", "nav_cssUtils_fullpage_full"),
        ("sc", 500, "scroll_cssUtils_0,500-1920,1580_utilities"),
        ("rs",),
    ]),
    # --- ANIMATIONS ---
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
        ("ck", ".hi-select-trigger", "open-lang-dropdown"),
        ("ck", ".hi-select-option[data-value='en']", "switch-to-english"),
        ("wait", 1.5),
        ("sv", "nav_i18n_0,0-1920,1080_initial"),
        ("ck", ".hi-select-trigger", "open-lang-dropdown-2"),
        ("ck", ".hi-select-option[data-value='zhs']", "switch-to-zhs"),
        ("wait", 1.5),
        ("sv", "nav_i18n_after-lang-change_0,0-1920,1080"),
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
        ("tp", "#demo-email",
         "John Doe", "type_form-name"),
        ("sv", "type_demoForm_0,0-1920,1080_filled-name"),
        ("sc", 500, "scroll_demoForm_0,500-1920,1580_more-fields"),
        ("rs",),
    ]),
]

# ------
# RUN
# ------
print(f"Output: {OUT}\nURL: {BASE}\nSize: {VP_W}x{VP_H}\nDebug API: {DEBUG}")
print("=" * 70)

# Check debug API is available
health = api_get("health")
if not health.get("ok"):
    print(f"ERROR: Debug API not available: {health.get('error')}")
    print("Start dev server with: tairitsu --manifest-path examples/website/Cargo.toml dev --port 52848 --daemon --debug")
    sys.exit(1)

# Set viewport
api_post("resize", {"width": VP_W, "height": VP_H})

# Inject animation control bridge (one-time setup via evaluate)
api_post("evaluate", {"expression": ANIM_BRIDGE})
time.sleep(0.5)

total = 0
ok = 0
fails = []

for route, desc, actions in PLAN:
    _current_group = desc
    print(f"\n{'─'*70}\n  [{desc}] {route}\n{'─'*70}")
    nav(route)

    for act in actions:
        t = act[0]
        total += 1
        try:
            if   t == "sv":
                snap(act[1])
                ok += 1
            elif t == "sf":
                snap(act[1], full_page=True)
                ok += 1
            elif t == "sc":
                scroll_content(act[1])
                snap(act[2])
                ok += 1
            elif t == "rs":
                reset_scroll()
            elif t == "ck":
                do_click(act[1])
            elif t == "tp":
                do_type(act[1], act[2])
            elif t == "freeze":
                anim_freeze()
            elif t == "unfreeze":
                anim_unfreeze()
            elif t == "step":
                anim_step(act[1])
            elif t == "wait":
                time.sleep(act[1])
            else:
                print(f"  ? Unknown: {t}")
                fails.append(str(act))
        except Exception as e:
            print(f"  ERROR [{act}]: {e}")
            fails.append(str(act))

print(f"\n{'='*70}")
print(f"DONE: {ok}/{total} screenshots")
if fails:
    print(f"Fails ({len(fails)}): {fails[:20]}")

files = sorted(OUT.rglob("*.png"))
sz = sum(f.stat().st_size for f in files)
dirs = sorted(set(f.parent.name for f in files))
print(f"Files: {len(files)}, Size: {sz/1024/1024:.1f}MB, Groups: {len(dirs)}, Dir: {OUT}")
