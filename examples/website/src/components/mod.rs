// website/src/components/mod.rs
// Demo-specific components

// Layout components
pub mod aside_footer;
pub mod layout;

// Navigation components
pub mod sidebar;
pub mod top_nav;

// Re-export commonly used components
pub use aside_footer::AsideFooter;
pub use layout::Layout;
