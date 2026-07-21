// packages/components/src/display/zoom_controls.rs
// ZoomControls component with Arknights + FUI styling

use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, UtilityClass, ZoomControlsClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct ZoomControlsComponent;

#[define_props]
pub struct ZoomControlsProps {
    #[default(100)]
    pub zoom: u32,

    #[default(25)]
    pub min_zoom: u32,

    #[default(400)]
    pub max_zoom: u32,

    #[default(25)]
    pub step: u32,

    #[default(true)]
    pub show_percentage: bool,

    #[default(false)]
    pub show_slider: bool,

    #[default]
    pub class: String,

    pub on_zoom_change: Option<EventHandler<u32>>,
}

///
#[component]
pub fn ZoomControls(props: ZoomControlsProps) -> Element {
    let zoom = use_signal(|| props.zoom);

    let container_classes = ClassesBuilder::new()
        .add(ZoomControlsClass::Container)
        .add_raw(&props.class)
        .build();

    let handle_zoom_in = {
        let zoom = zoom.clone();
        let on_zoom_change = props.on_zoom_change.clone();
        let max = props.max_zoom;
        let step = props.step;
        move |_| {
            let new_zoom = (zoom.get() + step).min(max);
            zoom.set(new_zoom);
            if let Some(handler) = on_zoom_change.as_ref() {
                handler.call(new_zoom);
            }
        }
    };

    let handle_zoom_out = {
        let zoom = zoom.clone();
        let on_zoom_change = props.on_zoom_change.clone();
        let min = props.min_zoom;
        let step = props.step;
        move |_| {
            let new_zoom = zoom.get().saturating_sub(step).max(min);
            zoom.set(new_zoom);
            if let Some(handler) = on_zoom_change.as_ref() {
                handler.call(new_zoom);
            }
        }
    };

    let handle_reset = {
        let zoom = zoom.clone();
        let on_zoom_change = props.on_zoom_change.clone();
        move |_| {
            zoom.set(100);
            if let Some(handler) = on_zoom_change.as_ref() {
                handler.call(100);
            }
        }
    };

    let can_zoom_in = zoom.get() < props.max_zoom;
    let can_zoom_out = zoom.get() > props.min_zoom;

    rsx! {
        div { class: container_classes,

            // Zoom out button
            button {
                class: if can_zoom_out { "{ZoomControlsClass::Button.as_class()}" } else { "{ZoomControlsClass::Button.as_class()} {ZoomControlsClass::ButtonDisabled.as_class()}" },
                disabled: !can_zoom_out,
                onclick: handle_zoom_out,
                Icon { icon: MdiIcon::Minus, size: 18 }
            }

            // Zoom percentage display
            if props.show_percentage {
                div { class: ZoomControlsClass::Percentage.as_class(), "{zoom.get()}%" }
            }

            // Zoom in button
            button {
                class: if can_zoom_in { "{ZoomControlsClass::Button.as_class()}" } else { "{ZoomControlsClass::Button.as_class()} {ZoomControlsClass::ButtonDisabled.as_class()}" },
                disabled: !can_zoom_in,
                onclick: handle_zoom_in,
                Icon { icon: MdiIcon::MagnifyPlus, size: 18 }
            }

            // Reset button
            button {
                class: ZoomControlsClass::Button.as_class(),
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
.hk-zoom-controls {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background-color: var(--hi-color-bg-elevated);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
}

[data-theme="dark"] .hk-zoom-controls {
    background-color: var(--hi-surface);
}

.hk-zoom-controls-button {
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

.hk-zoom-controls-button:hover:not(.hk-zoom-controls-button-disabled) {
    background-color: var(--hi-color-hover);
    color: var(--hi-text-primary);
}

.hk-zoom-controls-button:active:not(.hk-zoom-controls-button-disabled) {
    background-color: var(--hi-color-primary);
    color: white;
}

.hk-zoom-controls-button-disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.hk-zoom-controls-percentage {
    min-width: 50px;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    color: var(--hi-text-primary);
    font-variant-numeric: tabular-nums;
}

.hk-zoom-controls-slider {
    flex: 1;
    min-width: 80px;
}
"#
    }

    fn name() -> &'static str {
        "zoom-controls"
    }
}
