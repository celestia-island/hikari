// hi-components/src/feedback/tooltip.rs
// Tooltip component with Arknights + FUI styling - Portal-based rendering with animation

use hikari_palette::classes::{ClassesBuilder, TooltipClass, UtilityClass};

#[cfg(target_arch = "wasm32")]
use crate::portal::{PortalEntry, TriggerPlacement};
use crate::{
    portal::provider::{generate_portal_id, use_portal},
    prelude::*,
    styled::StyledComponent,
};

pub struct TooltipComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TooltipPlacement {
    #[default]
    Top,
    Bottom,
    Left,
    Right,
}

impl TooltipPlacement {
    #[cfg(target_arch = "wasm32")]
    fn to_trigger_placement(&self) -> TriggerPlacement {
        match self {
            TooltipPlacement::Top => TriggerPlacement::Top,
            TooltipPlacement::Bottom => TriggerPlacement::Bottom,
            TooltipPlacement::Left => TriggerPlacement::Left,
            TooltipPlacement::Right => TriggerPlacement::Right,
        }
    }
}

#[define_props]
pub struct TooltipProps {
    pub content: String,
    pub placement: TooltipPlacement,
    pub delay: Option<u64>,
    #[default(true)]
    pub arrow: bool,
    pub class: String,
    pub children: Element,
}

#[component]
pub fn Tooltip(props: TooltipProps) -> Element {
    let portal = use_portal();
    let tooltip_id = use_signal(generate_portal_id);
    #[allow(unused_mut)]
    let mut trigger_rect = use_signal(|| None::<(f64, f64, f64, f64)>);

    let wrapper_classes = ClassesBuilder::new()
        .add(TooltipClass::TooltipWrapper)
        .add_raw(&props.class)
        .build();

    let handle_mouse_enter = {
        let tooltip_id = tooltip_id.clone();
        let trigger_rect = trigger_rect.clone();
        let portal_add_entry = portal.add_entry.clone();
        let content = props.content.clone();
        let arrow = props.arrow;
        #[cfg(target_arch = "wasm32")]
        let placement = props.placement.to_trigger_placement();
        move |event: MouseEvent| {
            #[cfg(target_arch = "wasm32")]
            {
                // Use clientX/clientY from MouseEvent to approximate trigger position
                // For precise element bounds, a ref-based approach would be needed
                let rect_tuple = (event.client_x as f64, event.client_y as f64, 100.0, 30.0);
                trigger_rect.set(Some(rect_tuple));

                portal_add_entry(PortalEntry::Tooltip {
                    id: tooltip_id.get(),
                    trigger_rect: Some(rect_tuple),
                    placement,
                    content: content.clone(),
                    arrow,
                });
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                let _ = (&tooltip_id, &trigger_rect, &event, &content, arrow);
            }
        }
    };

    let tooltip_id_for_leave = tooltip_id.clone();
    let portal_remove_entry = portal.remove_entry.clone();
    let handle_mouse_leave = move |_| {
        portal_remove_entry(tooltip_id_for_leave.get());
    };

    rsx! {
        div { class: wrapper_classes,

            div {
                class: TooltipClass::TooltipTrigger.as_class(),
                onmouseenter: handle_mouse_enter,
                onmouseleave: handle_mouse_leave,
                {props.children}
            }
        }
    }
}

impl StyledComponent for TooltipComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/components/tooltip.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "tooltip"
    }
}
