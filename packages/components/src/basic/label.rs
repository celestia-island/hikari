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

    /// Rich content (links/icons/emphasis) — wins over `text` when present.
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
    // Vue renders null when neither the text prop nor the slot is present;
    // an rsx child is always present, so an empty fragment stands in.
    if !has_text && matches!(children, VNode::Fragment(ref nodes) if nodes.is_empty()) {
        return empty_vnode();
    }

    rsx! {
        span {
            class: format!("hk-label {}", props.size.class_name()),
            if has_text {
                "{props.text.clone().unwrap_or_default()}"
            } else {
                {children}
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
