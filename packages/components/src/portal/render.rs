// hi-components/src/portal/render.rs
// Portal rendering components

#![expect(clippy::needless_update)]

use hikari_palette::classes::{
    ClassesBuilder, DropdownClass, ModalClass, PopoverClass, PortalClass, TooltipClass,
    UtilityClass,
};

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use super::provider::use_portal;
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::platform::{element_closest, element_from_point, request_animation_frame, set_timeout};
use crate::{
    feedback::PopoverPlacement,
    modal::{MaskMode, ModalPosition, ModalSize},
    platform::{inner_height, inner_width, log},
    portal::{
        positioning::calculate_position,
        types::{
            ModalAnimationState, PortalEntry, PortalMaskMode, PortalPositionStrategy,
            ToastPosition, TriggerPlacement,
        },
    },
    prelude::*,
};
use tairitsu_hooks::ReactiveSignal;

fn use_animated_portal_entry(
    id: String,
    initial_state: ModalAnimationState,
    name: &'static str,
) -> (
    ReactiveSignal<ModalAnimationState>,
    Callback<MouseEvent>,
    Signal<(String, String)>,
) {
    #[cfg_attr(
        not(all(target_arch = "wasm32", target_os = "unknown")),
        allow(unused_variables)
    )]
    let id_for_close = id.clone();
    let internal_animation_state = use_signal(|| initial_state);

    let close_callback = {
        let anim_state = internal_animation_state.clone();
        Callback::new(move |_| {
            log(&format!("{} close triggered", name));
            let _ = name;
            anim_state.set(ModalAnimationState::Disappearing);
        })
    };

    let internal_animation_state_for_memo = internal_animation_state.clone();
    let computed_opacity_scale = use_memo(move || {
        let state = internal_animation_state_for_memo.read();
        log(&format!("{} use_memo triggered, state: {:?}", name, state));
        let (opacity, scale) = match state {
            ModalAnimationState::Appearing => ("0".to_string(), "0.95".to_string()),
            ModalAnimationState::Visible => ("1".to_string(), "1".to_string()),
            ModalAnimationState::Disappearing => ("0".to_string(), "0.95".to_string()),
        };
        (opacity, scale)
    })
    .value();

    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        let internal_animation_state_for_effect = internal_animation_state.clone();
        let portal = use_portal();
        let remove_entry_for_effect = portal.remove_entry.clone();
        use_effect(move || {
            let state = internal_animation_state_for_effect.get();
            log(&format!(
                "{} use_effect triggered, state: {:?}",
                name, state
            ));
            if state == ModalAnimationState::Appearing {
                let anim_state_clone = internal_animation_state_for_effect.clone();
                request_animation_frame(move || {
                    anim_state_clone.set(ModalAnimationState::Visible);
                    log(&format!(
                        "{} set to visible via requestAnimationFrame",
                        name
                    ));
                });
            } else if state == ModalAnimationState::Disappearing {
                let id = id_for_close.clone();
                log(&format!(
                    "{} setTimeout scheduled for removing entry: {}",
                    name, id
                ));
                let remove_entry = remove_entry_for_effect.clone();
                set_timeout(
                    move || {
                        log(&format!("{} removing entry after timeout: {}", name, id));
                        remove_entry.call(id.clone());
                    },
                    200,
                );
            }
        });
    }

    (
        internal_animation_state.clone(),
        close_callback,
        computed_opacity_scale,
    )
}

