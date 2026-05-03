use hikari_i18n::t;
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    let nav_components = t!("nav.components");
    let nav_system = t!("nav.system");
    let nav_demos = t!("nav.demos");
    let nav_github = t!("nav.github");
    let nav_toggle = t!("nav.toggle_menu");

    rsx! {
        header { class: "hi-header hi-header-sticky hi-header-md",
            div { class: "hi-header-left",
                button {
                    class: "hi-header-toggle",
                    id: "drawer-toggle",
                    "aria-label": nav_toggle,
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke: "currentColor",
                        stroke_width: "2",
                        stroke_linecap: "round",
                        stroke_linejoin: "round",
                        path { d: "M4 6h16M4 12h16M4 18h16" }
                    }
                }
                a { href: "/", class: "hi-header-brand",
                    img {
                        class: "hi-header-logo-img",
                        src: "/images/logo.png",
                        alt: "Hikari",
                        width: "28",
                        height: "28"
                    }
                }
            }
            div { class: "hi-header-right",
                nav { class: "hi-header-nav",
                    a {
                        href: "/components",
                        class: "hikari-topnav__link",
                        "data-page-target": "page-components-overview",
                        nav_components
                    }
                    a {
                        href: "/system",
                        class: "hikari-topnav__link",
                        "data-page-target": "page-system-overview",
                        nav_system
                    }
                    a {
                        href: "/demos",
                        class: "hikari-topnav__link",
                        "data-page-target": "page-demos-overview",
                        nav_demos
                    }
                }
                a {
                    href: "https://github.com/celestia-island/hikari",
                    target: "_blank",
                    class: "hi-header-github",
                    nav_github
                }
            }
        }
    }
}
