// hi-components/src/feedback/touch_hint.rs
// TouchHintBar — mirror of the canonical Vue TOUCH half of the tooltip story
// (`packages/vue/src/runtime/touchHint.ts` + `runtime/touchHint.scss`).
//
// The hover half already has a mirror (`feedback/tooltip.rs`); this file is
// the other pointer family. A finger cannot hover, so the Vue touch mode does
// not show an anchored bubble at all: a LONG-PRESS presents the hint in a bar
// DOCKED AT THE TOP CENTRE of the viewport, breadcrumb-like, where it can
// never cover the element being inspected. The stylesheet is the SAME sheet
// the Vue library ships (`runtime/touchHint.scss`, vendored under
// `src/styles/vue-mirror/runtime/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-touch-hint-bar` class names are literal and identical in both forms.
//
// DOM contract (Vue's presenter output, one rule per attribute):
//
//   div.hk-touch-hint-bar                  (role=status, aria-live=polite)
//         [.is-on]                         (the shown state)
//     {text}                               (text nodes only — the hint text
//                                           is never markup)
//
// Vue keeps ONE bar per page as module state (`barEl`), creates it lazily on
// the first show, and mounts it in the overlay root. The mirror therefore has
// no `visible`-less mode to fall back on: this is a CONTROLLED presenter
// ([`TouchHintBarProps::visible`] + [`TouchHintBarProps::text`]) that a host
// mounts once, exactly like `feedback/tooltip.rs` writes its bubble's opacity
// instead of owning a transition.
//
// Platform deltas vs Vue (declared, not approximated):
//   * NO DOCUMENT-LEVEL GESTURE RECOGNIZER, AND NO DELEGATED INSTALL.
//     Vue's `installHkTouchHintBridge` binds capture-phase
//     `pointerdown` / `pointermove` / `pointerup` / `pointercancel` /
//     `scroll` / `keydown` / `contextmenu` on `document`, resolves an anchor
//     with `closest("[title]")`, reads `title` / `data-hk-title`, and guards
//     the anchor's inline `user-select` / `-webkit-touch-callout` for the
//     hold. On `wasm32-wasip2` tairitsu exposes no document-level listener
//     registration at all, and typed `pointer*` events never dispatch (the
//     glue routes them through a data-less generic channel — ledger L67;
//     the tooltip mirror documents the same ceiling). So the mirror owns the
//     BAR and the RECOGNIZER TIMING (exported as pure values and one
//     predicate below), and the HOST owns the gesture: it decides which
//     press is a long-press and hands this component the text. A host that
//     installs nothing shows no hint bar — the touch path is simply absent
//     rather than silently half-working.
//   * NO LINGER TIMER. Vue keeps the bar up while the finger is down and
//     retires it [`TOUCH_HINT_LINGER_MS`] after the lift (and immediately on
//     any new press, scroll, Escape or window blur). Those are page-level
//     listeners, i.e. the same missing capability as above; the linger
//     constant is exported so the host's timer uses the canonical number.
//   * NO POPUP-MANAGER BAND. Vue registers the bar with `usePopupManager`
//     (kind `tooltip`) and writes the band's z INLINE; the crate has no
//     popup manager, so the sheet's `--hk-overlay-z-tooltip` fallback (300)
//     is the whole stacking story — the same delta `feedback/tooltip.rs`
//     documents for its bubble.
//   * NODE FROM FIRST PAINT. Vue creates the bar on the first show; the
//     mirror renders it from the first paint (hidden — the sheet's base rule
//     is `opacity: 0` without `.is-on`) because a tairitsu component cannot
//     mount an element from an imperative side path. Same reading behaviour:
//     a hidden `role=status` region announces nothing.
//   * ANCHOR GUARDS ARE HOST-SIDE. `user-select` / `-webkit-touch-callout`
//     are write-only concerns of the gesture that the host owns; the mirror
//     writes no inline style on anyone's anchor.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TouchHintBarComponent;

/// The bar's class (Vue: `bar.className = "hk-touch-hint-bar"`).
pub const TOUCH_HINT_BAR_CLASS: &str = "hk-touch-hint-bar";

/// The shown-state modifier (Vue: `bar.classList.add("is-on")`).
pub const TOUCH_HINT_ON_CLASS: &str = "is-on";

/// Long-press hold before the hint fires (Vue: `DEFAULT_HOLD_MS`).
pub const TOUCH_HINT_HOLD_MS: u32 = 450;

/// Finger travel that cancels a pending hold, in px (Vue: `DEFAULT_SLOP_PX`).
/// The comparison is strict: travel EQUAL to the slop still counts as a hold.
pub const TOUCH_HINT_SLOP_PX: f64 = 10.0;

/// How long the bar lingers after the finger lifts (Vue:
/// `DEFAULT_LINGER_MS`). Exported for the host's own timer — see the header
/// delta on the missing page-level listeners.
pub const TOUCH_HINT_LINGER_MS: u32 = 2200;

/// The bar's announcement roles (Vue: `role="status"` + `aria-live="polite"`).
/// Polite on purpose: the hint replaces an unreadable native tooltip for
/// touch users, so it must announce itself once without interrupting.
pub const TOUCH_HINT_ROLE: &str = "status";
pub const TOUCH_HINT_ARIA_LIVE: &str = "polite";

/// The bar's class string: the base class, then `.is-on` while shown, then the
/// host's fallthrough class (Vue's root carries exactly the first two).
pub fn touch_hint_bar_classes(visible: bool, host_class: &str) -> String {
    let mut classes = String::from(TOUCH_HINT_BAR_CLASS);
    if visible {
        classes.push(' ');
        classes.push_str(TOUCH_HINT_ON_CLASS);
    }
    let host = host_class.trim();
    if !host.is_empty() {
        classes.push(' ');
        classes.push_str(host);
    }
    classes
}