#[component]
pub fn PortalRender(
    #[props(default)] entries: Option<ReactiveSignal<Vec<PortalEntry>>>,
) -> Element {
    let entries = match entries {
        Some(signal) => signal.read(),
        None => {
            return rsx! {
                div {}
            };
        }
    };

    let portal_classes = ClassesBuilder::new().add(PortalClass::PortalRoot).build();

    // Pre-collect all portal entry elements
    let entry_elements: Vec<Element> = entries
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            let z_index = 10000 + index;
            match entry {
                PortalEntry::Modal {
                    id,
                    title,
                    position,
                    mask_mode,
                    closable,
                    mask_closable,
                    size,
                    children,
                    animation_state,
                } => rsx! {
                    ModalPortalEntry {
                        z_index,
                        id: id.clone(),
                        title: title.clone(),
                        position: *position,
                        mask_mode: *mask_mode,
                        closable: *closable,
                        mask_closable: *mask_closable,
                        size: *size,
                        children: children.clone(),
                        animation_state: *animation_state,
                    }
                },
                PortalEntry::Dropdown {
                    id,
                    strategy,
                    mask_mode,
                    children,
                    trigger_rect,
                    close_on_select,
                } => rsx! {
                    DropdownPortalEntry {
                        z_index,
                        id: id.clone(),
                        strategy: *strategy,
                        mask_mode: *mask_mode,
                        children: children.clone(),
                        trigger_rect: *trigger_rect,
                        close_on_select: *close_on_select,
                    }
                },
                PortalEntry::Toast {
                    id,
                    position,
                    children,
                } => rsx! {
                    ToastPortalEntry {
                        z_index,
                        id: id.clone(),
                        position: *position,
                        children: children.clone(),
                    }
                },
                PortalEntry::Popover {
                    id,
                    trigger_rect,
                    preferred_placements,
                    offset,
                    width,
                    title,
                    close_on_click_outside,
                    close_on_select,
                    on_close,
                    close_requested,
                    children,
                } => rsx! {
                    PopoverPortalEntry {
                        z_index,
                        id: id.clone(),
                        trigger_rect: *trigger_rect,
                        preferred_placements: preferred_placements.clone(),
                        offset: *offset,
                        width: width.clone(),
                        title: title.clone(),
                        close_on_click_outside: *close_on_click_outside,
                        close_on_select: *close_on_select,
                        on_close: on_close.clone(),
                        close_requested: Some(close_requested.clone()),
                        children: children.clone(),
                    }
                },
                PortalEntry::Tooltip {
                    id,
                    trigger_rect,
                    placement,
                    content,
                    arrow,
                } => rsx! {
                    TooltipPortalEntry {
                        z_index,
                        id: id.clone(),
                        trigger_rect: *trigger_rect,
                        placement: *placement,
                        content: content.clone(),
                        arrow: *arrow,
                    }
                },
            }
        })
        .collect();

    rsx! {
        div {
            class: portal_classes,
            style: "position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9999;",
            ..entry_elements,
        }
    }
}

