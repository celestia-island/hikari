//! Anchor component - In-page navigation with smooth scrolling
//!
//! # Example
//!
//! ```rust
//! use hikari_components::navigation::Anchor;
//! use dioxus::prelude::*;
//!
//! rsx! {
//!     div { id: "content",
//!         Anchor {
//!             items: vec![
//!                 AnchorItem { href: "#section1", title: "Section 1".to_string() },
//!                 AnchorItem { href: "#section2", title: "Section 2".to_string() },
//!                 AnchorItem { href: "#section3", title: "Section 3".to_string() },
//!             ],
//!             div { id: "section1", h1 { "Section 1" } }
//!             div { id: "section2", h1 { "Section 2" } }
//!             div { id: "section3", h1 { "Section 3" } }
//!         }
//!     }
//! }
//! ```

use dioxus::prelude::*;
use palette::classes::{
    AnchorClass, ClassesBuilder, Display, FlexDirection, Gap, Padding, UtilityClass,
};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::closure::Closure;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

/// Anchor item configuration
#[derive(Clone, Debug, PartialEq, Props)]
pub struct AnchorItem {
    /// Link href (e.g., "#section1")
    pub href: String,
    /// Display title
    pub title: String,
}

/// Anchor component - In-page navigation with smooth scrolling
///
/// Provides a navigation sidebar that links to sections on the same page.
///
/// # Features
/// - Smooth scrolling to sections
/// - Active section highlighting
/// - Click to scroll
/// - Customizable position
#[allow(unused_variables)]
#[component]
pub fn Anchor(
    /// Anchor items (href + title pairs)
    items: Vec<AnchorItem>,

    /// Fixed position (right or left)
    #[props(default = "right".to_string())]
    position: String,

    /// Offset from top (default: 20px)
    #[props(default = 20)]
    offset: i32,

    /// Custom CSS classes
    #[props(default)]
    class: String,

    /// Anchor content (page sections)
    children: Element,
) -> Element {
    let mut active_anchor = use_signal(String::new);

    // Build anchor links
    let anchor_links = items.iter().map(|item| {
        let href = item.href.clone();
        let title = item.title.clone();
        let is_active = active_anchor() == href;

        rsx! {
            button {
                class: ClassesBuilder::new()
                    .add(AnchorClass::Link)
                    .add_if(AnchorClass::Active, || is_active)
                    .build(),
                onclick: move |_| {
                    active_anchor.set(href.clone());

                    // Remove '#' from href
                    let target_id = href.trim_start_matches('#');

                    #[cfg(target_arch = "wasm32")]
                    {
                        use web_sys::window;
                        if let Some(window) = window() {
                            if let Some(document) = window.document() {
                                if let Some(element) = document.get_element_by_id(target_id) {
                                    let rect = element.get_bounding_client_rect();
                                    let scroll_options = web_sys::ScrollToOptions::new();
                                    scroll_options.set_top(rect.top() - offset as f64 - window.scroll_y().unwrap_or(0.0));
                                    scroll_options.set_behavior(web_sys::ScrollBehavior::Smooth);
                                    window.scroll_to_with_scroll_to_options(&scroll_options);
                                }
                            }
                        }
                    }
                },
                "{title}"
            }
        }
    });

    // Position class
    let position_class = match position.as_str() {
        "left" => AnchorClass::Left,
        _ => AnchorClass::Right,
    };

    let anchor_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(Gap::Gap2)
        .add(Padding::P3)
        .add(position_class)
        .add_raw(&class)
        .build();

    rsx! {
        div { class: "{AnchorClass::Wrapper.as_class()}",
            div { class: "{anchor_classes}",
                {anchor_links}
            }
            { children }
        }
    }
}

/// Scroll spy effect - Automatically highlight active section on scroll
///
/// This effect monitors scroll position and updates active anchor.
/// Call this in a component that uses Anchor.
#[cfg(target_arch = "wasm32")]
pub fn use_scrollspy(anchor_items: Vec<AnchorItem>) -> Signal<String> {
    let active_anchor = use_signal(|| String::new());

    use_effect(move || {
        let items = anchor_items.clone();
        let mut anchor = active_anchor.clone();

        let listener = Closure::wrap(Box::new(move |_event: web_sys::Event| {
            if let Some(window) = web_sys::window() {
                if let Some(document) = window.document() {
                    let scroll_y = window.scroll_y().unwrap_or(0.0);

                    // Find which section is currently visible
                    for item in &items {
                        let target_id = item.href.trim_start_matches('#');
                        if let Some(element) = document.get_element_by_id(target_id) {
                            let rect = element.get_bounding_client_rect();
                            // Check if element is in viewport
                            if rect.top() <= scroll_y + 100.0 && rect.bottom() >= scroll_y {
                                anchor.set(item.href.clone());
                            }
                        }
                    }
                }
            }
        }) as Box<dyn FnMut(_)>);

        if let Some(window) = web_sys::window() {
            window
                .add_event_listener_with_callback("scroll", listener.as_ref().unchecked_ref())
                .ok();
        }

        // Cleanup listener on unmount
        listener.forget();
    });

    active_anchor
}
