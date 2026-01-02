//! Render service plugin builder for Hikari applications.
//!
//! Provides a fluent builder API for configuring rendering behavior.

use crate::router::build_router;
use crate::router::AppState;
use crate::static_files::StaticFileConfig;
use crate::registry::StyleRegistry as RenderServiceStyleRegistry;
use axum::routing::MethodRouter;
use std::collections::HashMap;
use std::path::PathBuf;
use thiserror::Error;

// Re-export StyleRegistry for convenience
pub use crate::registry::StyleRegistry;

/// Errors that can occur during plugin configuration.
#[derive(Error, Debug)]
pub enum RenderServiceError {
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

/// Render service plugin builder for configuring Hikari applications.
///
/// # Example
///
/// ```rust,no_run
/// use hikari_render_service::HikariRenderServicePlugin;
/// use hikari_components::StyleRegistry;
/// use axum::routing::get;
///
/// async fn health() -> &'static str {
///     "OK"
/// }
///
/// let mut registry = StyleRegistry::default();
/// registry.register_all();  // Register all Hikari components
///
/// let plugin = HikariRenderServicePlugin::new()
///     .component_style_registry(registry)  // Convert from hikari_components
///     .add_route("/api/health", get(health))
///     .static_assets("./dist")
///     .build()
///     .unwrap();
/// ```
pub struct HikariRenderServicePlugin {
    routes: Vec<RouterRoute>,
    static_assets_path: Option<PathBuf>,
    static_config: StaticFileConfig,
    state: HashMap<String, serde_json::Value>,
    style_registry: Option<RenderServiceStyleRegistry>,
}

impl Default for HikariRenderServicePlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl HikariRenderServicePlugin {
    /// Creates a new render service plugin builder with default configuration.
    pub fn new() -> Self {
        Self {
            routes: Vec::new(),
            static_assets_path: None,
            static_config: StaticFileConfig::default(),
            state: HashMap::new(),
            style_registry: None,
        }
    }

    /// Sets the style registry for managing component styles.
    ///
    /// # Arguments
    ///
    /// * `registry` - StyleRegistry with registered component styles
    pub fn style_registry(mut self, registry: StyleRegistry) -> Self {
        self.style_registry = Some(registry);
        self
    }

    /// Sets the style registry from hikari_components.
    ///
    /// # Arguments
    ///
    /// * `registry` - hikari_components::StyleRegistry with registered component styles
    pub fn component_style_registry(mut self, registry: hikari_components::StyleRegistry) -> Self {
        // Convert hikari_components::StyleRegistry to render-service StyleRegistry
        let mut render_registry = RenderServiceStyleRegistry::default();

        // The components StyleRegistry stores &str, we need to convert to String
        for (name, css) in registry.get_all() {
            render_registry.register(name, css);
        }

        self.style_registry = Some(render_registry);
        self
    }

    /// Registers a styled component to the style registry.
    ///
    /// # Arguments
    ///
    /// * `css` - Static CSS content
    /// * `name` - Component name identifier
    pub fn register_style(mut self, name: &'static str, css: &'static str) -> Self {
        if let Some(ref mut registry) = self.style_registry {
            registry.register(name, css);
        } else {
            let mut registry = StyleRegistry::default();
            registry.register(name, css);
            self.style_registry = Some(registry);
        }
        self
    }

    /// Adds a custom route to the router.
    ///
    /// # Arguments
    ///
    /// * `path` - The URL path (must start with '/')
    /// * `method_router` - The Axum MethodRouter for this path
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
            self.style_registry,
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

    /// Returns the style registry if configured.
    pub fn get_style_registry(&self) -> Option<&StyleRegistry> {
        self.style_registry.as_ref()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_plugin_creation() {
        let plugin = HikariRenderServicePlugin::new();
        assert_eq!(plugin.route_count(), 0);
        assert!(!plugin.has_static_assets());
    }

    #[tokio::test]
    async fn test_add_route() {
        async fn handler() -> &'static str {
            "OK"
        }

        let plugin = HikariRenderServicePlugin::new().add_route("/test", axum::routing::get(handler));

        assert_eq!(plugin.route_count(), 1);
    }

    #[tokio::test]
    async fn test_style_registry() {
        let mut registry = StyleRegistry::default();
        registry.register("button", ".button { color: red; }");

        let plugin = HikariRenderServicePlugin::new()
            .style_registry(registry);

        assert!(plugin.get_style_registry().is_some());
        assert!(plugin.get_style_registry().unwrap().has("button"));
    }
}
