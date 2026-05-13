pub mod avatar;
pub mod button;
pub mod comment;
pub mod description_list;
pub mod display;
pub mod empty;
pub mod feedback;
pub mod form;
pub mod image;
pub mod number_input;
pub mod search;
pub mod switch;
pub mod tag;

use tairitsu_vdom::VNode;

pub fn render_all() -> Vec<VNode> {
    vec![
        button::render(),
        form::render(),
        number_input::render(),
        search::render(),
        switch::render(),
        feedback::render(),
        display::render(),
        avatar::render(),
        image::render(),
        tag::render(),
        empty::render(),
        comment::render(),
        description_list::render(),
    ]
}
