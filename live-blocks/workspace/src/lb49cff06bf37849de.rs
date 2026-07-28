use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        div { style: "border:2px dashed #ccc;border-radius:8px;padding:2rem;text-align:center;color:#999;",
            "Click or drag file to upload" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
