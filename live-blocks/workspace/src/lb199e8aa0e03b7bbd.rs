use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;position:relative;",
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "Hover me" }
        div { style: "position:absolute;top:40px;left:0;padding:8px 12px;background:#333;color:#fff;border-radius:4px;font-size:12px;white-space:nowrap;", "Popover content" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
