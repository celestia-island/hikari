pub mod dashboard_demo;
pub mod form_demo;
pub mod showcase;
pub mod video_demo;

use tairitsu_vdom::VNode;

pub fn render_showcase() -> VNode {
    showcase::render_showcase()
}

pub fn render_form_demo() -> VNode {
    form_demo::render_form_demo()
}

pub fn render_dashboard_demo() -> VNode {
    dashboard_demo::render_dashboard_demo()
}

pub fn render_all() -> Vec<VNode> {
    vec![
        render_showcase(),
        render_form_demo(),
        render_dashboard_demo(),
        video_demo::render(),
    ]
}
