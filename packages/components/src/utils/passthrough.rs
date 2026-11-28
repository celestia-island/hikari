//! Attribute passthrough: host attributes written onto a component's root
//! element.
//!
//! Vue components that do not declare `inheritAttrs: false` pass every
//! attribute and listener they do not own on to their root element (`$attrs`
//! fallthrough) — `title`, `id`, `data-*`, `aria-*`, `form`, test hooks. The
//! Rust mirrors take the attributes they render as typed props; what a host
//! needs beyond those arrives as `attrs: Vec<(String, String)>` and is set on
//! the root by name, in order, after the component's own attributes.
//!
//! `class` and `style` are merged, the way Vue merges a fallthrough class and
//! style with the component's own, and never written as attributes: `VElement`
//! keeps them in fields of their own, so an `attributes` entry of that name
//! would render as a second attribute beside the first.

use std::mem;

use tairitsu_vdom::{VElement, VNode};

/// Set each entry on `element` by name. A name the component rendered itself
/// takes the host's value, the way a fallthrough attribute replaces one the
/// template wrote.
///
/// A `class` entry adds its names to the element's class list and a `style`
/// entry adds its declarations (`property: value`, separated by `;`) to the
/// element's style; both keep what the component already put there. A style
/// value with a `;` inside parentheses or quotes is not understood — such a
/// declaration belongs on the element's own `style`.
pub fn pass_through(element: &mut VElement, attrs: &[(String, String)]) {
    for (name, value) in attrs {
        match name.as_str() {
            "class" => {
                for class in value.split_whitespace() {
                    element.class = mem::take(&mut element.class).add(class);
                }
            }
            "style" => {
                for declaration in value.split(';') {
                    let Some((property, val)) = declaration.split_once(':') else {
                        continue;
                    };
                    let (property, val) = (property.trim(), val.trim());
                    if property.is_empty() || val.is_empty() {
                        continue;
                    }
                    element.style = mem::take(&mut element.style).add(property, val);
                }
            }
            _ => {
                element.attributes.insert(name.clone(), value.clone());
            }
        }
    }
}

/// [`pass_through`] onto the root element of `node`. A node without an
/// element root (a fragment, text) is returned untouched: there is no single
/// element for the attributes to land on.
pub fn onto_root(mut node: VNode, attrs: &[(String, String)]) -> VNode {
    if let VNode::Element(element) = &mut node {
        pass_through(element, attrs);
    }
    node
}

#[cfg(test)]
mod tests {
    use tairitsu_macros::rsx;

    use super::*;

    #[test]
    fn passthrough_sets_each_entry_by_name() {
        let node = onto_root(
            rsx! {
                button { "type": "button", "Save" }
            },
            &[
                ("title".to_string(), "Save now".to_string()),
                ("data-testid".to_string(), "save".to_string()),
            ],
        );
        let VNode::Element(element) = node else {
            panic!("the root is an element");
        };
        assert_eq!(element.attributes.get("type").unwrap(), "button");
        assert_eq!(element.attributes.get("title").unwrap(), "Save now");
        assert_eq!(element.attributes.get("data-testid").unwrap(), "save");
    }

    #[test]
    fn passthrough_replaces_a_name_the_component_rendered() {
        let node = onto_root(
            rsx! {
                button { "aria-busy": "true", "Save" }
            },
            &[("aria-busy".to_string(), "false".to_string())],
        );
        let VNode::Element(element) = node else {
            panic!("the root is an element");
        };
        assert_eq!(element.attributes.get("aria-busy").unwrap(), "false");
    }

    #[test]
    fn passthrough_merges_a_class_instead_of_writing_an_attribute() {
        let node = onto_root(
            rsx! {
                button { class: "hk-btn", "Save" }
            },
            &[
                ("class".to_string(), " host-wide  ".to_string()),
                ("data-testid".to_string(), "save".to_string()),
            ],
        );
        let VNode::Element(element) = node else {
            panic!("the root is an element");
        };
        assert_eq!(element.class.static_classes, "hk-btn host-wide");
        assert!(
            !element.attributes.contains_key("class"),
            "a class entry is never an attribute: {:?}",
            element.attributes
        );
        assert_eq!(element.attributes.get("data-testid").unwrap(), "save");
        // One class attribute in the markup, carrying both names (the order
        // of attributes in a tag is not part of the contract).
        let html = VNode::Element(element).render_to_html();
        assert_eq!(html.matches("class=\"").count(), 1, "{html}");
        assert!(html.contains(r#"class="hk-btn host-wide""#), "{html}");
    }

    #[test]
    fn passthrough_merges_a_style_instead_of_writing_an_attribute() {
        let node = onto_root(
            rsx! {
                button { style: "color: red", "Save" }
            },
            &[(
                "style".to_string(),
                "margin: 0; ; border-width: 2px".to_string(),
            )],
        );
        let VNode::Element(element) = node else {
            panic!("the root is an element");
        };
        assert_eq!(
            element.style.static_styles,
            "color:red;margin:0;border-width:2px"
        );
        assert!(
            !element.attributes.contains_key("style"),
            "a style entry is never an attribute: {:?}",
            element.attributes
        );
    }

    #[test]
    fn passthrough_leaves_a_root_without_an_element_alone() {
        let node = onto_root(
            VNode::default(),
            &[("title".to_string(), "nowhere".to_string())],
        );
        // An empty fragment in, the same empty fragment out.
        assert!(matches!(node, VNode::Fragment(children) if children.is_empty()));
    }
}
