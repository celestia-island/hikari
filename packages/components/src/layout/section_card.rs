// hi-components/src/layout/section_card.rs
// SectionCard — mirror of the canonical Vue `HkSectionCard`: the standard
// titled SECTION (a heading, an optional hint line, above ONE card that
// carries the body) — the section-level twin of the page-level scaffold
// (`HkAdminTablePage`, mirrored in `layout/admin_table_page.rs`).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSectionCard.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`. It owns exactly two
// classes — the section's heading→body rhythm (`.hk-section-card`) and the
// trailing footnote slot (`.hk-section-card-footer`); everything between
// them is the composed primitives' own chrome.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   section.hk-section-card
//     div.hk-section-header.hk-section-header-default [.hk-section-header-dense]
//       div.hk-section-header-row
//         span.hk-section-header-icon?               {icon slot}
//         {h2|h3|div}.hk-section-header-title {title}
//           span.hk-section-header-count?            {count}
//         div.hk-section-header-actions?            {actions slot}
//       p.hk-section-header-description?            {hint | description slot}
//     div.hk-card [.hk-card-body-unpadded]          (mirrored Card)
//       ── error ──   the mirrored Alert (message = error)
//       ── loading ── the mirrored Spinner, centered
//       ── body ──    {children}
//     div.hk-section-card-footer?                   {footer slot}
//
// STATE CONTRACT (the crate's zero-signal rule): Vue keeps NO local state
// here — `error`, `loading` and the draft-free body all arrive as props,
// so the mirror is a pure function of them. The state PICK itself is
// exported ([`section_card_state`]): `error` wins when set (Vue's
// truthiness — an EMPTY string is falsy and renders the body), `loading`
// replaces the body whenever it is true (the documented difference from
// the scaffold, which keeps populated rows through a refresh), and both
// states ride a PADDED card (a state is content, not a table) while the
// normal body honours `padded` (default false: tables carry their own cell
// padding and sit flush).
//
// Deltas vs Vue (documented, not accidental):
//   * `HkSectionHeader` IS NOT MIRRORED and its sheet is not part of the
//     vendored set, so the header renders here as DOM HOOKS — the same
//     `hk-section-header*` class names Vue's header emits (spelled once
//     above), styled by whichever surface ships that sheet. The
//     `variant` slot of the header stays at Vue's `default` (HkSectionCard
//     exposes no variant prop), and `h(icon, { size: 15 })` cannot inject
//     a size into a prebuilt vnode — the host builds its glyph at 15
//     units, the size the header passes.
//   * `icon`, `actions`, `description` and `footer` are `Element` slots
//     (Vue: a component / render slots); the `description` slot renders
//     only when the `hint` PROP is unset, exactly like Vue's prop-first
//     fallback.
//   * `level` is an enum ([`SectionHeadingLevel`]) — Vue's `"h2"|"h3"|
//     "div"` union, default `h3`.
//
// No i18n keys: title, hint, count and the error text arrive as props
// (Vue's own defaults are `required` / undefined).

use crate::basic::{Card, CardProps};
use crate::feedback::{Alert, AlertProps, Spinner, SpinnerProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SectionCardComponent;

/// Which branch the card body renders (Vue's inline `state` ternary:
/// `props.error ? "error" : props.loading ? "loading" : "body"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SectionCardState {
    Error,
    Loading,
    #[default]
    Body,
}

/// Vue's state ternary. `error` follows JavaScript truthiness: `None` AND
/// an empty string both render the body (an empty alert would be noise).
pub fn section_card_state(error: Option<&str>, loading: bool) -> SectionCardState {
    if error.is_some_and(|text| !text.is_empty()) {
        SectionCardState::Error
    } else if loading {
        SectionCardState::Loading
    } else {
        SectionCardState::Body
    }
}

