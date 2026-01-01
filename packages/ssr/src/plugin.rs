//! SSR plugin builder for Hikari applications.
//!
//! Provides a fluent builder API for configuring SSR behavior.

use crate::router::build_router;
use crate::router::AppState;
use crate::static_files::StaticFileConfig;
use axum::routing::MethodRouter;
use std::collections::HashMap;
use std::path::PathBuf;
use thiserror::Error;

/// Errors that can occur during SSR plugin configuration.
#[derive(Error, Debug)]
pub enum SsrPluginError {
    #[error("Invalid static assets path: {0}")]
    InvalidStaticPath(String),

    #[error("Route path must start with '/': {0}")]
    InvalidRoutePath(String),

    #[error("State key already exists: {0}")]
    StateKeyExists(String),
}

/// Represents a single route in the router.
pub struct RouterRoute {
    pub path: String,
    pub method_router: MethodRouter<AppState>,
}

/// SSR plugin builder for configuring Hikari SSR applications.
///
/// # Example
///
/// ```rust,no_run
/// use hikari_ssr::HikariSsrPlugin;
/// use axum::routing::get;
///
/// async fn health() -> &'static str {
///     "OK"
/// }
///
/// let plugin = HikariSsrPlugin::new()
///     .add_route("/api/health", get(health))
///     .static_assets("./dist")
///     .state("app_name", "Hikari App")
///     .build()
///     .unwrap();
/// ```
pub struct HikariSsrPlugin {
    routes: Vec<RouterRoute>,
    static_assets_path: Option<PathBuf>,
    static_config: StaticFileConfig,
    state: HashMap<String, serde_json::Value>,
}

impl Default for HikariSsrPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl HikariSsrPlugin {
    /// Creates a new SSR plugin builder with default configuration.
    pub fn new() -> Self {
        Self {
            routes: Vec::new(),
            static_assets_path: None,
            static_config: StaticFileConfig::default(),
            state: HashMap::new(),
        }
    }

    /// Adds a custom route to the router.
    ///
    /// # Arguments
    ///
    /// * `path` - The URL path (must start with '/')
    /// * `method_router` - The Axum MethodRouter for this path
    ///
    /// # Errors
    ///
    /// Returns an error if the path doesn't start with '/'.
    pub fn add_route<S>(mut self, path: S, method_router: MethodRouter<AppState>) -> Self
    where
        S: AsRef<str>,
    {
        let path_str = path.as_ref();
        if !path_str.starts_with('/') {
            panic!("Route path must start with '/': got '{}'", path_str);
        }

        self.routes.push(RouterRoute {
            path: path_str.to_string(),
            method_router,
        });
        self
    }

    /// Sets the static assets directory path.
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the directory containing static assets
    pub fn static_assets<S>(mut self, path: S) -> Self
    where
        S: Into<String>,
    {
        let path_str = path.into();
        let path_buf = PathBuf::from(&path_str);

        if path_buf.exists() && !path_buf.is_dir() {
            panic!(
                "Static assets path exists but is not a directory: {}",
                path_str
            );
        }

        self.static_assets_path = Some(path_buf);
        self
    }

    /// Configures static file serving options.
    ///
    /// # Arguments
    ///
    /// * `config` - StaticFileConfig with caching and MIME settings
    pub fn static_config(mut self, config: StaticFileConfig) -> Self {
        self.static_config = config;
        self
    }

    /// Adds a state value that will be available to all handlers.
    ///
    /// # Arguments
    ///
    /// * `key` - State key identifier
    /// * `value` - State value (must be serializable)
    pub fn state<K, V>(mut self, key: K, value: V) -> Self
    where
        K: Into<String>,
        V: serde::Serialize,
    {
        let key_str = key.into();
        let json_value = serde_json::to_value(value).expect("Failed to serialize state value");

        self.state.insert(key_str, json_value);
        self
    }

    /// Builds the Axum Router with all configured routes and middleware.
    ///
    /// # Errors
    ///
    /// Returns an error if configuration is invalid.
    pub fn build(self) -> anyhow::Result<axum::Router> {
        build_router(
            self.routes,
            self.static_assets_path,
            self.static_config,
            self.state,
        )
    }

    /// Returns the number of configured routes.
    pub fn route_count(&self) -> usize {
        self.routes.len()
    }

    /// Returns whether static assets are configured.
    pub fn has_static_assets(&self) -> bool {
        self.static_assets_path.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_plugin_creation() {
        let plugin = HikariSsrPlugin::new();
        assert_eq!(plugin.route_count(), 0);
        assert!(!plugin.has_static_assets());
    }

    #[tokio::test]
    async fn test_add_route() {
        async fn handler() -> &'static str {
            "OK"
        }

        let plugin = HikariSsrPlugin::new().add_route("/test", axum::routing::get(handler));

        assert_eq!(plugin.route_count(), 1);
    }

    #[tokio::test]
    #[should_panic(expected = "Route path must start with '/'")]
    async fn test_invalid_route_path() {
        async fn handler() -> &'static str {
            "OK"
        }

        let _ = HikariSsrPlugin::new().add_route("invalid", axum::routing::get(handler));
    }

    #[tokio::test]
    async fn test_static_assets() {
        let plugin = HikariSsrPlugin::new().static_assets("./dist");

        assert!(plugin.has_static_assets());
    }

    #[tokio::test]
    async fn test_state() {
        let plugin = HikariSsrPlugin::new()
            .state("app_name", "Test App")
            .state("version", 1);

        assert_eq!(plugin.route_count(), 0);
    }
}
