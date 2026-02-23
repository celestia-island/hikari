// hi-components/src/portal/render.rs
// Portal rendering components

use dioxus::prelude::*;
use palette::classes::{
    ClassesBuilder, DropdownClass, ModalClass, PopoverClass, PortalClass, TooltipClass,
    UtilityClass,
};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{JsCast, closure::Closure};

use super::provider::PortalContext;
use crate::{
    feedback::PopoverPlacement,
    modal::{MaskMode, ModalPosition},
    portal::{
        positioning::calculate_position,
        types::{
            ModalAnimationState, PortalEntry, PortalMaskMode, PortalPositionStrategy,
            ToastPosition, TriggerPlacement,
        },
    },
};

fn use_animated_portal_entry(
    id: String,
    initial_state: ModalAnimationState,
    name: &'static str,
) -> (
    Signal<ModalAnimationState>,
    Callback<MouseEvent>,
    Memo<(String, String)>,
) {
    #[cfg_attr(not(target_arch = "wasm32"), allow(unused_variables))]
    let context = use_context::<PortalContext>();
    #[cfg_attr(not(target_arch = "wasm32"), allow(unused_variables))]
    let id_for_close = id.clone();
    let internal_animation_state = use_signal(|| initial_state);

    let close_callback = {
        let mut anim_state = internal_animation_state;
        Callback::new(move |_| {
            #[cfg(target_arch = "wasm32")]
            {
                web_sys::console::log_1(&format!("{} close triggered", name).into());
            }
            #[cfg(not(target_arch = "wasm32"))]
            let _ = name;
            anim_state.set(ModalAnimationState::Disappearing);
        })
    };

    let computed_opacity_scale = use_memo(move || {
        let state = *internal_animation_state.read();
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::console::log_1(
                &format!("{} use_memo triggered, state: {:?}", name, state).into(),
            );
        }
        let (opacity, scale) = match state {
            ModalAnimationState::Appearing => ("0".to_string(), "0.95".to_string()),
            ModalAnimationState::Visible => ("1".to_string(), "1".to_string()),
            ModalAnimationState::Disappearing => ("0".to_string(), "0.95".to_string()),
        };
        (opacity, scale)
    });

    #[cfg(target_arch = "wasm32")]
    {
        use_effect(use_reactive(
            (&internal_animation_state,),
            move |(anim_state,)| {
                let state = *anim_state.read();
                #[cfg(target_arch = "wasm32")]
                {
                    web_sys::console::log_1(
                        &format!("{} use_effect triggered, state: {:?}", name, state).into(),
                    );
                }
                if state == ModalAnimationState::Appearing {
                    let mut anim_state_clone = internal_animation_state.clone();
                    let callback = Closure::once_into_js(move || {
                        anim_state_clone.set(ModalAnimationState::Visible);
                        #[cfg(target_arch = "wasm32")]
                        {
                            web_sys::console::log_1(
                                &format!("{} set to visible via requestAnimationFrame", name)
                                    .into(),
                            );
                        }
                    });
                    let _ = web_sys::window()
                        .unwrap()
                        .request_animation_frame(callback.unchecked_ref());
                } else if state == ModalAnimationState::Disappearing {
                    let id = id_for_close.clone();
                    #[cfg(target_arch = "wasm32")]
                    web_sys::console::log_1(
                        &format!("{} setTimeout scheduled for removing entry: {}", name, id).into(),
                    );
                    let callback = Closure::once_into_js(move || {
                        #[cfg(target_arch = "wasm32")]
                        {
                            web_sys::console::log_1(
                                &format!("{} removing entry after timeout: {}", name, id).into(),
                            );
                        }
                        context.remove_entry.call(id.clone());
                    });
                    let _ = web_sys::window()
                        .unwrap()
                        .set_timeout_with_callback_and_timeout_and_arguments_0(
                            callback.as_ref().unchecked_ref(),
                            200,
                        );
                }
            },
        ));
    }

    (
        internal_animation_state,
        close_callback,
        computed_opacity_scale,
    )
}

