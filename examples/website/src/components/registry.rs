use dioxus::prelude::*;

#[derive(Debug, Clone, PartialEq)]
pub enum ComponentType {
    Layer(String, String, Option<String>),
    Demo(String, String, Option<String>),
    Code(String),
}

#[allow(non_snake_case)]
pub fn render_component(component_type: ComponentType) -> Element {
    match component_type {
        ComponentType::Layer(ref layer, ref name, ref component_id) => {
            match (layer.as_str(), name.as_str(), component_id.as_deref()) {
                ("layer1", "button", id) => {
                    rsx! {
                        crate::pages::components::layer1::ButtonDemos {
                            demo_id: id.map(|s| s.to_string()),
                        }
                    }
                }
                ("layer1", "form", _) => {
                    rsx! {
                        crate::pages::components::layer1::Layer1Form {}
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
                ("layer1", "switch", _) => {
                    rsx! {
                        crate::pages::components::layer1::Layer1Switch {}
                    }
                }

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

        ComponentType::Code(content) => {
            rsx! {
                pre { class: "hi-code-block",
                    code { class: "hi-code-content", "{content}" }
                }
            }
        }
    }
}

pub fn parse_component_path(path: &str) -> Option<ComponentType> {
    let path = path.trim().strip_prefix("pages/components/")?;

    let (base_path, component_id) = if let Some(idx) = path.find('#') {
        let base = &path[..idx];
        let id = path[idx + 1..].trim();
        (base, Some(id.to_string()))
    } else {
        (path, None)
    };

    let parts: Vec<&str> = base_path.split('/').collect();

    if parts.len() != 2 {
        return None;
    }

    let category = parts[0].to_string();
    let name = parts[1].to_string();

    if category.starts_with("demos/") {
        let demo_category = category.strip_prefix("demos/")?.to_string();
        return Some(ComponentType::Demo(demo_category, name, component_id));
    }

    Some(ComponentType::Layer(category, name, component_id))
}
