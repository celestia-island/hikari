//! # Hikari Render Service
//!
//! Complete rendering service for Hikari applications.
//!
//! This crate provides:
//! - HTML service (default/custom templates)
//! - CSS style service (component styles)
//! - SSR plugin builder for easy setup
//! - Router builder with Dioxus integration
//! - Static asset serving with caching
//!
//! ## Example
//!
//! ```rust,no_run
//! use hikari_render_service::HikariRenderServicePlugin;
//! use hikari_components::StyleRegistry;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let mut registry = StyleRegistry::default();
//!     registry.register_all();  // Register all Hikari components
//!
//!     let app = HikariRenderServicePlugin::new()
//!         .component_style_registry(registry)  // Convert from hikari_components
//!         .build()?;
//!
//!     let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
//!     axum::serve(listener, app).await?;
//!     Ok(())
//! }
//! ```

pub mod html;
pub mod plugin;
pub mod registry;
pub mod router;
pub mod static_files;
pub mod styles_service;

// Re-exports
pub use html::HtmlService;
pub use plugin::{HikariRenderServicePlugin, StaticMountConfig, StyleRegistry};
pub use router::build_router;
pub use static_files::{serve_static_files, StaticFileConfig};
pub use styles_service::StyleService;
