use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:300px;background:#fff;",
        h3 { style: "margin:0 0 8px;font-size:16px;", "Card Title" }
        p { style: "margin:0;color:#666;font-size:14px;", "Card content goes here." }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
