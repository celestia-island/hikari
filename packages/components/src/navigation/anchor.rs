//! Anchor component - In-page navigation with smooth scrolling
//!
//! # Example
//!
//! ```rust
//! use hikari_components::navigation::Anchor;
//! use crate::prelude::*;
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

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::platform;
use crate::prelude::*;
use hikari_palette::classes::{
    AnchorClass, ClassesBuilder, Display, FlexDirection, Gap, Padding, UtilityClass,
};
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use wasm_bindgen::JsCast;

#[derive(Clone, Debug, PartialEq, Props)]
pub struct AnchorItem {
    pub href: String,
    pub title: String,
}

///
///
#[component]
pub fn Anchor(
    items: Vec<AnchorItem>,

    #[props(default = "right".to_string())] position: String,

    #[props(default = 20)] offset: i32,

    #[props(default)] class: String,

    children: Element,
) -> Element {
    let mut active_anchor = use_signal(String::new);

    // Build anchor links
    let anchor_links: Vec<Element> = items.iter().map(|item| {
        let href = item.href.clone();
        let title = item.title.clone();
        let active_anchor_for_click = active_anchor.clone();
        let active_anchor_for_check = active_anchor.clone();
        let is_active = active_anchor_for_check.read() == href;
        let btn_class = ClassesBuilder::new()
            .add(AnchorClass::Link)
            .add_if(AnchorClass::Active, move || is_active)
            .build();

        rsx! {
            button {
                class: btn_class,
                onclick: move |_| {
                    active_anchor_for_click.set(href.clone());

                    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
                    {
                        use web_sys::window;
                        let target_id = href.trim_start_matches('#');
                        if let Some(window) = window() {
                            if let Some(document) = window.document() {
                                if let Some(element) = document.get_element_by_id(target_id) {
                                    if let Some(html_el) = element.dyn_ref::<web_sys::HtmlElement>() {
                                        let rect = html_el.get_bounding_client_rect();
                                        let scroll_y = platform::get_scroll_y();
                                        platform::scroll_to_with_options(
                                            rect.top() - offset as f64 - scroll_y,
                                            "smooth"
                                        );
                                    }
                                }
                            }
                        }
                    }
                },
                "{title}"
            }
        }
    }).collect();

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

    let wrapper_class = AnchorClass::Wrapper.as_class();
    rsx! {
        div { class: wrapper_class,
            div { class: anchor_classes,
                ..anchor_links
            }
            { children }
        }
    }
}

///
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub fn use_scrollspy(anchor_items: Vec<AnchorItem>) -> Signal<String> {
    use wasm_bindgen::closure::Closure;

    let active_anchor = use_signal(|| String::new());
    let active_anchor_for_effect = active_anchor.clone();

    use_effect(move || {
        let items = anchor_items.clone();
        let anchor = active_anchor_for_effect.clone();

        let listener = Closure::wrap(Box::new(move |_event: web_sys::Event| {
            if let Some(window) = web_sys::window() {
                if let Some(document) = window.document() {
                    let scroll_y = platform::get_scroll_y();

                    for item in &items {
                        let target_id = item.href.trim_start_matches('#');
                        if let Some(element) = document.get_element_by_id(target_id) {
                            let rect = element.get_bounding_client_rect();
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

        listener.forget();
    });

    active_anchor
}
