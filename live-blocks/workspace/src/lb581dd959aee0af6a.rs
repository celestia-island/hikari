use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;position:relative;width:240px;",
        input { type: "search", placeholder: "Search...", value: "ru", style: "padding:8px 12px;border:1px solid #3a6ea5;border-radius:6px;font-size:14px;width:100%;" }
        div { style: "margin-top:4px;border:1px solid #e2e2ea;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.08);",
            div { style: "padding:8px 12px;font-size:14px;background:#f0f7ff;cursor:pointer;", "Rust" }
            div { style: "padding:8px 12px;font-size:14px;cursor:pointer;", "Ruby" }
        }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
