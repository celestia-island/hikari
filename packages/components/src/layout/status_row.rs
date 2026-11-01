// packages/components/src/layout/status_row.rs
// StatusRow — mirror of the canonical Vue `HkStatusRow` (the family's
// standard "a thing and its state" card row).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkStatusRow.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so every
// `.hk-status-row*` class name is literal and identical in both forms.
// The anatomy is deliberately fixed (task-3 D, user ruling 2026-10-23): a
// 3px state RAIL on the left edge, an icon CHIP, TITLE + STATUS stacked in
// the body, and an optional trailing ACTION.
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   div.hk-status-row.hk-status-row--{tone}[.hk-status-row--absent] [+host class]
//     span.hk-status-row__chip            (ALWAYS rendered — the rail anchors here)
//       {icon slot}
//     div.hk-status-row__body
//       span.hk-status-row__title         ({title})
//       span.hk-status-row__status?       (only when `status` is non-empty)
//       {extra slot}
//     div.hk-status-row__action?          (only when the action slot yielded)
//       {action slot}
//
// Vue prop mapping: `tone` → [`StatusRowTone`] (the five values Vue's
// `validator` accepts, default `neutral`), `title` / `status` / `absent`
// one-to-one, and the `icon` / `extra` / `action` slots → the `Option<Element>`
// props of the same names. `tone` is the row's ONLY state axis: hosts map
// their domain states onto a tone and the row never guesses.
//
// State contract: the row is STATELESS. Every visual channel comes from
// `tone` / `absent` through pure CSS over the two classes (rail, border and
// chip wash are selector-driven), so there is no local state, no
// thread-local registry and no DOM write — the tairitsu 0.5.22 `use_signal` /
// `use_state` limits (ledger L48) never come into play.
//
// Deltas vs Vue (documented, not accidental):
//   * `class` is an explicit prop appended AFTER the tone/absent classes —
//     Vue reaches the same string through attribute fallthrough onto the root
//     `<div>`.
//   * The three slots become `Option<Element>` props (tairitsu exposes one
//     children channel per element). Vue gates the action wrapper on
//     `slots.action?.()` yielding something; the mirror gates it on the prop
//     being present — the same question asked of the host.
//   * No `{...attrs}` passthrough: `class` is the only host attribute Vue's
//     row actually reads, so the other passthrough cases stay unsupported.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct StatusRowComponent;

/// The five tones (Vue: `HkStatusRowTone`, default `neutral`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StatusRowTone {
    #[default]
    Neutral,
    Info,
    Success,
    Warning,
    Error,
}

impl StatusRowTone {
    /// The tone token exactly as Vue declares it.
    pub fn name(self) -> &'static str {
        match self {
            StatusRowTone::Neutral => "neutral",
            StatusRowTone::Info => "info",
            StatusRowTone::Success => "success",
            StatusRowTone::Warning => "warning",
            StatusRowTone::Error => "error",
        }
    }

    /// The `hk-status-row--{tone}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            StatusRowTone::Neutral => "hk-status-row--neutral",
            StatusRowTone::Info => "hk-status-row--info",
            StatusRowTone::Success => "hk-status-row--success",
            StatusRowTone::Warning => "hk-status-row--warning",
            StatusRowTone::Error => "hk-status-row--error",
        }
    }

    /// Vue's `validator`: the five legal strings, everything else rejected
    /// (including palette neighbours like `danger` / `primary`).
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "neutral" => Some(StatusRowTone::Neutral),
            "info" => Some(StatusRowTone::Info),
            "success" => Some(StatusRowTone::Success),
            "warning" => Some(StatusRowTone::Warning),
            "error" => Some(StatusRowTone::Error),
            _ => None,
        }
    }
}

