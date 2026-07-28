use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;width:200px;",
        div { style: "padding:8px 12px;border-radius:4px;background:rgba(58,110,165,0.1);color:#3a6ea5;font-size:14px;font-weight:500;", "Item 1 (Active)" }
        div { style: "padding:8px 12px;color:#666;font-size:14px;cursor:pointer;", "Item 2" }
        div { style: "padding:8px 12px;color:#666;font-size:14px;cursor:pointer;", "Item 3" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