#[component]
fn ModalPortalEntry(
    #[props(default)] z_index: usize,
    #[props(default)] id: String,
    #[props(default)] title: Option<String>,
    #[props(default)] position: ModalPosition,
    #[props(default)] mask_mode: MaskMode,
    #[props(default)] closable: bool,
    #[props(default)] mask_closable: bool,
    #[props(default)] size: ModalSize,
    #[props(default)] children: Element,
    #[props(default)] animation_state: ModalAnimationState,
) -> Element {
    let _internal_animation_state = use_signal(|| animation_state);
    let (_, button_close, computed_opacity_scale) =
        use_animated_portal_entry(id.clone(), animation_state, "Modal");

    // Clone button_close for the overlay click handler
    let button_close_for_overlay = button_close.clone();

    let overlay_classes = if mask_mode == MaskMode::Transparent {
        ClassesBuilder::new()
            .add(ModalClass::Overlay)
            .add(ModalClass::OverlayTransparent)
            .build()
    } else {
        ClassesBuilder::new().add(ModalClass::Overlay).build()
    };

    let size_class = match size {
        ModalSize::Sm => ModalClass::Sm,
        ModalSize::Md => ModalClass::Md,
        ModalSize::Lg => ModalClass::Lg,
        ModalSize::Xl => ModalClass::Xl,
    };

    let modal_classes = ClassesBuilder::new()
        .add(ModalClass::Modal)
        .add(size_class)
        .build();

    let modal_style = use_memo(move || {
        let (opacity, scale) = computed_opacity_scale.read().clone();
        let style = format!(
            "opacity: {}; transform: scale({}); transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;",
            opacity, scale
        );
        log(&format!("Modal style computed: {}", style));
        style
    });

    let header_classes = ClassesBuilder::new().add(ModalClass::Header).build();

    let title_classes = ClassesBuilder::new().add(ModalClass::Title).build();

    let close_classes = ClassesBuilder::new().add(ModalClass::Close).build();

    let body_classes = ClassesBuilder::new().add(ModalClass::Body).build();

    // Build title element outside rsx!
    let title_el = if title.is_some() {
        rsx! {
            h3 { class: title_classes, "{title.as_ref().unwrap().clone()}" }
        }
    } else {
        VNode::empty()
    };

    // Build close button outside rsx!
    let close_button = if closable {
        rsx! {
            button { class: close_classes, onclick: button_close,
                svg {
                    view_box: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    stroke_width: "2",
                    line {
                        x1: "18",
                        y1: "6",
                        x2: "6",
                        y2: "18",
                    }
                    line {
                        x1: "6",
                        y1: "6",
                        x2: "18",
                        y2: "18",
                    }
                }
            }
        }
    } else {
        VNode::empty()
    };

    // Compute overlay style based on mask mode
    let overlay_style = format!(
        "position: fixed; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; z-index: {};",
        z_index
    );

    rsx! {
        div {
            class: overlay_classes,
            style: overlay_style,
            onclick: move |e: MouseEvent| {
                if mask_closable && mask_mode == MaskMode::Opaque {
                    e.stop_propagation();
                    button_close_for_overlay.call(e);
                }
            },

            div {
                class: modal_classes,
                style: modal_style.read(),
                onclick: |e: MouseEvent| {
                    e.stop_propagation();
                },

                div { class: header_classes,
                    {title_el}
                    {close_button}
                }

                div { class: body_classes, {children} }
            }
        }
    }
}

