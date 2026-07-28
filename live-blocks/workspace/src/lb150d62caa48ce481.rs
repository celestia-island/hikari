use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:400px;",
        div { style: "display:flex;align-items:center;gap:8px;margin-bottom:8px;",
            div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;", "A" }
            span { style: "font-weight:600;font-size:14px;", "Alice" }
            span { style: "color:#999;font-size:12px;margin-left:auto;", "2h ago" }
        }
        p { style: "margin:0;color:#333;font-size:14px;", "This is a great component!" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
