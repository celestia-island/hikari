//! Icon helper for non-rsx! contexts (VElement builder pattern).
//!
//! Provides [`icon_vnode`] to render an MDI icon as an inline-SVG VNode,
//! for use in components that build their DOM imperatively via `VElement`
//! rather than declaratively via `rsx!`.

use tairitsu_vdom::{VElement, VNode, VText};

/// Render an MDI icon as an inline `<svg>` VNode.
///
/// Uses `fill="currentColor"` so the icon inherits its CSS `color`.
/// Returns an empty text node if the icon name is not found.
pub fn icon_vnode(name: &str, size: u32) -> VNode {
    let path = match hikari_icons::get(name) {
        Some(d) => d
            .path
            .or_else(|| d.paths.first().and_then(|p| p.d))
            .unwrap_or(""),
        None => "",
    };
    if path.is_empty() {
        return VNode::Text(VText::new(""));
    }
    let svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{size}" height="{size}" fill="currentColor"><path d="{path}"/></svg>"#
    );
    VNode::Element(Box::new(
        VElement::new("span")
            .class("hi-icon-inline")
            .attr(
                "style",
                &format!("display:inline-flex;align-items:center;width:{size}px;height:{size}px"),
            )
            .attr("aria-hidden", "true")
            .dangerous_inner_html(&svg),
    ))
}
