use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
