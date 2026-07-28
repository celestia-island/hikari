use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;font-size:14px;",
        div { style: "padding:4px 0;cursor:pointer;", "▼ Folder 1" }
        div { style: "padding:4px 0 4px 20px;color:#666;", "  File A" }
        div { style: "padding:4px 0 4px 20px;color:#666;", "  File B" }
        div { style: "padding:4px 0;cursor:pointer;", "▶ Folder 2" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
