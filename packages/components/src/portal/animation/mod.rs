// hi-components/src/portal/animation/mod.rs
// Animation modules for portal components

pub mod dropdown_animation;

pub use dropdown_animation::{
    DropdownAnimationState, DropdownEvent, DropdownRenderContext,
    dropdown_get_styles, dropdown_transition,
};
