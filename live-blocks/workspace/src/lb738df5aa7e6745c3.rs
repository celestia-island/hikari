use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;position:relative;",
        div { style: "padding:12px;border:1px solid #ccc;border-radius:8px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.1);opacity:0.8;display:inline-block;", "Dragging item" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