#[component]
fn DropdownPortalEntry(
    #[props(default)] z_index: usize,
    #[props(default)] id: String,
    #[props(default)] strategy: PortalPositionStrategy,
    #[props(default)] mask_mode: PortalMaskMode,
    #[props(default)] children: Element,
    #[props(default)] trigger_rect: Option<(f64, f64, f64, f64)>,
    #[props(default)] close_on_select: bool,
) -> Element {
    let _internal_animation_state = use_signal(|| ModalAnimationState::Appearing);
    let (_, close_dropdown, computed_opacity_scale) =
        use_animated_portal_entry(id.clone(), ModalAnimationState::Appearing, "Dropdown");

    // Clone close_dropdown for multiple handlers
    let close_dropdown_for_overlay = close_dropdown.clone();
    let close_dropdown_for_content = close_dropdown.clone();

    let viewport_width = use_signal(|| inner_width() as f64);
    let viewport_height = use_signal(|| inner_height() as f64);

    // Use trigger_rect width if available, otherwise default to 200.0
    let element_width =
        use_signal(move || trigger_rect.map(|(_, _, width, _)| width).unwrap_or(200.0));

    let _position_style = use_memo(move || {
        let viewport_w = viewport_width.read();
        let viewport_h = viewport_height.read();
        let elem_w = element_width.read();

        let (placement, _trigger_x, trigger_y) = match &strategy {
            PortalPositionStrategy::TriggerBased { placement } => {
                if let Some((rect_x, rect_y, _, _)) = trigger_rect {
                    (Some(*placement), Some(rect_x), Some(rect_y))
                } else {
                    (Some(*placement), None, None)
                }
            }
            _ => (None, None, None),
        };

        let (x, y) = calculate_position(&strategy, viewport_w, viewport_h, elem_w, trigger_rect);

        match placement {
            Some(
                TriggerPlacement::Bottom
                | TriggerPlacement::BottomLeft
                | TriggerPlacement::BottomRight,
            ) => {
                format!("position: fixed; left: {}px; top: {}px;", x, y)
            }
            Some(
                TriggerPlacement::Top | TriggerPlacement::TopLeft | TriggerPlacement::TopRight,
            ) => {
                if let Some(ty) = trigger_y {
                    let bottom_offset = viewport_h - ty;
                    format!(
                        "position: fixed; left: {}px; bottom: {}px;",
                        x, bottom_offset
                    )
                } else {
                    format!("position: fixed; left: {}px; bottom: {}px;", x, y)
                }
            }
            Some(
                TriggerPlacement::Left | TriggerPlacement::LeftTop | TriggerPlacement::LeftBottom,
            ) => {
                format!("position: fixed; left: {}px; top: {}px;", x, y)
            }
            Some(
                TriggerPlacement::Right
                | TriggerPlacement::RightTop
                | TriggerPlacement::RightBottom,
            ) => {
                format!("position: fixed; left: {}px; top: {}px;", x, y)
            }
            Some(TriggerPlacement::Center) => {
                format!("position: fixed; left: {}px; top: {}px;", x, y)
            }
            None => format!("position: fixed; left: {}px; top: {}px;", x, y),
        }
    });

    let overlay_classes = if mask_mode == PortalMaskMode::Dimmed {
        ClassesBuilder::new()
            .add(DropdownClass::Overlay)
            .add(DropdownClass::OverlayDimmed)
            .build()
    } else {
        ClassesBuilder::new().add(DropdownClass::Overlay).build()
    };

    let dropdown_classes =
        use_memo(move || ClassesBuilder::new().add(DropdownClass::Dropdown).build());

    let overlay_style = format!(
        "position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: auto; z-index: {}; transition: opacity 0.2s ease-in-out;",
        z_index
    );

    let content_style = use_memo(move || {
        let pos = _position_style.read();
        let (opacity, scale) = computed_opacity_scale.read().clone();

        let transform_origin = match &strategy {
            PortalPositionStrategy::TriggerBased { placement } => match placement {
                TriggerPlacement::Bottom
                | TriggerPlacement::BottomLeft
                | TriggerPlacement::BottomRight => "top center",
                TriggerPlacement::Top | TriggerPlacement::TopLeft | TriggerPlacement::TopRight => {
                    "bottom center"
                }
                _ => "center center",
            },
            _ => "center center",
        };

        let style = format!(
            "{} opacity: {}; transform: scaleY({}); transform-origin: {}; transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;",
            pos, opacity, scale, transform_origin
        );
        log(&format!("Dropdown style computed: {}", style));
        style
    });

    rsx! {
        div {
            class: overlay_classes,
            style: overlay_style,
            onclick: move |e: MouseEvent| {
                e.stop_propagation();
                close_dropdown_for_overlay.call(e);
            },

            div {
                class: dropdown_classes,
                style: content_style.read(),
                onclick: move |e: MouseEvent| {
                    e.stop_propagation();
                    if close_on_select {
                        #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
                        {
                            if let Some(target_el) = element_from_point(e.client_x, e.client_y) {
                                if element_closest(&target_el, ".hi-menu-item").is_some() {
                                    close_dropdown_for_content.call(e);
                                }
                            }
                        }
                        #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
                        {
                            close_dropdown_for_content.call(e);
                        }
                    }
                },

                {children}
            }
        }
    }
}

#[component]
fn ToastPortalEntry(
    #[props(default)] z_index: usize,
    #[props(default)] id: String,
    #[props(default)] position: ToastPosition,
    #[props(default)] children: Element,
) -> Element {
    let position_style = match position {
        ToastPosition::TopLeft => "position: fixed; top: 16px; left: 16px;",
        ToastPosition::TopCenter => {
            "position: fixed; top: 16px; left: 50%; transform: translateX(-50%);"
        }
        ToastPosition::TopRight => "position: fixed; top: 16px; right: 16px;",
        ToastPosition::BottomLeft => "position: fixed; bottom: 16px; left: 16px;",
        ToastPosition::BottomCenter => {
            "position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);"
        }
        ToastPosition::BottomRight => "position: fixed; bottom: 16px; right: 16px;",
    };

    rsx! {
        div {
            class: "hi-toast",
            style: "{position_style} z-index: {z_index}; pointer-events: auto;",
            {children}
        }
    }
}

