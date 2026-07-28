use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:12px 16px;border-radius:6px;background:rgba(58,110,165,0.1);border:1px solid rgba(58,110,165,0.3);margin:1rem 0;display:flex;gap:8px;align-items:center;",
        span { style: "color:#3a6ea5;font-weight:600;", "ℹ" }
        span { style: "color:#333;font-size:14px;", "This is an info alert message." }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
