// hi-components/src/layout/title_bar.rs
// TitleBar — mirror of the canonical Vue `HkTitleBar`: the hybrid-shell window
// caption bar (app icon + title/subtitle, a draggable surface, right-side
// caption buttons).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTitleBar.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `scripts/sync-vue-mirror.py`'s W5
// `LAYOUT_SHEETS`), compiled with `no_hash` so the `.hk-titlebar*` class names
// are literal and identical in both forms. DOM contract (mirrors the Vue render
// output one-to-one):
//
//   div.hk-titlebar data-drag-region="true" [data-maximized="true"]
//     ── left slot wins over the default title block ──
//     span.hk-titlebar-title                    (the default title block)
//       img.hk-titlebar-icon?                   (icon = URL, as in Vue)
//       span.hk-titlebar-title-text             (title)
//       span.hk-titlebar-subtitle?              (only for a non-empty subtitle)
//     span.hk-titlebar-spacer
//     div.hk-titlebar-actions
//       {actions slot}
//       button.hk-titlebar-btn                  (per custom action: title=id)
//       button.hk-titlebar-btn                  (minimize; show_minimize)
//       button.hk-titlebar-btn                  (maximize/restore; show_maximize)
//       button.hk-titlebar-btn.hk-titlebar-btn-close   (close; show_close)
//     ── every caption glyph ──
//     span[style="display:contents"] > the svg (see the SVG rule below)
//
// State: none. The bar is a pure visual + event component — Vue's only state is
// the one-shot window-chrome claim on mount (`runtime/windowChrome`), which is
// a host concern here: the host decides who owns the chrome, the mirror renders
// and reports clicks. Dragging is pure CSS (`app-region: drag` on the bar,
// `no-drag` on `.hk-titlebar-actions` in the sheet); the mirror emits the same
// `data-drag-region` marker and adds no JS drag logic, no signals and no
// registry.
//
// Deltas vs Vue (documented, not accidental):
//   * the caption tooltips read `components.hk.titleBar.{minimize,maximize,
//     restore,close}` through `hikari_i18n::t`, with Vue's English words as the
//     fallback. Vue reads its preset bundle's `hikari::titleBar.*` keys; the
//     Rust preset family namespaces component strings
//     `components.hk.<comp>.<key>` (`packages/i18n/src/locales/*/components.toml`),
//     so the mirror opens those four keys in that namespace. They are NEW (the
//     wave receipt lists them): until a locale bundle carries them every locale
//     renders the English fallback, which is exactly the words Vue shows, and a
//     bundle that adds them localizes the captions with the host's locale.
//   * `customActions` becomes `custom_actions: Vec<TitleBarAction>`; its `icon`
//     is a host `Element` (Vue renders `a.icon` as a node), so no consumer
//     string reaches the markup.
//   * the caption glyphs are TRUSTED STATIC MARKUP through
//     `dangerous_inner_html` on their own `style="display:contents"` host
//     (tairitsu creates elements in the HTML namespace, so an rsx `svg {}`
//     child would never paint, and `dangerous_inner_html` suppresses an
//     element's children). The path/rect data is copied VERBATIM from
//     `HkTitleBar.tsx`; the crate-wide convention adds
//     `xmlns` + `aria-hidden="true"` so the button's own `aria-label` stays the
//     accessible name. No consumer string enters that markup, so no escaper is
//     needed here (contrast `data/gauge_ring.rs`).
//   * [D] a host `class` prop is appended last (Vue merges the fallthrough class
//     itself).
//   * [D] the `maximized` prop is fully CONTROLLED (Vue also takes it as a prop
//     — the mirror just never stores it) and drives the same three things Vue
//     pins: the `data-maximized` marker, the maximize↔restore glyph swap and the
//     tooltip text.
//   * unlike `WindowControls`, a caption whose callback is absent renders
//     ENABLED and does nothing — exactly Vue's `emit` with no listener. Hiding
//     is the `show_*` props' job, as in Vue; the bar never invents a disabled
//     state (that derivation lives in `layout/window_controls.rs`, where Vue's
//     own source requires a refused shell call to not look like a working
//     button).
//
// Replaces nothing: the family had no Rust counterpart for the caption bar.

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TitleBarComponent;