#[component]
fn PopoverPortalEntry(
    #[props(default)] z_index: usize,
    #[props(default)] id: String,
    #[props(default)] trigger_rect: Option<(f64, f64, f64, f64)>,
    #[props(default)] preferred_placements: Vec<PopoverPlacement>,
    #[props(default)] offset: f64,
    #[props(default)] width: Option<String>,
    #[props(default)] title: Option<String>,
    #[props(default)] close_on_click_outside: bool,
    #[props(default)] close_on_select: bool,
    #[props(default)] on_close: Option<Callback<()>>,
    #[props(default)] close_requested: Option<ReactiveSignal<bool>>,
    #[props(default)] children: Element,
) -> Element {
    let (mut animation_state, close_popover, computed_opacity_scale) =
        use_animated_portal_entry(id.clone(), ModalAnimationState::Appearing, "Popover");

    // Create a default signal if none provided
    let close_requested_signal = close_requested.unwrap_or_else(|| use_signal(|| false));

    // Clone for use_effect
    let on_close_for_effect = on_close.clone();
    {
        use_effect(move || {
            if close_requested_signal.get() {
                let current_state = animation_state.read();
                if current_state == ModalAnimationState::Visible {
                    animation_state.set(ModalAnimationState::Disappearing);
                    if let Some(handler) = on_close_for_effect.as_ref() {
                        handler.call(());
                    }
                }
            }
        });
    }

    let viewport_height = use_signal(|| inner_height() as f64);

    let position_state = use_signal(|| {
        struct PlacementParams {
            tx: f64,
            ty: f64,
            tw: f64,
            th: f64,
            popover_w: f64,
            popover_h: f64,
            vw: f64,
            vh: f64,
            offset: f64,
            padding: f64,
        }

        fn check_placement(
            placement: PopoverPlacement,
            params: &PlacementParams,
        ) -> Option<(PopoverPlacement, f64, f64)> {
            let PlacementParams {
                tx,
                ty,
                tw,
                th,
                popover_w,
                popover_h,
                vw,
                vh,
                offset,
                padding,
            } = *params;
            let x = tx + tw / 2.0;
            let y = ty + th / 2.0;

            match placement {
                PopoverPlacement::Bottom => {
                    let pos_y = ty + th + offset;
                    if pos_y + popover_h <= vh - padding {
                        Some((PopoverPlacement::Bottom, x, pos_y))
                    } else {
                        None
                    }
                }
                PopoverPlacement::Top => {
                    let pos_y = ty - offset;
                    if pos_y - popover_h >= padding {
                        Some((PopoverPlacement::Top, x, pos_y))
                    } else {
                        None
                    }
                }
                PopoverPlacement::Left => {
                    let pos_x = tx - offset;
                    if pos_x - popover_w >= padding {
                        Some((PopoverPlacement::Left, pos_x, y))
                    } else {
                        None
                    }
                }
                PopoverPlacement::Right => {
                    let pos_x = tx + tw + offset;
                    if pos_x + popover_w <= vw - padding {
                        Some((PopoverPlacement::Right, pos_x, y))
                    } else {
                        None
                    }
                }
            }
        }

        fn get_viewport_width() -> f64 {
            inner_width() as f64
        }

        const PADDING: f64 = 16.0;
        const POPOVER_W: f64 = 160.0;
        const POPOVER_H: f64 = 120.0;

        if let Some((tx, ty, tw, th)) = trigger_rect {
            let trigger_center_x = tx + tw / 2.0;
            let params = PlacementParams {
                tx,
                ty,
                tw,
                th,
                popover_w: POPOVER_W,
                popover_h: POPOVER_H,
                vw: get_viewport_width(),
                vh: viewport_height.get(),
                offset,
                padding: PADDING,
            };

            for placement in &preferred_placements {
                if let Some(result) = check_placement(*placement, &params) {
                    return result;
                }
            }

            let default_order = [
                PopoverPlacement::Bottom,
                PopoverPlacement::Top,
                PopoverPlacement::Left,
                PopoverPlacement::Right,
            ];
            for placement in default_order {
                if !preferred_placements.contains(&placement)
                    && let Some(result) = check_placement(placement, &params)
                {
                    return result;
                }
            }

            (PopoverPlacement::Bottom, trigger_center_x, ty + th + offset)
        } else {
            (PopoverPlacement::Bottom, 0.0, 0.0)
        }
    });

    let (placement, x, y) = position_state.get();

    let (position_style, transform_origin, translate_transform) = match placement {
        PopoverPlacement::Bottom => (
            format!("position: fixed; left: {}px; top: {}px;", x, y),
            "top center",
            "translateX(-50%)",
        ),
        PopoverPlacement::Top => (
            format!(
                "position: fixed; left: {}px; bottom: {}px;",
                x,
                viewport_height.get() - y
            ),
            "bottom center",
            "translateX(-50%)",
        ),
        PopoverPlacement::Left => (
            format!("position: fixed; left: {}px; top: {}px;", x, y),
            "right center",
            "translateX(-100%) translateY(-50%)",
        ),
        PopoverPlacement::Right => (
            format!("position: fixed; left: {}px; top: {}px;", x, y),
            "left center",
            "translateY(-50%)",
        ),
    };

    let (opacity, scale) = computed_opacity_scale.read().clone();
    let width_style = width.as_deref().unwrap_or("auto");
    let popover_classes = ClassesBuilder::new().add(PopoverClass::Popover).build();

    let popover_style = format!(
        "{} z-index: {}; width: {}; transform: {} scaleY({}); transform-origin: {}; opacity: {}; transition: opacity 0.15s ease-out, transform 0.15s ease-out; border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10); backdrop-filter: blur(12px); padding: 4px 0;",
        position_style, z_index, width_style, translate_transform, scale, transform_origin, opacity
    );

    let backdrop_z_index = z_index.saturating_sub(1);

    // Clone for handle_close
    let on_close_for_backdrop = on_close.clone();
    let close_popover_for_backdrop = close_popover.clone();
    let handle_close = move |e: MouseEvent| {
        close_popover_for_backdrop.call(e);
        if let Some(handler) = on_close_for_backdrop.as_ref() {
            handler.call(());
        }
    };

    let backdrop_style = format!(
        "position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: {}; background: transparent; pointer-events: auto;",
        backdrop_z_index
    );

    let backdrop = if close_on_click_outside {
        rsx! {
            div {
                class: "hi-popover-backdrop",
                style: backdrop_style,
                onclick: handle_close,
            }
        }
    } else {
        VNode::empty()
    };

    let title_classes = ClassesBuilder::new().add(PopoverClass::Title).build();
    let content_classes = ClassesBuilder::new().add(PopoverClass::Content).build();

    // Build title element outside rsx!
    let title_el = if title.is_some() {
        rsx! {
            div { class: title_classes, "{title.as_ref().unwrap().clone()}" }
        }
    } else {
        VNode::empty()
    };

    // Clone for content onclick
    let close_popover_for_content = close_popover.clone();
    let on_close_for_content = on_close.clone();

    let popover_content = rsx! {
        div {
            class: popover_classes,
            style: popover_style,
            "data-open": "true",

            {title_el}

            div {
                class: content_classes,
                onclick: move |e: MouseEvent| {
                    e.stop_propagation();

                    if close_on_select {
                        #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
                        {
                            if let Some(target_el) = element_from_point(e.client_x, e.client_y) {
                                if element_closest(&target_el, ".hi-menu-item").is_some() {
                                    close_popover_for_content.call(e);
                                    if let Some(handler) = on_close_for_content.as_ref() {
                                        handler.call(());
                                    }
                                }
                            }
                        }
                        #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
                        {
                            close_popover_for_content.call(e);
                            if let Some(handler) = on_close_for_content.as_ref() {
                                handler.call(());
                            }
                        }
                    }
                },
                {children}
            }
        }
    };

    VNode::Fragment(vec![backdrop, popover_content])
}

