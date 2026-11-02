// packages/components/src/scene/zoom_toolbar.rs
// ZoomToolbar — mirror of the canonical Vue `HkZoomToolbar`: the floating zoom
// cluster that rides on top of an image / scene viewer's canvas.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkZoomToolbar.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `manifest.tsv`), compiled with
// `no_hash` so `.hk-zoom-toolbar` / `.hk-zoom-btn` / `.hk-zoom-label` /
// `.hk-zoom-reset-btn` are literal and identical in both forms. The DOM
// contract below mirrors the Vue render output one-to-one:
//
//   div.hk-zoom-toolbar
//     button.hk-btn.hk-btn-ghost.hk-btn-sm.hk-zoom-btn        (zoom out)
//            type="button" [disabled] aria-label="Zoom out"
//       span[style="display:contents"] > lucide zoom-out svg (14px)
//     span.hk-zoom-label                                     ("{round(zoom*100)}%")
//     button.hk-btn.hk-btn-ghost.hk-btn-sm.hk-zoom-btn        (zoom in)
//            type="button" [disabled] aria-label="Zoom in"
//       span[style="display:contents"] > lucide zoom-in svg (14px)
//     button.hk-btn.hk-btn-ghost.hk-btn-sm.hk-zoom-btn.hk-zoom-reset-btn
//            type="button" aria-label="Reset zoom"            (`isZoomed` only)
//       span[style="display:contents"] > lucide rotate-ccw svg (14px)
//
// Vue prop mapping: `zoom` → [`ZoomToolbarProps::zoom`] (a SCALE, `1` = 100%),
// `canZoomIn` / `canZoomOut` → the `disabled` guards, `isZoomed` → the reset
// button's render gate AND half of the component gate, the three emits
// (`zoomIn` / `zoomOut` / `reset`) → the three callbacks.
//
// The buttons are the MIRRORED `basic::button::Button` (`variant: ghost`,
// `size: sm`), not hand-rolled `<button>`s: Vue renders `HButton` there, and
// the sheet's `.hk-zoom-btn.hk-btn` rule (24×24) only matches when both class
// families land on one element.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] NO "FIT" CONTROL — the canonical source has exactly three intents
//     (out / in / reset); there is no fit button and no ladder in this
//     component: the zoom LEVEL belongs to the viewer that feeds `zoom`, and
//     the only level math here is the `Math.round(zoom * 100)` label. The
//     ±5% / ±15% ladders and their clamps live in `scene::minimap` /
//     `scene::minimap_3d` (which is where Vue's governance props sit too).
//   * [D] the glyphs are TRUSTED STATIC MARKUP through `dangerous_inner_html`
//     on their own `style="display:contents"` host (the crate-wide SVG rule:
//     tairitsu creates elements in the HTML namespace, so an rsx `svg {}`
//     child would never paint). Path data is lucide's (ISC) at Vue's exact
//     `size={14}`; the wrapper carries lucide's own
//     `class="lucide lucide-{name}-icon lucide-{name}"` + `aria-hidden="true"`
//     spelling, so each button's `aria-label` stays the accessible name.
//   * [D] `aria-label`s read `components.hk.zoomToolbar.*` through
//     `hikari_i18n::t`. Vue hard-codes the English literals in its render
//     function; the fallbacks are those same words, so the English DOM is
//     identical. The three keys are NEW (listed in the wave receipt).
//   * [D] `zoom: 1.0` as the prop default (Vue marks `zoom` required; a Rust
//     prop must be `Default`-constructible).
//
// State: none. Every input is a prop and every intent is a callback (zero
// `use_signal` / `use_state`); Vue's cluster is equally stateless.
//
// New file. `display/zoom_controls.rs` is a DIFFERENT, legacy component
// (`.hk-zoom-controls*`, `--hi-*` tokens, `min`/`max`/`step` props, an
// internal `use_signal`) that `display/mod.rs` still exports; this file is the
// canonical `HkZoomToolbar` mirror and deliberately does not touch it — see
// `display/image_viewer.rs`'s header, which already draws that distinction.

use hikari_i18n::t;