/// The root class list: `.hk-status-row`, the tone modifier, the absent
/// modifier (false keys are omitted from Vue's `class` object, so the class is
/// emitted only when `absent` holds) and the host class last, the way Vue's
/// attribute fallthrough merges it.
pub fn status_row_classes(tone: StatusRowTone, absent: bool, class: &str) -> String {
    let mut classes = format!("hk-status-row {}", tone.class_name());
    if absent {
        classes.push_str(" hk-status-row--absent");
    }
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

/// Vue's `props.status ? <span…> : null`: only a non-empty string renders the
/// status line. A whitespace-only string is content in Vue (a truthy string),
/// so it stays content here too.
pub fn status_row_status_visible(status: &str) -> bool {
    !status.is_empty()
}

#[define_props]
pub struct StatusRowProps {
    /// The state axis (Vue default `neutral`).
    #[default]
    pub tone: StatusRowTone,

    /// Heading line — the member / service name (Vue: required `title`).
    pub title: String,

    /// Status line under the title (Vue default `""`).
    #[default]
    pub status: String,

    /// Quiet variant: dashed edge + reduced opacity for absent rows.
    #[default]
    pub absent: bool,

    /// The icon slot (the chip's content).
    pub icon: Option<Element>,

    /// The extra slot, rendered inside the body after the status line.
    pub extra: Option<Element>,

    /// The action slot; its wrapper only renders when this is `Some`.
    pub action: Option<Element>,

    /// Vue attribute fallthrough onto the root `<div>`.
    #[default]
    pub class: String,
}

#[component]
pub fn StatusRow(props: StatusRowProps) -> Element {
    // The chip box is part of the anatomy, so it renders even when the host
    // supplies no icon (Vue renders `slots.icon?.()` inside it unconditionally).
    let mut chip = VElement::new("span").class("hk-status-row__chip");
    if let Some(icon) = &props.icon {
        chip = chip.child(icon.clone());
    }

    let mut body = VElement::new("div")
        .class("hk-status-row__body")
        .child(rsx! {
            span { class: "hk-status-row__title", {props.title.clone()} }
        });
    if status_row_status_visible(&props.status) {
        body = body.child(rsx! {
            span { class: "hk-status-row__status", {props.status.clone()} }
        });
    }
    if let Some(extra) = &props.extra {
        body = body.child(extra.clone());
    }

    let mut root = VElement::new("div")
        .class(status_row_classes(props.tone, props.absent, &props.class))
        .child(VNode::Element(Box::new(chip)))
        .child(VNode::Element(Box::new(body)));
    if let Some(action) = &props.action {
        root = root.child(rsx! {
            div { class: "hk-status-row__action", {action.clone()} }
        });
    }
    VNode::Element(Box::new(root))
}

impl StyledComponent for StatusRowComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkStatusRow.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "status-row"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_row_defaults_match_the_vue_props() {
        let props = StatusRowProps::default();
        assert_eq!(props.tone, StatusRowTone::Neutral);
        assert_eq!(props.title, "");
        assert_eq!(props.status, "");
        assert!(!props.absent);
        assert!(props.icon.is_none());
        assert!(props.extra.is_none());
        assert!(props.action.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn status_row_tones_match_the_vue_validator() {
        // Every legal validator value round-trips through the token/class pair.
        for (name, class) in [
            ("neutral", "hk-status-row--neutral"),
            ("info", "hk-status-row--info"),
            ("success", "hk-status-row--success"),
            ("warning", "hk-status-row--warning"),
            ("error", "hk-status-row--error"),
        ] {
            let tone = StatusRowTone::from_name(name).expect("legal validator value");
            assert_eq!(tone.name(), name);
            assert_eq!(tone.class_name(), class);
        }
        // Anything outside the validator's five is rejected, not coerced.
        assert!(StatusRowTone::from_name("danger").is_none());
        assert!(StatusRowTone::from_name("primary").is_none());
        assert!(StatusRowTone::from_name("Info").is_none());
        assert!(StatusRowTone::from_name("").is_none());
    }

    #[test]
    fn status_row_tone_tokens_are_namespaced_and_unique() {
        let mut seen: Vec<(&'static str, &'static str)> = Vec::new();
        for tone in [
            StatusRowTone::Neutral,
            StatusRowTone::Info,
            StatusRowTone::Success,
            StatusRowTone::Warning,
            StatusRowTone::Error,
        ] {
            let entry = (tone.name(), tone.class_name());
            // The modifier is the class-object key, not a hand-written literal.
            assert_eq!(format!("hk-status-row--{}", entry.0), entry.1);
            assert!(entry.1.starts_with("hk-status-row--"));
            // No copy-paste alias: five tones → five distinct tokens/classes.
            assert!(!seen.contains(&entry), "duplicate tone mapping {}", entry.0);
            seen.push(entry);
        }
        assert_eq!(seen.len(), 5);
    }

    #[test]
    fn status_row_classes_follow_the_vue_class_object() {
        assert_eq!(
            status_row_classes(StatusRowTone::Neutral, false, ""),
            "hk-status-row hk-status-row--neutral"
        );
        assert_eq!(
            status_row_classes(StatusRowTone::Info, true, "host"),
            "hk-status-row hk-status-row--info hk-status-row--absent host"
        );
        // `absent: false` is omitted entirely — a `false` class-object key.
        assert!(!status_row_classes(StatusRowTone::Error, false, "").contains("--absent"));
    }

    #[test]
    fn status_row_status_line_is_gated_on_content() {
        assert!(!status_row_status_visible(""));
        assert!(status_row_status_visible("online"));
        // A whitespace-only string is truthy in Vue, so it renders.
        assert!(status_row_status_visible(" "));
    }

    #[test]
    fn status_row_renders_the_vue_dom_contract() {
        let html = StatusRow(StatusRowProps {
            title: "member-1".to_string(),
            status: "online".to_string(),
            tone: StatusRowTone::Info,
            absent: true,
            class: "host".to_string(),
            icon: Some(rsx! {
                span { "data-el": "icon" }
            }),
            extra: Some(rsx! {
                span { "data-el": "extra" }
            }),
            action: Some(rsx! {
                button { "data-el": "action" }
            }),
        })
        .render_to_html();

        assert!(
            html.contains(
                r#"class="hk-status-row hk-status-row--info hk-status-row--absent host""#
            ),
            "{html}"
        );
        // The chip is always there, before the body; the action wrapper last.
        let chip = html.find("hk-status-row__chip").expect("chip");
        let body = html.find("hk-status-row__body").expect("body");
        let title = html.find("hk-status-row__title").expect("title");
        let status = html.find("hk-status-row__status").expect("status");
        let extra = html.find(r#"data-el="extra""#).expect("extra");
        let action = html.find("hk-status-row__action").expect("action");
        assert!(chip < body && body < title && title < status, "{html}");
        assert!(status < extra && extra < action, "{html}");
        assert!(html.contains(">member-1<"), "{html}");
        assert!(html.contains(">online<"), "{html}");
        assert!(html.contains(r#"data-el="action""#), "{html}");
    }

    #[test]
    fn status_row_omits_the_optional_row_parts() {
        let html = StatusRow(StatusRowProps {
            title: "service".to_string(),
            ..Default::default()
        })
        .render_to_html();

        // The chip and title stand alone: no status line, no action wrapper.
        assert!(html.contains("hk-status-row__chip"), "{html}");
        assert!(!html.contains("hk-status-row__status"), "{html}");
        assert!(!html.contains("hk-status-row__action"), "{html}");
        assert!(html.contains(">service<"), "{html}");
    }

    #[test]
    fn status_row_styles_come_from_the_canonical_vue_sheet() {
        let css = StatusRowComponent::styles();
        for needle in [
            ".hk-status-row",
            "hk-status-row__chip",
            "hk-status-row__body",
            "hk-status-row__title",
            "hk-status-row__status",
            "hk-status-row__action",
            "hk-status-row--absent",
        ] {
            assert!(
                css.contains(needle),
                "status-row css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored status-row sheet"
        );
    }
}