/// Vue's `padded={state === "body" ? props.padded : true}`: a state is
/// content, not a table — both standing states ride a padded card.
pub fn section_card_body_padded(state: SectionCardState, padded: bool) -> bool {
    match state {
        SectionCardState::Body => padded,
        _ => true,
    }
}

/// The heading element (Vue: the `level` prop union, default `h3`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SectionHeadingLevel {
    H2,
    #[default]
    H3,
    Div,
}

impl SectionHeadingLevel {
    /// The tag exactly as Vue renders it.
    pub fn tag(self) -> &'static str {
        match self {
            SectionHeadingLevel::H2 => "h2",
            SectionHeadingLevel::H3 => "h3",
            SectionHeadingLevel::Div => "div",
        }
    }
}

/// The header block's class string (Vue: `["hk-section-header",
/// "hk-section-header-default", dense && "hk-section-header-dense"]` — the
/// variant is always the default because HkSectionCard passes none).
pub fn section_card_header_classes(dense: bool) -> String {
    if dense {
        "hk-section-header hk-section-header-default hk-section-header-dense".to_string()
    } else {
        "hk-section-header hk-section-header-default".to_string()
    }
}

/// The heading block: `{level}.hk-section-header-title` with the optional
/// trailing count badge.
fn section_card_heading(title: &str, count: Option<&str>, level: SectionHeadingLevel) -> VNode {
    let mut heading = VElement::new(level.tag()).class("hk-section-header-title");
    heading = heading.child(VNode::Text(VText::new(title)));
    // Vue: `props.count != null` — presence, not truthiness (an empty
    // count renders an empty badge).
    if let Some(count) = count {
        heading = heading.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-section-header-count")
                .child(VNode::Text(VText::new(count))),
        )));
    }
    VNode::Element(Box::new(heading))
}

/// The whole header block (the un-mirrored `HkSectionHeader`, as DOM
/// hooks — see the file header).
fn section_card_header(props: &SectionCardProps) -> VNode {
    let mut row = VElement::new("div").class("hk-section-header-row");
    if let Some(icon) = &props.icon {
        row = row.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-section-header-icon")
                .child(icon.clone()),
        )));
    }
    row = row.child(section_card_heading(
        &props.title,
        props.count.as_deref(),
        props.level,
    ));
    if let Some(actions) = &props.actions {
        row = row.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-section-header-actions")
                .child(actions.clone()),
        )));
    }

    let mut header = VElement::new("div").class(section_card_header_classes(props.dense));
    header = header.child(VNode::Element(Box::new(row)));
    // The hint PROP wins; the description SLOT is the fallback (Vue's
    // HkSectionHeader renders `props.description` before its slot).
    if let Some(hint) = props.hint.as_deref() {
        header = header.child(VNode::Element(Box::new(
            VElement::new("p")
                .class("hk-section-header-description")
                .child(VNode::Text(VText::new(hint))),
        )));
    } else if let Some(description) = &props.description {
        header = header.child(VNode::Element(Box::new(
            VElement::new("p")
                .class("hk-section-header-description")
                .child(description.clone()),
        )));
    }
    VNode::Element(Box::new(header))
}

#[define_props]
pub struct SectionCardProps {
    /// Section heading (Vue: required; the Rust default is the empty
    /// title, which still renders the heading element).
    pub title: String,

    /// Explanatory line under the heading — the standard place for the
    /// "what this list is for" copy.
    pub hint: Option<String>,

    /// Leading glyph slot (Vue: a component HkSectionHeader mounts at
    /// size 15; see the header delta).
    pub icon: Option<Element>,

    /// Heading element: h2 / h3 (default) / div.
    #[default]
    pub level: SectionHeadingLevel,

    /// Trailing count beside the title (e.g. "3").
    pub count: Option<String>,

    /// Tighter header spacing for dense panels.
    pub dense: bool,

    /// Hard failure: replaces the body with an alert (empty string = no
    /// error, Vue truthiness).
    pub error: Option<String>,

