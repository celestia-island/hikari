// hi-components/src/layout/page_header.rs
// PageHeader — mirror of the canonical Vue `HkPageHeader`: the shared in-page
// shell header (big title + optional icon/subtitle on the left, a right-aligned
// tool row in the `actions` slot).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkPageHeader.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `scripts/sync-vue-mirror.py`'s W5
// `LAYOUT_SHEETS`), compiled with `no_hash` so the `.hk-page-header*` class
// names are literal and identical in both forms. DOM contract (mirrors the Vue
// render output one-to-one):
//
//   div.hk-page-header [.hk-page-header-dense] [+class]
//     div.hk-page-header-main
//       h1.hk-page-header-title
//         span.hk-page-header-lead?            (lead slot)
//         span.hk-page-header-icon?            (icon slot / icon prop)
//         span.hk-page-header-title-text       (title; title= tooltip — see [D])
//         span.hk-page-header-title-extra?     (titleExtra slot)
//       p.hk-page-header-subtitle?             (only for a non-empty subtitle)
//     div.hk-page-header-actions?              (only when the slot carries content)
//
// State: none. Vue reads its four slots (`lead` / `icon` / `titleExtra` /
// `actions`) and four props and stores nothing, so the mirror is a pure
// props→DOM function (no signal, no registry, no inline state).
//
// Deltas vs Vue (documented, not accidental):
//   * `icon` is a host `Element` (Vue takes a `Component` and calls `h()`):
//     tairitsu has no component-passing in props, so the host hands over the
//     already-built node, which lands in the SAME `span.hk-page-header-icon`
//     box (the sheet owns its 1.75rem tile and tone wash, not the glyph).
//   * `lead` / `title_extra` / `actions` are `Option<Element>` controlled
//     props instead of slots. An empty node (the `Element` default, an empty
//     fragment or blank text) counts as ABSENT, because a vnode cannot tell
//     "slot provided but empty" from "no slot": Vue's `slots.x &&` renders the
//     wrapper for a provided-but-empty slot, which no Rust host can express.
//   * [D] the title text span carries `title={title}` so a title the sheet
//     clips (`text-overflow: ellipsis; white-space: nowrap`) stays reachable.
//     Vue ships the ellipsis with no tooltip; the rule lives in
//     [`page_header_title_tooltip`] and is the component's only DOM delta.
//   * a host `class` is appended last (Vue merges the fallthrough class itself).
//   * `title` is Vue's required prop; `#[define_props]` makes every Rust field
//     total, so the mirror's `Default` is the empty string.
//
// No `dangerous_inner_html` host appears here: the component renders no SVG
// (the sheet paints the icon TILE, the host glyph is a node), so no consumer
// string ever bypasses tairitsu's escaper — the title/subtitle ride ordinary
// text nodes and the tooltip rides an escaped attribute.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct PageHeaderComponent;

// ── pure functions ───────────────────────────────────────────────────────

/// The root class list in Vue's order: the base class, the dense modifier,
/// then the host class.
pub fn page_header_root_classes(dense: bool, extra: &str) -> String {
    let mut classes = String::from("hk-page-header");
    if dense {
        classes.push_str(" hk-page-header-dense");
    }
    if !extra.is_empty() {
        classes.push(' ');
        classes.push_str(extra);
    }
    classes
}

/// Vue renders the subtitle paragraph only for a TRUTHY subtitle
/// (`props.subtitle && <p>`), so the empty string is "no subtitle" — not an
/// empty paragraph.
pub fn page_header_shows_subtitle(subtitle: Option<&str>) -> bool {
    matches!(subtitle, Some(text) if !text.is_empty())
}

/// The title ellipsis rule: the sheet clips `.hk-page-header-title-text`
/// (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`), so the
/// mirror names the FULL string on that span and a clipped title stays
/// reachable. A blank title has nothing to reach and emits no attribute
/// (`title=""` would render an empty native tooltip); everything else is
/// passed VERBATIM (Vue never trims the title, and neither does this).
pub fn page_header_title_tooltip(title: &str) -> Option<&str> {
    if title.trim().is_empty() {
        None
    } else {
        Some(title)
    }
}

