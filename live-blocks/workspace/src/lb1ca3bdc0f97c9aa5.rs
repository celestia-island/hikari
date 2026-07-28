use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        div { style: "background:#1e1e2a;border-radius:8px;overflow:hidden;",
            div { style: "padding:6px 12px;background:#16161e;color:#999;font-size:12px;border-bottom:1px solid #333;", "main.rs" }
            pre { style: "padding:12px;color:#e0e0e8;font-size:13px;margin:0;", "fn main() { println!("Hello"); }" }
        }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
