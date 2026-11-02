// hi-components/src/display/step_guide.rs
// StepGuide — mirror of the canonical Vue `HkStepGuide`: the big-artwork
// illustrated step cards ("what do I physically do now?" — every step a
// rounded card, the ordinal pinned to the card's outer top corner).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkStepGuide.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-step-guide*` class names are literal and identical in both forms.
// The sheet is a container-query root: wide hosts lay the cards side by
// side with a chevron (a pure-CSS `::after`) bridging consecutive steps,
// narrow ones stack them; `layout="grid"` wraps the cards as an auto-fill
// grid. All of that is CSS — the mirror only has to emit the same DOM.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   div.hk-step-guide [data-layout={list|grid}]     (nothing when `items`
//     h4.hk-step-guide-title?                        is empty — Vue's null)
//     ol.hk-step-guide-list
//       li.hk-step-guide-item [data-done]           (per item, in order)
//         span.hk-step-guide-ordinal
//           ── done ── the check <svg> markup        (see the SVG rule)
//           ── else ─ the 1-based ordinal text
//         span.hk-step-guide-art [aria-hidden?]     (hidden only when the
//           {icon}                                   step carries NO artwork)
//           ── else ── img.hk-step-guide-art-img     (src, alt, draggable)
//         span.hk-step-guide-body
//           span.hk-step-guide-item-title {title}
//           span.hk-step-guide-item-desc?           (JS truthiness: an
//                                                    empty description
//                                                    renders nothing)
//
// SVG rule (ledger L49): inline `<svg>` children are TRUSTED STATIC
// MARKUP through `dangerous_inner_html` — an `rsx!` `svg {}` child lands
// in the HTML namespace in this host stack and would never paint. The
// done-check therefore rides the ordinal span's `dangerous_inner_html`
// (the ordinal carries either the glyph or its text, never both, so no
// children are suppressed); the markup is byte-identical to the Vue `<svg>`
// down to the attribute order.
//
// Deltas vs Vue (documented, not accidental):
//   * `icon` is an `Element` slot, not a loose component. Vue mounts
//     `h(item.icon, { class: "hk-step-guide-art-svg" })`; a prebuilt vnode
//     cannot take an injected class, so a host that wants the sheet's 68%
//     artwork sizing builds its glyph with that class itself (the crate's
//     `Icon`/inner-html hosts are the intended shapes). The
//     `.hk-step-guide-art-svg` hook stays pure CSS — the mirror adds no
//     wrapper box Vue does not ship.
//   * `alt` is Rust-side `Option<String>` where Vue's is
//     `string | undefined` — same nullish semantics (`??` keeps an empty
//     string; only `None` falls back to the title).
//   * No deltas in behaviour: the component is stateless in Vue, so the
//     mirror is a 1:1 port.
//
// No i18n keys: the section heading and every caption arrive as data
// (`title` prop / `StepGuideItem` fields), exactly like Vue.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct StepGuideComponent;

/// The done-check glyph (Vue's inline `<svg>`), serialized exactly as Vue
/// renders it and mounted through `dangerous_inner_html` — see the header.
pub const STEP_GUIDE_CHECK_SVG: &str = r#"<svg class="hk-step-guide-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg>"#;

/// Vue's `layout` prop: width-responsive flow cards (the default) or an
/// auto-fill card grid.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum StepGuideLayout {
    #[default]
    List,
    Grid,
}

impl StepGuideLayout {
    /// The `data-layout` value exactly as Vue emits it.
    pub fn attr(self) -> &'static str {
        match self {
            StepGuideLayout::List => "list",
            StepGuideLayout::Grid => "grid",
        }
    }
}

/// One illustrated step (Vue: `StepGuideItem`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct StepGuideItem {
    /// Stable key (also the list rendering key in Vue).
    pub id: String,

    /// Short imperative title ("插入 SD 卡").
    pub title: String,

    /// One-line elaboration under the title. JS truthiness: an EMPTY
    /// string renders no description span at all.
    pub description: Option<String>,

    /// The step's own artwork as a prebuilt vnode (Vue: a component; see
    /// the header delta). Wins over `image`.
    pub icon: Option<Element>,

    /// Bitmap/photo URL for the artwork (`icon` wins when both are given).
    pub image: Option<String>,

    /// Accessible name for the bitmap (`alt ?? title`).
    pub alt: Option<String>,
}

