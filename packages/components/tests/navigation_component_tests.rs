// Navigation component tests

#[cfg(feature = "navigation")]
#[test]
fn test_anchor_feature() {
    // Anchor feature is enabled
}

#[cfg(feature = "navigation")]
use dioxus::prelude::*;
#[cfg(feature = "navigation")]
use hikari_components::{navigation::Anchor, AnchorItem};

#[cfg(feature = "navigation")]
#[test]
fn test_anchor_component_exists() {
    let anchor_item = AnchorItem {
        href: "#section1".to_string(),
        title: "Section 1".to_string(),
    };

    assert_eq!(anchor_item.href, "#section1");
    assert_eq!(anchor_item.title, "Section 1");
}

#[cfg(feature = "navigation")]
#[test]
fn test_anchor_component_compiles() {
    let app = rsx! {
        Anchor {
            items: vec![
                AnchorItem { href: "#section1".to_string(), title: "Section 1".to_string() },
                AnchorItem { href: "#section2".to_string(), title: "Section 2".to_string() },
            ],
            div { id: "section1", h1 { "Section 1" } }
            div { id: "section2", h1 { "Section 2" } }
        }
    };
    assert!(true, "Anchor component compiles: {app:?}");
}
