// hi-components/src/basic/kbd.rs
// Kbd — mirror of the canonical Vue `HkKbd` (a keyboard shortcut hint).
//
// The Vue component carries NO stylesheet of its own: `.hk-kbd*` are semantic
// hooks the host styles (or leaves to its own chrome). The mirror therefore
// ships the DOM contract only — attribute-for-attribute identical to Vue:
//
//   kbd.hk-kbd.hk-kbd-{size}  aria-hidden="true"
//     span                       (one per key chunk)
//       span.hk-kbd-sep  "+"      (between chunks, not before the first)
//       span.hk-kbd-key  {key}
//
// Behaviour (mirrors Vue): `keys` is split on `+` and each chunk is trimmed
// (`"Ctrl + K"` → `Ctrl`, `K`; `"Ctrl+Shift+K"` → three keys). Empty chunks
// render as empty key spans exactly like Vue.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct KbdComponent;

/// The two size steps (Vue: `"sm" | "md"`, default md).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum KbdSize {
    Sm,
    #[default]
    Md,
}

impl KbdSize {
    pub fn class_name(self) -> &'static str {
        match self {
            KbdSize::Sm => "hk-kbd-sm",
            KbdSize::Md => "hk-kbd-md",
        }
    }
}

/// Split a shortcut string into its key chunks exactly as Vue does.
pub fn kbd_keys(keys: &str) -> Vec<String> {
    keys.split('+')
        .map(|chunk| chunk.trim().to_string())
        .collect()
}

#[define_props]
pub struct KbdProps {
    /// The shortcut, `+`-separated (Vue: `keys`, required).
    #[default]
    pub keys: String,

    #[default]
    pub size: KbdSize,
}

#[component]
pub fn Kbd(props: KbdProps) -> Element {
    let keys = kbd_keys(&props.keys);
    let mut children: Vec<VNode> = Vec::new();
    for (i, key) in keys.iter().enumerate() {
        let mut span_children: Vec<VNode> = Vec::new();
        if i > 0 {
            span_children.push(rsx! {
                span { class: "hk-kbd-sep", "+" }
            });
        }
        span_children.push(rsx! {
            span { class: "hk-kbd-key", "{key}" }
        });
        children.push(rsx! {
            span { key: i, {VNode::Fragment(span_children)} }
        });
    }

    rsx! {
        kbd {
            class: format!("hk-kbd {}", props.size.class_name()),
            "aria-hidden": "true",
            {VNode::Fragment(children)}
        }
    }
}

impl StyledComponent for KbdComponent {
    fn styles() -> &'static str {
        // Vue ships no sheet for this component; the classes are hooks.
        ""
    }

    fn name() -> &'static str {
        "kbd"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kbd_splits_and_trims_exactly_like_vue() {
        assert_eq!(kbd_keys("Ctrl+K"), vec!["Ctrl", "K"]);
        assert_eq!(kbd_keys("Ctrl + K"), vec!["Ctrl", "K"]);
        assert_eq!(kbd_keys("Ctrl+Shift+K"), vec!["Ctrl", "Shift", "K"]);
        // Vue does not drop empty chunks.
        assert_eq!(kbd_keys("A++B"), vec!["A", "", "B"]);
    }

    #[test]
    fn kbd_size_classes_match_vue() {
        assert_eq!(KbdSize::Sm.class_name(), "hk-kbd-sm");
        assert_eq!(KbdSize::Md.class_name(), "hk-kbd-md");
    }

    #[test]
    fn kbd_defaults_match_the_vue_props() {
        let props = KbdProps::default();
        assert_eq!(props.size, KbdSize::Md);
        assert_eq!(props.keys, "");
    }
}
