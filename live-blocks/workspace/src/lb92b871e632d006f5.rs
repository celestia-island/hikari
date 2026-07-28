use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        span { style: "position:relative;display:inline-block;padding:4px 8px;background:#333;color:#fff;border-radius:4px;font-size:12px;",
            "Hover for info" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
