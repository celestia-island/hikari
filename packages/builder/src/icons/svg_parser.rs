//! SVG parser types for Hikari icons
//!
//! This module defines the SvgIcon struct used in icon data.

/// Structured SVG icon data
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SvgIcon {
    /// ViewBox attribute (e.g., "0 0 24 24")
    pub view_box: Option<String>,
    /// Width attribute
    pub width: Option<String>,
    /// Height attribute
    pub height: Option<String>,
    /// Main path data (for simple icons)
    pub path: Option<String>,
    /// Group with paths (for complex icons with multiple paths)
    pub paths: Vec<PathElement>,
    /// Other SVG elements (circle, rect, etc.)
    pub elements: Vec<SvgElement>,
}

/// Path element with attributes
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct PathElement {
    /// Path data (d attribute)
    pub d: Option<String>,
    /// Fill attribute
    pub fill: Option<String>,
    /// Stroke attribute
    pub stroke: Option<String>,
    /// Stroke width
    pub stroke_width: Option<String>,
    /// Stroke line cap
    pub stroke_linecap: Option<String>,
    /// Stroke line join
    pub stroke_linejoin: Option<String>,
    /// Transform
    pub transform: Option<String>,
}

/// Generic SVG element
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SvgElement {
    /// Element type (path, circle, rect, etc.)
    pub tag: String,
    /// Attributes map
    pub attributes: std::collections::HashMap<String, String>,
}