    /// In-flight: replaces the body with a centred spinner — pass it for
    /// the FIRST load, not every refetch, or it blanks a table the user
    /// is reading (the documented difference from the scaffold).
    pub loading: bool,

    /// Body padding for non-table content (tables stay flush).
    pub padded: bool,

    /// Right-aligned cluster beside the title (Vue: the header's
    /// `actions` slot).
    pub actions: Option<Element>,

    /// Description fallback when `hint` is unset (Vue: the header's
    /// `description` slot).
    pub description: Option<Element>,

    /// Trailing notes under the card (placeholder grammars, "what this
    /// list feeds" details) with the same rhythm.
    pub footer: Option<Element>,

    /// The section body (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn SectionCard(props: SectionCardProps) -> Element {
    let state = section_card_state(props.error.as_deref(), props.loading);

    let body = match state {
        SectionCardState::Error => Alert(AlertProps {
            message: props.error.clone().unwrap_or_default(),
            ..Default::default()
        }),
        SectionCardState::Loading => Spinner(SpinnerProps {
            center: true,
            ..Default::default()
        }),
        SectionCardState::Body => props.children.clone(),
    };

    let card = Card(CardProps {
        padded: section_card_body_padded(state, props.padded),
        children: body,
        ..Default::default()
    });

    let mut section = VElement::new("section").class("hk-section-card");
    section = section.child(section_card_header(&props));
    section = section.child(card);
    if let Some(footer) = &props.footer {
        section = section.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-section-card-footer")
                .child(footer.clone()),
        )));
    }
    VNode::Element(Box::new(section))
}

