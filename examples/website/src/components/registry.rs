// website/src/components/registry.rs
// Dynamic component registry system
// Similar to MDX code blocks - allows documentation to reference and render components dynamically

use dioxus::prelude::*;

/// Dynamic component type
#[derive(Debug, Clone, PartialEq)]
pub enum ComponentType {
    /// Layer component (basic, display, form, feedback, switch, etc.)
    /// With optional component_id for specific sub-components (e.g., "button", "input")
    Layer(String, String, Option<String>), // (layer, name, component_id)

    /// Demo component (form_demo, dashboard_demo, video_demo, etc.)
    Demo(String, String, Option<String>), // (demo_category, name, component_id)

    /// Plain code block (not a component reference)
    Code(String), // code content
}

/// Dynamic component render function
/// Maps a component identifier to its render function
#[allow(non_snake_case)]
pub fn render_component(component_type: ComponentType) -> Element {
    match component_type {
        // Layer 1 Components
        ComponentType::Layer(ref layer, ref name, ref component_id) => {
            match (layer.as_str(), name.as_str(), component_id.as_deref()) {
                // Layer 1 Basic components with sub-components
                ("layer1", "basic", Some("button")) => {
                    rsx! {
                        crate::pages::components::layer1::basic_components::BasicButton {}
                    }
                }
                ("layer1", "basic", Some("input")) => {
                    rsx! {
                        crate::pages::components::layer1::basic_components::BasicInput {}
                    }
                }
                ("layer1", "basic", Some("card")) => {
                    rsx! {
                        crate::pages::components::layer1::basic_components::BasicCard {}
                    }
                }
                ("layer1", "basic", Some("badge")) => {
                    rsx! {
                        crate::pages::components::layer1::basic_components::BasicBadge {}
                    }
                }
                ("layer1", "basic", Some("select")) => {
                    rsx! {
                        crate::pages::components::layer1::basic_components::BasicSelect {}
                    }
                }
                ("layer1", "basic", Some("checkbox")) => {
                    rsx! {
                        crate::pages::components::layer1::basic_components::BasicCheckbox {}
                    }
                }
                ("layer1", "basic", Some("radio")) => {
                    rsx! {
                        crate::pages::components::layer1::basic_components::BasicRadio {}
                    }
                }
                ("layer1", "basic", Some("divider")) => {
                    rsx! {
                        crate::pages::components::layer1::basic_components::BasicDivider {}
                    }
                }

                // Layer 1 components without sub-components (fallback to index pages)
                ("layer1", "basic", None) => {
                    rsx! {
                        crate::pages::components::layer1::Layer1Basic {}
                    }
                }
                ("layer1", "display", _) => {
                    rsx! {
                        crate::pages::components::layer1::Layer1Display {}
                    }
                }
                ("layer1", "feedback", _) => {
                    rsx! {
                        crate::pages::components::layer1::Layer1Feedback {}
                    }
                }
                ("layer1", "form", _) => {
                    rsx! {
                        crate::pages::components::layer1::Layer1Form {}
                    }
                }
                ("layer1", "switch", _) => {
                    rsx! {
                        crate::pages::components::layer1::Layer1Switch {}
                    }
                }

                // Layer 2 Components
                ("layer2", "navigation", _) => {
                    rsx! {
                        crate::pages::components::layer2::Layer2Navigation {}
                    }
                }
                ("layer2", "data", _) => {
                    rsx! {
                        crate::pages::components::layer2::Layer2Data {}
                    }
                }
                ("layer2", "form", _) => {
                    rsx! {
                        crate::pages::components::layer2::Layer2Form {}
                    }
                }
                ("layer2", "feedback", _) => {
                    rsx! {
                        crate::pages::components::layer2::Layer2Feedback {}
                    }
                }

                // Layer 3 Components
                ("layer3", "media", _) => {
                    rsx! {
                        crate::pages::components::layer3::Layer3Media {}
                    }
                }
                ("layer3", "editor", _) => {
                    rsx! {
                        crate::pages::components::layer3::Layer3Editor {}
                    }
                }
                ("layer3", "visualization", _) => {
                    rsx! {
                        crate::pages::components::layer3::Layer3Visualization {}
                    }
                }

                _ => {
                    rsx! {
                        div { class: "component-error",
                            h3 { "Component Not Found" }
                            p { "Unknown component: {component_type:?}" }
                        }
                    }
                }
            }
        }

        // Demo Components
        ComponentType::Demo(ref category, ref name, _) => {
            match (category.as_str(), name.as_str()) {
                ("layer1", "form_demo") => {
                    rsx! {
                        crate::pages::demos::layer1::FormDemo {}
                    }
                }
                ("layer1", "auth_demo") => {
                    rsx! {
                        div { class: "demo-placeholder", "Auth Demo - Coming Soon" }
                    }
                }
                ("layer1", "gallery_demo") => {
                    rsx! {
                        div { class: "demo-placeholder", "Gallery Demo - Coming Soon" }
                    }
                }

                _ => {
                    rsx! {
                        div { class: "component-error",
                            h3 { "Component Not Found" }
                            p { "Unknown component: {component_type:?}" }
                        }
                    }
                }
            }
        }

        // Plain code blocks (not component references)
        ComponentType::Code(content) => {
            rsx! {
                pre { class: "hi-code-block",
                    code { class: "hi-code-content", "{content}" }
                }
            }
        }
    }
}

/// Parse component path from documentation format
/// Format: ```_inner_hikari
/// pages/components/layer1/basic
/// pages/components/layer1/basic#button
/// pages/components/layer1/basic#input
/// ```
pub fn parse_component_path(path: &str) -> Option<ComponentType> {
    let path = path.trim().strip_prefix("pages/components/")?;

    // Check for component_id using # syntax
    let (base_path, component_id) = if let Some(idx) = path.find('#') {
        let base = &path[..idx];
        let id = path[idx + 1..].trim();
        (base, Some(id.to_string()))
    } else {
        (path, None)
    };

    // Split into segments
    let parts: Vec<&str> = base_path.split('/').collect();

    if parts.len() != 2 {
        return None;
    }

    let category = parts[0].to_string();
    let name = parts[1].to_string();

    // Check if it's a demo component
    if category.starts_with("demos/") {
        let demo_category = category.strip_prefix("demos/")?.to_string();
        return Some(ComponentType::Demo(demo_category, name, component_id));
    }

    // Layer component
    Some(ComponentType::Layer(category, name, component_id))
}