impl StepGuideItem {
    /// A titled step with no artwork — the minimal Vue item.
    pub fn new(id: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            ..Default::default()
        }
    }
}

/// Vue's `doneIds` membership test (`done.has(item.id)`).
pub fn step_guide_is_done(done_ids: &[String], id: &str) -> bool {
    done_ids.iter().any(|done| done == id)
}

/// Vue's truthiness gates on the two optional artwork sources: an
/// `image` of `""` renders nothing (same for a missing icon).
pub fn step_guide_has_image(image: Option<&str>) -> bool {
    image.is_some_and(|url| !url.is_empty())
}

/// Vue's `item.description && …`: an empty string is falsy, so the
/// description span only exists for a NON-empty one.
pub fn step_guide_has_description(description: Option<&str>) -> bool {
    description.is_some_and(|text| !text.is_empty())
}

/// Vue's `aria-hidden={Art || item.image ? undefined : true}`: the art box
/// is decorative EXACTLY when it is empty (artwork would carry meaning —
/// the bitmap's `alt`, or the SVG's own semantics).
pub fn step_guide_art_hidden(has_artwork: bool) -> Option<&'static str> {
    if has_artwork { None } else { Some("true") }
}

/// Vue's `const alt = item.alt ?? item.title` — nullish fallback only, so
/// an explicitly empty `alt` stays empty.
pub fn step_guide_art_alt<'a>(alt: Option<&'a str>, title: &'a str) -> &'a str {
    alt.unwrap_or(title)
}

/// The `data-done` presence marker (`isDone || undefined`).
pub fn step_guide_done_attr(done: bool) -> Option<&'static str> {
    if done { Some("true") } else { None }
}

/// One step card (Vue's `<li>` block).
fn step_guide_item_node(item: &StepGuideItem, index: usize, done_ids: &[String]) -> VNode {
    let is_done = step_guide_is_done(done_ids, &item.id);
    let has_artwork = item.icon.is_some() || step_guide_has_image(item.image.as_deref());

    let mut li = VElement::new("li").class("hk-step-guide-item");
    if let Some(marker) = step_guide_done_attr(is_done) {
        li = li.attr("data-done", marker);
    }

    // The ordinal: the check glyph replaces the number on a done step.
    let ordinal = if is_done {
        VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-step-guide-ordinal")
                .dangerous_inner_html(STEP_GUIDE_CHECK_SVG),
        ))
    } else {
        VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-step-guide-ordinal")
                .child(VNode::Text(VText::new(&(index + 1).to_string()))),
        ))
    };
    li = li.child(ordinal);

    // The artwork, large and bare on the card face.
    let mut art = VElement::new("span").class("hk-step-guide-art");
    if let Some(hidden) = step_guide_art_hidden(has_artwork) {
        art = art.attr("aria-hidden", hidden);
    }
    if let Some(icon) = &item.icon {
        art = art.child(icon.clone());
    } else if step_guide_has_image(item.image.as_deref()) {
        art = art.child(VNode::Element(Box::new(
            VElement::new("img")
                .class("hk-step-guide-art-img")
                .attr("src", item.image.clone().unwrap_or_default())
                .attr("alt", step_guide_art_alt(item.alt.as_deref(), &item.title))
                .attr("draggable", "false"),
        )));
    }
    li = li.child(VNode::Element(Box::new(art)));

    // The caption beneath.
    let mut body = VElement::new("span").class("hk-step-guide-body");
    body = body.child(VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-step-guide-item-title")
            .child(VNode::Text(VText::new(item.title.as_str()))),
    )));
    if step_guide_has_description(item.description.as_deref()) {
        body = body.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-step-guide-item-desc")
                .child(VNode::Text(VText::new(
                    item.description.clone().unwrap().as_str(),
                ))),
        )));
    }
    li = li.child(VNode::Element(Box::new(body)));

    VNode::Element(Box::new(li))
}

