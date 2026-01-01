//! # Hikari SSR
//!
//! Server-Side Rendering integration for Hikari applications using Axum.
//!
//! This crate provides:
//! - SSR plugin builder for easy setup
//! - Router builder with Dioxus integration
//! - Static asset serving with caching
//! - Type-safe state management
//! - Production-ready error handling
//!
//! ## Example
//!
//! ```rust,no_run
//! use hikari_ssr::{HikariSsrPlugin, router};
//! use axum::Router;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let app = HikariSsrPlugin::new()
//!         .add_route("/api/health", health_handler)
//!         .static_assets("./dist")
//!         .build()?;
//!
//!     let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
//!     axum::serve(listener, app).await?;
//!     Ok(())
//! }
//! ```

pub mod plugin;
pub mod router;
pub mod static_files;

#[cfg(feature = "example")]
pub mod example;

// Re-exports for convenience
pub use plugin::HikariSsrPlugin;
pub use router::build_router;
pub use static_files::{serve_static_files, StaticFileConfig};
