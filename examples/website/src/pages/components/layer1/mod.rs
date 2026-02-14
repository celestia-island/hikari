// website/src/pages/components/layer1/mod.rs
// Layer 1 components index

pub mod basic;
pub mod basic_components;
pub mod display;
pub mod feedback;
pub mod form;
pub mod switch;

// New components from entry/display
pub mod avatar;
pub mod comment;
pub mod description_list;
pub mod empty;
pub mod image;
pub mod number_input;
pub mod search;
pub mod tag;

// Re-exports
pub use basic::Layer1Basic;
pub use basic_components::*;
pub use display::Layer1Display;
pub use feedback::Layer1Feedback;
pub use form::Layer1Form;
pub use switch::Layer1Switch;

// Re-export new components
pub use avatar::Avatar;
pub use comment::Comment;
pub use description_list::DescriptionList;
pub use empty::Empty;
pub use image::Image;
pub use number_input::NumberInput;
pub use search::Search;
pub use tag::Tag;
