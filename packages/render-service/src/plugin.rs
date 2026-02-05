//! Render service plugin builder for Hikari applications.
//!
//! Provides a fluent builder API for configuring rendering behavior.

use std::{collections::HashMap, path::PathBuf};

use axum::routing::MethodRouter;
use thiserror::Error;

use crate::{
    registry::StyleRegistry as RenderServiceStyleRegistry,
    router::{AppState, build_router},
    static_files::StaticFileConfig,
};

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

/// Configuration for static asset mounting.
#[derive(Clone, Debug)]
pub struct StaticMountConfig {
    /// Local filesystem path to the assets
    pub local_path: PathBuf,
    /// URL path to mount the assets (e.g., "/static")
    pub url_path: String,
    /// File serving configuration
    pub config: StaticFileConfig,
}

impl StaticMountConfig {
    /// Create a new static mount configuration.
    ///
    /// # Arguments
    ///
    /// * `local_path` - Local filesystem path
    /// * `url_path` - URL path to mount at (must start with '/')
    pub fn new<S>(local_path: impl Into<PathBuf>, url_path: S) -> Self
    where
        S: Into<String>,
    {
        Self {
            local_path: local_path.into(),
            url_path: url_path.into(),
            config: StaticFileConfig::default(),
        }
    }

    /// Set custom file serving configuration.
    pub fn config(mut self, config: StaticFileConfig) -> Self {
        self.config = config;
        self
    }
}