#[define_props]
pub struct StepGuideProps {
    /// The steps in render order (Vue: `items`, required there; the Rust
    /// default renders NOTHING, exactly like Vue's empty-array `null`).
    #[default]
    pub items: Vec<StepGuideItem>,

    /// Steps whose ids appear here render as completed (check, success
    /// edge) so the guide doubles as a checklist.
    #[default]
    pub done_ids: Vec<String>,

    /// Width-responsive flow cards (default) or an auto-fill card grid.
    #[default]
    pub layout: StepGuideLayout,

    /// Section heading above the steps.
    pub title: Option<String>,
}

#[component]
pub fn StepGuide(props: StepGuideProps) -> Element {
    // Vue: `if (!props.items.length) return null;` — no guide at all.
    if props.items.is_empty() {
        return empty_vnode();
    }

    let mut list = VElement::new("ol").class("hk-step-guide-list");
    for (index, item) in props.items.iter().enumerate() {
        list = list.child(step_guide_item_node(item, index, &props.done_ids));
    }

    let mut root = VElement::new("div")
        .class("hk-step-guide")
        .attr("data-layout", props.layout.attr());
    if let Some(title) = &props.title {
        // Vue's `props.title &&` guard: an empty heading renders none.
        if !title.is_empty() {
            root = root.child(VNode::Element(Box::new(
                VElement::new("h4")
                    .class("hk-step-guide-title")
                    .child(VNode::Text(VText::new(&title.clone()))),
            )));
        }
    }
    root = root.child(VNode::Element(Box::new(list)));
    VNode::Element(Box::new(root))
}

impl StyledComponent for StepGuideComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-step-guide*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkStepGuide.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "step-guide"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn step_guide_defaults_match_the_vue_props() {
        let props = StepGuideProps::default();
        assert!(props.items.is_empty());
        assert!(props.done_ids.is_empty());
        assert_eq!(props.layout, StepGuideLayout::List);
        assert!(props.title.is_none());

        let item = StepGuideItem::default();
        assert_eq!(item.id, "");
        assert_eq!(item.title, "");
        assert!(item.description.is_none());
        assert!(item.icon.is_none());
        assert!(item.image.is_none());
        assert!(item.alt.is_none());

