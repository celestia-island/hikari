pub mod editor;
pub mod media;
pub mod user_guide;
pub mod visualization;
pub mod zoom_controls;

use tairitsu_vdom::VNode;

pub fn render_all() -> Vec<VNode> {
    vec![
        media::render(),
        editor::render(),
        visualization::render(),
        user_guide::render(),
        zoom_controls::render(),
    ]
}