use crate::basic::button::{Button, ButtonSize, ButtonVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ZoomToolbarComponent;

/// Vue's `zoom` is a SCALE, and the label multiplies it by this before
/// rounding (`Math.round(props.zoom * 100)`).
pub const ZOOM_TOOLBAR_PERCENT_SCALE: f64 = 100.0;

/// The glyph size Vue passes to every lucide icon in this cluster
/// (`<ZoomOut size={14} />`, `ZoomIn`, `RotateCcw`).
pub const ZOOM_TOOLBAR_GLYPH_SIZE: u32 = 14;

/// The cluster's own root class.
pub const ZOOM_TOOLBAR_ROOT_CLASS: &str = "hk-zoom-toolbar";

/// The three intents, in Vue's render order (out → in → reset).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ZoomToolbarAction {
    /// `emit("zoomOut")`.
    ZoomOut,
    /// `emit("zoomIn")`.
    ZoomIn,
    /// `emit("reset")` — rendered only while `isZoomed`.
    Reset,
}

impl ZoomToolbarAction {
    /// The Vue emit this action forwards (the `emits` key).
    pub fn event_name(self) -> &'static str {
        match self {
            ZoomToolbarAction::ZoomOut => "zoomOut",
            ZoomToolbarAction::ZoomIn => "zoomIn",
            ZoomToolbarAction::Reset => "reset",
        }
    }

    /// The lucide glyph name Vue imports for this action.
    pub fn lucide_name(self) -> &'static str {
        match self {
            ZoomToolbarAction::ZoomOut => "zoom-out",
            ZoomToolbarAction::ZoomIn => "zoom-in",
            ZoomToolbarAction::Reset => "rotate-ccw",
        }
    }

    /// The button's class list. Vue passes `"hk-zoom-btn"` to the first two
    /// and `["hk-zoom-btn", "hk-zoom-reset-btn"]` to the reset button; the
    /// `hk-btn*` family comes from the mirrored `Button`, exactly as Vue's
    /// `HButton` supplies it.
    pub fn class_name(self) -> &'static str {
        match self {
            ZoomToolbarAction::ZoomOut | ZoomToolbarAction::ZoomIn => "hk-zoom-btn",
            ZoomToolbarAction::Reset => "hk-zoom-btn hk-zoom-reset-btn",
        }
    }

    /// The `aria-label` (and accessible name) of the button.
    pub fn label(self) -> String {
        match self {
            ZoomToolbarAction::ZoomOut => t("components.hk.zoomToolbar.zoomOut", "Zoom out"),
            ZoomToolbarAction::ZoomIn => t("components.hk.zoomToolbar.zoomIn", "Zoom in"),
            ZoomToolbarAction::Reset => t("components.hk.zoomToolbar.reset", "Reset zoom"),
        }
    }

    /// Vue's disabled contract: `!props.canZoomOut` / `!props.canZoomIn`, and
    /// the reset button is NEVER disabled (it is rendered or absent).
    pub fn disabled(self, can_zoom_in: bool, can_zoom_out: bool) -> bool {
        match self {
            ZoomToolbarAction::ZoomOut => !can_zoom_out,
            ZoomToolbarAction::ZoomIn => !can_zoom_in,
            ZoomToolbarAction::Reset => false,
        }
    }

    /// Vue's render gate: the reset button exists only while `isZoomed`; the
    /// two step buttons always exist.
    pub fn rendered(self, is_zoomed: bool) -> bool {
        match self {
            ZoomToolbarAction::Reset => is_zoomed,
            ZoomToolbarAction::ZoomOut | ZoomToolbarAction::ZoomIn => true,
        }
    }
}

/// The action order the cluster always uses (the sheet's
/// `.hk-zoom-reset-btn` divider and the label's `min-width` both depend on
/// the out → label → in → reset order).
pub const ZOOM_TOOLBAR_ACTION_ORDER: [ZoomToolbarAction; 3] = [
    ZoomToolbarAction::ZoomOut,
    ZoomToolbarAction::ZoomIn,
    ZoomToolbarAction::Reset,
];

// ── lucide glyph bodies (ISC; children of the shared svg frame) ──────────

const ZOOM_OUT_BODY: &str = r#"<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>"#;
const ZOOM_IN_BODY: &str = r#"<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>"#;
const ROTATE_CCW_BODY: &str =
    r#"<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>"#;

// ── pure functions ──────────────────────────────────────────────────────

