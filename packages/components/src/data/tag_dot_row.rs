// hi-components/src/data/tag_dot_row.rs
// TagDotRow — mirror of the canonical Vue `HkTagDotRow`: the Finder-style
// strip of toggleable colored dots (one dot per tag, the caption beneath,
// one click toggles).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTagDotRow.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-tag-dot*` class names are literal and identical in both forms. The
// sheet speaks the unified menu-item spec (`@use "./menu-item" as mi`), so
// the strip keeps menu rhythm inside menu surfaces and grows with the
// sheet tokens inside mobile sheets — unchanged by the mirror.
//
// DOM contract (mirrors the Vue render output one-to-one; the component is
// stateless in Vue, so the mirror is a 1:1 port with NO deltas):
//
//   div.hk-tag-dot-row [role=group] [aria-label?]     (label prop, absent
//     |                                              when None — Vue's
//     |                                               undefined attr)
//     button.hk-tag-dot                              (per tag)
//         type="button" [data-active] [disabled] aria-pressed="true|false"
//         aria-label={label ?? key} [title={label?}]
//       span.hk-tag-dot__dot                         (style: --hk-tag-color)
//       span.hk-tag-dot__label?                      (label text, only when
//                                                     the tag carries one)
//
// Tags are domain-free {key, color, label} triples exactly like Vue's
// `HkTagDot`: the host owns the vocabulary (and its i18n), the row owns
// only the geometry and the states. Clicking a dot never closes a
// surrounding menu — the `toggle` emit is the whole interaction
// ([`TagDotRowProps::on_toggle`], fired with the tag `key`).
//
// Presence-marker conventions (pinned by the tests):
//   * `data-active` is ABSENT on unapplied tags (a serialized
//     `="false"` would still match `[data-active]` selectors).
//   * `disabled` is the native attribute; the click handler additionally
//     guards it, keeping a synthetic click honest.
//   * `aria-pressed` is ALWAYS present ("true"/"false") — the toggle
//     semantics are the row's, unlike the auth-method tiles where the
//     Vue suite pins the absence of group semantics.
//
// No i18n keys: captions and the group label arrive as props (the host
// i18n's them, exactly like Vue — the sheet's label has no dictionary
// entry).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TagDotRowComponent;

/// The sheet's class names, spelled once so the DOM and the tests read one
/// source (Vue inlines them at each call site).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TagDotClass {
    /// The group row.
    Row,
    /// One toggleable dot button.
    Tag,
    /// The colored disc inside a tag button.
    Dot,
    /// The caption under the disc.
    Label,
}

impl TagDotClass {
    /// The class exactly as the Vue sheet spells it.
    pub fn class_name(self) -> &'static str {
        match self {
            TagDotClass::Row => "hk-tag-dot-row",
            TagDotClass::Tag => "hk-tag-dot",
            TagDotClass::Dot => "hk-tag-dot__dot",
            TagDotClass::Label => "hk-tag-dot__label",
        }
    }
}

/// One toggleable tag of the row (Vue: `HkTagDot`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct HkTagDot {
    /// Stable identity — the value `toggle` carries.
    pub key: String,

    /// Dot color — any CSS color (hex, `rgb()`, a `var()` reference…);
    /// rendered verbatim into the `--hk-tag-color` custom property.
    pub color: String,

    /// Caption under the dot; the host i18n's it. `None` renders the
    /// dot alone (no label span, no `title`).
    pub label: Option<String>,

    /// Whether the tag is currently applied (the row's selected face:
    /// `data-active` + `aria-pressed="true"` + the sheet's dot ring).
    pub active: bool,

    /// Inert: rendered dimmed through the native `disabled` attribute,
    /// clicks never toggle it.
    pub disabled: bool,
}

impl HkTagDot {
    /// A live, captionless dot — the minimal Vue triple.
    pub fn new(key: impl Into<String>, color: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            color: color.into(),
            ..Default::default()
        }
    }
}

/// Vue's `aria-label={tag.label ?? tag.key}`: the caption names the button;
/// a captionless dot falls back to its stable key.
pub fn tag_dot_aria_label(label: Option<&str>, key: &str) -> String {
    label.unwrap_or(key).to_string()
}

/// Vue's `title={tag.label}`: the native tooltip only exists when a caption
/// does (`undefined` drops the attribute entirely).
pub fn tag_dot_title(label: Option<&str>) -> Option<&str> {
    label
}

/// Vue's `aria-pressed={tag.active ? "true" : "false"}` — always present,
/// unlike the presence-only `data-active` marker.
pub fn tag_dot_aria_pressed(active: bool) -> &'static str {
    if active { "true" } else { "false" }
}

