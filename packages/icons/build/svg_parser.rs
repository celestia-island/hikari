use std::collections::HashMap;

use anyhow::{Result, anyhow};
use quick_xml::events::Event;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SvgIcon {
    pub view_box: Option<String>,
    pub width: Option<String>,
    pub height: Option<String>,
    pub path: Option<String>,
    pub paths: Vec<PathElement>,
    pub elements: Vec<SvgElement>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct PathElement {
    pub d: Option<String>,
    pub fill: Option<String>,
    pub stroke: Option<String>,
    pub stroke_width: Option<String>,
    pub stroke_linecap: Option<String>,
    pub stroke_linejoin: Option<String>,
    pub transform: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SvgElement {
    pub tag: String,
    pub attributes: HashMap<String, String>,
}

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
    let mut current_tag;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                current_tag = std::str::from_utf8(e.name().as_ref())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                if current_tag == "svg" {
                    for attr in e.attributes().flatten() {
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
                } else if current_tag == "path" {
                    current_attrs.clear();
                    for attr in e.attributes().flatten() {
                        let key = std::str::from_utf8(attr.key.as_ref())
                            .map(|s| s.to_string())
                            .unwrap_or_default();
                        let value = std::str::from_utf8(&attr.value)
                            .map(|s| s.to_string())
                            .unwrap_or_default();
                        current_attrs.insert(key, value);
                    }
                } else {
                    current_attrs.clear();
                    for attr in e.attributes().flatten() {
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

                    for attr in e.attributes().flatten() {
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

                    if let Some(d) = &path_element.d {
                        if icon.path.is_none() {
                            icon.path = Some(d.clone());
                        } else {
                            icon.paths.push(path_element);
                        }
                    }
                } else {
                    let mut attrs = HashMap::new();
                    for attr in e.attributes().flatten() {
                        let key = std::str::from_utf8(attr.key.as_ref())
                            .map(|s| s.to_string())
                            .unwrap_or_default();
                        let value = std::str::from_utf8(&attr.value)
                            .map(|s| s.to_string())
                            .unwrap_or_default();
                        attrs.insert(key, value);
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
