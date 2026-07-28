use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;max-width:300px;",
        div { style: "border:1px solid #e2e2ea;border-radius:8px;margin-bottom:4px;",
            div { style: "padding:10px 12px;font-weight:600;background:#f7f7fa;cursor:pointer;", "Panel 1 ▼" }
            div { style: "padding:10px 12px;color:#666;font-size:14px;", "Content 1" }
        }
        div { style: "border:1px solid #e2e2ea;border-radius:8px;",
            div { style: "padding:10px 12px;font-weight:600;background:#f7f7fa;cursor:pointer;", "Panel 2 ▶" }
        }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