impl StyledComponent for SectionCardComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-section-card*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSectionCard.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "section-card"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn section_card_defaults_match_the_vue_props() {
        let props = SectionCardProps::default();
        assert_eq!(props.title, "");
        assert!(props.hint.is_none());
        assert!(props.icon.is_none());
        assert_eq!(props.level, SectionHeadingLevel::H3);
        assert!(props.count.is_none());
        assert!(!props.dense);
        assert!(props.error.is_none());
        assert!(!props.loading);
        // Vue default false: tables carry their own cell padding.
        assert!(!props.padded);
        assert!(props.actions.is_none());
        assert!(props.description.is_none());
        assert!(props.footer.is_none());
    }

    #[test]
    fn section_card_class_names_and_levels_match_the_vue_side() {
        assert_eq!(
            section_card_header_classes(false),
            "hk-section-header hk-section-header-default"
        );
        assert_eq!(
            section_card_header_classes(true),
            "hk-section-header hk-section-header-default hk-section-header-dense"
        );
        assert_eq!(SectionHeadingLevel::H2.tag(), "h2");
        assert_eq!(SectionHeadingLevel::H3.tag(), "h3");
        assert_eq!(SectionHeadingLevel::Div.tag(), "div");
    }

    #[test]
    fn section_card_state_picks_error_over_loading_with_vue_truthiness() {
        use SectionCardState::{Body, Error, Loading};
        assert_eq!(section_card_state(None, false), Body);
        assert_eq!(section_card_state(Some(""), true), Loading);
        assert_eq!(section_card_state(Some(""), false), Body);
        assert_eq!(section_card_state(Some("boom"), true), Error);
        assert_eq!(section_card_state(Some("boom"), false), Error);
        assert_eq!(section_card_state(None, true), Loading);
        // Standing states always ride a PADDED card; only the body honours
        // the caller's `padded`.
        assert!(!section_card_body_padded(Body, false));
        assert!(section_card_body_padded(Body, true));
        assert!(section_card_body_padded(Error, false));
        assert!(section_card_body_padded(Loading, false));
    }

    #[test]
    fn section_card_renders_the_body_contract_with_a_flush_card() {
        let html = SectionCard(SectionCardProps {
            title: "Members".to_string(),
            hint: Some("Who can sign in".to_string()),
            count: Some("3".to_string()),
            children: rsx! { table { class: "hk-table" } },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"<section"#,
            r#"class="hk-section-card""#,
            r#"class="hk-section-header hk-section-header-default""#,
            r#"class="hk-section-header-row""#,
            r#"class="hk-section-header-title""#,
            "Members",
            r#"class="hk-section-header-count""#,
            ">3</span>",
            r#"class="hk-section-header-description""#,
            "Who can sign in",
            r#"class="hk-card""#,
            // The default body is FLUSH (tables carry their own padding).
            "hk-card-body-unpadded",
            r#"class="hk-table""#,
            r#"<h3"#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // No state, no footer, no icon, no actions: none of those boxes.
        assert!(!html.contains("hk-alert"), "{html}");
        assert!(!html.contains("hk-spinner"), "{html}");
        assert!(!html.contains("hk-section-card-footer"), "{html}");
        assert!(!html.contains("hk-section-header-icon"), "{html}");
        assert!(!html.contains("hk-section-header-actions"), "{html}");
        assert!(!html.contains("hk-section-header-dense"), "{html}");
    }

    #[test]
    fn section_card_error_and_loading_replace_the_body_on_a_padded_card() {
        let error = SectionCard(SectionCardProps {
            title: "T".to_string(),
            error: Some("fetch failed".to_string()),
            // `error` wins when both are set, as on the scaffold.
            loading: true,
            children: rsx! { p { "rows" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(error.contains("hk-alert"), "{error}");
        assert!(error.contains("fetch failed"), "{error}");
        assert!(!error.contains("hk-spinner"), "{error}");
        assert!(!error.contains(">rows<"), "{error}");
        // A state is content, not a table: the card pads it.
        assert!(!error.contains("hk-card-body-unpadded"), "{error}");

        let loading = SectionCard(SectionCardProps {
            title: "T".to_string(),
            loading: true,
            children: rsx! { p { "rows" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(loading.contains("hk-spinner"), "{loading}");
        assert!(!loading.contains("hk-alert"), "{loading}");
        assert!(!loading.contains("hk-card-body-unpadded"), "{loading}");
    }

    #[test]
    fn section_card_renders_the_header_slots_level_and_footer() {
        let html = SectionCard(SectionCardProps {
            title: "Tokens".to_string(),
            level: SectionHeadingLevel::H2,
            dense: true,
            icon: Some(rsx! { span { class: "host-icon" } }),
            actions: Some(rsx! { button { class: "host-export" } }),
            description: Some(rsx! { em { "slot description" } }),
            footer: Some(rsx! { p { "note" } }),
            padded: true,
            children: rsx! { p { "body" } },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"<h2"#,
            "hk-section-header-dense",
            r#"class="hk-section-header-icon""#,
            r#"class="host-icon""#,
            r#"class="hk-section-header-actions""#,
            r#"class="host-export""#,
            // The description SLOT renders only when the hint prop is unset.
            r#"class="hk-section-header-description""#,
            "slot description",
            r#"class="hk-section-card-footer""#,
            "note",
            // padded body keeps the padded card face.
            "body",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("hk-card-body-unpadded"), "{html}");
    }

    #[test]
    fn section_card_hint_prop_wins_over_the_description_slot() {
        let html = SectionCard(SectionCardProps {
            title: "T".to_string(),
            hint: Some("the hint".to_string()),
            description: Some(rsx! { em { "the slot" } }),
            children: rsx! { p { "body" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("the hint"), "{html}");
        assert!(!html.contains("the slot"), "{html}");
        // Exactly one description line.
        assert_eq!(
            html.matches("hk-section-header-description").count(),
            1,
            "{html}"
        );
    }

    #[test]
    fn section_card_styles_come_from_the_canonical_vue_sheet() {
        let css = SectionCardComponent::styles();
        for needle in [".hk-section-card", ".hk-section-card-footer"] {
            assert!(
                css.contains(needle),
                "section-card css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored section-card sheet"
        );
        assert_eq!(SectionCardComponent::name(), "section-card");
    }
}
