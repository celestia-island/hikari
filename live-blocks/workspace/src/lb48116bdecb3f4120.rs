use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "Open Modal" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