        let item = StepGuideItem::new("insert", "插入 SD 卡");
        assert_eq!(item.id, "insert");
        assert_eq!(item.title, "插入 SD 卡");
        assert!(item.icon.is_none() && item.image.is_none());
    }

    #[test]
    fn step_guide_class_names_and_layout_attrs_match_the_vue_sheet() {
        assert_eq!(StepGuideLayout::List.attr(), "list");
        assert_eq!(StepGuideLayout::Grid.attr(), "grid");
        assert_eq!(
            STEP_GUIDE_CHECK_SVG,
            r#"<svg class="hk-step-guide-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg>"#
        );
    }

    #[test]
    fn step_guide_truthiness_gates_follow_vue() {
        let done = vec!["a".to_string(), "c".to_string()];
        assert!(step_guide_is_done(&done, "a"));
        assert!(!step_guide_is_done(&done, "b"));
        assert!(!step_guide_is_done(&[], ""));
        // Empty strings are falsy in Vue's guards.
        assert!(!step_guide_has_image(Some("")));
        assert!(step_guide_has_image(Some("/img.png")));
        assert!(!step_guide_has_image(None));
        assert!(!step_guide_has_description(Some("")));
        assert!(step_guide_has_description(Some("Push it in")));
        assert!(!step_guide_has_description(None));
        // The art box hides only when it carries nothing at all.
        assert_eq!(step_guide_art_hidden(true), None);
        assert_eq!(step_guide_art_hidden(false), Some("true"));
        // `alt ?? title` keeps an explicit empty alt.
        assert_eq!(step_guide_art_alt(Some("A card"), "T"), "A card");
        assert_eq!(step_guide_art_alt(Some(""), "T"), "");
        assert_eq!(step_guide_art_alt(None, "T"), "T");
        // `data-done` is presence-only.
        assert_eq!(step_guide_done_attr(true), Some("true"));
        assert_eq!(step_guide_done_attr(false), None);
    }

    #[test]
    fn step_guide_renders_the_vue_card_contract() {
        let html = StepGuide(StepGuideProps {
            title: Some("Setup".to_string()),
            items: vec![
                StepGuideItem {
                    description: Some("Push until it clicks".to_string()),
                    ..StepGuideItem::new("insert", "插入 SD 卡")
                },
                StepGuideItem {
                    image: Some("/photos/step-2.png".to_string()),
                    alt: Some("The slot from above".to_string()),
                    ..StepGuideItem::new("power", "接通电源")
                },
                StepGuideItem {
                    icon: Some(rsx! { span { class: "host-glyph" } }),
                    ..StepGuideItem::new("watch", "观察指示灯")
                },
                StepGuideItem::new("wait", "等待上线"),
            ],
            done_ids: vec!["insert".to_string()],
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-step-guide""#,
            r#"data-layout="list""#,
            r#"class="hk-step-guide-title""#,
            "Setup",
            r#"<h4"#,
            r#"class="hk-step-guide-list""#,
            r#"class="hk-step-guide-item""#,
            r#"data-done="true""#,
            r#"class="hk-step-guide-check""#,
            r#"class="hk-step-guide-ordinal""#,
            ">2</span>",
            ">3</span>",
            ">4</span>",
            r#"class="hk-step-guide-art""#,
            r#"class="hk-step-guide-art-img""#,
            r#"src="/photos/step-2.png""#,
            r#"alt="The slot from above""#,
            r#"draggable="false""#,
            r#"class="host-glyph""#,
            r#"class="hk-step-guide-body""#,
            r#"class="hk-step-guide-item-title""#,
            "插入 SD 卡",
            r#"class="hk-step-guide-item-desc""#,
            "Push until it clicks",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Only the first step is done: one marker, one check glyph, and
        // its ordinal renders the glyph INSTEAD of the number 1.
        assert_eq!(html.matches("data-done").count(), 1, "{html}");
        assert!(html.contains("hk-step-guide-check"), "{html}");
        assert!(!html.contains(">1</span>"), "{html}");
        // Steps without a description render no desc span (2 of 4 have
        // none); the artwork-less step hides its empty art box.
        assert_eq!(html.matches("hk-step-guide-item-desc").count(), 1, "{html}");
        assert!(html.contains(r#"aria-hidden="true""#), "{html}");
    }

    #[test]
    fn step_guide_grid_layout_and_empty_items_render_vue_shapes() {
        let grid = StepGuide(StepGuideProps {
            items: vec![StepGuideItem::new("only", "一步")],
            layout: StepGuideLayout::Grid,
            ..Default::default()
        })
        .render_to_html();
        assert!(grid.contains(r#"data-layout="grid""#), "{grid}");
        // No title prop → no heading at all.
        assert!(!grid.contains("hk-step-guide-title"), "{grid}");

        // Vue returns null for an empty guide.
        let empty = StepGuide(StepGuideProps::default()).render_to_html();
        assert!(!empty.contains("hk-step-guide"), "{empty}");
    }

    #[test]
    fn step_guide_styles_come_from_the_canonical_vue_sheet() {
        let css = StepGuideComponent::styles();
        for needle in [
            ".hk-step-guide",
            ".hk-step-guide-title",
            ".hk-step-guide-list",
            ".hk-step-guide-item",
            ".hk-step-guide-ordinal",
            ".hk-step-guide-check",
            ".hk-step-guide-art",
            ".hk-step-guide-art-svg",
            ".hk-step-guide-art-img",
            ".hk-step-guide-item-title",
            ".hk-step-guide-item-desc",
        ] {
            assert!(
                css.contains(needle),
                "step-guide css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored step-guide sheet"
        );
        assert_eq!(StepGuideComponent::name(), "step-guide");
    }
}
