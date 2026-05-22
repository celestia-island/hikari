use hikari_icons::MdiIcon;
use tairitsu_vdom::{VElement, VNode};

pub fn icon_el(icon: MdiIcon, size: u32) -> VNode {
    let path_data = hikari_icons::get(&icon.to_string()).unwrap_or(
        "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
    );
    let svg_str = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{size}" height="{size}"><path fill="currentColor" d="{path_data}"/></svg>"#,
    );
    VNode::Element(
        VElement::new("span")
            .class("hikari-icon")
            .inner_html(svg_str),
    )
}
