pub mod cascader;
pub mod collapsible;
pub mod data;
pub mod feedback;
pub mod form;
pub mod navigation;
pub mod pagination;
pub mod qrcode;
pub mod table;
pub mod timeline;
pub mod transfer;
pub mod tree;

use tairitsu_vdom::VNode;

pub fn render_all() -> Vec<VNode> {
    vec![
        navigation::render(),
        data::render(),
        table::render(),
        tree::render(),
        pagination::render(),
        qrcode::render(),
        timeline::render(),
        form::render(),
        cascader::render(),
        transfer::render(),
        collapsible::render(),
        feedback::render(),
    ]
}
