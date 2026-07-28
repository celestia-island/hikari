use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;flex-wrap:wrap;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Primary" }
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "Secondary" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:transparent;color:#3a6ea5;cursor:pointer;", "Ghost" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "Danger" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