/// The three caption buttons in Vue's render order.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TitleBarCaption {
    Minimize,
    Maximize,
    Close,
}

// ── caption glyphs (verbatim from HkTitleBar.tsx; see the header delta) ──

/// Minimize — a single rule, `stroke-width="1.75"`, lucide-free (hikari-authored
/// in the Vue source).
pub const TITLE_BAR_MINIMIZE_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>"#;

/// Maximize (windowed) — one rounded square.
pub const TITLE_BAR_MAXIMIZE_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>"#;

/// Restore (maximized) — the stacked pair.
pub const TITLE_BAR_RESTORE_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="3" y="8" width="13" height="13" rx="2"/><path d="M8 8V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/></svg>"#;

/// Close — the ✕, `stroke-linecap="round"`.
pub const TITLE_BAR_CLOSE_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>"#;

// ── pure functions ───────────────────────────────────────────────────────

/// The root class list: the base class plus the host class.
pub fn title_bar_root_classes(extra: &str) -> String {
    let mut classes = String::from("hk-titlebar");
    if !extra.is_empty() {
        classes.push(' ');
        classes.push_str(extra);
    }
    classes
}

/// The visible captions in Vue's render order (minimize → maximize → close),
/// each gated by its `show_*` prop. Vue's `customActions` and `actions` slot
/// come BEFORE this list, so they are not part of it.
pub fn title_bar_captions(
    show_minimize: bool,
    show_maximize: bool,
    show_close: bool,
) -> Vec<TitleBarCaption> {
    let mut captions = Vec::with_capacity(3);
    if show_minimize {
        captions.push(TitleBarCaption::Minimize);
    }
    if show_maximize {
        captions.push(TitleBarCaption::Maximize);
    }
    if show_close {
        captions.push(TitleBarCaption::Close);
    }
    captions
}

/// The caption's class list: only the rightmost (close) button carries the
/// window's top-right corner radius (`hk-titlebar-btn-close`).
pub fn title_bar_caption_classes(caption: TitleBarCaption) -> &'static str {
    match caption {
        TitleBarCaption::Close => "hk-titlebar-btn hk-titlebar-btn-close",
        TitleBarCaption::Minimize | TitleBarCaption::Maximize => "hk-titlebar-btn",
    }
}

/// The caption's tooltip / accessible name. The maximize button speaks as
/// `maximize` or `restore` depending on the CONTROLLED `maximized` prop — Vue
/// swaps the same two strings.
pub fn title_bar_caption_label(caption: TitleBarCaption, maximized: bool) -> String {
    match caption {
        TitleBarCaption::Minimize => t("components.hk.titleBar.minimize", "Minimize"),
        TitleBarCaption::Maximize => {
            if maximized {
                t("components.hk.titleBar.restore", "Restore")
            } else {
                t("components.hk.titleBar.maximize", "Maximize")
            }
        }
        TitleBarCaption::Close => t("components.hk.titleBar.close", "Close"),
    }
}

/// The caption's glyph markup (the `dangerous_inner_html` payload).
pub fn title_bar_caption_glyph(caption: TitleBarCaption, maximized: bool) -> &'static str {
    match caption {
        TitleBarCaption::Minimize => TITLE_BAR_MINIMIZE_SVG,
        TitleBarCaption::Maximize => {
            if maximized {
                TITLE_BAR_RESTORE_SVG
            } else {
                TITLE_BAR_MAXIMIZE_SVG
            }
        }
        TitleBarCaption::Close => TITLE_BAR_CLOSE_SVG,
    }
}

/// Vue renders the subtitle span only for a TRUTHY subtitle.
pub fn title_bar_shows_subtitle(subtitle: &str) -> bool {
    !subtitle.is_empty()
}

