use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