#[component]
fn TooltipPortalEntry(
    #[props(default)] z_index: usize,
    #[props(default)] id: String,
    #[props(default)] trigger_rect: Option<(f64, f64, f64, f64)>,
    #[props(default)] placement: TriggerPlacement,
    #[props(default)] content: String,
    #[props(default)] arrow: bool,
) -> Element {
    let viewport_width = use_signal(|| inner_width() as f64);
    let viewport_height = use_signal(|| inner_height() as f64);

    let tooltip_width = use_signal(|| 120.0);
    let tooltip_height = use_signal(|| 40.0);

    let position_style = use_memo(move || {
        let vw = viewport_width.read();
        let vh = viewport_height.read();
        let tw = tooltip_width.read();
        let th = tooltip_height.read();

        if let Some((tx, ty, tw_rect, th_rect)) = trigger_rect {
            let trigger_center_x = tx + tw_rect / 2.0;
            let trigger_center_y = ty + th_rect / 2.0;

            let (x, y) = match placement {
                TriggerPlacement::Top => (trigger_center_x - tw / 2.0, ty - th - 8.0),
                TriggerPlacement::TopLeft => (tx, ty - th - 8.0),
                TriggerPlacement::TopRight => (tx + tw_rect - tw, ty - th - 8.0),
                TriggerPlacement::Bottom => (trigger_center_x - tw / 2.0, ty + th_rect + 8.0),
                TriggerPlacement::BottomLeft => (tx, ty + th_rect + 8.0),
                TriggerPlacement::BottomRight => (tx + tw_rect - tw, ty + th_rect + 8.0),
                TriggerPlacement::Left => (tx - tw - 8.0, trigger_center_y - th / 2.0),
                TriggerPlacement::LeftTop => (tx - tw - 8.0, ty),
                TriggerPlacement::LeftBottom => (tx - tw - 8.0, ty + th_rect - th),
                TriggerPlacement::Right => (tx + tw_rect + 8.0, trigger_center_y - th / 2.0),
                TriggerPlacement::RightTop => (tx + tw_rect + 8.0, ty),
                TriggerPlacement::RightBottom => (tx + tw_rect + 8.0, ty + th_rect - th),
                TriggerPlacement::Center => {
                    (trigger_center_x - tw / 2.0, trigger_center_y - th / 2.0)
                }
            };

            let x_clamped = x.clamp(8.0, vw - tw - 8.0);
            let y_clamped = y.clamp(8.0, vh - th - 8.0);

            format!(
                "position: fixed; left: {}px; top: {}px;",
                x_clamped, y_clamped
            )
        } else {
            "position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);".to_string()
        }
    });

    let placement_class = match placement {
        TriggerPlacement::Top => TooltipClass::TooltipTop,
        TriggerPlacement::Bottom => TooltipClass::TooltipBottom,
        TriggerPlacement::Left => TooltipClass::TooltipLeft,
        TriggerPlacement::Right => TooltipClass::TooltipRight,
        _ => TooltipClass::TooltipTop,
    };

    let tooltip_classes = ClassesBuilder::new()
        .add(TooltipClass::Tooltip)
        .add(placement_class)
        .add(TooltipClass::TooltipVisible)
        .build();

    let tooltip_style = format!(
        "{} z-index: {}; pointer-events: none;",
        position_style.read(),
        z_index
    );

    // Build arrow element outside rsx!
    let arrow_el = if arrow {
        rsx! {
            div { class: "hi-tooltip-arrow" }
        }
    } else {
        VNode::empty()
    };

    rsx! {
        div { class: tooltip_classes, style: tooltip_style,

            div { class: TooltipClass::TooltipContent.as_class(), "{content}" }

            {arrow_el}
        }
    }
}