#[component]
pub fn PortalRender(entries: Signal<Vec<PortalEntry>>) -> Element {
    let entries = entries.read();

    let portal_classes = ClassesBuilder::new().add(PortalClass::PortalRoot).build();

    rsx! {
        div {
            class: "{portal_classes}",
            style: "position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9999;",

            {
                entries
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
                                children,
                                animation_state,
                            } => rsx! {
                                ModalPortalEntry {
                                    key: "{id}",
                                    z_index,
                                    id: id.clone(),
                                    title: title.clone(),
                                    position: *position,
                                    mask_mode: *mask_mode,
                                    closable: *closable,
                                    mask_closable: *mask_closable,
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
                                    key: "{id}",
                                    z_index,
                                    id: id.clone(),
                                    strategy: *strategy,
                                    mask_mode: *mask_mode,
                                    children: children.clone(),
                                    trigger_rect: *trigger_rect,
                                    close_on_select: *close_on_select,
                                }
                            },
                            PortalEntry::Toast { id, position, children } => rsx! {
                                ToastPortalEntry {
                                    key: "{id}",
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
                                    key: "{id}",
                                    z_index,
                                    id: id.clone(),
                                    trigger_rect: *trigger_rect,
                                    preferred_placements: preferred_placements.clone(),
                                    offset: *offset,
                                    width: width.clone(),
                                    title: title.clone(),
                                    close_on_click_outside: *close_on_click_outside,
                                    close_on_select: *close_on_select,
                                    on_close: *on_close,
                                    close_requested: *close_requested,
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
                                    key: "{id}",
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
            }
        }
    }
}

#[component]
fn ModalPortalEntry(
    z_index: usize,
    id: String,
    title: Option<String>,
    position: ModalPosition,
    mask_mode: MaskMode,
    closable: bool,
    mask_closable: bool,
    children: Element,
    animation_state: ModalAnimationState,
) -> Element {
    let _internal_animation_state = use_signal(|| animation_state);
    let (_, button_close, computed_opacity_scale) =
        use_animated_portal_entry(id.clone(), animation_state, "Modal");

    let overlay_classes = if mask_mode == MaskMode::Transparent {
        ClassesBuilder::new()
            .add(ModalClass::Overlay)
            .add(ModalClass::OverlayTransparent)
            .build()
    } else {
        ClassesBuilder::new().add(ModalClass::Overlay).build()
    };

    let modal_classes = ClassesBuilder::new().add(ModalClass::Modal).build();

    let modal_style = use_memo(move || {
        let (opacity, scale) = computed_opacity_scale.read().clone();
        let style = format!(
            "opacity: {}; transform: scale({}); transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;",
            opacity, scale
        );
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::console::log_1(&format!("Modal style computed: {}", style).into());
        }
        style
    });

    let header_classes = ClassesBuilder::new().add(ModalClass::Header).build();

    let title_classes = ClassesBuilder::new().add(ModalClass::Title).build();

    let close_classes = ClassesBuilder::new().add(ModalClass::Close).build();

    let body_classes = ClassesBuilder::new().add(ModalClass::Body).build();

    rsx! {
        div {
            class: "{overlay_classes}",
            style: "position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: auto; display: flex; align-items: center; justify-content: center; z-index: {z_index};",
            onclick: move |e: MouseEvent| {
                if mask_closable && mask_mode == MaskMode::Opaque {
                    e.stop_propagation();
                    button_close.call(e);
                }
            },

            div {
                class: "{modal_classes}",
                style: "{modal_style.read()}",
                onclick: |e: MouseEvent| {
                    e.stop_propagation();
                },

                div { class: "{header_classes}",
                    if let Some(title_val) = title {
                        h3 { class: "{title_classes}", "{title_val}" }
                    }

                    if closable {
                        button { class: "{close_classes}", onclick: button_close,
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
                }

                div { class: "{body_classes}", {children} }
            }
        }
    }
}

#[component]
fn DropdownPortalEntry(
    z_index: usize,
    id: String,
    strategy: PortalPositionStrategy,
    mask_mode: PortalMaskMode,
    children: Element,
    trigger_rect: Option<(f64, f64, f64, f64)>,
    close_on_select: bool,
) -> Element {
    let _internal_animation_state = use_signal(|| ModalAnimationState::Appearing);
    let (_, close_dropdown, computed_opacity_scale) =
        use_animated_portal_entry(id.clone(), ModalAnimationState::Appearing, "Dropdown");

    let viewport_width = use_signal(|| {
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::window()
                .and_then(|w| w.inner_width().ok())
                .and_then(|v| v.as_f64())
                .unwrap_or(1920.0)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            1920.0
        }
    });
    let viewport_height = use_signal(|| {
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::window()
                .and_then(|w| w.inner_height().ok())
                .and_then(|v| v.as_f64())
                .unwrap_or(1080.0)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            1080.0
        }
    });

    let element_width = use_signal(|| 200.0);

    let _position_style = use_memo(move || {
        let viewport_w = *viewport_width.read();
        let viewport_h = *viewport_height.read();
        let elem_w = *element_width.read();

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
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::console::log_1(&format!("Dropdown style computed: {}", style).into());
        }
        style
    });

    rsx! {
        div {
            class: "{overlay_classes}",
            style: "{overlay_style}",
            onclick: move |e: MouseEvent| {
                e.stop_propagation();
                close_dropdown.call(e);
            },

            div {
                class: "{dropdown_classes}",
                style: "{content_style.read()}",
                onclick: move |e: MouseEvent| {
                    e.stop_propagation();
                    if close_on_select {
                        #[cfg(target_arch = "wasm32")]
                        {
                            if let Some(web_event) = e.downcast::<web_sys::MouseEvent>() {
                                if let Some(target) = web_event.target() {
                                    if let Some(elem) = target.dyn_ref::<web_sys::Element>() {
                                        let is_menu_item = elem.closest(".hi-menu-item").ok();
                                        if is_menu_item.is_some() {
                                            close_dropdown.call(e);
                                        }
                                    }
                                }
                            }
                        }
                        #[cfg(not(target_arch = "wasm32"))]
                        {
                            close_dropdown.call(e);
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
    z_index: usize,
    id: String,
    position: ToastPosition,
    children: Element,
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
    z_index: usize,
    id: String,
    trigger_rect: Option<(f64, f64, f64, f64)>,
    preferred_placements: Vec<PopoverPlacement>,
    offset: f64,
    width: Option<String>,
    title: Option<String>,
    close_on_click_outside: bool,
    close_on_select: bool,
    on_close: Option<Callback<()>>,
    close_requested: Signal<bool>,
    children: Element,
) -> Element {
    let (mut animation_state, close_popover, computed_opacity_scale) =
        use_animated_portal_entry(id.clone(), ModalAnimationState::Appearing, "Popover");

    {
        let on_close_clone = on_close;
        use_effect(move || {
            if close_requested() {
                let current_state = *animation_state.read();
                if current_state == ModalAnimationState::Visible {
                    animation_state.set(ModalAnimationState::Disappearing);
                    if let Some(handler) = on_close_clone.as_ref() {
                        handler.call(());
                    }
                }
            }
        });
    }

    let viewport_height = use_signal(|| {
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::window()
                .and_then(|w| w.inner_height().ok())
                .and_then(|v| v.as_f64())
                .unwrap_or(1080.0)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            1080.0
        }
    });

    let position_state = use_signal(|| {
        fn check_placement(
            placement: PopoverPlacement,
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
        ) -> Option<(PopoverPlacement, f64, f64)> {
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

        const PADDING: f64 = 16.0;
        const POPOVER_W: f64 = 160.0;
        const POPOVER_H: f64 = 120.0;

        if let Some((tx, ty, tw, th)) = trigger_rect {
            let trigger_center_x = tx + tw / 2.0;

            for placement in &preferred_placements {
                if let Some(result) = check_placement(
                    *placement,
                    tx,
                    ty,
                    tw,
                    th,
                    POPOVER_W,
                    POPOVER_H,
                    web_sys::window()
                        .and_then(|w| w.inner_width().ok())
                        .and_then(|v| v.as_f64())
                        .unwrap_or(1920.0),
                    viewport_height(),
                    offset,
                    PADDING,
                ) {
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
                    && let Some(result) = check_placement(
                        placement,
                        tx,
                        ty,
                        tw,
                        th,
                        POPOVER_W,
                        POPOVER_H,
                        web_sys::window()
                            .and_then(|w| w.inner_width().ok())
                            .and_then(|v| v.as_f64())
                            .unwrap_or(1920.0),
                        viewport_height(),
                        offset,
                        PADDING,
                    )
                {
                    return result;
                }
            }

            (PopoverPlacement::Bottom, trigger_center_x, ty + th + offset)
        } else {
            (PopoverPlacement::Bottom, 0.0, 0.0)
        }
    });

    let (placement, x, y) = position_state();

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
                viewport_height() - y
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

    let handle_close = {
        let on_close = on_close;
        move |e: MouseEvent| {
            close_popover.call(e);
            if let Some(handler) = on_close.as_ref() {
                handler.call(());
            }
        }
    };

    rsx! {
        if close_on_click_outside {
            div {
                class: "hi-popover-backdrop",
                style: "position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: {backdrop_z_index}; background: transparent; pointer-events: auto;",
                onclick: handle_close,
            }
        }

        div {
            class: "{popover_classes}",
            style: "{popover_style}",
            "data-open": "true",

            if let Some(title) = title {
                div { class: "hi-popover-title", "{title}" }
            }

            div {
                class: "hi-popover-content",
                onclick: move |e: MouseEvent| {
                    e.stop_propagation();

                    if close_on_select {
                        #[cfg(target_arch = "wasm32")]
                        {
                            if let Some(web_event) = e.downcast::<web_sys::MouseEvent>() {
                                if let Some(target) = web_event.target() {
                                    if let Some(elem) = target.dyn_ref::<web_sys::Element>() {
                                        let is_menu_item = elem.closest(".hi-menu-item").ok();
                                        if is_menu_item.is_some() {
                                            close_popover.call(e);
                                            if let Some(handler) = on_close.as_ref() {
                                                handler.call(());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        #[cfg(not(target_arch = "wasm32"))]
                        {
                            close_popover.call(e);
                            if let Some(handler) = on_close.as_ref() {
                                handler.call(());
                            }
                        }
                    }
                },
                {children}
            }
        }
    }
}

#[component]
fn TooltipPortalEntry(
    z_index: usize,
    id: String,
    trigger_rect: Option<(f64, f64, f64, f64)>,
    placement: TriggerPlacement,
    content: String,
    arrow: bool,
) -> Element {
    let viewport_width = use_signal(|| {
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::window()
                .and_then(|w| w.inner_width().ok())
                .and_then(|v| v.as_f64())
                .unwrap_or(1920.0)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            1920.0
        }
    });
    let viewport_height = use_signal(|| {
        #[cfg(target_arch = "wasm32")]
        {
            web_sys::window()
                .and_then(|w| w.inner_height().ok())
                .and_then(|v| v.as_f64())
                .unwrap_or(1080.0)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            1080.0
        }
    });

    let tooltip_width = use_signal(|| 120.0);
    let tooltip_height = use_signal(|| 40.0);

    let position_style = use_memo(move || {
        let vw = *viewport_width.read();
        let vh = *viewport_height.read();
        let tw = *tooltip_width.read();
        let th = *tooltip_height.read();

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
            format!("position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);")
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

    rsx! {
        div {
            class: "{tooltip_classes}",
            style: "{position_style.read()} z-index: {z_index}; pointer-events: none;",

            div { class: "{TooltipClass::TooltipContent.as_class()}", "{content}" }

            if arrow {
                div { class: "hi-tooltip-arrow" }
            }
        }
    }
}
