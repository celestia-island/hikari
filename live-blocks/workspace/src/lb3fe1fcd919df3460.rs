use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;position:relative;width:200px;",
        button { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;width:100%;text-align:left;cursor:pointer;", "Select ▼" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
