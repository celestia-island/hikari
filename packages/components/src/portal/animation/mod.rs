// hi-components/src/portal/animation/mod.rs
// Animation modules for portal components

pub mod dropdown_animation;

pub use dropdown_animation::{DropdownAnimationState, DropdownEvent};

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub use dropdown_animation::{DropdownRenderContext, dropdown_render, dropdown_transition};
