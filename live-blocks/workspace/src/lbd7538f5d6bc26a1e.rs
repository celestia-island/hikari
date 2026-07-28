use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;",
        div { style: "padding:8px 12px;border-bottom:1px solid #e2e2ea;font-size:12px;color:#999;", "Markdown Editor" }
        div { style: "padding:12px;", "Type **markdown** here..." }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