/// Vue's `data-active={tag.active || undefined}` — presence-only, never a
/// serialized `="false"` (a `[data-active]` selector would read it as on).
pub fn tag_dot_active_attr(active: bool) -> Option<&'static str> {
    if active { Some("true") } else { None }
}

/// The dot's inline custom property (Vue: the style object
/// `{ "--hk-tag-color": tag.color }`).
pub fn tag_dot_dot_style(color: &str) -> String {
    format!("--hk-tag-color:{color}")
}

/// Vue's group `aria-label={props.label}`: the attribute rides along only
/// when the prop is given.
pub fn tag_dot_row_group_label(label: Option<&str>) -> Option<&str> {
    label
}

/// One toggle button of the strip.
fn tag_dot_button(tag: &HkTagDot, on_toggle: &Option<EventHandler<String>>) -> VNode {
    let live = !tag.disabled;
    let mut button = VElement::new("button")
        .class(TagDotClass::Tag.class_name())
        .attr("type", "button")
        .attr("aria-pressed", tag_dot_aria_pressed(tag.active))
        .attr(
            "aria-label",
            tag_dot_aria_label(tag.label.as_deref(), &tag.key),
        );
    if let Some(marker) = tag_dot_active_attr(tag.active) {
        button = button.attr("data-active", marker);
    }
    if tag.disabled {
        button = button.attr("disabled", "disabled");
    }
    if let Some(label) = tag_dot_title(tag.label.as_deref()) {
        button = button.attr("title", label);
    }

    button = button.child(VNode::Element(Box::new(
        VElement::new("span")
            .class(TagDotClass::Dot.class_name())
            .style(tag_dot_dot_style(&tag.color)),
    )));
    if let Some(label) = &tag.label {
        button = button.child(VNode::Element(Box::new(
            VElement::new("span")
                .class(TagDotClass::Label.class_name())
                .child(VNode::Text(VText::new(&label.clone()))),
        )));
    }

    let key = tag.key.clone();
    let handler = on_toggle.clone();
    button = button.on_click(move |_event: MouseEvent| {
        // Vue relies on the native `disabled` attribute alone; the guard
        // keeps a synthetic click (host test harness, programmatic
        // dispatch) honest.
        if !live {
            return;
        }
        if let Some(handler) = handler.as_ref() {
            handler.call(key.clone());
        }
    });

    VNode::Element(Box::new(button))
}

#[define_props]
pub struct TagDotRowProps {
    /// The tags in render order (Vue: `tags`, required there; the Rust
    /// default is the empty strip, which renders the group shell only).
    #[default]
    pub tags: Vec<HkTagDot>,

    /// Accessible name for the whole group (Vue: `label`; absent → no
    /// `aria-label` attribute, exactly like Vue's undefined).
    pub label: Option<String>,

    /// A dot was pressed; carries the tag `key` (Vue: the `toggle` emit).
    /// Toggling is the HOST's decision — the row never closes a
    /// surrounding menu on its own.
    pub on_toggle: Option<EventHandler<String>>,
}

#[component]
pub fn TagDotRow(props: TagDotRowProps) -> Element {
    let mut group = VElement::new("div")
        .class(TagDotClass::Row.class_name())
        .attr("role", "group");
    if let Some(label) = tag_dot_row_group_label(props.label.as_deref()) {
        group = group.attr("aria-label", label);
    }
    for tag in &props.tags {
        group = group.child(tag_dot_button(tag, &props.on_toggle));
    }
    VNode::Element(Box::new(group))
}

impl StyledComponent for TagDotRowComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-tag-dot*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTagDotRow.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "tag-dot-row"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tag_dot_row_defaults_match_the_vue_props() {
        let props = TagDotRowProps::default();
        assert!(props.tags.is_empty());
        assert!(props.label.is_none());
        assert!(props.on_toggle.is_none());

        let dot = HkTagDot::default();
        assert_eq!(dot.key, "");
        assert_eq!(dot.color, "");
        assert!(dot.label.is_none());
        assert!(!dot.active);
        assert!(!dot.disabled);