/// True when a slot carries nothing to render (Vue tests `slots.x`).
/// tairitsu hands a slot over as a vnode, so the empty cases are the default
/// (empty fragment), `empty_vnode()` (blank text) and fragments of those.
fn slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct PageHeaderProps {
    /// The page title (`h1.hk-page-header-title`; Vue: required).
    #[default]
    pub title: String,

    /// Secondary line under the title (`p.hk-page-header-subtitle`).
    pub subtitle: Option<String>,

    /// Leading glyph node rendered inside `span.hk-page-header-icon`
    /// (Vue: the `icon` Component prop).
    pub icon: Option<Element>,

    /// Compact variant for dense pages (smaller title, tighter spacing).
    #[default]
    pub dense: bool,

    /// Extra class appended to the root.
    #[default]
    pub class: String,

    /// A back affordance (or any leading control) riding BEFORE the icon
    /// inside the `h1` box, keeping the heading semantics intact
    /// (Vue: the `lead` slot).
    pub lead: Option<Element>,

    /// Inline chips (status badges, mono ids) after the title text
    /// (Vue: the `titleExtra` slot).
    pub title_extra: Option<Element>,

    /// The right-aligned tool row (Vue: the `actions` slot). Pages own their
    /// actions; the top app bar carries identity/navigation only.
    pub actions: Option<Element>,
}

#[component]
pub fn PageHeader(props: PageHeaderProps) -> Element {
    let classes = page_header_root_classes(props.dense, &props.class);
    // `Option<&str>` → `Option<String>` for the attribute slot: `None` emits
    // no `title=` at all (an empty string would be a dead tooltip).
    let title_tooltip = page_header_title_tooltip(&props.title).map(str::to_string);
    let subtitle = props
        .subtitle
        .clone()
        .filter(|text| page_header_shows_subtitle(Some(text.as_str())));
    let actions = props.actions.clone().filter(|node| !slot_is_empty(node));

    rsx! {
        div { class: classes,
            div { class: "hk-page-header-main",
                h1 { class: "hk-page-header-title",
                    if let Some(lead) = &props.lead {
                        span { class: "hk-page-header-lead", {lead.clone()} }
                    }
                    if let Some(icon) = &props.icon {
                        span { class: "hk-page-header-icon", {icon.clone()} }
                    }
                    span {
                        class: "hk-page-header-title-text",
                        "title": title_tooltip,
                        "{props.title}"
                    }
                    if let Some(extra) = &props.title_extra {
                        span { class: "hk-page-header-title-extra", {extra.clone()} }
                    }
                }
                if let Some(subtitle) = &subtitle {
                    p { class: "hk-page-header-subtitle", "{subtitle}" }
                }
            }
            if let Some(actions) = &actions {
                div { class: "hk-page-header-actions", {actions.clone()} }
            }
        }
    }
}

