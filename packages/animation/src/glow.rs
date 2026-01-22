// animation/src/glow.rs
// Component-isolated glow effect using Dioxus hooks

use dioxus::prelude::*;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsValue;
#[cfg(target_arch = "wasm32")]
use web_sys::HtmlElement;

#[cfg(target_arch = "wasm32")]
use crate::style::StyleBuilder;

/// Glow component properties
#[derive(Clone, Props, PartialEq)]
pub struct GlowProps {
    #[props(default = "rgba(255, 255, 255, 0.3)".to_string())]
    pub color: String,

    #[props(default = 0.3)]
    pub intensity: f64,

    #[props(default)]
    pub children: Element,
}

/// Glow component with mouse-following effect
///
/// This component provides a glow effect that follows the mouse cursor
/// within the component boundaries. It is fully component-isolated,
/// using Dioxus hooks for state management and lifecycle handling.
///
/// # Example
///
/// ```ignore
/// use dioxus::prelude::*;
/// use hikari_animation::Glow;
///
/// rsx! {
///     Glow {
///         color: "rgba(255, 255, 255, 0.3)",
///         intensity: 0.5,
///         Card {
///             "Card with glow effect"
///         }
///     }
/// }
/// ```
#[component]
pub fn Glow(props: GlowProps) -> Element {
    #[cfg(target_arch = "wasm32")]
    {
        use wasm_bindgen::JsCast;

        // Clone props for use in event handlers
        let color = props.color.clone();
        let intensity = props.intensity.to_string();

        // Clone for use in rsx! block (color and intensity are moved into onmousemove_handler)
        let rsx_color = color.clone();
        let rsx_intensity = intensity.clone();

        // Mouse move handler - directly update CSS variables without re-render
        let onmousemove_handler = move |event: Event<MouseData>| {
            // Downcast to web_sys::MouseEvent to access DOM APIs
            if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                // Get the target element (may be a child of glow-wrapper)
                if let Some(target) = web_event.target() {
                    if let Some(mut current) = target.dyn_into::<web_sys::Element>().ok() {
                        // Traverse up to find .hi-glow-wrapper element
                        loop {
                            let class_list = current.class_list();
                            if class_list.contains("hi-glow-wrapper") {
                                break;
                            }

                            // Move to parent
                            match current.parent_element() {
                                Some(parent) => current = parent,
                                None => return,
                            }
                        }

                        if let Some(html_element) = current.dyn_into::<HtmlElement>().ok() {
                            // Get element bounding box
                            let rect = html_element.get_bounding_client_rect();

                            // Get client coordinates from web event
                            let client_x = web_event.client_x() as f64;
                            let client_y = web_event.client_y() as f64;

                            // Calculate relative position as percentage
                            let relative_x = client_x - rect.left();
                            let relative_y = client_y - rect.top();

                            let width = rect.width();
                            let height = rect.height();

                            // Debug logging
                            let _ = web_sys::console::log_1(&format!(
                                "Glow: client=({:.0},{:.0}) rect=({:.0},{:.0},{:.0},{:.0}) size=({:.0},{:.0})",
                                client_x, client_y, rect.left(), rect.top(), rect.right(), rect.bottom(), width, height
                            ).into());

                            // Handle zero or negative dimensions
                            if width <= 0.0 || height <= 0.0 {
                                let _ = web_sys::console::log_1(&JsValue::from(
                                    "Glow: Invalid dimensions, using 50%",
                                ));
                                StyleBuilder::new(&html_element)
                                    .add_custom("--glow-x", "50%")
                                    .add_custom("--glow-y", "50%")
                                    .add_custom("--glow-color", &color)
                                    .add_custom("--glow-intensity", &intensity.to_string())
                                    .apply();
                                return;
                            }

                            let percent_x = if width > 0.0 {
                                ((relative_x / width) * 100.0).clamp(0.0, 100.0)
                            } else {
                                50.0
                            };

                            let percent_y = if height > 0.0 {
                                ((relative_y / height) * 100.0).clamp(0.0, 100.0)
                            } else {
                                50.0
                            };

                            let _ = web_sys::console::log_1(
                                &format!("Glow: percent=({:.1}%,{:.1}%)", percent_x, percent_y)
                                    .into(),
                            );

                            // Update CSS variables directly on DOM (no re-render)
                            let _ = web_sys::console::log_1(
                                &format!(
                                    "Glow: --glow-x: {:.1}%; --glow-y: {:.1}%; --glow-color: {}; --glow-intensity: {};",
                                    percent_x, percent_y, color, intensity
                                ).into()
                            );

                            StyleBuilder::new(&html_element)
                                .add_custom("--glow-x", &format!("{:.1}%", percent_x))
                                .add_custom("--glow-y", &format!("{:.1}%", percent_y))
                                .add_custom("--glow-color", &color)
                                .add_custom("--glow-intensity", &intensity.to_string())
                                .apply();
                        }
                    }
                }
            }
        };

        rsx! {
            div {
                class: "hi-glow-wrapper",

                // Initial style
                style: "--glow-x: 50%; --glow-y: 50%; --glow-color: {rsx_color}; --glow-intensity: {rsx_intensity};",

                onmousemove: onmousemove_handler,

                { props.children }
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        // SSR fallback: just render children
        rsx! {
            div { class: "hi-glow-wrapper", { props.children } }
        }
    }
}
