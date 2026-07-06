//! 404 Not Found page.

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-not-found", class: "hikari-page",
            div { class: "page-section page-section--center",
                h1 { class: "page-hero__title", "404" }
                p { class: "page-hero__subtitle", "Page not found" }
                a { href: "/", class: "hi-btn hi-btn--primary", "Go Home" }
            }
        }
    }
}
