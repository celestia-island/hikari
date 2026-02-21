// packages/components/src/display/zoom_controls.rs
// ZoomControls component with Arknights + FUI styling

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, UtilityClass, ZoomControlsClass};

use crate::styled::StyledComponent;

/// ZoomControls component type wrapper (for StyledComponent)
pub struct ZoomControlsComponent;

/// ZoomControls component props
#[derive(Clone, PartialEq, Props)]
pub struct ZoomControlsProps {
    /// Current zoom level (percentage)
    #[props(default = 100)]
    pub zoom: u32,

    /// Minimum zoom level
    #[props(default = 25)]
    pub min_zoom: u32,

    /// Maximum zoom level
    #[props(default = 400)]
    pub max_zoom: u32,

    /// Zoom step for buttons
    #[props(default = 25)]
    pub step: u32,

    /// Show zoom percentage display
    #[props(default = true)]
    pub show_percentage: bool,

    /// Show zoom slider
    #[props(default = false)]
    pub show_slider: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Callback when zoom changes
    pub on_zoom_change: Option<EventHandler<u32>>,
}

/// ZoomControls component for zoom in/out controls
///
/// A control panel for adjusting zoom level with buttons and optional slider.
#[component]
pub fn ZoomControls(props: ZoomControlsProps) -> Element {
    let mut zoom = use_signal(|| props.zoom);

    let container_classes = ClassesBuilder::new()
        .add(ZoomControlsClass::Container)
        .add_raw(&props.class)
        .build();

    let handle_zoom_in = {
        let on_zoom_change = props.on_zoom_change;
        let max = props.max_zoom;
        let step = props.step;
        move |_| {
            let new_zoom = (zoom() + step).min(max);
            zoom.set(new_zoom);
            if let Some(handler) = on_zoom_change.as_ref() {
                handler.call(new_zoom);
            }
        }
    };

    let handle_zoom_out = {
        let on_zoom_change = props.on_zoom_change;
        let min = props.min_zoom;
        let step = props.step;
        move |_| {
            let new_zoom = zoom().saturating_sub(step).max(min);
            zoom.set(new_zoom);
            if let Some(handler) = on_zoom_change.as_ref() {
                handler.call(new_zoom);
            }
        }
    };

    let handle_reset = {
        let on_zoom_change = props.on_zoom_change;
        move |_| {
            zoom.set(100);
            if let Some(handler) = on_zoom_change.as_ref() {
                handler.call(100);
            }
        }
    };

    let can_zoom_in = zoom() < props.max_zoom;
    let can_zoom_out = zoom() > props.min_zoom;

    rsx! {
        div {
            class: "{container_classes}",

            // Zoom out button
            button {
                class: if can_zoom_out {
                    "{ZoomControlsClass::Button.as_class()}"
                } else {
                    "{ZoomControlsClass::Button.as_class()} {ZoomControlsClass::ButtonDisabled.as_class()}"
                },
                disabled: !can_zoom_out,
                onclick: handle_zoom_out,
                Icon { icon: MdiIcon::Minus, size: 18 }
            }

            // Zoom percentage display
            if props.show_percentage {
                div { class: "{ZoomControlsClass::Percentage.as_class()}",
                    "{zoom()}%"
                }
            }

            // Zoom in button
            button {
                class: if can_zoom_in {
                    "{ZoomControlsClass::Button.as_class()}"
                } else {
                    "{ZoomControlsClass::Button.as_class()} {ZoomControlsClass::ButtonDisabled.as_class()}"
                },
                disabled: !can_zoom_in,
                onclick: handle_zoom_in,
                Icon { icon: MdiIcon::MagnifyPlus, size: 18 }
            }

            // Reset button
            button {
                class: "{ZoomControlsClass::Button.as_class()}",
                onclick: handle_reset,
                title: "Reset to 100%",
                Icon { icon: MdiIcon::Magnify, size: 18 }
            }
        }
    }
}

impl StyledComponent for ZoomControlsComponent {
    fn styles() -> &'static str {
        r#"
.hi-zoom-controls {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background-color: var(--hi-color-bg-elevated);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
}

[data-theme="dark"] .hi-zoom-controls {
    background-color: var(--hi-surface);
}

.hi-zoom-controls-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--hi-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-zoom-controls-button:hover:not(.hi-zoom-controls-button-disabled) {
    background-color: var(--hi-color-hover);
    color: var(--hi-text-primary);
}

.hi-zoom-controls-button:active:not(.hi-zoom-controls-button-disabled) {
    background-color: var(--hi-color-primary);
    color: white;
}

.hi-zoom-controls-button-disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.hi-zoom-controls-percentage {
    min-width: 50px;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    color: var(--hi-text-primary);
    font-variant-numeric: tabular-nums;
}

.hi-zoom-controls-slider {
    flex: 1;
    min-width: 80px;
}
"#
    }

    fn name() -> &'static str {
        "zoom-controls"
    }
}
