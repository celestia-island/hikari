//! Shared layout components: top nav and sidebar.
//!
//! Uses hikari-components CSS class names (hi-header, hi-aside, etc.)
//! so the bundle.css styles apply correctly for the drawer/header/aside layout.

pub mod aside_footer;
pub mod breadcrumb;
pub mod code_block;
pub mod doc_components;
pub mod dynamic_markdown;
pub mod demo_page;
pub mod glow;
pub mod layout;
pub mod markdown_renderer;
pub mod page_layout;
pub mod portal;
pub mod portal_examples;
pub mod sidebar;
pub mod top_nav;

pub mod registry;

pub use aside_footer::render as aside_footer;
pub use breadcrumb::render as breadcrumb;
pub use layout::render as layout;
pub use registry::render_component_demo;
pub use sidebar::render as sidebar;
pub use top_nav::render as top_nav;
