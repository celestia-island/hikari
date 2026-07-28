use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;color:#999;", "Component preview: pages/system/css#spacing" }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