impl StyledComponent for PageHeaderComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPageHeader.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "page-header"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_header_defaults_match_the_vue_props() {
        let props = PageHeaderProps::default();
        assert_eq!(props.title, "");
        assert!(props.subtitle.is_none());
        assert!(props.icon.is_none());
        assert!(!props.dense);
        assert_eq!(props.class, "");
        assert!(props.lead.is_none());
        assert!(props.title_extra.is_none());
        assert!(props.actions.is_none());
    }

    #[test]
    fn page_header_root_classes_match_the_vue_markup() {
        assert_eq!(page_header_root_classes(false, ""), "hk-page-header");
        assert_eq!(
            page_header_root_classes(true, ""),
            "hk-page-header hk-page-header-dense"
        );
        assert_eq!(
            page_header_root_classes(true, "admin-grid"),
            "hk-page-header hk-page-header-dense admin-grid"
        );
        // A host class without the dense variant still lands last.
        assert_eq!(
            page_header_root_classes(false, "admin-grid"),
            "hk-page-header admin-grid"
        );
    }

    #[test]
    fn page_header_title_tooltip_follows_the_ellipsis_rule() {
        // The sheet clips the span, so a real title is named on it.
        assert_eq!(page_header_title_tooltip("Channels"), Some("Channels"));
        assert_eq!(
            page_header_title_tooltip("A very long page title that the sheet ellipsizes"),
            Some("A very long page title that the sheet ellipsizes")
        );
        // Verbatim: Vue never trims the title, and neither does the mirror.
        assert_eq!(page_header_title_tooltip("  Padded  "), Some("  Padded  "));
        // Nothing to reach → no attribute (not `title=""`).
        assert_eq!(page_header_title_tooltip(""), None);
        assert_eq!(page_header_title_tooltip("   \t\n"), None);
    }

    #[test]
    fn page_header_subtitle_truthiness_matches_vue() {
        assert!(!page_header_shows_subtitle(None));
        assert!(!page_header_shows_subtitle(Some("")));
        assert!(page_header_shows_subtitle(Some("Manage agent runtimes")));
        // Vue's `props.subtitle &&` is string truthiness: whitespace renders.
        assert!(page_header_shows_subtitle(Some(" ")));
    }

    #[test]
    fn page_header_render_contract() {
        let html = PageHeader(PageHeaderProps {
            title: "Channels".to_string(),
            subtitle: Some("Manage channels".to_string()),
            dense: true,
            actions: Some(rsx! {
                button { class: "tool-mock", "TOOL" }
            }),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "class=\"hk-page-header hk-page-header-dense\"",
            "hk-page-header-main",
            "class=\"hk-page-header-title\"",
            "class=\"hk-page-header-title-text\"",
            // The ellipsis rule: the full title rides the span as a tooltip.
            "title=\"Channels\"",
            ">Channels<",
            "class=\"hk-page-header-subtitle\"",
            ">Manage channels<",
            "class=\"hk-page-header-actions\"",
            "tool-mock",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // No icon / lead / titleExtra was passed: those boxes never render.
        assert!(!html.contains("hk-page-header-icon"), "{html}");
        assert!(!html.contains("hk-page-header-lead"), "{html}");
        assert!(!html.contains("hk-page-header-title-extra"), "{html}");
    }

    #[test]
    fn page_header_omits_the_tool_row_and_subtitle_when_absent() {
        // An explicitly EMPTY slot is absent too (see the header delta).
        let html = PageHeader(PageHeaderProps {
            title: "System".to_string(),
            actions: Some(empty_vnode()),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-page-header-actions"), "{html}");
        assert!(!html.contains("hk-page-header-subtitle"), "{html}");
        assert!(!html.contains("hk-page-header-dense"), "{html}");
    }

    #[test]
    fn page_header_renders_slots_in_the_vue_order() {
        let html = PageHeader(PageHeaderProps {
            title: "T".to_string(),
            lead: Some(rsx! {
                button { class: "probe-back", "Back" }
            }),
            icon: Some(rsx! {
                span { class: "probe-icon", "" }
            }),
            title_extra: Some(rsx! {
                span { class: "probe-chip", "stable" }
            }),
            ..Default::default()
        })
        .render_to_html();

        let lead_at = html.find("hk-page-header-lead").expect("lead box");
        let icon_at = html.find("hk-page-header-icon").expect("icon box");
        let text_at = html.find("hk-page-header-title-text").expect("title text");
        let extra_at = html
            .find("hk-page-header-title-extra")
            .expect("title extra");
        assert!(lead_at < icon_at, "{html}");
        assert!(icon_at < text_at, "{html}");
        assert!(text_at < extra_at, "{html}");
    }

    #[test]
    fn page_header_escapes_consumer_text_on_both_sinks() {
        // The title rides a text node AND the tooltip attribute; neither may
        // smuggle markup through.
        let html = PageHeader(PageHeaderProps {
            title: "<b>bold</b>".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("<b>bold</b>"), "{html}");
        assert!(html.contains("&lt;b&gt;bold&lt;/b&gt;"), "{html}");
        assert!(html.contains("title=\"&lt;b&gt;bold&lt;/b&gt;\""), "{html}");
    }

    #[test]
    fn page_header_styles_come_from_the_canonical_vue_sheet() {
        let css = PageHeaderComponent::styles();
        assert!(
            css.contains(".hk-page-header")
                && css.contains(".hk-page-header-title-text")
                && css.contains(".hk-page-header-dense"),
            "page-header css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored page-header sheet"
        );
    }
}
