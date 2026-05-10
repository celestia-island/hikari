pub mod layer1;
pub mod layer2;
pub mod layer3;
pub mod overview;

use tairitsu_vdom::VNode;

pub fn render_all() -> Vec<VNode> {
    let mut pages = Vec::new();
    pages.push(overview::render());
    pages.extend(layer1::render_all());
    pages.extend(layer2::render_all());
    pages.extend(layer3::render_all());
    pages
}