/// Vue renders the `<img>` only for a truthy `icon` URL.
pub fn title_bar_shows_icon(icon: &str) -> bool {
    !icon.is_empty()
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

/// True when a slot carries nothing to render (Vue tests `slots.x`).
fn slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

// ── the component ────────────────────────────────────────────────────────

/// One extra icon button rendered to the LEFT of minimize
/// (Vue: `customActions[i]`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TitleBarAction {
    /// The id reported by `on_action` when the button is clicked.
    pub id: String,
    /// Tooltip / accessible name (`title` and `aria-label`, as in Vue).
    pub label: String,
    /// The button's glyph node (Vue: `a.icon`, rendered as-is).
    pub icon: Option<Element>,
}

#[define_props]
pub struct TitleBarProps {
    /// Caption text (Vue default `""`).
    #[default]
    pub title: String,

    /// Secondary caption text (Vue default `""`; empty omits the span).
    #[default]
    pub subtitle: String,

    /// App icon URL rendered left of the title (Vue: `icon` is the `<img>`
    /// `src`, NOT a node).
    #[default]
    pub icon: String,

    /// Controlled maximized state (Vue: the `maximized` prop). Drives the
    /// `data-maximized` marker, the maximize↔restore glyph and the tooltip.
    #[default]
    pub maximized: bool,

    /// Render the minimize caption (Vue default true).
    #[default(true)]
    pub show_minimize: bool,

    /// Render the maximize/restore caption (Vue default true).
    #[default(true)]
    pub show_maximize: bool,

    /// Render the close caption (Vue default true).
    #[default(true)]
    pub show_close: bool,

    /// Extra icon buttons rendered left of minimize; each reports its id
    /// through `on_action` (Vue: `customActions`).
    pub custom_actions: Vec<TitleBarAction>,

    /// Extra class appended to the root.
    #[default]
    pub class: String,

    /// Replaces the default title block entirely (Vue: the `left` slot).
    pub left: Option<Element>,

    /// Content rendered BEFORE the custom actions (Vue: the `actions` slot).
    pub actions: Option<Element>,

    /// Minimize request (Vue: the `minimize` emit). The host owns the shell.
    pub on_minimize: Option<EventHandler<MouseEvent>>,

    /// Maximize/restore request (Vue: the `toggle-maximize` emit).
    pub on_toggle_maximize: Option<EventHandler<MouseEvent>>,

    /// Close request (Vue: the `close` emit).
    pub on_close: Option<EventHandler<MouseEvent>>,

    /// A custom action button was clicked; carries its id
    /// (Vue: the `action` emit).
    pub on_action: Option<EventHandler<String>>,
}

/// One caption button: the class pair, the `title`/`aria-label` and the glyph
/// host are identical in construction, so the three captions share this
/// builder. A missing callback leaves the button ENABLED and inert (see the
/// header delta — Vue's `emit` with no listener).
fn caption_button(
    caption: TitleBarCaption,
    maximized: bool,
    handler: Option<EventHandler<MouseEvent>>,
) -> VNode {
    let label = title_bar_caption_label(caption, maximized);
    let mut button = VElement::new("button")
        .class(title_bar_caption_classes(caption))
        .attr("type", "button")
        .attr("title", label.clone())
        .attr("aria-label", label)
        .child(glyph_host(title_bar_caption_glyph(caption, maximized)));
    button = button.on_click(move |event: MouseEvent| {
        // Vue: `e.stopPropagation()` before emitting — the bar's own click
        // must never treat a caption press as a bar gesture.
        event.stop_propagation();
        if let Some(handler) = handler.as_ref() {
            handler.call(event);
        }
    });
    VNode::Element(Box::new(button))
}

