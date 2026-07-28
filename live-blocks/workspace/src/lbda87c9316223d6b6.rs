use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;",
        div { style: "padding:8px 12px;border-bottom:1px solid #e2e2ea;display:flex;gap:8px;",
            button { style: "border:none;background:none;cursor:pointer;font-weight:bold;", "B" }
            button { style: "border:none;background:none;cursor:pointer;font-style:italic;", "I" }
            button { style: "border:none;background:none;cursor:pointer;text-decoration:underline;", "U" }
        }
        div { style: "padding:12px;min-height:60px;", "Rich text content" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