/// Render service plugin builder for configuring Hikari applications.
///
/// # Example
///
/// ```rust,no_run
/// use render_service::HikariRenderServicePlugin;
/// use components::StyleRegistry;
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
///     .component_style_registry(registry)  // Convert from components
///     .add_route("/api/health", get(health))
///     .static_assets("./dist", "/static")  // Custom mount path
///     .icon_assets("./packages/icons/dist/lucide/icons", "/static/icons")
///     .build()
///     .unwrap();
/// ```
pub struct HikariRenderServicePlugin {
    routes: Vec<RouterRoute>,
    static_mounts: Vec<StaticMountConfig>,
    state: HashMap<String, serde_json::Value>,
    style_registry: Option<RenderServiceStyleRegistry>,
    public_dir: Option<String>,
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
            static_mounts: Vec::new(),
            state: HashMap::new(),
            style_registry: None,
            public_dir: None,
        }
    }

    /// Sets the public directory path for serving index.html.
    ///
    /// # Arguments
    ///
    /// * `public_dir` - Path to the public directory containing index.html
    pub fn public_dir(mut self, public_dir: impl Into<String>) -> Self {
        self.public_dir = Some(public_dir.into());
        self
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

    /// Sets the style registry from components.
    ///
    /// # Arguments
    ///
    /// * `registry` - components::StyleRegistry with registered component styles
    pub fn component_style_registry(mut self, registry: components::StyleRegistry) -> Self {
        // Convert components::StyleRegistry to render-service StyleRegistry
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

    /// Mount static assets with custom path configuration.
    ///
    /// # Arguments
    ///
    /// * `local_path` - Local filesystem path to assets
    /// * `url_path` - URL path to mount at (default: "/static")
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use render_service::HikariRenderServicePlugin;
    /// let plugin = HikariRenderServicePlugin::new()
    ///     .static_assets("./dist", "/static");
    /// ```
    pub fn static_assets<S, T>(mut self, local_path: S, url_path: T) -> Self
    where
        S: Into<PathBuf>,
        T: AsRef<str>,
    {
        let local = local_path.into();
        let url = url_path.as_ref();

        if !url.starts_with('/') {
            panic!("Static URL path must start with '/': got '{}'", url);
        }

        let mount_config = StaticMountConfig::new(local, url);
        self.static_mounts.push(mount_config);
        self
    }

    /// Mount icon assets with custom path configuration.
    ///
    /// # Arguments
    ///
    /// * `local_path` - Local filesystem path to icon assets
    /// * `url_path` - URL path to mount at (default: "/static/icons")
    ///
    /// # Important: Icon Path Configuration
    ///
    /// Icon assets should be mounted at **/icons** or **/static/icons** to ensure:
    /// - Icon requests (`/icons/moon.svg`) don't fall through to SPA fallback
    /// - Missing icons return 404 SVG (not HTML)
    /// - Icon routes are properly scoped under the icons path
    ///
    /// # Recommended Configuration
    ///
    /// ```rust,no_run
    /// # use render_service::HikariRenderServicePlugin;
    /// let plugin = HikariRenderServicePlugin::new()
    ///     .icon_assets("./packages/builder/generated/mdi_svgs", "/icons");
    /// ```
    ///
    /// # Example with Custom Mount
    ///
    /// ```rust,no_run
    /// # use render_service::HikariRenderServicePlugin;
    /// let plugin = HikariRenderServicePlugin::new()
    ///     .icon_assets("./packages/icons/dist/lucide/icons", "/static/icons");
    /// ```
    ///
    /// # Icon Fallback Handler
    ///
    /// The render-service includes a dedicated icon fallback handler at `/icons/*` that:
    /// - Returns 404 SVG for missing icons (not HTML)
    /// - Logs helpful error messages
    /// - Prevents icon requests from falling through to SPA fallback
    ///
    /// This ensures that when an icon is missing, the frontend won't accidentally
    /// render the entire application HTML inside an Icon component (which would cause
    /// nested DOM rendering issues).
    pub fn icon_assets<S, T>(mut self, local_path: S, url_path: T) -> Self
    where
        S: Into<PathBuf>,
        T: AsRef<str>,
    {
        let local = local_path.into();
        let url = url_path.as_ref();

        if !url.starts_with('/') {
            panic!("Icon URL path must start with '/': got '{}'", url);
        }

        let mount_config = StaticMountConfig::new(local, url);
        self.static_mounts.push(mount_config);
        self
    }

    /// Configure static file serving options for a specific mount.
    ///
    /// This is a convenience method for advanced configuration.
    /// For simple cases, use `static_assets()` directly.
    pub fn mount_static(mut self, mount_config: StaticMountConfig) -> Self {
        self.static_mounts.push(mount_config);
        self
    }

    /// Adds a state value that will be available to all handlers.
    ///
    /// # Arguments
    ///
    /// * `key` - State key identifier
    /// * `value` - State value (must be serializable)
    ///
    /// # Errors
    ///
    /// Returns an error if the value cannot be serialized.
    pub fn state<K, V>(mut self, key: K, value: V) -> Result<Self, anyhow::Error>
    where
        K: Into<String>,
        V: serde::Serialize,
    {
        let key_str = key.into();
        let json_value = serde_json::to_value(value)
            .map_err(|e| anyhow::anyhow!("Failed to serialize state value: {}", e))?;

        self.state.insert(key_str, json_value);
        Ok(self)
    }

    /// Builds the Axum Router with all configured routes and middleware.
    ///
    /// # Errors
    ///
    /// Returns an error if configuration is invalid.
    pub fn build(self) -> anyhow::Result<axum::Router> {
        let public_dir = self.public_dir.unwrap_or_else(|| "public".to_string());
        build_router(
            self.routes,
            self.static_mounts,
            self.state,
            self.style_registry,
            Some(public_dir),
        )
    }

    /// Returns the number of configured routes.
    pub fn route_count(&self) -> usize {
        self.routes.len()
    }

    /// Returns the number of configured static mounts.
    pub fn static_mount_count(&self) -> usize {
        self.static_mounts.len()
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
        assert_eq!(plugin.static_mount_count(), 0);
    }

    #[tokio::test]
    async fn test_add_route() {
        async fn handler() -> &'static str {
            "OK"
        }

        let plugin =
            HikariRenderServicePlugin::new().add_route("/test", axum::routing::get(handler));

        assert_eq!(plugin.route_count(), 1);
    }

    #[tokio::test]
    async fn test_style_registry() {
        let mut registry = StyleRegistry::default();
        registry.register("button", ".button { color: red; }");

        let plugin = HikariRenderServicePlugin::new().style_registry(registry);

        assert!(plugin.get_style_registry().is_some());
        assert!(plugin.get_style_registry().unwrap().has("button"));
    }

    #[tokio::test]
    async fn test_static_assets() {
        let plugin = HikariRenderServicePlugin::new().static_assets("./dist", "/static");

        assert_eq!(plugin.static_mount_count(), 1);
    }

    #[tokio::test]
    async fn test_icon_assets() {
        let plugin = HikariRenderServicePlugin::new().icon_assets("./icons", "/static/icons");

        assert_eq!(plugin.static_mount_count(), 1);
    }

    #[tokio::test]
    async fn test_multiple_static_mounts() {
        let plugin = HikariRenderServicePlugin::new()
            .static_assets("./dist", "/static")
            .icon_assets("./icons", "/static/icons");

        assert_eq!(plugin.static_mount_count(), 2);
    }
}