/// One custom action button (Vue: `customActions.map(...)`).
fn action_button(action: &TitleBarAction, on_action: Option<EventHandler<String>>) -> VNode {
    let id = action.id.clone();
    let label = action.label.clone();
    let mut button = VElement::new("button")
        .class("hk-titlebar-btn")
        .attr("type", "button")
        .attr("title", label.clone())
        .attr("aria-label", label);
    if let Some(icon) = &action.icon {
        button = button.child(icon.clone());
    }
    button = button.on_click(move |event: MouseEvent| {
        event.stop_propagation();
        if let Some(handler) = on_action.as_ref() {
            handler.call(id.clone());
        }
    });
    VNode::Element(Box::new(button))
}

/// The default title block (Vue's non-`left`-slot branch).
fn title_block(props: &TitleBarProps) -> VNode {
    let mut block = VElement::new("span").class("hk-titlebar-title");
    if title_bar_shows_icon(&props.icon) {
        block = block.child(rsx! {
            img {
                class: "hk-titlebar-icon",
                src: props.icon.clone(),
                alt: "",
            }
        });
    }
    block = block.child(rsx! {
        span { class: "hk-titlebar-title-text", {VNode::Text(VText::new(props.title.as_str()))} }
    });
    if title_bar_shows_subtitle(&props.subtitle) {
        block = block.child(rsx! {
            span { class: "hk-titlebar-subtitle", {VNode::Text(VText::new(props.subtitle.as_str()))} }
        });
    }
    VNode::Element(Box::new(block))
}

#[component]
pub fn TitleBar(props: TitleBarProps) -> Element {
    let maximized = props.maximized;
    let mut children: Vec<VNode> = Vec::new();

    // Vue: `slots.left?.() ?? <title block>` — the slot REPLACES the block.
    match &props.left {
        Some(left) => children.push(left.clone()),
        None => children.push(title_block(&props)),
    }
    children.push(rsx! {
        span { class: "hk-titlebar-spacer" }
    });

    let mut actions_element = VElement::new("div").class("hk-titlebar-actions");
    if let Some(actions) = props.actions.clone().filter(|node| !slot_is_empty(node)) {
        actions_element = actions_element.child(actions);
    }
    let on_action = props.on_action.clone();
    for action in &props.custom_actions {
        actions_element = actions_element.child(action_button(action, on_action.clone()));
    }
    let on_minimize = props.on_minimize.clone();
    let on_toggle_maximize = props.on_toggle_maximize.clone();
    let on_close = props.on_close.clone();
    for caption in title_bar_captions(props.show_minimize, props.show_maximize, props.show_close) {
        let handler = match caption {
            TitleBarCaption::Minimize => on_minimize.clone(),
            TitleBarCaption::Maximize => on_toggle_maximize.clone(),
            TitleBarCaption::Close => on_close.clone(),
        };
        actions_element = actions_element.child(caption_button(caption, maximized, handler));
    }
    children.push(VNode::Element(Box::new(actions_element)));

    // `data-maximized` is a PRESENCE attribute in Vue
    // (`props.maximized || undefined`): absent when windowed, never "false".
    let root = VElement::new("div")
        .class(title_bar_root_classes(&props.class))
        .attr("data-drag-region", "true")
        .attr_opt("data-maximized", maximized.then_some("true"))
        .children(children);
    VNode::Element(Box::new(root))
}

