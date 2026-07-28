use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:transparent;color:#666;cursor:pointer;", "G" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "P" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "S" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "D" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;", "✓" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
