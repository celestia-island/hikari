// animation/src/glow.rs
// Component-isolated glow effect built on tairitsu hooks.

use tairitsu_macros::{component, define_props, rsx};
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use tairitsu_vdom::MouseEvent;
use tairitsu_vdom::VNode as Element;
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use wasm_bindgen::JsValue;
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use web_sys::HtmlElement;

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::style::StyleBuilder;

/// Glow component properties
#[define_props]
pub struct GlowProps {
    #[default("rgba(255, 255, 255, 0.3)".to_string())]
    pub color: String,

    #[default(0.3)]
    pub intensity: f64,

    pub children: Element,
}

/// Glow component with mouse-following effect
///
/// This component provides a glow effect that follows the mouse cursor
/// within the component boundaries. It is fully component-isolated,
/// using tairitsu hooks for state management and lifecycle handling.
///
/// # Example
///
/// ```ignore
/// use tairitsu_macros::rsx;
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
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        use wasm_bindgen::JsCast;

        // Clone props for use in event handlers
        let color = props.color.clone();
        let intensity = props.intensity.to_string();

        // Clone for use in rsx! block (color and intensity are moved into onmousemove_handler)
        let rsx_color = color.clone();
        let rsx_intensity = intensity.clone();

        // Mouse move handler - directly update CSS variables without re-render.
        // In tairitsu the handler receives the event data directly (no `Event<...>`
        // wrapper and no DOM Event object), so we resolve the target element via
        // `document.element_from_point` from the reported client coordinates.
        let onmousemove_handler = move |event: MouseEvent| {
            let client_x = event.client_x as f64;
            let client_y = event.client_y as f64;

            let Some(document) = (|| web_sys::window()?.document())() else {
                return;
            };
            let Some(target) = document.element_from_point(client_x as f32, client_y as f32) else {
                return;
            };

            let mut current = target;
            // Traverse up to find the .hk-glow-wrapper element.
            loop {
                let class_list = current.class_list();
                if class_list.contains("hk-glow-wrapper") {
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

                let percent_x = ((relative_x / width) * 100.0).clamp(0.0, 100.0);
                let percent_y = ((relative_y / height) * 100.0).clamp(0.0, 100.0);

                let _ = web_sys::console::log_1(
                    &format!("Glow: percent=({:.1}%,{:.1}%)", percent_x, percent_y).into(),
                );

                // Update CSS variables directly on DOM (no re-render)
                let _ = web_sys::console::log_1(
                    &format!(
                        "Glow: --glow-x: {:.1}%; --glow-y: {:.1}%; --glow-color: {}; --glow-intensity: {};",
                        percent_x, percent_y, color, intensity
                    )
                    .into(),
                );

                StyleBuilder::new(&html_element)
                    .add_custom("--glow-x", &format!("{:.1}%", percent_x))
                    .add_custom("--glow-y", &format!("{:.1}%", percent_y))
                    .add_custom("--glow-color", &color)
                    .add_custom("--glow-intensity", &intensity.to_string())
                    .apply();
            }
        };

        rsx! {
            div {
                class: "hk-glow-wrapper",

                // Initial style
                style: "--glow-x: 50%; --glow-y: 50%; --glow-color: {rsx_color}; --glow-intensity: {rsx_intensity};",

                onmousemove: onmousemove_handler,

                { props.children }
            }
        }
    }

    #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
    {
        // SSR fallback: just render children
        rsx! {
            div { class: "hk-glow-wrapper", { props.children } }
        }
    }
}
