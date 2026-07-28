use tairitsu_vdom::VNode;
use hikari_components::prelude::*;

fn main() {
    let vnode: VNode = rsx! {
    div { style: "padding:1rem;",
        table { style: "border-collapse:collapse;width:100%;font-size:14px;",
            thead { tr { th { style: "border:1px solid #e2e2ea;padding:8px;text-align:left;background:#f7f7fa;", "Name" }
                         th { style: "border:1px solid #e2e2ea;padding:8px;text-align:left;background:#f7f7fa;", "Age" } } }
            tbody { tr { td { style: "border:1px solid #e2e2ea;padding:8px;", "Alice" }
                         td { style: "border:1px solid #e2e2ea;padding:8px;", "30" } }
                    tr { td { style: "border:1px solid #e2e2ea;padding:8px;", "Bob" }
                         td { style: "border:1px solid #e2e2ea;padding:8px;", "25" } } }
        }
    }
};
    let html = vnode.render_to_html();
    print!("{}", html);
}
