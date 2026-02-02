//! Dynamic icon server endpoint
//!
//! Provides icon data in RON format for secure client-side rendering.

use serde::Deserialize;
use std::collections::HashMap;

use axum::{
    extract::Query,
    http::StatusCode,
    response::{IntoResponse, Response},
};

/// Query parameters for icon request
#[derive(Debug, Deserialize)]
pub struct IconQuery {
    name: String,
}

/// Icon data structure for RON serialization
#[derive(serde::Serialize, Clone)]
struct IconData {
    view_box: Option<String>,
    width: Option<String>,
    height: Option<String>,
    fill: Option<String>,
    stroke: Option<String>,
    paths: Vec<PathData>,
}

#[derive(serde::Serialize, Clone)]
struct PathData {
    d: Option<String>,
    fill: Option<String>,
    stroke: Option<String>,
    stroke_width: Option<String>,
}

/// Global icon cache
static ICON_CACHE: std::sync::OnceLock<std::sync::RwLock<HashMap<String, String>>> =
    std::sync::OnceLock::new();

/// Get icon data for a specific icon name
///
/// Returns RON-serialized icon data (not raw SVG) to prevent injection
pub async fn get_icon_data(Query(query): Query<IconQuery>) -> Response {
    // Validate icon name (kebab-case, alphanumeric + hyphens)
    let icon_name = query.name.to_lowercase();
    if !is_safe_icon_name(&icon_name) {
        return (
            StatusCode::BAD_REQUEST,
            "Invalid icon name: must be kebab-case (lowercase letters, numbers, hyphens)",
        )
            .into_response();
    }

    // Check cache first
    let cache = ICON_CACHE.get_or_init(|| std::sync::RwLock::new(HashMap::new()));
    {
        let cached = cache.read().unwrap();
        if let Some(ron_data) = cached.get(&icon_name) {
            return (StatusCode::OK, ron_data.clone()).into_response();
        }
    }

    // Find workspace root and fetch SVG
    let workspace_root = find_workspace_root();
    let svg_path = workspace_root.join(format!(
        "packages/builder/generated/mdi_svgs/{}.svg",
        icon_name
    ));

    if !svg_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            format!("Icon not found: {}", icon_name),
        )
            .into_response();
    }

    // Read and parse SVG
    let svg_content = match std::fs::read_to_string(&svg_path) {
        Ok(content) => content,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to read icon: {}", e),
            )
                .into_response();
        }
    };

    // Parse SVG to structured data
    let icon_data = match parse_svg_safe(&svg_content) {
        Ok(data) => data,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to parse SVG: {}", e),
            )
                .into_response();
        }
    };

    // Serialize to RON
    let ron_data = match ron::to_string(&icon_data) {
        Ok(ron) => ron,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to serialize icon data: {}", e),
            )
                .into_response();
        }
    };

    // Cache the result
    {
        let mut cache = cache.write().unwrap();
        cache.insert(icon_name.clone(), ron_data.clone());
    }

    (StatusCode::OK, ron_data).into_response()
}

/// Validate icon name to prevent path traversal and injection
fn is_safe_icon_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 100 {
        return false;
    }

    // Only allow lowercase letters, numbers, and hyphens (kebab-case)
    name.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Parse SVG and extract structured data safely
///
/// Uses quick-xml to parse without interpreting raw HTML/SVG
fn parse_svg_safe(svg: &str) -> Result<IconData, String> {
    use quick_xml::Reader;
    use quick_xml::events::Event;

    let mut reader = Reader::from_str(svg);
    reader.trim_text(true);

    let mut icon_data = IconData {
        view_box: None,
        width: None,
        height: None,
        fill: None,
        stroke: None,
        paths: Vec::new(),
    };

    let mut in_svg = false;
    let mut current_path = PathData {
        d: None,
        fill: None,
        stroke: None,
        stroke_width: None,
    };

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                match e.name().as_ref() {
                    b"svg" => {
                        in_svg = true;
                        // Extract SVG attributes
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                match attr.key.as_ref() {
                                    b"viewBox" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        icon_data.view_box = Some(value.to_string());
                                    }
                                    b"width" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        icon_data.width = Some(value.to_string());
                                    }
                                    b"height" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        icon_data.height = Some(value.to_string());
                                    }
                                    b"fill" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        icon_data.fill = Some(value.to_string());
                                    }
                                    b"stroke" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        icon_data.stroke = Some(value.to_string());
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    b"path" if in_svg => {
                        // Reset current path
                        current_path = PathData {
                            d: None,
                            fill: None,
                            stroke: None,
                            stroke_width: None,
                        };
                        // Extract path attributes
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                match attr.key.as_ref() {
                                    b"d" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        current_path.d = Some(value.to_string());
                                    }
                                    b"fill" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        current_path.fill = Some(value.to_string());
                                    }
                                    b"stroke" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        current_path.stroke = Some(value.to_string());
                                    }
                                    b"stroke-width" => {
                                        let value = attr
                                            .decode_and_unescape_value(&reader)
                                            .map_err(|e| e.to_string())?;
                                        current_path.stroke_width = Some(value.to_string());
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) => {
                // Self-closing path element
                if e.name().as_ref() == b"path" && in_svg {
                    current_path = PathData {
                        d: None,
                        fill: None,
                        stroke: None,
                        stroke_width: None,
                    };
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            match attr.key.as_ref() {
                                b"d" => {
                                    let value = attr
                                        .decode_and_unescape_value(&reader)
                                        .map_err(|e| e.to_string())?;
                                    current_path.d = Some(value.to_string());
                                }
                                b"fill" => {
                                    let value = attr
                                        .decode_and_unescape_value(&reader)
                                        .map_err(|e| e.to_string())?;
                                    current_path.fill = Some(value.to_string());
                                }
                                b"stroke" => {
                                    let value = attr
                                        .decode_and_unescape_value(&reader)
                                        .map_err(|e| e.to_string())?;
                                    current_path.stroke = Some(value.to_string());
                                }
                                b"stroke-width" => {
                                    let value = attr
                                        .decode_and_unescape_value(&reader)
                                        .map_err(|e| e.to_string())?;
                                    current_path.stroke_width = Some(value.to_string());
                                }
                                _ => {}
                            }
                        }
                    }
                    if current_path.d.is_some() {
                        icon_data.paths.push(current_path.clone());
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                if e.name().as_ref() == b"svg" {
                    in_svg = false;
                } else if e.name().as_ref() == b"path" && in_svg {
                    if current_path.d.is_some() {
                        icon_data.paths.push(current_path.clone());
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(format!("XML parsing error: {}", e));
            }
            _ => {}
        }
    }

    if icon_data.paths.is_empty() {
        return Err("No paths found in SVG".to_string());
    }

    Ok(icon_data)
}

/// Find workspace root by looking for Cargo.toml with [workspace]
fn find_workspace_root() -> std::path::PathBuf {
    let mut current = std::env::var("CARGO_MANIFEST_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."));

    loop {
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists() {
            if let Ok(content) = std::fs::read_to_string(&cargo_toml) {
                if content.contains("[workspace]") {
                    return current;
                }
            }
        }

        match current.parent() {
            Some(parent) if parent != current => {
                current = parent.to_path_buf();
            }
            _ => {
                panic!("Workspace root not found");
            }
        }
    }
}
