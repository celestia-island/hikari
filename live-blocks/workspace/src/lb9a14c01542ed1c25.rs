use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;display:flex;align-items:center;gap:12px;",
        button { style: "width:40px;height:40px;border-radius:50%;border:none;background:#3a6ea5;color:#fff;cursor:pointer;font-size:16px;", "▶" }
        div { style: "flex:1;",
            div { style: "height:4px;background:#e2e2ea;border-radius:2px;",
                div { style: "width:30%;height:100%;background:#3a6ea5;border-radius:2px;", "" } }
            div { style: "display:flex;justify-content:space-between;font-size:12px;color:#999;margin-top:4px;",
                span { "1:23" } span { "4:56" } }
        }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
