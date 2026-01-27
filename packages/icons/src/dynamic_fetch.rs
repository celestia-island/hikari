//! Dynamic icon fetcher for client-side
//!
//! Provides secure icon fetching with RON serialization and caching.

#[cfg(feature = "dynamic-fetch")]
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
};

// Import the route constant from lib.rs
#[cfg(all(feature = "dynamic-fetch", target_arch = "wasm32"))]
use super::ICON_ROUTE;

#[cfg(feature = "dynamic-fetch")]
use std::sync::OnceLock;

/// Icon cache to prevent duplicate requests
#[cfg(feature = "dynamic-fetch")]
static ICON_CACHE: OnceLock<Arc<RwLock<HashMap<String, String>>>> = OnceLock::new();

/// Fetch and cache icon SVG (RON format)
#[cfg(all(feature = "dynamic-fetch", target_arch = "wasm32"))]
pub async fn fetch_and_cache_icon(icon_name: &str) -> Option<String> {
    // Check cache first
    {
        let cache = ICON_CACHE.get_or_init(|| Arc::new(RwLock::new(HashMap::new())));
        let cache = cache.read().unwrap();
        if let Some(cached) = cache.get(icon_name) {
            web_sys::console::log_1(&format!("✅ Icon '{}' from cache", icon_name).into());
            return Some(cached.clone());
        }
    }

    // Fetch from server
    let url = format!("{}?name={}", ICON_ROUTE, icon_name);
    web_sys::console::log_1(&format!("🔄 Fetching icon '{}' from: {}", icon_name, url).into());

    match reqwest::get(&url).await {
        Ok(response) if response.status().is_success() => {
            match response.text().await {
                Ok(ron_data) => {
                    // Parse RON safely
                    match parse_safe_ron(&ron_data) {
                        Ok(svg) => {
                            // Cache the result
                            {
                                let cache = ICON_CACHE
                                    .get_or_init(|| Arc::new(RwLock::new(HashMap::new())));
                                let mut cache = cache.write().unwrap();
                                cache.insert(icon_name.to_string(), svg.clone());
                            }
                            web_sys::console::log_1(
                                &format!("✅ Icon '{}' fetched and cached", icon_name).into(),
                            );
                            Some(svg)
                        }
                        Err(e) => {
                            web_sys::console::error_1(
                                &format!("❌ Failed to parse RON for '{}': {}", icon_name, e)
                                    .into(),
                            );
                            None
                        }
                    }
                }
                Err(e) => {
                    web_sys::console::error_1(
                        &format!("❌ Failed to read RON response for '{}': {}", icon_name, e)
                            .into(),
                    );
                    None
                }
            }
        }
        Ok(response) => {
            web_sys::console::warn_1(
                &format!(
                    "⚠️  Server returned {} for icon '{}'",
                    response.status(),
                    icon_name
                )
                .into(),
            );
            None
        }
        Err(e) => {
            web_sys::console::error_1(
                &format!("❌ Failed to fetch icon '{}': {}", icon_name, e).into(),
            );
            None
        }
    }
}

/// Parse RON safely and reconstruct SVG
#[cfg(all(feature = "dynamic-fetch", target_arch = "wasm32"))]
fn parse_safe_ron(ron_data: &str) -> Result<String, String> {
    // Deserialize RON to SafeIconData
    let icon_data: SafeIconData =
        ron::de::from_str(ron_data).map_err(|e| format!("RON parse error: {}", e))?;

    // Validate all fields
    validate_icon_data(&icon_data)?;

    // Reconstruct SVG safely
    reconstruct_svg(&icon_data)
}

/// Safe icon data structure (no raw SVG strings)
#[derive(serde::Deserialize, Debug)]
struct SafeIconData {
    view_box: Option<String>,
    width: Option<String>,
    height: Option<String>,
    fill: Option<String>,
    stroke: Option<String>,
    paths: Vec<SafePathData>,
}

/// Safe path data structure
#[derive(serde::Deserialize, Debug)]
struct SafePathData {
    d: Option<String>,
    fill: Option<String>,
    stroke: Option<String>,
    stroke_width: Option<String>,
}

