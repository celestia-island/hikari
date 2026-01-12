//! SVG parser types for Hikari icons
//!
//! This module defines the SvgIcon struct used in icon data and provides parsing utilities.

use anyhow::{anyhow, Context, Result};
use quick_xml::events::Event;
use std::collections::HashMap;

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

impl SvgIcon {
    /// Check if this is a simple icon (single path)
    pub fn is_simple(&self) -> bool {
        self.path.is_some() && self.paths.is_empty() && self.elements.is_empty()
    }

    /// Get the first path if it exists
    pub fn first_path(&self) -> Option<PathElement> {
        self.path.as_ref().map(|d| PathElement {
            d: Some(d.clone()),
            fill: None,
            stroke: None,
            stroke_width: None,
            stroke_linecap: None,
            stroke_linejoin: None,
            transform: None,
        })
    }
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
    pub attributes: HashMap<String, String>,
}

/// Path data for generating Rust constants
#[derive(Copy, Clone, Debug)]
pub struct PathData {
    pub d: Option<&'static str>,
    pub fill: Option<&'static str>,
    pub stroke: Option<&'static str>,
    pub stroke_width: Option<&'static str>,
    pub stroke_linecap: Option<&'static str>,
    pub stroke_linejoin: Option<&'static str>,
    pub transform: Option<&'static str>,
}

/// SVG element for generating Rust constants
#[derive(Copy, Clone, Debug)]
pub struct SvgElem {
    pub tag: &'static str,
    pub attributes: &'static [(&'static str, &'static str)],
}

/// Icon data for generating Rust constants
#[derive(Copy, Clone, Debug)]
pub struct IconData {
    pub view_box: Option<&'static str>,
    pub width: Option<&'static str>,
    pub height: Option<&'static str>,
    pub path: Option<&'static str>,
    pub paths: &'static [PathData],
    pub elements: &'static [SvgElem],
}

/// Parse SVG string into structured SvgIcon
pub fn parse_svg(svg: &str) -> Result<SvgIcon> {
    let mut reader = quick_xml::Reader::from_str(svg);

    let mut icon = SvgIcon {
        view_box: None,
        width: None,
        height: None,
        path: None,
        paths: Vec::new(),
        elements: Vec::new(),
    };

    let mut current_attrs: HashMap<String, String> = HashMap::new();
    let mut current_tag = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                current_tag = std::str::from_utf8(e.name().as_ref())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                if current_tag == "svg" {
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            let key = std::str::from_utf8(attr.key.as_ref())
                                .map(|s| s.to_string())
                                .unwrap_or_default();
                            let value = std::str::from_utf8(&attr.value)
                                .map(|s| s.to_string())
                                .unwrap_or_default();

                            match key.as_str() {
                                "viewBox" | "viewbox" => icon.view_box = Some(value),
                                "width" => icon.width = Some(value),
                                "height" => icon.height = Some(value),
                                _ => {}
                            }
                        }
                    }
                } else if current_tag == "path" {
                    current_attrs.clear();
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            let key = std::str::from_utf8(attr.key.as_ref())
                                .map(|s| s.to_string())
                                .unwrap_or_default();
                            let value = std::str::from_utf8(&attr.value)
                                .map(|s| s.to_string())
                                .unwrap_or_default();
                            current_attrs.insert(key, value);
                        }
                    }
                } else {
                    current_attrs.clear();
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            let key = std::str::from_utf8(attr.key.as_ref())
                                .map(|s| s.to_string())
                                .unwrap_or_default();
                            let value = std::str::from_utf8(&attr.value)
                                .map(|s| s.to_string())
                                .unwrap_or_default();
                            current_attrs.insert(key, value);
                        }
                    }
                }
            }
            Ok(Event::Empty(ref e)) => {
                let tag = std::str::from_utf8(e.name().as_ref())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                if tag == "path" {
                    let mut path_element = PathElement {
                        d: None,
                        fill: None,
                        stroke: None,
                        stroke_width: None,
                        stroke_linecap: None,
                        stroke_linejoin: None,
                        transform: None,
                    };

                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            let key = std::str::from_utf8(attr.key.as_ref())
                                .map(|s| s.to_string())
                                .unwrap_or_default();
                            let value = std::str::from_utf8(&attr.value)
                                .map(|s| s.to_string())
                                .unwrap_or_default();

                            match key.as_str() {
                                "d" => path_element.d = Some(value),
                                "fill" => path_element.fill = Some(value),
                                "stroke" => path_element.stroke = Some(value),
                                "stroke-width" => path_element.stroke_width = Some(value),
                                "stroke-linecap" => path_element.stroke_linecap = Some(value),
                                "stroke-linejoin" => path_element.stroke_linejoin = Some(value),
                                "transform" => path_element.transform = Some(value),
                                _ => {}
                            }
                        }
                    }

                    if let Some(d) = &path_element.d {
                        if icon.path.is_none() {
                            icon.path = Some(d.clone());
                        } else {
                            icon.paths.push(path_element);
                        }
                    }
                } else {
                    let mut attrs = HashMap::new();
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            let key = std::str::from_utf8(attr.key.as_ref())
                                .map(|s| s.to_string())
                                .unwrap_or_default();
                            let value = std::str::from_utf8(&attr.value)
                                .map(|s| s.to_string())
                                .unwrap_or_default();
                            attrs.insert(key, value);
                        }
                    }
                    icon.elements.push(SvgElement {
                        tag: tag.clone(),
                        attributes: attrs,
                    });
                }
            }
            Ok(Event::End(_)) => {}
            Ok(Event::Eof) => break,
            Err(e) => return Err(anyhow!("XML parsing error: {}", e)),
            _ => {}
        }
    }

    Ok(icon)
}
