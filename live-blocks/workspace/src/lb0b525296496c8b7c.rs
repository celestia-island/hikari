use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;max-width:300px;",
        div { style: "margin-bottom:12px;",
            label { style: "display:block;font-size:14px;margin-bottom:4px;", "Username" }
            input { type: "text", style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;width:100%;font-size:14px;" }
        }
        div { style: "margin-bottom:12px;",
            label { style: "display:block;font-size:14px;margin-bottom:4px;", "Password" }
            input { type: "password", style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;width:100%;font-size:14px;" }
        }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Submit" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
