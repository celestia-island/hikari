use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;",
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(58,110,165,0.1);color:#3a6ea5;font-size:12px;display:flex;align-items:center;gap:4px;", "Tag ✕" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
