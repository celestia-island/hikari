use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
