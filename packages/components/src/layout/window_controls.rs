// hi-components/src/layout/window_controls.rs
// WindowControls — mirror of the canonical Vue `HkWindowControls`: the
// minimize / maximize / close cluster for hosts that own their window chrome
// (Tauri custom titlebars, Electron frameless).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkWindowControls.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `scripts/sync-vue-mirror.py`'s W5
// `LAYOUT_SHEETS`), compiled with `no_hash` so the `.hk-window-controls*` class
// names are literal and identical in both forms. DOM contract (mirrors the Vue
// render output one-to-one):
//
//   div.hk-window-controls[.hk-window-controls--flush] [+class]
//        data-tauri-drag-region="false"
//     button.hk-window-controls__btn                              (minimize)
//     button.hk-window-controls__btn                              (maximize/restore)
//     button.hk-window-controls__btn.hk-window-controls__btn--close(close)
//        ── every button carries type=button, aria-label, [disabled] and ──
//        span[style="display:contents"] > the lucide svg
//
// Two deliberate modes (2026-10-23 user ruling, kept verbatim): `standard`
// (borderless ghost buttons at the header chrome's size step — the host keeps
// the canonical right-edge inset) and `flush` (edge-riding squares for real
// thin captions, radius 0). There is NO default variant: Vue's explicit-None
// contract renders NOTHING for an omitted or invalid variant, so the mirror
// takes `variant: Option<WindowControlsVariant>` and returns `empty_vnode()`
// when it is `None`.
//
// State: none stored, everything CONTROLLED. Vue keeps `maximized` in a local
// ref fed by the shell (`isMaximized` + `onResized`) and calls the shell
// directly; tairitsu has no window API, so the mirror takes `maximized` as a
// prop and reports the three intents as callbacks. The three Vue render gates
// (`isApplePlatform()`, the variant validator, and `resolveWindowApi()` returning
// nothing) are HOST facts that cannot be probed from Rust: the host passes
// `None` on macOS (the OS owns the traffic lights) or on a shell-less browser
// preview, and the explicit-None contract covers all three at once.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] BUTTON DISABLED DERIVATION — a button whose callback is `None` is
//     rendered `disabled` instead of inert. Vue's own header states the
//     contract ("must never look like a working button"): a refused shell call
//     keeps the glyph but must not read as a live control. Folding that into
//     the disabled state is the mirror's only behavioural addition; a fully
//     wired cluster is byte-identical to Vue's (no `disabled` attribute at all).
//     The derivation lives in [`window_controls_button_disabled`].
//   * [D] `aria-label`s read `components.hk.windowControls.*` through
//     `hikari_i18n::t`. Vue hard-codes the English literals in its render
//     function; the fallbacks are those same words, so the English DOM is
//     identical. The four keys are NEW (listed in the wave receipt) — until a
//     locale bundle carries them, every locale renders the English fallback, and
//     a bundle that adds them localizes the cluster.
//   * the glyphs are TRUSTED STATIC MARKUP through `dangerous_inner_html` on
//     their own `style="display:contents"` host (tairitsu creates elements in
//     the HTML namespace, so an rsx `svg {}` child would never paint, and
//     `dangerous_inner_html` suppresses an element's children). Path/rect data
//     is lucide's (ISC) at the exact per-mode sizes Vue passes
//     (`Minus`16/14, `Square`|`Copy`14/12, `X`16/14); the restore glyph keeps
//     Vue's `rotate(180deg)`. The crate's inlined-lucide spelling
//     (`class="lucide lucide-{name}"` + `aria-hidden="true"`) is used, so the
//     button's `aria-label` stays the accessible name. No consumer string
//     enters that markup, so no escaper is needed here.
//   * [D] a host `class` prop is appended last (Vue merges the fallthrough class
//     itself).
//
// Replaces nothing: the family had no Rust counterpart for the cluster.

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct WindowControlsComponent;

/// The two deliberate modes (Vue: `"standard" | "flush"`, REQUIRED — no
/// default, because the explicit-None contract is a design decision).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum WindowControlsVariant {
    /// Borderless ghost buttons at the header chrome's size step.
    Standard,
    /// Edge-riding squares filling the host's height.
    Flush,
}

impl WindowControlsVariant {
    /// True for the edge-riding mode (drives the modifier class, the glyph
    /// sizes and `align-self: stretch` in the sheet).
    pub fn is_flush(self) -> bool {
        matches!(self, WindowControlsVariant::Flush)
    }

    /// The mode token (the part the modifier class is built from).
    pub fn token(self) -> &'static str {
        match self {
            WindowControlsVariant::Standard => "standard",
            WindowControlsVariant::Flush => "flush",
        }
    }
}

