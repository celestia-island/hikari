use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;",
        label { style: "display:flex;align-items:center;gap:4px;font-size:14px;",
            input { type: "radio", checked: true, name: "g" } "Option A" }
        label { style: "display:flex;align-items:center;gap:4px;font-size:14px;",
            input { type: "radio", name: "g" } "Option B" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