impl StyledComponent for TitleBarComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTitleBar.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "title-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_bar_defaults_match_the_vue_props() {
        let props = TitleBarProps::default();
        assert_eq!(props.title, "");
        assert_eq!(props.subtitle, "");
        assert_eq!(props.icon, "");
        assert!(!props.maximized);
        assert!(props.show_minimize);
        assert!(props.show_maximize);
        assert!(props.show_close);
        assert!(props.custom_actions.is_empty());
        assert_eq!(props.class, "");
        assert!(props.left.is_none());
        assert!(props.actions.is_none());
        assert!(props.on_minimize.is_none());
        assert!(props.on_toggle_maximize.is_none());
        assert!(props.on_close.is_none());
        assert!(props.on_action.is_none());
    }

    #[test]
    fn title_bar_caption_order_and_gating_match_the_vue_render() {
        use TitleBarCaption::*;
        assert_eq!(
            title_bar_captions(true, true, true),
            vec![Minimize, Maximize, Close]
        );
        assert_eq!(title_bar_captions(false, true, true), vec![Maximize, Close]);
        assert_eq!(title_bar_captions(true, false, true), vec![Minimize, Close]);
        assert_eq!(
            title_bar_captions(true, true, false),
            vec![Minimize, Maximize]
        );
        assert!(title_bar_captions(false, false, false).is_empty());
    }

    #[test]
    fn title_bar_caption_classes_mark_only_the_close_button() {
        assert_eq!(
            title_bar_caption_classes(TitleBarCaption::Minimize),
            "hk-titlebar-btn"
        );
        assert_eq!(
            title_bar_caption_classes(TitleBarCaption::Maximize),
            "hk-titlebar-btn"
        );
        assert_eq!(
            title_bar_caption_classes(TitleBarCaption::Close),
            "hk-titlebar-btn hk-titlebar-btn-close"
        );
    }

    #[test]
    fn title_bar_caption_labels_follow_the_maximized_prop() {
        // No locale is installed in the test thread → the English fallbacks
        // (Vue's own literal words) are the expected strings.
        assert_eq!(
            title_bar_caption_label(TitleBarCaption::Minimize, false),
            "Minimize"
        );
        assert_eq!(
            title_bar_caption_label(TitleBarCaption::Close, false),
            "Close"
        );
        assert_eq!(
            title_bar_caption_label(TitleBarCaption::Maximize, false),
            "Maximize"
        );
        assert_eq!(
            title_bar_caption_label(TitleBarCaption::Maximize, true),
            "Restore"
        );
        // The glyph swaps with the same prop.
        assert_eq!(
            title_bar_caption_glyph(TitleBarCaption::Maximize, false),
            TITLE_BAR_MAXIMIZE_SVG
        );
        assert_eq!(
            title_bar_caption_glyph(TitleBarCaption::Maximize, true),
            TITLE_BAR_RESTORE_SVG
        );
        assert!(TITLE_BAR_RESTORE_SVG.contains("rx=\"2\""));
        assert!(TITLE_BAR_CLOSE_SVG.contains("M6 6l12 12M18 6L6 18"));
    }

    #[test]
    fn title_bar_root_classes_match_the_vue_markup() {
        assert_eq!(title_bar_root_classes(""), "hk-titlebar");
        assert_eq!(title_bar_root_classes("momoi"), "hk-titlebar momoi");
    }

    #[test]
    fn title_bar_render_contract() {
        let html = TitleBar(TitleBarProps {
            title: "App".to_string(),
            subtitle: "dev".to_string(),
            icon: "app.png".to_string(),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "class=\"hk-titlebar\"",
            "data-drag-region=\"true\"",
            "class=\"hk-titlebar-title\"",
            "class=\"hk-titlebar-icon\"",
            "src=\"app.png\"",
            "class=\"hk-titlebar-title-text\"",
            ">App<",
            "class=\"hk-titlebar-subtitle\"",
            ">dev<",
            "class=\"hk-titlebar-spacer\"",
            "class=\"hk-titlebar-actions\"",
            "hk-titlebar-btn-close",
            "title=\"Minimize\"",
            "title=\"Maximize\"",
            "title=\"Close\"",
            "display:contents",
            // The caption glyphs are the Vue source's 1.75-stroke drawings.
            "stroke-width=\"1.75\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Windowed: the presence marker is ABSENT (Vue: `|| undefined`).
        assert!(!html.contains("data-maximized"), "{html}");
        // Three caption buttons in render order.
        let minimize_at = html.find("title=\"Minimize\"").expect("minimize");
        let maximize_at = html.find("title=\"Maximize\"").expect("maximize");
        let close_at = html.find("title=\"Close\"").expect("close");
        assert!(minimize_at < maximize_at, "{html}");
        assert!(maximize_at < close_at, "{html}");
    }

    #[test]
    fn title_bar_marks_maximized_and_swaps_the_restore_caption() {
        let html = TitleBar(TitleBarProps {
            title: "App".to_string(),
            maximized: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("data-maximized=\"true\""), "{html}");
        assert!(html.contains("title=\"Restore\""), "{html}");
        assert!(!html.contains("title=\"Maximize\""), "{html}");
        // The restore glyph is the stacked pair, not the single square.
        assert!(html.contains("M8 8V5a2 2 0 0 1 2-2h11"), "{html}");
    }

    #[test]
    fn title_bar_renders_custom_actions_left_of_minimize() {
        let html = TitleBar(TitleBarProps {
            title: "App".to_string(),
            custom_actions: vec![
                TitleBarAction {
                    id: "pin".to_string(),
                    label: "Pin".to_string(),
                    icon: Some(rsx! {
                        span { class: "probe-pin", "" }
                    }),
                },
                TitleBarAction {
                    id: "sync".to_string(),
                    label: "Sync".to_string(),
                    icon: None,
                },
            ],
            actions: Some(rsx! {
                button { class: "probe-slot", "SLOT" }
            }),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains("title=\"Pin\""), "{html}");
        assert!(html.contains("title=\"Sync\""), "{html}");
        assert!(html.contains("probe-pin"), "{html}");
        assert!(html.contains("probe-slot"), "{html}");
        // Vue's order inside `.hk-titlebar-actions`: slot, custom actions,
        // then the three captions.
        let slot_at = html.find("probe-slot").expect("slot");
        let pin_at = html.find("title=\"Pin\"").expect("pin");
        let minimize_at = html.find("title=\"Minimize\"").expect("minimize");
        assert!(slot_at < pin_at, "{html}");
        assert!(pin_at < minimize_at, "{html}");
    }

    #[test]
    fn title_bar_left_slot_replaces_the_title_block() {
        let html = TitleBar(TitleBarProps {
            title: "App".to_string(),
            left: Some(rsx! {
                span { class: "probe-left", "LEFT" }
            }),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("probe-left"), "{html}");
        assert!(!html.contains("hk-titlebar-title"), "{html}");
        assert!(!html.contains("hk-titlebar-title-text"), "{html}");
    }

    #[test]
    fn title_bar_omits_the_subtitle_and_icon_when_empty() {
        let html = TitleBar(TitleBarProps {
            title: "App".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-titlebar-subtitle"), "{html}");
        assert!(!html.contains("hk-titlebar-icon"), "{html}");
        // The actions row itself is always present (it carries the captions),
        // exactly like Vue's `div.hk-titlebar-actions`.
        assert!(html.contains("class=\"hk-titlebar-actions\""), "{html}");
    }

    #[test]
    fn title_bar_escapes_consumer_text_on_both_sinks() {
        let html = TitleBar(TitleBarProps {
            title: "<b>t</b>".to_string(),
            custom_actions: vec![TitleBarAction {
                id: "pin".to_string(),
                // An attribute sink: `title` / `aria-label` escape quotes.
                label: "He said \"hi\"".to_string(),
                icon: None,
            }],
            ..Default::default()
        })
        .render_to_html();
        // Text sink: the title cannot smuggle markup through.
        assert!(!html.contains("<b>t</b>"), "{html}");
        assert!(html.contains("&lt;b&gt;t&lt;/b&gt;"), "{html}");
        // Attribute sink: the custom action's label is quote-escaped.
        assert!(html.contains("He said &quot;hi&quot;"), "{html}");
    }

    #[test]
    fn title_bar_styles_come_from_the_canonical_vue_sheet() {
        let css = TitleBarComponent::styles();
        assert!(
            css.contains(".hk-titlebar")
                && css.contains(".hk-titlebar-btn")
                && css.contains("data-maximized"),
            "title-bar css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored title-bar sheet"
        );
    }
}