/// The lucide `<svg>` Vue renders for one action at [`ZOOM_TOOLBAR_GLYPH_SIZE`].
pub fn zoom_toolbar_glyph(action: ZoomToolbarAction) -> String {
    let body = match action {
        ZoomToolbarAction::ZoomOut => ZOOM_OUT_BODY,
        ZoomToolbarAction::ZoomIn => ZOOM_IN_BODY,
        ZoomToolbarAction::Reset => ROTATE_CCW_BODY,
    };
    let name = action.lucide_name();
    let size = ZOOM_TOOLBAR_GLYPH_SIZE;
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-{name}-icon lucide-{name}" aria-hidden="true">{body}</svg>"#
    )
}

/// JS `Math.round` — ties go toward `+∞` (`f64::round` sends them away from
/// zero, which would answer a negative scale one whole percent lower).
fn zoom_toolbar_js_round(value: f64) -> f64 {
    (value + 0.5).floor()
}

/// Vue's label number: `Math.round(props.zoom * 100)`, as an integer.
/// A non-finite scale resolves to `0` (JS would print `NaN%`; the mirror
/// keeps the label printable instead of poisoning the text node).
pub fn zoom_toolbar_percent(zoom: f64) -> i64 {
    let scaled = zoom * ZOOM_TOOLBAR_PERCENT_SCALE;
    if !scaled.is_finite() {
        return 0;
    }
    let rounded = zoom_toolbar_js_round(scaled);
    if rounded == 0.0 {
        // `Math.round(-0.4)` is `-0`, which JS prints as "0" — never "-0".
        return 0;
    }
    rounded as i64
}

/// The label text Vue renders in `span.hk-zoom-label`.
pub fn zoom_toolbar_label(zoom: f64) -> String {
    format!("{}%", zoom_toolbar_percent(zoom))
}

/// Vue's component gate: `if (!props.isZoomed && !props.canZoomOut) return
/// null;` — nothing to show while the view sits at its resting state.
pub fn zoom_toolbar_visible(is_zoomed: bool, can_zoom_out: bool) -> bool {
    is_zoomed || can_zoom_out
}

/// The root class list: the cluster class plus any host class (Vue merges the
/// fallthrough class itself; `ZoomToolbar` declares none, so this only keeps
/// the door open for one).
pub fn zoom_toolbar_root_classes(extra: &str) -> String {
    if extra.is_empty() {
        ZOOM_TOOLBAR_ROOT_CLASS.to_string()
    } else {
        format!("{ZOOM_TOOLBAR_ROOT_CLASS} {extra}")
    }
}

/// One rendered button: everything the render function needs, derived once.
#[derive(Clone, PartialEq, Debug)]
pub struct ZoomToolbarButton {
    /// Which intent this button forwards.
    pub action: ZoomToolbarAction,
    /// `hk-zoom-btn[.hk-zoom-reset-btn]`.
    pub classes: &'static str,
    /// The `aria-label` / accessible name.
    pub aria_label: String,
    /// The `disabled` guard (never set on the reset button).
    pub disabled: bool,
    /// The lucide markup Vue renders inside the button.
    pub glyph: String,
}

/// The buttons Vue actually renders, in DOM order (out, in, reset-when-zoomed).
pub fn zoom_toolbar_buttons(
    is_zoomed: bool,
    can_zoom_in: bool,
    can_zoom_out: bool,
) -> Vec<ZoomToolbarButton> {
    ZOOM_TOOLBAR_ACTION_ORDER
        .iter()
        .filter(|action| action.rendered(is_zoomed))
        .map(|action| ZoomToolbarButton {
            action: *action,
            classes: action.class_name(),
            aria_label: action.label(),
            disabled: action.disabled(can_zoom_in, can_zoom_out),
            glyph: zoom_toolbar_glyph(*action),
        })
        .collect()
}