/// Validate icon data to prevent injection
#[cfg(all(feature = "dynamic-fetch", target_arch = "wasm32"))]
fn validate_icon_data(data: &SafeIconData) -> Result<(), String> {
    // Validate view_box (format: "0 0 24 24")
    if let Some(ref vb) = data.view_box {
        let parts: Vec<&str> = vb.split_whitespace().collect();
        if parts.len() != 4 {
            return Err(format!(
                "Invalid viewBox: must have 4 numbers, got {}",
                parts.len()
            ));
        }
        for part in &parts {
            part.parse::<f32>()
                .map_err(|_| format!("Invalid viewBox number: {}", part))?;
        }
    }

    // Validate paths
    if data.paths.is_empty() {
        return Err("Icon must have at least one path".to_string());
    }

    // Validate each path
    for (_i, path) in data.paths.iter().enumerate() {
        // Validate d attribute (SVG path data)
        if let Some(ref d) = path.d {
            // Basic validation: only allow SVG path commands
            let allowed_commands = [
                'M', 'm', 'L', 'l', 'H', 'h', 'V', 'v', 'C', 'c', 'S', 's', 'Q', 'q', 'T', 't',
                'A', 'a', 'Z', 'z',
            ];

            for (j, c) in d.chars().enumerate() {
                if j > 1000 {
                    return Err(format!("Path too long: {} characters", j));
                }
                if c.is_ascii_alphabetic() {
                    if !allowed_commands.contains(&c) {
                        return Err(format!(
                            "Invalid SVG path command '{}' at position {}",
                            c, j
                        ));
                    }
                }
            }
        }

        // Validate fill (color or none)
        if let Some(ref fill) = path.fill {
            if !is_safe_color(fill) {
                return Err(format!("Invalid fill color: {}", fill));
            }
        }

        // Validate stroke (color or none)
        if let Some(ref stroke) = path.stroke {
            if !is_safe_color(stroke) {
                return Err(format!("Invalid stroke color: {}", stroke));
            }
        }

        // Validate stroke_width (number)
        if let Some(ref sw) = path.stroke_width {
            sw.parse::<f32>()
                .map_err(|_| format!("Invalid stroke_width: {}", sw))?;
        }
    }

    Ok(())
}

/// Check if a color string is safe
#[cfg(all(feature = "dynamic-fetch", target_arch = "wasm32"))]
fn is_safe_color(color: &str) -> bool {
    match color {
        "none" | "currentColor" => true,
        c if c.starts_with("#") && c.len() == 4 => c[1..].chars().all(|c| c.is_ascii_hexdigit()),
        c if c.starts_with("#") && c.len() == 7 => c[1..].chars().all(|c| c.is_ascii_hexdigit()),
        c if c.starts_with("rgb(") && c.ends_with(')') => c[4..c.len() - 1].split(',').count() == 3,
        c if c.starts_with("rgba(") && c.ends_with(')') => {
            c[5..c.len() - 1].split(',').count() == 4
        }
        _ => false,
    }
}

/// Reconstruct SVG from safe data
#[cfg(all(feature = "dynamic-fetch", target_arch = "wasm32"))]
fn reconstruct_svg(data: &SafeIconData) -> Result<String, String> {
    let mut svg = String::from(r#"<svg xmlns="http://www.w3.org/2000/svg""#);

    if let Some(ref vb) = data.view_box {
        svg.push_str(&format!(r#" viewBox="{}""#, vb));
    }
    if let Some(ref w) = data.width {
        svg.push_str(&format!(r#" width="{}""#, w));
    }
    if let Some(ref h) = data.height {
        svg.push_str(&format!(r#" height="{}""#, h));
    }
    if let Some(ref fill) = data.fill {
        svg.push_str(&format!(r#" fill="{}""#, fill));
    }
    if let Some(ref stroke) = data.stroke {
        svg.push_str(&format!(r#" stroke="{}""#, stroke));
    }

    svg.push_str(">");

    for path in &data.paths {
        svg.push_str(r#"<path"#);

        if let Some(ref d) = path.d {
            svg.push_str(&format!(r#" d="{}""#, d));
        }
        if let Some(ref fill) = path.fill {
            svg.push_str(&format!(r#" fill="{}""#, fill));
        }
        if let Some(ref stroke) = path.stroke {
            svg.push_str(&format!(r#" stroke="{}""#, stroke));
        }
        if let Some(ref sw) = path.stroke_width {
            svg.push_str(&format!(r#" stroke-width="{}""#, sw));
        }

        svg.push_str("/>");
    }

    svg.push_str("</svg>");
    Ok(svg)
}

/// Mock fetch for non-WASM or when feature disabled
#[cfg(not(all(feature = "dynamic-fetch", target_arch = "wasm32")))]
pub async fn fetch_and_cache_icon(_icon_name: &str) -> Option<String> {
    None
}
