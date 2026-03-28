//! Platform bridge for tairitsu WIT bindings

use std::{cell::RefCell, rc::Rc};

use tairitsu_web::wit_bindings::bindings::tairitsu_browser::full;

/// Platform abstraction layer for animation operations
pub struct AnimationPlatform {
    _private: (),
}

impl AnimationPlatform {
    pub fn new() -> Self {
        Self { _private: () }
    }

    /// Request animation frame
    pub fn request_animation_frame(&self, callback: Box<dyn FnOnce(f64)>) -> u32 {
        #[cfg(target_family = "wasm")]
        {
            use tairitsu_web::wit_bindings::bindings::tairitsu_browser::full::platform_helpers;

            // Convert callback to the expected type
            let wrapped_callback = move |timestamp: f64| {
                callback(timestamp);
            };

            // Create a listener ID
            let listener_id = platform_helpers::add_platform_listener(Box::new(wrapped_callback));

            // Request animation frame that will trigger our listener
            let window = full::window::Window::new();
            window.request_animation_frame(listener_id);

            listener_id
        }

        #[cfg(not(target_family = "wasm"))]
        {
            // Fallback for non-WASM targets
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(16));
                callback(0.0);
            });
            0
        }
    }

    /// Get bounding client rect
    pub fn get_bounding_client_rect(&self, element: u64) -> DomRect {
        #[cfg(target_family = "wasm")]
        {
            use tairitsu_web::wit_bindings::bindings::tairitsu_browser::full::platform_helpers;

            let rect = platform_helpers::get_bounding_client_rect(element);

            DomRect {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
            }
        }

        #[cfg(not(target_family = "wasm"))]
        {
            DomRect {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 100.0,
            }
        }
    }

    /// Match media query
    pub fn match_media(&self, query: &str) -> MediaQueryListWrapper {
        #[cfg(target_family = "wasm")]
        {
            use tairitsu_web::wit_bindings::bindings::tairitsu_browser::full;

            let window = full::window::Window::new();
            let media_query_list = window.match_media(query);

            MediaQueryListWrapper {
                matches: media_query_list.matches(),
                media: media_query_list.media().to_string(),
            }
        }

        #[cfg(not(target_family = "wasm"))]
        {
            MediaQueryListWrapper {
                matches: false,
                media: query.to_string(),
            }
        }
    }

    /// Add event listener
    pub fn add_event_listener(
        &self,
        element: u64,
        event_type: &str,
        callback: Box<dyn Fn(EventDataWrapper)>,
    ) -> u64 {
        #[cfg(target_family = "wasm")]
        {
            use tairitsu_web::wit_bindings::bindings::tairitsu_browser::full::platform_helpers;

            let wrapped_callback = move |event: tairitsu_web::wit_bindings::bindings::tairitsu_browser::full::EventData| {
                let wrapper = EventDataWrapper {
                    event_type: event.type_().to_string(),
                    target: event.target(),
                    // TODO: Convert specific event types
                };
                callback(wrapper);
            };

            platform_helpers::add_event_listener(element, event_type, wrapped_callback)
        }

        #[cfg(not(target_family = "wasm"))]
        {
            0
        }
    }
}

/// DOM rectangle structure
pub struct DomRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Media query list wrapper
pub struct MediaQueryListWrapper {
    pub matches: bool,
    pub media: String,
}

/// Event data wrapper
pub struct EventDataWrapper {
    pub event_type: String,
    pub target: u64,
}

impl EventDataWrapper {
    /// Try to downcast to mouse event
    pub fn as_mouse_event(&self) -> Option<MouseEventWrapper> {
        #[cfg(target_family = "wasm")]
        {
            if self.event_type == "click" || self.event_type == "mousedown" || self.event_type == "mouseup" {
                Some(MouseEventWrapper {
                    client_x: 0.0, // TODO: Get from actual event
                    client_y: 0.0,
                    target: self.target,
                })
            } else {
                None
            }
        }

        #[cfg(not(target_family = "wasm"))]
        {
            None
        }
    }
}

/// Mouse event wrapper
pub struct MouseEventWrapper {
    pub client_x: f64,
    pub client_y: f64,
    pub target: u64,
}