// ── render assembly ─────────────────────────────────────────────────────

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an rsx `svg {}`
/// child would be an HTML element, and the host must not add a box).
fn zoom_toolbar_glyph_host(markup: &str) -> VNode {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

/// One button: the MIRRORED `Button` (ghost / sm) carrying the action's class,
/// disabled guard, accessible name and glyph — Vue's `HButton` verbatim.
fn zoom_toolbar_button_node(
    button: &ZoomToolbarButton,
    handler: Option<EventHandler<MouseEvent>>,
) -> VNode {
    let glyph = zoom_toolbar_glyph_host(&button.glyph);
    rsx! {
        Button {
            variant: ButtonVariant::Ghost,
            size: ButtonSize::Sm,
            class: button.classes.to_string(),
            disabled: button.disabled,
            aria_label: Some(button.aria_label.clone()),
            onclick: handler,
            children: glyph,
        }
    }
}

// ── props ──────────────────────────────────────────────────────────────

#[define_props]
pub struct ZoomToolbarProps {
    /// The viewer's zoom SCALE (Vue: `zoom`, required there; `1.0` here
    /// because Rust props need a `Default`). `1.0` = the label's `100%`.
    #[default(1.0)]
    pub zoom: f64,

    /// Gate for the zoom-in button (Vue: `canZoomIn`, required).
    #[default]
    pub can_zoom_in: bool,

    /// Gate for the zoom-out button AND half of the component gate (Vue:
    /// `canZoomOut`, required).
    #[default]
    pub can_zoom_out: bool,

    /// Half of the component gate and the reset button's render gate (Vue:
    /// `isZoomed`, required).
    #[default]
    pub is_zoomed: bool,

    /// Zoom-in intent (Vue: `emit("zoomIn")`).
    pub on_zoom_in: Option<EventHandler<MouseEvent>>,

    /// Zoom-out intent (Vue: `emit("zoomOut")`).
    pub on_zoom_out: Option<EventHandler<MouseEvent>>,

    /// Reset intent (Vue: `emit("reset")`).
    pub on_reset: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn ZoomToolbar(props: ZoomToolbarProps) -> Element {
    // Vue: `if (!props.isZoomed && !props.canZoomOut) return null;`
    if !zoom_toolbar_visible(props.is_zoomed, props.can_zoom_out) {
        return empty_vnode();
    }

    let buttons = zoom_toolbar_buttons(props.is_zoomed, props.can_zoom_in, props.can_zoom_out);
    let find = |action: ZoomToolbarAction| buttons.iter().find(|button| button.action == action);

    let label = zoom_toolbar_label(props.zoom);
    let out_handler = props.on_zoom_out.clone();
    let in_handler = props.on_zoom_in.clone();
    let reset_handler = props.on_reset.clone();

    let out_node = match find(ZoomToolbarAction::ZoomOut) {
        Some(button) => zoom_toolbar_button_node(button, out_handler),
        None => empty_vnode(),
    };
    let in_node = match find(ZoomToolbarAction::ZoomIn) {
        Some(button) => zoom_toolbar_button_node(button, in_handler),
        None => empty_vnode(),
    };
    // The reset button is absent (not disabled) while the view is at rest.
    let reset_node = match find(ZoomToolbarAction::Reset) {
        Some(button) => zoom_toolbar_button_node(button, reset_handler),
        None => empty_vnode(),
    };

    rsx! {
        div {
            class: zoom_toolbar_root_classes(""),
            {out_node}
            span { class: "hk-zoom-label", "{label}" }
            {in_node}
            {reset_node}
        }
    }
}

impl StyledComponent for ZoomToolbarComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-zoom-*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkZoomToolbar.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "zoom-toolbar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn html_for(props: ZoomToolbarProps) -> String {
        ZoomToolbar(props).render_to_html()
    }

    #[test]
    fn zoom_toolbar_defaults_match_the_vue_props() {
        let props = ZoomToolbarProps::default();
        // Vue marks `zoom` / `canZoomIn` / `canZoomOut` / `isZoomed` required;
        // the Rust defaults are the neutral camera (1.0 = 100%, nothing
        // zoomed, both guards closed).
        assert_eq!(props.zoom, 1.0);
        assert!(!props.can_zoom_in);
        assert!(!props.can_zoom_out);
        assert!(!props.is_zoomed);
        assert!(props.on_zoom_in.is_none());
        assert!(props.on_zoom_out.is_none());
        assert!(props.on_reset.is_none());
    }

    #[test]
    fn zoom_toolbar_action_class_names_match_the_vue_buttons() {
        assert_eq!(ZoomToolbarAction::ZoomOut.class_name(), "hk-zoom-btn");
        assert_eq!(ZoomToolbarAction::ZoomIn.class_name(), "hk-zoom-btn");
        // Vue passes the class ARRAY ["hk-zoom-btn", "hk-zoom-reset-btn"].
        assert_eq!(
            ZoomToolbarAction::Reset.class_name(),
            "hk-zoom-btn hk-zoom-reset-btn"
        );
        assert_eq!(ZoomToolbarAction::ZoomOut.event_name(), "zoomOut");
        assert_eq!(ZoomToolbarAction::ZoomIn.event_name(), "zoomIn");
        assert_eq!(ZoomToolbarAction::Reset.event_name(), "reset");
        assert_eq!(
            zoom_toolbar_root_classes(""),
            "hk-zoom-toolbar",
            "the root class is Vue's literal"
        );
        assert_eq!(
            zoom_toolbar_root_classes("host-class"),
            "hk-zoom-toolbar host-class"
        );
    }

    #[test]
    fn zoom_toolbar_label_rounds_like_js_math_round() {
        // Math.round(zoom * 100).
        assert_eq!(zoom_toolbar_percent(1.0), 100);
        assert_eq!(zoom_toolbar_percent(1.25), 125);
        assert_eq!(zoom_toolbar_percent(0.125), 13, "12.5 rounds UP");
        assert_eq!(zoom_toolbar_percent(0.0), 0);
        // JS rounds ties toward +∞: Math.round(-12.5) === -12 (f64::round
        // would answer -13 — this is the tie the helper exists for).
        assert_eq!(zoom_toolbar_percent(-0.125), -12);
        // A value inside the first percent is "0", never "-0".
        assert_eq!(zoom_toolbar_label(-0.001), "0%");
        assert_eq!(zoom_toolbar_label(1.0), "100%");
        assert_eq!(zoom_toolbar_label(0.075), "8%");
        // Non-finite stays printable instead of rendering "NaN%".
        assert_eq!(zoom_toolbar_label(f64::NAN), "0%");
        assert_eq!(zoom_toolbar_label(f64::INFINITY), "0%");
    }

    #[test]
    fn zoom_toolbar_gate_matches_the_vue_null_contract() {
        // `!isZoomed && !canZoomOut` renders nothing at all.
        assert!(!zoom_toolbar_visible(false, false));
        assert!(zoom_toolbar_visible(true, false));
        assert!(zoom_toolbar_visible(false, true));
        assert!(zoom_toolbar_visible(true, true));
        assert_eq!(
            html_for(ZoomToolbarProps::default()),
            "",
            "a resting view renders no cluster"
        );
    }

    #[test]
    fn zoom_toolbar_buttons_follow_the_vue_order_and_gates() {
        // At rest with a zoomed-out floor: only the two step buttons.
        let rest = zoom_toolbar_buttons(false, true, false);
        assert_eq!(
            rest.iter().map(|button| button.action).collect::<Vec<_>>(),
            vec![ZoomToolbarAction::ZoomOut, ZoomToolbarAction::ZoomIn]
        );
        assert!(
            rest[0].disabled,
            "canZoomOut=false disables the zoom-out button"
        );
        assert!(!rest[1].disabled);

        // Zoomed: the reset button joins at the END of the cluster.
        let zoomed = zoom_toolbar_buttons(true, false, true);
        assert_eq!(
            zoomed
                .iter()
                .map(|button| button.action)
                .collect::<Vec<_>>(),
            vec![
                ZoomToolbarAction::ZoomOut,
                ZoomToolbarAction::ZoomIn,
                ZoomToolbarAction::Reset
            ]
        );
        assert!(!zoomed[0].disabled, "canZoomOut re-enables the way out");
        assert!(zoomed[1].disabled, "canZoomIn=false disables the way in");
        // The reset button is rendered or absent — never disabled.
        assert!(!zoomed[2].disabled);
        assert_eq!(zoomed[2].classes, "hk-zoom-btn hk-zoom-reset-btn");
    }

    #[test]
    fn zoom_toolbar_labels_and_glyphs_follow_the_i18n_keys() {
        assert_eq!(ZoomToolbarAction::ZoomOut.label(), "Zoom out");
        assert_eq!(ZoomToolbarAction::ZoomIn.label(), "Zoom in");
        assert_eq!(ZoomToolbarAction::Reset.label(), "Reset zoom");

        // Every glyph is lucide's 24-unit frame at Vue's `size={14}`.
        for action in ZOOM_TOOLBAR_ACTION_ORDER {
            let glyph = zoom_toolbar_glyph(action);
            assert!(glyph.contains(r#"width="14""#), "{glyph}");
            assert!(glyph.contains(r#"height="14""#), "{glyph}");
            assert!(glyph.contains(r#"viewBox="0 0 24 24""#), "{glyph}");
            assert!(glyph.contains(r#"aria-hidden="true""#), "{glyph}");
            assert!(
                glyph.contains(&format!("lucide-{}-icon", action.lucide_name())),
                "{glyph}"
            );
        }
        // The zoom-in glyph is the zoom-out glyph plus the vertical bar.
        let out = zoom_toolbar_glyph(ZoomToolbarAction::ZoomOut);
        let into = zoom_toolbar_glyph(ZoomToolbarAction::ZoomIn);
        assert!(out.contains(r#"<line x1="8" x2="14" y1="11" y2="11"/>"#));
        assert!(
            !out.contains(r#"x1="11" x2="11""#),
            "no vertical bar on the out glyph"
        );
        assert!(into.contains(r#"<line x1="11" x2="11" y1="8" y2="14"/>"#));
        assert!(zoom_toolbar_glyph(ZoomToolbarAction::Reset).contains("M3 12a9 9 0 1 0 9-9"));
    }

    #[test]
    fn zoom_toolbar_renders_the_vue_dom_contract() {
        let html = html_for(ZoomToolbarProps {
            zoom: 1.25,
            can_zoom_in: true,
            can_zoom_out: true,
            is_zoomed: true,
            ..Default::default()
        });

        // Root, then the label between the two step buttons.
        assert!(html.contains(r#"class="hk-zoom-toolbar""#), "{html}");
        assert!(
            html.contains(r#"<span class="hk-zoom-label">125%</span>"#),
            "{html}"
        );
        let out = html
            .find(r#"aria-label="Zoom out""#)
            .expect("zoom-out button");
        let label = html.find("hk-zoom-label").expect("label");
        let into = html
            .find(r#"aria-label="Zoom in""#)
            .expect("zoom-in button");
        let reset = html
            .find(r#"aria-label="Reset zoom""#)
            .expect("reset button");
        assert!(
            out < label && label < into && into < reset,
            "Vue's order is out → label → in → reset: {html}"
        );

        // The mirrored Button family lands on the same element as
        // `.hk-zoom-btn` (that is what `.hk-zoom-btn.hk-btn` matches).
        assert!(
            html.contains(r#"class="hk-btn hk-btn-ghost hk-btn-sm hk-zoom-btn""#),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-btn hk-btn-ghost hk-btn-sm hk-zoom-btn hk-zoom-reset-btn""#),
            "the reset button carries both class families: {html}"
        );
        // `type="button"` always (Vue's HButton default) and every glyph rides
        // a display:contents host.
        assert!(html.contains(r#"type="button""#), "{html}");
        assert!(html.contains(r#"style="display:contents""#), "{html}");
        assert!(
            html.contains(r#"class="lucide lucide-zoom-out-icon lucide-zoom-out""#),
            "{html}"
        );
        // Fully zoomable ⇒ no disabled attribute anywhere.
        assert!(!html.contains("disabled="), "{html}");
    }

    #[test]
    fn zoom_toolbar_disables_the_step_buttons_at_the_endpoints() {
        let html = html_for(ZoomToolbarProps {
            zoom: 1.0,
            can_zoom_in: false,
            can_zoom_out: true,
            is_zoomed: false,
            ..Default::default()
        });
        // `disabled: bool` in rsx renders the presence form `disabled="disabled"`.
        assert!(html.contains(r#"disabled="disabled""#), "{html}");
        assert_eq!(
            html.matches(r#"disabled="disabled""#).count(),
            1,
            "only the zoom-in button is disabled: {html}"
        );
        // Not zoomed ⇒ the reset button does not exist.
        assert!(!html.contains("hk-zoom-reset-btn"), "{html}");
        assert!(!html.contains("Reset zoom"), "{html}");
    }

    #[test]
    fn zoom_toolbar_styles_come_from_the_canonical_vue_sheet() {
        let css = ZoomToolbarComponent::styles();
        for class in [
            ".hk-zoom-toolbar",
            ".hk-zoom-btn.hk-btn",
            ".hk-zoom-label",
            ".hk-zoom-reset-btn",
        ] {
            assert!(
                css.contains(class),
                "zoom-toolbar css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored zoom-toolbar sheet"
        );
    }
}
