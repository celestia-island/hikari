use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        div { style: "position:relative;width:320px;height:180px;background:#000;border-radius:8px;display:flex;align-items:center;justify-content:center;",
            button { style: "width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);color:#333;cursor:pointer;font-size:20px;", "▶" }
        }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
