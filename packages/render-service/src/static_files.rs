//! Static file serving for Hikari SSR applications.
//!
//! Provides production-ready static asset serving with caching,
//! proper MIME types, and compression support.

use std::path::PathBuf;
use tokio::fs;

use axum::{
    body::Body,
    extract::Path as AxumPath,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use tokio_util::io::ReaderStream;

/// Configuration for static file serving.
#[derive(Clone, Debug)]
pub struct StaticFileConfig {
    /// Enable browser caching (default: true)
    pub cache_enabled: bool,

    /// Cache-Control max-age in seconds (default: 3600 = 1 hour)
    pub cache_max_age: u64,

    /// Enable gzip compression (default: true)
    pub compression_enabled: bool,

    /// Pre-computed MIME types for common extensions
    pub mime_types: MimeTypes,
}

impl Default for StaticFileConfig {
    fn default() -> Self {
        Self {
            cache_enabled: true,
            cache_max_age: 3600,
            compression_enabled: true,
            mime_types: MimeTypes::default(),
        }
    }
}

impl StaticFileConfig {
    /// Create a new static file config with custom settings.
    pub fn new() -> Self {
        Self::default()
    }

    /// Disable caching for files.
    pub fn no_cache(mut self) -> Self {
        self.cache_enabled = false;
        self
    }

    /// Set custom cache max-age.
    pub fn cache_max_age(mut self, max_age: u64) -> Self {
        self.cache_max_age = max_age;
        self
    }

    /// Disable compression.
    pub fn no_compression(mut self) -> Self {
        self.compression_enabled = false;
        self
    }
}

/// MIME type mappings for common file extensions.
#[derive(Clone, Debug)]
pub struct MimeTypes {
    pub html: &'static str,
    pub css: &'static str,
    pub js: &'static str,
    pub wasm: &'static str,
    pub json: &'static str,
    pub png: &'static str,
    pub jpg: &'static str,
    pub svg: &'static str,
    pub ico: &'static str,
    pub woff: &'static str,
    pub woff2: &'static str,
    pub ttf: &'static str,
    pub eot: &'static str,
    pub txt: &'static str,
    pub xml: &'static str,
    pub pdf: &'static str,
}

impl Default for MimeTypes {
    fn default() -> Self {
        Self {
            html: "text/html; charset=utf-8",
            css: "text/css; charset=utf-8",
            js: "application/javascript; charset=utf-8",
            wasm: "application/wasm",
            json: "application/json; charset=utf-8",
            png: "image/png",
            jpg: "image/jpeg",
            svg: "image/svg+xml",
            ico: "image/x-icon",
            woff: "font/woff",
            woff2: "font/woff2",
            ttf: "font/ttf",
            eot: "application/vnd.ms-fontobject",
            txt: "text/plain; charset=utf-8",
            xml: "application/xml; charset=utf-8",
            pdf: "application/pdf",
        }
    }
}

impl MimeTypes {
    /// Get MIME type based on file extension.
    pub fn from_extension(ext: &str) -> &'static str {
        let types = MimeTypes::default();
        match ext.to_lowercase().as_str() {
            "html" | "htm" => types.html,
            "css" => types.css,
            "js" | "mjs" => types.js,
            "wasm" => types.wasm,
            "json" => types.json,
            "png" => types.png,
            "jpg" | "jpeg" => types.jpg,
            "svg" => types.svg,
            "ico" => types.ico,
            "woff" => types.woff,
            "woff2" => types.woff2,
            "ttf" => types.ttf,
            "eot" => types.eot,
            "txt" => types.txt,
            "xml" => types.xml,
            "pdf" => types.pdf,
            _ => "application/octet-stream",
        }
    }
}

