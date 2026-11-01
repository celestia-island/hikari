// hi-components/src/basic/label.rs
// Label — mirror of the canonical Vue `HkLabel`: the unified label/text shell
// every control that shows a label position uses (checkbox, radio, switch,
// and agreement lines).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkLabel.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`.
//
//   span.hk-label.hk-label-{size}
//     {the `text` prop, or the `children` slot}
//
// Contract (mirrors Vue): plain text goes through `text` (escaped), rich
// content through the slot; the shell and typography stay identical either
// way. With neither, Vue renders `null` — the mirror returns an empty vnode.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct LabelComponent;

/// The three size steps (Vue default `md`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum LabelSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl LabelSize {
    pub fn class_name(self) -> &'static str {
        match self {
            LabelSize::Sm => "hk-label-sm",
            LabelSize::Md => "hk-label-md",
            LabelSize::Lg => "hk-label-lg",
        }
    }
}

#[define_props]
pub struct LabelProps {
    /// Plain-text label; rendered as-is (escaped) inside the shell.
    pub text: Option<String>,

    #[default]
    pub size: LabelSize,

    /// Rich content (links/icons/emphasis) — wins over `text` when present
    /// (Vue: `hasSlot ? slots.default!() : props.text`).
    pub children: Element,
}

#[component]
pub fn Label(props: LabelProps) -> Element {
    let has_text = props
        .text
        .as_deref()
        .map(|text| !text.is_empty())
        .unwrap_or(false);
    let children = props.children.clone();
    // Same emptiness rule the Button mirror uses: an empty fragment AND a
    // zero-length text node (`empty_vnode()`, the prelude helper callers pass
    // for "no slot") both count as absent, so `text + empty_vnode()` keeps
    // rendering the text.
    let has_children = match &children {
        VNode::Fragment(nodes) => !nodes.is_empty(),
        VNode::Text(text) => !text.text.is_empty(),
        VNode::DynamicText(_) => true,
        VNode::Element(_) => true,
    };
    // Vue renders null when neither the text prop nor the slot is present;
    // an rsx child is always present, so an empty fragment stands in.
    if !has_text && !has_children {
        return empty_vnode();
    }

    rsx! {
        span {
            class: format!("hk-label {}", props.size.class_name()),
            // The SLOT wins when present (Vue precedence).
            if has_children {
                {children}
            } else {
                "{props.text.clone().unwrap_or_default()}"
            }
        }
    }
}

impl StyledComponent for LabelComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkLabel.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "label"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn label_size_classes_match_vue() {
        assert_eq!(LabelSize::Sm.class_name(), "hk-label-sm");
        assert_eq!(LabelSize::Md.class_name(), "hk-label-md");
        assert_eq!(LabelSize::Lg.class_name(), "hk-label-lg");
    }

    #[test]
    fn label_defaults_match_the_vue_props() {
        let props = LabelProps::default();
        assert_eq!(props.size, LabelSize::Md);
        assert!(props.text.is_none());
    }

    #[test]
    fn label_text_survives_an_empty_slot_and_the_slot_wins_when_real() {
        // `text + empty_vnode()` must keep the text (empty_vnode is
        // VNode::Text(""), not an empty fragment).
        let html = Label(LabelProps {
            text: Some("TEXT".to_string()),
            children: empty_vnode(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("TEXT"), "{html}");

        // A real slot wins over the text prop (Vue precedence).
        let html = Label(LabelProps {
            text: Some("TEXT".to_string()),
            children: rsx! { span { "SLOT" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("SLOT") && !html.contains("TEXT"), "{html}");
    }

    #[test]
    fn label_styles_come_from_the_canonical_vue_sheet() {
        let css = LabelComponent::styles();
        assert!(
            css.contains(".hk-label"),
            "label css must carry the vue shell class"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored label sheet"
        );
    }
}
