// website/src/components/mod.rs
// Demo-specific components

// Layout components
pub mod aside_footer;
pub mod layout;

// Navigation components
pub mod sidebar;
pub mod top_nav;

// Dynamic component registry
pub mod registry;

// Editor components
pub mod code_block;
pub mod markdown_renderer;

// Documentation components
pub mod doc_components;

// Re-export commonly used components
pub use aside_footer::AsideFooter;
pub use code_block::CodeBlock;
pub use doc_components::{ExampleCard, PropsRow, PropsTable, Section};
pub use layout::Layout;
pub use markdown_renderer::{render_markdown, MarkdownRenderer};
