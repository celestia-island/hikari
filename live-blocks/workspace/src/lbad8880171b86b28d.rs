use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        p { style: "margin:0 0 16px;", "Content above" }
        hr { style: "border:none;border-top:1px solid #e2e2ea;margin:0;" }
        p { style: "margin:16px 0 0;", "Content below" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
