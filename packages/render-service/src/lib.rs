//! # Hikari Render Service
//!
//! Server-side rendering (SSR) and static asset serving for Hikari applications.
//!
//! ## Overview
//!
//! The render service provides a complete backend solution for Hikari applications using Axum:
//!
//! - **HTML Rendering**: Customizable HTML templates with injected styles and state
//! - **Style Registry**: Centralized component style management
//! - **Router Builder**: Fluent API for configuring Axum routers
//! - **Static Asset Serving**: Optimized file serving with caching headers
//! - **Plugin System**: Easy integration with Dioxus SSR
//!
//! ## Architecture
//!
//! The render service is organized into several modules:
//!
//! - **[`plugin`]** - [`HikariRenderServicePlugin`] for easy application setup
//! - **[`html`]** - [`HtmlService`] for rendering HTML templates
//! - **[`registry`]** - [`StyleRegistry`] for managing component styles
//! - **[`router`]** - Router builder with Dioxus integration
//! - **[`static_files`]** - Static asset serving with caching
//! - **[`styles_service`]** - CSS style injection and management
//!
//! ## Quick Start
//!
//! ### Basic Setup
//!
//! ```rust,no_run
//! use render_service::HikariRenderServicePlugin;
//! use components::StyleRegistry;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     // Create style registry and register components
//!     let mut registry = StyleRegistry::default();
//!     registry.register_all();
//!
//!     // Build the application
//!     let app = HikariRenderServicePlugin::new()
//!         .component_style_registry(registry)
//!         .static_assets("./dist", "/static")
//!         .build()?;
//!
//!     // Start the server
//!     let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
//!     axum::serve(listener, app).await?;
//!     Ok(())
//! }
//! ```
//!
//! ### Adding Custom Routes
//!
//! ```rust,no_run
//! use render_service::HikariRenderServicePlugin;
//! use axum::routing::get;
//!
//! async fn health_check() -> &'static str {
//!     "OK"
//! }
//!
//! async fn main() -> anyhow::Result<()> {
//!     let app = HikariRenderServicePlugin::new()
//!         .add_route("/health", get(health_check))
//!         .add_route("/api/status", get(async || { "running" }))
//!         .build()?;
//!
//!     // Start server...
//!     Ok(())
//! }
//! ```
//!
//! ### Mounting Static Assets
//!
//! ```rust,no_run
//! use render_service::HikariRenderServicePlugin;
//!
//! async fn main() -> anyhow::Result<()> {
//!     let app = HikariRenderServicePlugin::new()
//!         // Mount general static assets
//!         .static_assets("./dist", "/static")
//!         // Mount icons separately
//!         .icon_assets("./icons/dist", "/static/icons")
//!         // Mount custom fonts
//!         .mount_static(
//!             render_service::StaticMountConfig::new("./fonts", "/static/fonts")
//!         )
//!         .build()?;
//!
//!     // Start server...
//!     Ok(())
//! }
//! ```
//!
//! ### Custom HTML Templates
//!
//! ```rust,no_run
//! use render_service::{HtmlService, HikariRenderServicePlugin};
//!
//! async fn main() -> anyhow::Result<()> {
//!     // Use custom HTML template
//!     let html_service = HtmlService::new()
//!         .with_title("My Hikari App")
//!         .with_description("A beautiful Hikari application")
//!         .with_custom_head(r#"<meta name="author" content="Hikari">"#);
//!
//!     let app = HikariRenderServicePlugin::new()
//!         .with_html_service(html_service)
//!         .build()?;
//!
//!     // Start server...
//!     Ok(())
//! }
//! ```
//!
//! ## Plugin Configuration
//!
//! ### HikariRenderServicePlugin
//!
//! The [`HikariRenderServicePlugin`] provides a fluent builder API:
//!
//! ```rust,no_run
//! use render_service::HikariRenderServicePlugin;
//!
//! let plugin = HikariRenderServicePlugin::new()
//!     // Style management
//!     .component_style_registry(registry)
//!     .register_style("custom", ".custom { color: red; }")
//!
//!     // Routing
//!     .add_route("/api/health", get(health_handler))
//!
//!     // Static assets
//!     .static_assets("./dist", "/static")
//!     .icon_assets("./icons", "/static/icons")
//!
//!     // State management
//!     .state("api_key", "secret")
//!     .state("config", json!({"feature": true}))
//!
//!     // Build the router
//!     .build()?;
//! ```
//!
//! ### Builder Methods
//!
//! | Method | Description |
//!|--------|-------------|
//! | `new()` | Create a new plugin builder |
//! | `style_registry()` | Set style registry |
//! | `component_style_registry()` | Import from components crate |
//! | `register_style()` | Register a component style |
//! | `add_route()` | Add a custom route |
//! | `static_assets()` | Mount static assets |
//! | `icon_assets()` | Mount icon assets |
//! | `mount_static()` | Mount with custom config |
//! | `state()` | Add application state |
//! | `build()` | Build the Axum router |
//!
//! ## Style Registry
//!
//! The [`StyleRegistry`] manages component styles:
//!
//! ```rust,no_run
//! use render_service::StyleRegistry;
//!
//! // Create registry
//! let mut registry = StyleRegistry::default();
//!
//! // Register component styles
//! registry.register("button", ".button { color: red; }");
//! registry.register("card", ".card { border: 1px solid #ccc; }");
//!
//! // Check if style exists
//! if registry.has("button") {
//!     println!("Button style registered");
//! }
//!
//! // Get all styles
//! let all_styles = registry.get_all();
//! for (name, css) in all_styles {
//!     println!("{}: {} bytes", name, css.len());
//! }
//! ```
//!
//! ## Static File Serving
//!
//! ### StaticMountConfig
//!
//! Configure static file serving with [`StaticMountConfig`]:
//!
//! ```rust,no_run
//! use render_service::StaticMountConfig;
//! use render_service::StaticFileConfig;
//!
//! let mount = StaticMountConfig::new("./dist", "/static")
//!     .config(StaticFileConfig {
//!         cache_control: Some("public, max-age=31536000".to_string()),
//!         ..StaticFileConfig::default()
//!     });
//! ```
//!
//! ### StaticFileConfig
//!
//! Options for static file serving:
//!
//! ```rust,no_run
//! use render_service::StaticFileConfig;
//!
//! let config = StaticFileConfig {
//!     // Cache-Control header
//!     cache_control: Some("public, max-age=31536000".to_string()),
//!
//!     // Enable pre-compressed files (.gz, .br)
//!     precompressed: true,
//!
//!     // Default index file
//!     index_file: Some("index.html".to_string()),
//! };
//! ```
//!
//! ## HTML Templates
//!
//! ### HtmlService
//!
//! Customize HTML rendering with [`HtmlService`]:
//!
//! ```rust,no_run
//! use render_service::HtmlService;
//!
//! let html = HtmlService::new()
//!     .with_title("My App")
//!     .with_description("Description")
//!     .with_favicon("/favicon.ico")
//!     .with_custom_head(r#"<link rel="stylesheet" href="/custom.css">"#);
//! ```
//!
//! ## Error Handling
//!
//! The render service uses [`anyhow`] for error handling:
//!
//! ```rust,no_run
//! use render_service::HikariRenderServicePlugin;
//!
//! fn main() -> anyhow::Result<()> {
//!     match HikariRenderServicePlugin::new()
//!         .static_assets("./dist", "/static")
//!         .build()
//!     {
//!         Ok(app) => {
//!             // Start server
//!             Ok(())
//!         }
//!         Err(e) => {
//!             eprintln!("Failed to build app: {}", e);
//!             Err(e)
//!         }
//!     }
//! }
//! ```
//!
//! Common errors:
//!
//! - **InvalidStaticPath**: Static asset path doesn't exist
//! - **InvalidRoutePath**: Route path doesn't start with '/'
//! - **StateKeyExists**: Duplicate state key
//!
//! ## Performance
//!
//! The render service is optimized for production:
//!
//! - **Static Asset Caching**: Configurable Cache-Control headers
//! - **Pre-compression**: Serve .gz and .br files when available
//! - **Style Bundling**: Inline CSS for faster initial render
//! - **Router Optimization**: Efficient route matching with Axum
//!
//! ## Integration with Dioxus SSR
//!
//! The render service integrates seamlessly with Dioxus SSR:
//!
//! ```rust,no_run
//! use render_service::HikariRenderServicePlugin;
//! use dioxus::prelude::*;
//!
//! #[component]
//! fn App() -> Element {
//!     rsx! {
//!         div { "Hello, Hikari!" }
//!     }
//! }
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let app = HikariRenderServicePlugin::new()
//!         .build()?;
//!
//!     // Serve Dioxus app...
//!     Ok(())
//! }
//! }
//! ```
//!
//! ## Security Considerations
//!
//! - **Path Traversal**: Static file serving validates paths to prevent directory traversal
//! - **Content-Type**: Files are served with correct MIME types
//! - **Cache Headers**: Configure appropriate cache policies for sensitive content
//!
//! ## Platform Support
//!
//! - **Linux**: ✅ Fully supported
//! - **macOS**: ✅ Fully supported
//! - **Windows**: ✅ Fully supported

pub mod html;
pub mod icon_route;
pub mod models;
pub mod plugin;
pub mod registry;
pub mod router;
pub mod static_files;
pub mod styles_service;

// Re-exports
pub use html::HtmlService;
pub use icon_route::get_icon_data;
pub use models::{
    BasicComponents, ComponentCategories, DataComponents, FeedbackComponents, NavigationComponents,
    StyleInfo,
};
pub use plugin::{HikariRenderServicePlugin, StaticMountConfig, StyleRegistry};
pub use router::build_router;
pub use static_files::{StaticFileConfig, serve_static_files};
pub use styles_service::StyleService;