        let dot = HkTagDot::new("red", "#f00");
        assert_eq!(dot.key, "red");
        assert_eq!(dot.color, "#f00");
        assert!(dot.label.is_none() && !dot.active && !dot.disabled);
    }

    #[test]
    fn tag_dot_class_names_match_the_vue_sheet() {
        assert_eq!(TagDotClass::Row.class_name(), "hk-tag-dot-row");
        assert_eq!(TagDotClass::Tag.class_name(), "hk-tag-dot");
        assert_eq!(TagDotClass::Dot.class_name(), "hk-tag-dot__dot");
        assert_eq!(TagDotClass::Label.class_name(), "hk-tag-dot__label");
    }

    #[test]
    fn tag_dot_attribute_mapping_follows_vue() {
        // aria-pressed is ALWAYS serialized; data-active is presence-only.
        assert_eq!(tag_dot_aria_pressed(true), "true");
        assert_eq!(tag_dot_aria_pressed(false), "false");
        assert_eq!(tag_dot_active_attr(true), Some("true"));
        assert_eq!(tag_dot_active_attr(false), None);
        // The caption names the button; a captionless dot falls back to
        // its key and carries no native tooltip.
        assert_eq!(tag_dot_aria_label(Some("Red"), "red"), "Red");
        assert_eq!(tag_dot_aria_label(None, "red"), "red");
        assert_eq!(tag_dot_title(Some("Red")), Some("Red"));
        assert_eq!(tag_dot_title(None), None);
        assert_eq!(tag_dot_row_group_label(Some("Tags")), Some("Tags"));
        assert_eq!(tag_dot_row_group_label(None), None);
    }

    #[test]
    fn tag_dot_style_carries_the_color_token() {
        assert_eq!(tag_dot_dot_style("#ff0000"), "--hk-tag-color:#ff0000");
        assert_eq!(
            tag_dot_dot_style("rgb(var(--color-primary))"),
            "--hk-tag-color:rgb(var(--color-primary))"
        );
        assert_eq!(tag_dot_dot_style(""), "--hk-tag-color:");
    }

    #[test]
    fn tag_dot_row_renders_the_vue_strip_contract() {
        let html = TagDotRow(TagDotRowProps {
            label: Some("Tags".to_string()),
            tags: vec![
                HkTagDot {
                    label: Some("Red".to_string()),
                    active: true,
                    ..HkTagDot::new("red", "#f00")
                },
                HkTagDot {
                    label: Some("Green".to_string()),
                    ..HkTagDot::new("green", "#0f0")
                },
                HkTagDot {
                    disabled: true,
                    ..HkTagDot::new("blue", "#00f")
                },
                HkTagDot::new("plain", "var(--x)"),
            ],
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-tag-dot-row""#,
            r#"role="group""#,
            r#"aria-label="Tags""#,
            r#"class="hk-tag-dot""#,
            r#"class="hk-tag-dot__dot""#,
            r#"class="hk-tag-dot__label""#,
            r#"type="button""#,
            r#"data-active="true""#,
            r#"aria-pressed="true""#,
            r#"aria-pressed="false""#,
            r#"aria-label="Red""#,
            r#"aria-label="plain""#,
            r#"title="Red""#,
            r#"disabled="disabled""#,
            "--hk-tag-color:#f00",
            "--hk-tag-color:var(--x)",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Exactly one applied tag → one presence marker; two labels
        // render — the two captionless dots (disabled "blue" and
        // "plain") render none, exactly Vue's `tag.label ?` arm
        // (disabled has no say in the caption).
        assert_eq!(html.matches("data-active").count(), 1, "{html}");
        assert_eq!(html.matches("hk-tag-dot__label").count(), 2, "{html}");
        // Vue drops `title` when the caption is absent: the captionless
        // dot carries no tooltip at all.
        assert!(!html.contains(r#"title="plain""#), "{html}");
    }

    #[test]
    fn tag_dot_row_without_a_label_omits_the_group_aria_label() {
        let html = TagDotRow(TagDotRowProps {
            tags: vec![HkTagDot::new("red", "#f00")],
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-tag-dot-row""#), "{html}");
        // No group `aria-label` at all: the ONLY aria-label in the strip is
        // the single button's own accessible name (the key).
        assert_eq!(html.matches("aria-label").count(), 1, "{html}");
        assert!(html.contains(r#"aria-label="red""#), "{html}");
    }

    #[test]
    fn tag_dot_row_styles_come_from_the_canonical_vue_sheet() {
        let css = TagDotRowComponent::styles();
        for needle in [
            ".hk-tag-dot-row",
            ".hk-tag-dot",
            ".hk-tag-dot__dot",
            ".hk-tag-dot__label",
            "[data-active]",
        ] {
            assert!(
                css.contains(needle),
                "tag-dot-row css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored tag-dot-row sheet"
        );
        assert_eq!(TagDotRowComponent::name(), "tag-dot-row");
    }
}