/// Creates a service for serving static files from a directory.
///
/// # Arguments
///
/// * `base_path` - Root directory for static files
/// * `config` - Configuration for file serving
///
/// # Example
///
/// ```rust,no_run
/// use render_service::static_files::{serve_static_files, StaticFileConfig};
///
/// let service = serve_static_files(
///     "./dist".into(),
///     StaticFileConfig::default()
/// );
/// ```
pub fn serve_static_files(
    base_path: PathBuf,
    config: StaticFileConfig,
) -> axum::routing::MethodRouter {
    async fn serve_file(
        AxumPath(path): AxumPath<String>,
        state: axum::extract::State<FileServerState>,
    ) -> impl IntoResponse {
        // Prevent directory traversal attacks by checking for ".."
        if path.contains("..") {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(Body::empty())
                .expect("FORBIDDEN response should always succeed");
        }

        let full_path = state.base_path.join(&path);

        // Check if path exists and is within base directory
        if !full_path.starts_with(&state.base_path) {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(Body::empty())
                .expect("FORBIDDEN response should always succeed");
        }

        match fs::metadata(&full_path).await {
            Ok(metadata) if metadata.is_file() => {
                // Determine MIME type
                let mime_type = full_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(MimeTypes::from_extension)
                    .unwrap_or("application/octet-stream");

                // Read file
                match fs::File::open(&full_path).await {
                    Ok(file) => {
                        let reader_stream = ReaderStream::new(file);
                        let body = Body::from_stream(reader_stream);

                        let mut builder = Response::builder().status(StatusCode::OK);
                        builder = builder.header(header::CONTENT_TYPE, mime_type);

                        // Add cache headers if enabled
                        if state.config.cache_enabled {
                            let cache_header =
                                format!("public, max-age={}", state.config.cache_max_age);
                            builder = builder.header(header::CACHE_CONTROL, cache_header);
                        }

                        builder.body(body).expect("OK response with body should always succeed")
                    }
                    Err(_) => not_found_response(),
                }
            }
            Ok(_) => not_found_response(),
            Err(_) => not_found_response(),
        }
    }

    // Create shared state
    let state = FileServerState { base_path, config };

    axum::routing::get(serve_file).with_state(state)
}

/// Internal state for the file server.
#[derive(Clone, Debug)]
struct FileServerState {
    base_path: PathBuf,
    config: StaticFileConfig,
}

/// Create a 404 Not Found response.
fn not_found_response() -> Response {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::empty())
        .expect("NOT_FOUND response should always succeed")
}

/// Serve an individual file with proper headers.
///
/// # Arguments
///
/// * `file_path` - Path to the file
/// * `config` - Static file configuration
pub async fn serve_file(file_path: PathBuf, config: StaticFileConfig) -> anyhow::Result<Response> {
    if !file_path.exists() {
        return Ok(not_found_response());
    }

    let mime_type = file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(MimeTypes::from_extension)
        .unwrap_or("application/octet-stream");

    let file = fs::File::open(&file_path).await?;
    let reader_stream = ReaderStream::new(file);
    let body = Body::from_stream(reader_stream);

    let mut builder = Response::builder().status(StatusCode::OK);
    builder = builder.header(header::CONTENT_TYPE, mime_type);

    if config.cache_enabled {
        let cache_header = format!("public, max-age={}", config.cache_max_age);
        builder = builder.header(header::CACHE_CONTROL, cache_header);
    }

    builder.body(body).map_err(|e| anyhow::anyhow!("Failed to build response: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mime_types_from_extension() {
        assert_eq!(
            MimeTypes::from_extension("html"),
            "text/html; charset=utf-8"
        );
        assert_eq!(MimeTypes::from_extension("css"), "text/css; charset=utf-8");
        assert_eq!(
            MimeTypes::from_extension("js"),
            "application/javascript; charset=utf-8"
        );
        assert_eq!(MimeTypes::from_extension("wasm"), "application/wasm");
        assert_eq!(
            MimeTypes::from_extension("json"),
            "application/json; charset=utf-8"
        );
        assert_eq!(MimeTypes::from_extension("png"), "image/png");
        assert_eq!(MimeTypes::from_extension("svg"), "image/svg+xml");
        assert_eq!(MimeTypes::from_extension("woff2"), "font/woff2");
    }

    #[test]
    fn test_mime_types_case_insensitive() {
        assert_eq!(
            MimeTypes::from_extension("HTML"),
            "text/html; charset=utf-8"
        );
        assert_eq!(MimeTypes::from_extension("CSS"), "text/css; charset=utf-8");
        assert_eq!(MimeTypes::from_extension("WASM"), "application/wasm");
    }

    #[test]
    fn test_static_file_config_default() {
        let config = StaticFileConfig::default();
        assert!(config.cache_enabled);
        assert_eq!(config.cache_max_age, 3600);
        assert!(config.compression_enabled);
    }

    #[test]
    fn test_static_file_config_no_cache() {
        let config = StaticFileConfig::default().no_cache();
        assert!(!config.cache_enabled);
    }

    #[test]
    fn test_static_file_config_custom_max_age() {
        let config = StaticFileConfig::default().cache_max_age(7200);
        assert_eq!(config.cache_max_age, 7200);
    }

    #[test]
    fn test_static_file_config_no_compression() {
        let config = StaticFileConfig::default().no_compression();
        assert!(!config.compression_enabled);
    }
}
