// hi-components/src/feedback/tooltip.rs
// Tooltip component with Arknights + FUI styling - Portal-based rendering with animation

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, TooltipClass, UtilityClass};

use crate::{
    portal::{
        provider::{generate_portal_id, use_portal},
    },
    styled::StyledComponent,
};

#[cfg(target_arch = "wasm32")]
use crate::portal::{PortalEntry, TriggerPlacement};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

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

#[derive(Clone, PartialEq, Props)]
pub struct TooltipProps {
    #[props(default)]
    pub content: String,

    #[props(default)]
    pub placement: TooltipPlacement,

    #[props(default)]
    pub delay: Option<u64>,

    #[props(default = true)]
    pub arrow: bool,

    #[props(default)]
    pub class: String,

    pub children: Element,
}

impl Default for TooltipProps {
    fn default() -> Self {
        Self {
            content: String::default(),
            placement: Default::default(),
            delay: None,
            arrow: true,
            class: String::default(),
            children: VNode::empty(),
        }
    }
}

#[component]
pub fn Tooltip(props: TooltipProps) -> Element {
    let portal = use_portal();
    let tooltip_id = use_signal(|| generate_portal_id());
    let mut trigger_rect = use_signal(|| None::<(f64, f64, f64, f64)>);

    let wrapper_classes = ClassesBuilder::new()
        .add(TooltipClass::TooltipWrapper)
        .add_raw(&props.class)
        .build();

    let handle_mouse_enter = move |event: Event<MouseData>| {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(web_event) = event.downcast::<web_sys::MouseEvent>() {
                if let Some(target) = web_event.target() {
                    if let Some(elem) = target.dyn_ref::<web_sys::Element>() {
                        let rect = elem.get_bounding_client_rect();
                        let rect_tuple = (rect.left(), rect.top(), rect.width(), rect.height());
                        trigger_rect.set(Some(rect_tuple));

                        (portal.add_entry)(PortalEntry::Tooltip {
                            id: tooltip_id(),
                            trigger_rect: Some(rect_tuple),
                            placement: props.placement.to_trigger_placement(),
                            content: props.content.clone(),
                            arrow: props.arrow,
                        });
                    }
                }
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = (&tooltip_id, &trigger_rect, &event);
        }
    };

    let handle_mouse_leave = move |_| {
        (portal.remove_entry)(tooltip_id());
    };

    rsx! {
        div {
            class: "{wrapper_classes}",

            div {
                class: "{TooltipClass::TooltipTrigger.as_class()}",
                onmouseenter: handle_mouse_enter,
                onmouseleave: handle_mouse_leave,
                { props.children }
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
