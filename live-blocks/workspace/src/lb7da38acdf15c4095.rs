use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        div { style: "display:flex;gap:4px;border-bottom:2px solid #e2e2ea;margin-bottom:12px;",
            button { style: "padding:6px 16px;border:none;background:none;color:#3a6ea5;font-weight:500;border-bottom:2px solid #3a6ea5;margin-bottom:-2px;cursor:pointer;", "Tab 1" }
            button { style: "padding:6px 16px;border:none;background:none;color:#999;cursor:pointer;", "Tab 2" }
            button { style: "padding:6px 16px;border:none;background:none;color:#999;cursor:pointer;", "Tab 3" }
        }
        div { style: "padding:8px;color:#333;font-size:14px;", "Content of Tab 1" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
