use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "A" }
        div { style: "width:40px;height:40px;border-radius:8px;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "B" }
        div { style: "width:40px;height:40px;border-radius:0;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "C" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
