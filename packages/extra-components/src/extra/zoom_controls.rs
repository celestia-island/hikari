// hikari-extra-components/src/zoom_controls.rs
// Zoom controls component with keyboard shortcuts

use dioxus::prelude::*;

/// Position of the zoom controls
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ZoomPosition {
    #[default]
    TopRight,
    TopLeft,
    BottomRight,
    BottomLeft,
}

#[derive(Clone, PartialEq, Props)]
pub struct ZoomControlsProps {
    /// Current zoom level (0.0 to 2.0, where 1.0 = 100%)
    #[props(default = 1.0)]
    pub zoom: f64,

    /// Minimum zoom level
    #[props(default = 0.1)]
    pub min_zoom: f64,

    /// Maximum zoom level
    #[props(default = 2.0)]
    pub max_zoom: f64,

    /// Zoom step size
    #[props(default = 0.1)]
    pub zoom_step: f64,

    /// Callback when zoom changes
    pub on_zoom_change: Callback<f64>,

    /// Position of the controls
    #[props(default)]
    pub position: ZoomPosition,

    /// Whether to show fit to screen button
    #[props(default)]
    pub show_fit: bool,

    /// Custom class name
    #[props(default)]
    pub class: String,
}

impl Default for ZoomControlsProps {
    fn default() -> Self {
        Self {
            zoom: 1.0,
            min_zoom: 0.1,
            max_zoom: 2.0,
            zoom_step: 0.1,
            on_zoom_change: Callback::new(|_| {}),
            position: Default::default(),
            show_fit: true,
            class: String::default(),
        }
    }
}

/// Zoom controls component with keyboard shortcuts
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::ZoomControls;
///
/// fn app() -> Element {
///     rsx! {
///         ZoomControls {
///             zoom: 1.0,
///             on_zoom_change: move |zoom| {
///                 println!("Zoom: {}", zoom);
///             }
///         }
///     }
/// }
/// ```
#[component]
pub fn ZoomControls(props: ZoomControlsProps) -> Element {
    let mut zoom = use_signal(|| props.zoom);

    let position_class = match props.position {
        ZoomPosition::TopRight => "hikari-zoom-top-right",
        ZoomPosition::TopLeft => "hikari-zoom-top-left",
        ZoomPosition::BottomRight => "hikari-zoom-bottom-right",
        ZoomPosition::BottomLeft => "hikari-zoom-bottom-left",
    };

    // Create callbacks by cloning what we need
    let on_zoom_change = props.on_zoom_change;

    // Keyboard shortcuts handler
    let handle_keydown = move |e: KeyboardEvent| {
        let key = e.key();
        match key {
            Key::Character(c) if c == "+" || c == "=" => {
                let new_zoom = (zoom() + props.zoom_step).min(props.max_zoom);
                zoom.set(new_zoom);
                on_zoom_change.call(new_zoom);
            }
            Key::Character(c) if c == "-" || c == "_" => {
                let new_zoom = (zoom() - props.zoom_step).max(props.min_zoom);
                zoom.set(new_zoom);
                on_zoom_change.call(new_zoom);
            }
            Key::Character(c) if c == "0" => {
                zoom.set(1.0);
                on_zoom_change.call(1.0);
            }
            _ => {}
        }
    };

    let zoom_percent = (zoom() * 100.0).round() as i32;
    let can_zoom_in = zoom() < props.max_zoom;
    let can_zoom_out = zoom() > props.min_zoom;

    rsx! {
        div {
            class: format!("hikari-zoom-controls {position_class} {}", props.class),
            tabindex: 0,
            onkeydown: handle_keydown,

            // Zoom out button
            button {
                class: "hikari-zoom-btn hikari-zoom-out",
                "aria-label": "Zoom out",
                "title": "Zoom out (-)",
                disabled: !can_zoom_out,
                onclick: move |_| {
                    let new_zoom = (zoom() - props.zoom_step).max(props.min_zoom);
                    zoom.set(new_zoom);
                    on_zoom_change.call(new_zoom);
                },
                dangerous_inner_html: "&#9666;" // Left arrow
            }

            // Zoom level display
            div {
                class: "hikari-zoom-level",
                "{zoom_percent}%"
            }

            // Zoom in button
            button {
                class: "hikari-zoom-btn hikari-zoom-in",
                "aria-label": "Zoom in",
                "title": "Zoom in (+)",
                disabled: !can_zoom_in,
                onclick: move |_| {
                    let new_zoom = (zoom() + props.zoom_step).min(props.max_zoom);
                    zoom.set(new_zoom);
                    on_zoom_change.call(new_zoom);
                },
                dangerous_inner_html: "&#9656;" // Right arrow
            }

            // Reset button
            button {
                class: "hikari-zoom-btn hikari-zoom-reset",
                "aria-label": "Reset zoom",
                "title": "Reset to 100% (0)",
                onclick: move |_| {
                    zoom.set(1.0);
                    on_zoom_change.call(1.0);
                },
                "100%"
            }

            // Fit to screen button (optional)
            if props.show_fit {
                button {
                    class: "hikari-zoom-btn hikari-zoom-fit",
                    "aria-label": "Fit to screen",
                    "title": "Fit to screen",
                    onclick: move |_| {
                        zoom.set(1.0);
                        on_zoom_change.call(1.0);
                    },
                    dangerous_inner_html: "&#9647;" // Square
                }
            }
        }
    }
}
