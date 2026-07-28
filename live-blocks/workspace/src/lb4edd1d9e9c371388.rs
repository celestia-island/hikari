use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Enter text...", style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;width:200px;" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
