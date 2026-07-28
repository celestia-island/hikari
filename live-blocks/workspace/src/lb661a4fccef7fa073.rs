use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        input { type: "search", placeholder: "Search...", style: "padding:8px 12px 8px 36px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
