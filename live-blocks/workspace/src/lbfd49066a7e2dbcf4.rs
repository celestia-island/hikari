use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;font-size:14px;color:#999;",
        a { href: "#", style: "color:#3a6ea5;text-decoration:none;", "Home" }
        span { " / " }
        a { href: "#", style: "color:#3a6ea5;text-decoration:none;", "Components" }
        span { " / " }
        span { style: "color:#333;", "Breadcrumb" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
