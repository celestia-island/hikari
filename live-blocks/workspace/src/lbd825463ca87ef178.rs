use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;display:flex;gap:4px;overflow-x:auto;",
        div { style: "min-width:120px;padding:8px;border:1px solid #e2e2ea;border-radius:8px;font-size:12px;", "Task A
3 days" }
        div { style: "min-width:80px;padding:8px;border:1px solid #e2e2ea;border-radius:8px;font-size:12px;", "Task B
2 days" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
