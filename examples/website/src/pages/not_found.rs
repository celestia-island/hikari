use tairitsu_web::t;
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    let title = t!("page.not_found.title");
    let action = t!("page.not_found.action");

    rsx! {
        div { id: "page-not-found", class: "hikari-page",
            div { class: "page-section page-section--center",
                h1 { class: "page-hero__title", "404" }
                p { class: "page-hero__subtitle", title }
                a { href: "/", class: "hi-button hi-button-primary", action }
            }
        }
    }
}
