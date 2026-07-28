use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        label { style: "display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;",
            input { type: "checkbox", checked: true, style: "width:16px;height:16px;" }
            "Checked" }
        label { style: "display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;",
            input { type: "checkbox", style: "width:16px;height:16px;" }
            "Unchecked" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
