use tairitsu_web::{i18n::translate_or_key, t};
use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn el(tag: &str) -> VElement {
    VElement::new(tag)
}

pub fn render() -> VNode {
    let nav_components = t!("nav.components");
    let nav_system = t!("nav.system");
    let nav_demos = t!("nav.demos");
    let nav_github = t!("nav.github");
    let nav_toggle = t!("nav.toggle_menu");

    VNode::Element(
        el("header")
            .class("hi-header hi-header-sticky hi-header-md")
            .child(VNode::Element(
                el("div")
                    .class("hi-header-left")
                    .child(VNode::Element(
                        el("button")
                            .class("hi-header-toggle")
                            .attr("id", "drawer-toggle")
                            .attr("aria-label", nav_toggle.as_str())
                            .child(VNode::Element(
                                el("svg")
                                    .attr("xmlns", "http://www.w3.org/2000/svg")
                                    .attr("fill", "none")
                                    .attr("viewBox", "0 0 24 24")
                                    .attr("stroke", "currentColor")
                                    .attr("stroke-width", "2")
                                    .attr("stroke-linecap", "round")
                                    .attr("stroke-linejoin", "round")
                                    .child(VNode::Element(
                                        el("path").attr("d", "M4 6h16M4 12h16M4 18h16"),
                                    )),
                            )),
                    ))
                    .child(VNode::Element(
                        el("a")
                            .attr("href", "/")
                            .class("hi-header-brand")
                            .child(VNode::Element(
                                el("img")
                                    .class("hi-header-logo-img")
                                    .attr("src", "/images/logo.png")
                                    .attr("alt", "Hikari")
                                    .attr("width", "28")
                                    .attr("height", "28"),
                            )),
                    )),
            ))
            .child(VNode::Element(
                el("div")
                    .class("hi-header-right")
                    .child(VNode::Element(
                        el("nav")
                            .class("hi-header-nav")
                            .child(VNode::Element(
                                el("a")
                                    .attr("href", "/components")
                                    .class("hikari-topnav__link")
                                    .attr("data-page-target", "page-components-overview")
                                    .child(txt(nav_components.as_str())),
                            ))
                            .child(VNode::Element(
                                el("a")
                                    .attr("href", "/system")
                                    .class("hikari-topnav__link")
                                    .attr("data-page-target", "page-system-overview")
                                    .child(txt(nav_system.as_str())),
                            ))
                            .child(VNode::Element(
                                el("a")
                                    .attr("href", "/demos")
                                    .class("hikari-topnav__link")
                                    .attr("data-page-target", "page-demos-overview")
                                    .child(txt(nav_demos.as_str())),
                            )),
                    ))
                    .child(VNode::Element(
                        el("a")
                            .attr("href", "https://github.com/celestia-island/hikari")
                            .attr("target", "_blank")
                            .class("hi-header-github")
                            .child(txt(nav_github.as_str())),
                    )),
            )),
    )
}
