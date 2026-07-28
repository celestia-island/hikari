use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;flex-wrap:wrap;",
        span { style: "padding:2px 8px;border-radius:4px;background:#f0f0f0;font-size:12px;color:#333;", "Default" }
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(58,110,165,0.1);color:#3a6ea5;font-size:12px;", "Primary" }
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(34,197,94,0.1);color:#22c55e;font-size:12px;", "Success" }
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(245,158,11,0.1);color:#f59e0b;font-size:12px;", "Warning" }
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:12px;", "Danger" }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
