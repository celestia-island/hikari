// hi-components/src/feedback/tooltip.rs
// Tooltip component with Arknights + FUI styling - Portal-based rendering with animation

use hikari_palette::classes::{TypedClass, ClassesBuilder, TooltipClass};

use crate::portal::{PortalEntry, TriggerPlacement};
use crate::{
    platform,
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
    fn to_trigger_placement(self) -> TriggerPlacement {
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
        .add_typed(TooltipClass::TooltipWrapper)
        .add(&props.class)
        .build();

    let handle_mouse_enter = {
        let tooltip_id = tooltip_id.clone();
        let trigger_rect = trigger_rect.clone();
        let portal_add_entry = portal.add_entry.clone();
        let content = props.content.clone();
        let arrow = props.arrow;
        let placement = props.placement.to_trigger_placement();
        move |event: MouseEvent| {
            let rect_tuple = if let Some(target_el) =
                platform::get_target_element_from_event(event.client_x, event.client_y)
            {
                platform::get_bounding_rect_by_class_impl("hi-tooltip-trigger", &target_el)
                    .map(|rect| (rect.x, rect.y, rect.width, rect.height))
            } else {
                None
            };
            trigger_rect.set(rect_tuple);

            portal_add_entry(PortalEntry::Tooltip {
                id: tooltip_id.get(),
                trigger_rect: rect_tuple,
                placement,
                content: content.clone(),
                arrow,
            });
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
                class: TooltipClass::TooltipTrigger.class_name(),
                onmouseenter: handle_mouse_enter,
                onmouseleave: handle_mouse_leave,
                "aria-describedby": format!("hi-tooltip-{}", tooltip_id.get()),
                {props.children}
            }
        }
    }
}

impl StyledComponent for TooltipComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/tooltip.css"))
    }

    fn name() -> &'static str {
        "tooltip"
    }
}
