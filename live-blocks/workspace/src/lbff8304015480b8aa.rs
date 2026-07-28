use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        div { style: "display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #3a6ea5;border-radius:8px;background:rgba(58,110,165,0.05);",
            div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;color:#fff;display:flex;align-items:center;justify-content:center;", "!" }
            span { style: "font-size:14px;color:#333;", "Tip: Use arrow keys to navigate" }
        }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