/// The three buttons, in the order the cluster always renders them.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum WindowControlAction {
    Minimize,
    ToggleMaximize,
    Close,
}

/// Vue's render order: minimize → maximize/restore → close. The order IS the
/// contract — the cluster's three buttons never reorder (the sheet's
/// `:last-child` / adjacent selectors depend on it).
pub const WINDOW_CONTROL_ACTION_ORDER: [WindowControlAction; 3] = [
    WindowControlAction::Minimize,
    WindowControlAction::ToggleMaximize,
    WindowControlAction::Close,
];

/// Which of the three intents the host actually wired (Vue: the shell API it
/// resolved; Rust: which callback props carry a handler). Pure data so the
/// disabled derivation stays testable.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct WindowControlWiring {
    pub minimize: bool,
    pub toggle_maximize: bool,
    pub close: bool,
}

/// One rendered button: everything the render function needs, computed once by
/// the pure functions below.
#[derive(Clone, PartialEq, Debug)]
pub struct WindowControlButton {
    pub action: WindowControlAction,
    /// `aria-label` (Vue's literal, resolved through i18n — see the header).
    pub aria_label: String,
    /// `hk-window-controls__btn[--close]`, in Vue's class order.
    pub classes: &'static str,
    /// The lucide glyph markup for this mode / maximized state.
    pub glyph: String,
    /// The host wired no handler for this action ([D], see the header).
    pub disabled: bool,
}

// ── lucide glyph bodies (ISC; children of the shared svg frame) ──────────

const MINUS_BODY: &str = r#"<path d="M5 12h14"/>"#;
const SQUARE_BODY: &str = r#"<rect width="18" height="18" x="3" y="3" rx="2"/>"#;
const COPY_BODY: &str = r#"<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>"#;
const CROSS_BODY: &str = r#"<path d="M18 6 6 18"/><path d="m6 6 12 12"/>"#;

// ── pure functions ───────────────────────────────────────────────────────

/// The root class list: the base class, the flush modifier, then the host
/// class. Vue builds the first two from an object binding, so the modifier is
/// only ever `hk-window-controls--flush` (never `--standard`).
pub fn window_controls_root_classes(variant: WindowControlsVariant, extra: &str) -> String {
    let mut classes = String::from("hk-window-controls");
    if variant.is_flush() {
        classes.push_str(" hk-window-controls--flush");
    }
    if !extra.is_empty() {
        classes.push(' ');
        classes.push_str(extra);
    }
    classes
}

/// Whether one button is disabled: the host wired no handler for its action.
/// `disabled` is NOT keyed on `maximized`, mode, or the other two callbacks —
/// the three controls fail independently, exactly as Vue's three shell calls do.
pub fn window_controls_button_disabled(
    action: WindowControlAction,
    wired: WindowControlWiring,
) -> bool {
    !match action {
        WindowControlAction::Minimize => wired.minimize,
        WindowControlAction::ToggleMaximize => wired.toggle_maximize,
        WindowControlAction::Close => wired.close,
    }
}

/// The button's `aria-label`: the maximize control speaks as `Restore` while
/// the window is maximized and `Maximize` otherwise (Vue swaps the same two
/// strings off the controlled `maximized` prop).
pub fn window_controls_label(action: WindowControlAction, maximized: bool) -> String {
    match action {
        WindowControlAction::Minimize => t("components.hk.windowControls.minimize", "Minimize"),
        WindowControlAction::ToggleMaximize => {
            if maximized {
                t("components.hk.windowControls.restore", "Restore")
            } else {
                t("components.hk.windowControls.maximize", "Maximize")
            }
        }
        WindowControlAction::Close => t("components.hk.windowControls.close", "Close"),
    }
}

/// The button's class pair: only the close button takes the danger wash
/// modifier.
pub fn window_controls_button_classes(action: WindowControlAction) -> &'static str {
    match action {
        WindowControlAction::Close => "hk-window-controls__btn hk-window-controls__btn--close",
        WindowControlAction::Minimize | WindowControlAction::ToggleMaximize => {
            "hk-window-controls__btn"
        }
    }
}

