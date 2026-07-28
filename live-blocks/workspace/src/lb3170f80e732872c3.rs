use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        div { style: "width:100px;height:100px;background:#000;display:grid;grid-template-columns:repeat(10,1fr);",
            div { style: "background:#fff;aspect-ratio:1;", "" }
        }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