/// Whether a finger that moved from `origin` to `point` has cancelled the
/// pending hold — Vue's slop test,
/// `Math.hypot(x - origin.x, y - origin.y) > slopPx`.
///
/// Exported as the one piece of the recognizer that is PURE: a host that
/// drives its own long-press uses the same arithmetic and therefore the same
/// feel. Travel exactly ON the slop is still a hold (strict `>`).
pub fn touch_hint_move_cancels(origin: (f64, f64), point: (f64, f64), slop_px: f64) -> bool {
    let dx = point.0 - origin.0;
    let dy = point.1 - origin.1;
    (dx * dx + dy * dy).sqrt() > slop_px
}

#[define_props]
pub struct TouchHintBarProps {
    /// The hint text. Vue takes it from the anchor's `title` /
    /// `data-hk-title` (or a custom resolver) at fire time; the mirror takes
    /// it as a prop because the crate cannot read attributes (header delta).
    #[default]
    pub text: String,

    /// Show the bar (Vue: the `is-on` class the presenter adds / removes).
    #[default]
    pub visible: bool,

    /// Extra class appended after `hk-touch-hint-bar` (host fallthrough).
    #[default]
    pub class: String,
}

#[component]
pub fn TouchHintBar(props: TouchHintBarProps) -> Element {
    let classes = touch_hint_bar_classes(props.visible, &props.class);

    rsx! {
        div {
            class: classes,
            "role": TOUCH_HINT_ROLE,
            "aria-live": TOUCH_HINT_ARIA_LIVE,
            "{props.text}"
        }
    }
}

impl StyledComponent for TouchHintBarComponent {
    fn styles() -> &'static str {
        // The canonical Vue runtime sheet, compiled verbatim (`no_hash` keeps
        // `.hk-touch-hint-bar` literal so both forms ship the same chrome).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/runtime/touchHint.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "touch-hint-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn touch_hint_timing_matches_the_vue_constants() {
        assert_eq!(TOUCH_HINT_HOLD_MS, 450);
        assert_eq!(TOUCH_HINT_SLOP_PX, 10.0);
        assert_eq!(TOUCH_HINT_LINGER_MS, 2200);
    }

    #[test]
    fn touch_hint_bar_classes_mirror_the_presenter() {
        assert_eq!(touch_hint_bar_classes(false, ""), "hk-touch-hint-bar");
        assert_eq!(touch_hint_bar_classes(true, ""), "hk-touch-hint-bar is-on");
        // The host class is a fallthrough, appended last (Vue's attr merge).
        assert_eq!(
            touch_hint_bar_classes(true, "host-bar"),
            "hk-touch-hint-bar is-on host-bar"
        );
        assert_eq!(
            TOUCH_HINT_BAR_CLASS, "hk-touch-hint-bar",
            "the sheet's selector and the renderer's class must agree"
        );
        assert_eq!(TOUCH_HINT_ON_CLASS, "is-on");
        assert_eq!(TOUCH_HINT_ROLE, "status");
        assert_eq!(TOUCH_HINT_ARIA_LIVE, "polite");
    }

    #[test]
    fn touch_hint_slop_is_strict_and_euclidean() {
        let origin = (100.0, 100.0);
        // ANY travel inside the slop keeps the hold alive.
        assert!(!touch_hint_move_cancels(origin, (100.0, 100.0), 10.0));
        assert!(!touch_hint_move_cancels(origin, (106.0, 108.0), 10.0));
        // Exactly ON the slop is still a hold (Vue: `>` not `>=`).
        assert!(!touch_hint_move_cancels(origin, (110.0, 100.0), 10.0));
        // A diagonal crossing the slop cancels on the true distance, not on
        // either axis alone (3-4-5 triangle scaled past 10: 6.6 + 8.8).
        assert!(touch_hint_move_cancels(
            origin,
            (100.0 + 6.6, 100.0 + 8.8),
            10.0
        ));
        assert!(touch_hint_move_cancels(origin, (100.0, 111.0), 10.0));
        // The defaults are what a caller gets when it passes no tuning.
        assert!(touch_hint_move_cancels(
            origin,
            (100.0, 200.0),
            TOUCH_HINT_SLOP_PX
        ));
    }

    #[test]
    fn touch_hint_bar_renders_the_presenter_contract() {
        let shown = TouchHintBar(TouchHintBarProps {
            text: "Open details".to_string(),
            visible: true,
            class: String::new(),
        })
        .render_to_html();
        for needle in [
            r#"class="hk-touch-hint-bar is-on""#,
            r#"role="status""#,
            r#"aria-live="polite""#,
            "Open details",
        ] {
            assert!(shown.contains(needle), "missing {needle}: {shown}");
        }

        let hidden = TouchHintBar(TouchHintBarProps {
            text: "Open details".to_string(),
            visible: false,
            class: "host-bar".to_string(),
        })
        .render_to_html();
        assert!(
            hidden.contains(r#"class="hk-touch-hint-bar host-bar""#),
            "{hidden}"
        );
        assert!(!hidden.contains("is-on"), "{hidden}");
        // The text rides text nodes only — a hint is never markup.
        assert!(hidden.contains("Open details"), "{hidden}");
    }

    #[test]
    fn touch_hint_styles_come_from_the_canonical_vue_runtime_sheet() {
        let css = TouchHintBarComponent::styles();
        assert!(
            css.contains(".hk-touch-hint-bar"),
            "the touch hint css must carry the bar class"
        );
        assert!(
            css.contains(".hk-touch-hint-bar.is-on"),
            "the touch hint css must carry the shown state"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored touch hint sheet"
        );
    }
}