/// The lucide glyph Vue renders for one button at the current mode and
/// maximized state (see the header for the verbatim source mapping).
pub fn window_controls_glyph(
    action: WindowControlAction,
    variant: WindowControlsVariant,
    maximized: bool,
) -> String {
    let flush = variant.is_flush();
    let (name, size, body) = match action {
        WindowControlAction::Minimize => ("minus", if flush { 14 } else { 16 }, MINUS_BODY),
        WindowControlAction::ToggleMaximize => {
            if maximized {
                ("copy", if flush { 12 } else { 14 }, COPY_BODY)
            } else {
                ("square", if flush { 12 } else { 14 }, SQUARE_BODY)
            }
        }
        WindowControlAction::Close => ("x", if flush { 14 } else { 16 }, CROSS_BODY),
    };
    // Vue passes `style={{ transform: "rotate(180deg)" }}` to the restored
    // `Copy` glyph only.
    let rotate = if maximized && action == WindowControlAction::ToggleMaximize {
        r#" style="transform:rotate(180deg)""#
    } else {
        ""
    };
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-{name}-icon lucide-{name}" aria-hidden="true"{rotate}>{body}</svg>"#
    )
}

/// The three buttons in [`WINDOW_CONTROL_ACTION_ORDER`], each with its resolved
/// label, class pair, glyph and disabled state.
pub fn window_controls_buttons(
    variant: WindowControlsVariant,
    maximized: bool,
    wired: WindowControlWiring,
) -> Vec<WindowControlButton> {
    WINDOW_CONTROL_ACTION_ORDER
        .iter()
        .map(|action| WindowControlButton {
            action: *action,
            aria_label: window_controls_label(*action, maximized),
            classes: window_controls_button_classes(*action),
            glyph: window_controls_glyph(*action, variant, maximized),
            disabled: window_controls_button_disabled(*action, wired),
        })
        .collect()
}

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an rsx `svg {}`
/// child would be an HTML element, and the host must not add a box).
fn glyph_host(markup: &str) -> VNode {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct WindowControlsProps {
    /// REQUIRED — no default. `None` renders nothing (Vue's explicit-None
    /// contract, which also absorbs the Apple-platform and no-shell gates).
    pub variant: Option<WindowControlsVariant>,

    /// Controlled maximized state (Vue: the local ref fed by `isMaximized` /
    /// `onResized`). Swaps the glyph and the maximize/restore label.
    #[default]
    pub maximized: bool,

    /// Extra class appended to the root.
    #[default]
    pub class: String,

    /// Minimize intent (Vue: `win.minimize()`). `None` disables the button.
    pub on_minimize: Option<EventHandler<MouseEvent>>,

    /// Maximize/restore intent (Vue: `win.toggleMaximize()` + an `isMaximized`
    /// re-read, which the host performs to keep `maximized` truthful).
    pub on_toggle_maximize: Option<EventHandler<MouseEvent>>,

    /// Close intent (Vue: `win.close()`). `None` disables the button.
    pub on_close: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn WindowControls(props: WindowControlsProps) -> Element {
    // The explicit-None contract: TWO render gates before any chrome — Vue
    // checks `variant` twice (mount and render) on top of the Apple-platform
    // and shell probes, all of which the host folds into this prop.
    let Some(variant) = props.variant else {
        return empty_vnode();
    };

    let wired = WindowControlWiring {
        minimize: props.on_minimize.is_some(),
        toggle_maximize: props.on_toggle_maximize.is_some(),
        close: props.on_close.is_some(),
    };
    let buttons = window_controls_buttons(variant, props.maximized, wired);

    let on_minimize = props.on_minimize.clone();
    let on_toggle_maximize = props.on_toggle_maximize.clone();
    let on_close = props.on_close.clone();

    rsx! {
        div {
            class: window_controls_root_classes(variant, &props.class),
            // Vue marks the cluster as NOT a drag region (the caption bar
            // around it is one).
            "data-tauri-drag-region": "false",
            for button in buttons.iter() {
                {
                    let handler = match button.action {
                        WindowControlAction::Minimize => on_minimize.clone(),
                        WindowControlAction::ToggleMaximize => on_toggle_maximize.clone(),
                        WindowControlAction::Close => on_close.clone(),
                    };
                    let classes = button.classes;
                    let label = button.aria_label.clone();
                    let glyph = button.glyph.clone();
                    let disabled = button.disabled;
                    rsx! {
                        button {
                            class: classes,
                            "type": "button",
                            "aria-label": label,
                            disabled: disabled,
                            onclick: move |event: MouseEvent| {
                                if let Some(handler) = handler.as_ref() {
                                    handler.call(event);
                                }
                            },
                            {glyph_host(&glyph)}
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for WindowControlsComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkWindowControls.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "window-controls"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fully_wired() -> WindowControlWiring {
        WindowControlWiring {
            minimize: true,
            toggle_maximize: true,
            close: true,
        }
    }

    #[test]
    fn window_controls_defaults_match_the_vue_props() {
        let props = WindowControlsProps::default();
        // Vue: `variant` is REQUIRED with no default — the explicit-None
        // contract, so the Rust default is "render nothing".
        assert!(props.variant.is_none());
        assert!(!props.maximized);
        assert_eq!(props.class, "");
        assert!(props.on_minimize.is_none());
        assert!(props.on_toggle_maximize.is_none());
        assert!(props.on_close.is_none());
        assert_eq!(
            WindowControlWiring::default(),
            WindowControlWiring {
                minimize: false,
                toggle_maximize: false,
                close: false,
            }
        );
    }

    #[test]
    fn window_controls_button_order_is_minimize_maximize_close() {
        // The order table and the builder agree, for both modes.
        assert_eq!(
            WINDOW_CONTROL_ACTION_ORDER,
            [
                WindowControlAction::Minimize,
                WindowControlAction::ToggleMaximize,
                WindowControlAction::Close,
            ]
        );
        for variant in [
            WindowControlsVariant::Standard,
            WindowControlsVariant::Flush,
        ] {
            let buttons = window_controls_buttons(variant, false, fully_wired());
            let actions: Vec<WindowControlAction> =
                buttons.iter().map(|button| button.action).collect();
            assert_eq!(actions, WINDOW_CONTROL_ACTION_ORDER, "{variant:?}");
            // Only the last (close) button takes the close modifier.
            assert_eq!(buttons[0].classes, "hk-window-controls__btn");
            assert_eq!(buttons[1].classes, "hk-window-controls__btn");
            assert_eq!(
                buttons[2].classes,
                "hk-window-controls__btn hk-window-controls__btn--close"
            );
        }
    }

    #[test]
    fn window_controls_disabled_state_follows_the_wiring() {
        // Nothing wired → all three disabled (never a dead-looking live
        // control — the Vue source's stated contract).
        for action in WINDOW_CONTROL_ACTION_ORDER {
            assert!(window_controls_button_disabled(
                action,
                WindowControlWiring::default()
            ));
        }
        // Fully wired → no disabled flag at all.
        for action in WINDOW_CONTROL_ACTION_ORDER {
            assert!(!window_controls_button_disabled(action, fully_wired()));
        }
        // The three fail INDEPENDENTLY: only the unwired one is disabled.
        let only_close = WindowControlWiring {
            minimize: true,
            toggle_maximize: true,
            close: false,
        };
        assert!(!window_controls_button_disabled(
            WindowControlAction::Minimize,
            only_close
        ));
        assert!(!window_controls_button_disabled(
            WindowControlAction::ToggleMaximize,
            only_close
        ));
        assert!(window_controls_button_disabled(
            WindowControlAction::Close,
            only_close
        ));
        // `maximized` never feeds the disabled derivation.
        let buttons = window_controls_buttons(WindowControlsVariant::Standard, true, fully_wired());
        assert!(buttons.iter().all(|button| !button.disabled));
    }

    #[test]
    fn window_controls_labels_and_glyphs_follow_the_maximized_prop() {
        assert_eq!(
            window_controls_label(WindowControlAction::Minimize, false),
            "Minimize"
        );
        assert_eq!(
            window_controls_label(WindowControlAction::Close, true),
            "Close"
        );
        assert_eq!(
            window_controls_label(WindowControlAction::ToggleMaximize, false),
            "Maximize"
        );
        assert_eq!(
            window_controls_label(WindowControlAction::ToggleMaximize, true),
            "Restore"
        );

        // Sizes: standard 16/14/16, flush 14/12/14 (Vue's size={flush ? n : m}).
        let standard_minimize = window_controls_glyph(
            WindowControlAction::Minimize,
            WindowControlsVariant::Standard,
            false,
        );
        assert!(
            standard_minimize.contains(r#"width="16""#),
            "{standard_minimize}"
        );
        assert!(
            standard_minimize.contains("lucide-minus"),
            "{standard_minimize}"
        );
        let flush_minimize = window_controls_glyph(
            WindowControlAction::Minimize,
            WindowControlsVariant::Flush,
            false,
        );
        assert!(flush_minimize.contains(r#"width="14""#), "{flush_minimize}");

        let windowed = window_controls_glyph(
            WindowControlAction::ToggleMaximize,
            WindowControlsVariant::Standard,
            false,
        );
        assert!(windowed.contains("lucide-square"), "{windowed}");
        assert!(windowed.contains(r#"width="14""#), "{windowed}");
        assert!(!windowed.contains("rotate(180deg)"), "{windowed}");

        let restored = window_controls_glyph(
            WindowControlAction::ToggleMaximize,
            WindowControlsVariant::Flush,
            true,
        );
        assert!(restored.contains("lucide-copy"), "{restored}");
        assert!(restored.contains(r#"width="12""#), "{restored}");
        assert!(
            restored.contains(r#"style="transform:rotate(180deg)""#),
            "{restored}"
        );

        let close = window_controls_glyph(
            WindowControlAction::Close,
            WindowControlsVariant::Standard,
            false,
        );
        assert!(close.contains("lucide-x"), "{close}");
        assert!(close.contains(r#"width="16""#), "{close}");
        assert!(close.contains("aria-hidden=\"true\""), "{close}");
    }

    #[test]
    fn window_controls_root_classes_match_the_vue_markup() {
        assert_eq!(
            window_controls_root_classes(WindowControlsVariant::Standard, ""),
            "hk-window-controls"
        );
        assert_eq!(
            window_controls_root_classes(WindowControlsVariant::Flush, ""),
            "hk-window-controls hk-window-controls--flush"
        );
        assert_eq!(
            window_controls_root_classes(WindowControlsVariant::Flush, "chest"),
            "hk-window-controls hk-window-controls--flush chest"
        );
        // The mode token never leaks as a `--standard` modifier.
        assert!(!WindowControlsVariant::Standard.is_flush());
        assert!(WindowControlsVariant::Flush.is_flush());
        assert_eq!(WindowControlsVariant::Standard.token(), "standard");
        assert_eq!(WindowControlsVariant::Flush.token(), "flush");
    }

    #[test]
    fn window_controls_renders_nothing_without_a_variant() {
        // Vue's explicit-None contract, belt included: an invalid/omitted
        // variant paints no chrome at all.
        let html = WindowControls(WindowControlsProps::default()).render_to_html();
        assert_eq!(html, "");
        assert!(!html.contains("hk-window-controls"), "{html}");
    }

    #[test]
    fn window_controls_render_contract() {
        let html = WindowControls(WindowControlsProps {
            variant: Some(WindowControlsVariant::Standard),
            on_minimize: Some(EventHandler::new(|_: MouseEvent| {})),
            on_close: Some(EventHandler::new(|_: MouseEvent| {})),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "class=\"hk-window-controls\"",
            "data-tauri-drag-region=\"false\"",
            "hk-window-controls__btn",
            "hk-window-controls__btn--close",
            "type=\"button\"",
            "aria-label=\"Minimize\"",
            "aria-label=\"Maximize\"",
            "aria-label=\"Close\"",
            "display:contents",
            "lucide lucide-minus",
            "lucide lucide-square",
            "lucide lucide-x",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Three buttons, in Vue's order, and the mid button is the unwired
        // one: exactly one `disabled` sits in the markup.
        let minimize_at = html.find("aria-label=\"Minimize\"").expect("minimize");
        let maximize_at = html.find("aria-label=\"Maximize\"").expect("maximize");
        let close_at = html.find("aria-label=\"Close\"").expect("close");
        assert!(minimize_at < maximize_at, "{html}");
        assert!(maximize_at < close_at, "{html}");
        assert_eq!(html.matches("disabled=").count(), 1, "{html}");
        // No flush modifier in standard mode.
        assert!(!html.contains("hk-window-controls--flush"), "{html}");
    }

    #[test]
    fn window_controls_flush_mode_and_maximized_state() {
        let html = WindowControls(WindowControlsProps {
            variant: Some(WindowControlsVariant::Flush),
            maximized: true,
            on_minimize: Some(EventHandler::new(|_: MouseEvent| {})),
            on_toggle_maximize: Some(EventHandler::new(|_: MouseEvent| {})),
            on_close: Some(EventHandler::new(|_: MouseEvent| {})),
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains("class=\"hk-window-controls hk-window-controls--flush\""),
            "{html}"
        );
        assert!(html.contains("aria-label=\"Restore\""), "{html}");
        assert!(!html.contains("aria-label=\"Maximize\""), "{html}");
        assert!(html.contains("lucide lucide-copy"), "{html}");
        assert!(html.contains("rotate(180deg)"), "{html}");
        // Fully wired → not one disabled button.
        assert!(!html.contains("disabled="), "{html}");
    }

    #[test]
    fn window_controls_styles_come_from_the_canonical_vue_sheet() {
        let css = WindowControlsComponent::styles();
        assert!(
            css.contains(".hk-window-controls")
                && css.contains(".hk-window-controls__btn")
                && css.contains("hk-window-controls--flush"),
            "window-controls css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored window-controls sheet"
        );
    }
}
