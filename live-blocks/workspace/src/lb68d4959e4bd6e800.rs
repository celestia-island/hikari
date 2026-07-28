use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:12px 20px;border-radius:6px;background:#333;color:#fff;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:inline-block;",
        "Operation succeeded" }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
