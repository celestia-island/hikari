// website/src/pages/system/mod.rs
// System showcase pages

pub mod animations;
pub mod css;
pub mod icons;
pub mod overview;
pub mod palette;

// Re-export page components
pub use overview::SystemOverview;
pub use css::SystemCSS;
pub use icons::SystemIcons;
pub use palette::SystemPalette;
pub use animations::SystemAnimations;
