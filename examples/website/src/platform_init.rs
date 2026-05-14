use hikari_components::platform::init;

pub fn register(platform: &tairitsu_web::WitPlatform) {
    #[cfg(target_family = "wasm")]
    register_wasm(platform);

    #[cfg(not(target_family = "wasm"))]
    let _ = platform;
}

#[cfg(target_family = "wasm")]
fn register_wasm(platform: &tairitsu_web::WitPlatform) {
    use hikari_components::platform::{HikariPlatform, ContentEditableState};
    use tairitsu_vdom::platform::{
        CanvasOps, ClipboardOps, ContentEditableOps, DomOps, LayoutOps, MediaOps, ObserverOps,
        QueryOps, ScrollOps, TimerOps,
    };
    use tairitsu_web::WitElement;

    let hp = HikariPlatform {
        inner_width: Box::new(|| platform.inner_width()),
        inner_height: Box::new(|| platform.inner_height()),
        set_timeout: Box::new(|cb, ms| platform.set_timeout(cb, ms)),
        get_scroll_y: Box::new(|| platform.get_scroll_y()),
        scroll_to: Box::new(|top, behavior| platform.scroll_to(top, behavior)),
        on_resize: Box::new(|cb| platform.on_resize(cb)),
        on_scroll: Box::new(|cb| platform.on_scroll(cb)),
        prefers_dark_mode: Box::new(|| platform.prefers_dark_mode()),
        request_animation_frame: Box::new(|cb| platform.request_animation_frame(cb)),
        request_animation_frame_with_timestamp: Box::new(|cb| {
            platform.request_animation_frame(cb) as i32
        }),
        copy_to_clipboard: Box::new(|text| platform.copy_to_clipboard(text)),
        element_from_point: Box::new(|x, y| {
            platform.element_from_point(x, y).map(|e| e.as_raw())
        }),
        get_target_element_from_event: Box::new(|cx, cy| {
            platform.get_target_element_from_event(cx, cy).map(|e| e.as_raw())
        }),
        element_closest: Box::new(|handle, selector| {
            platform
                .element_closest(&WitElement::from_raw(handle), selector)
                .map(|e| e.as_raw())
        }),
        get_bounding_client_rect: Box::new(|handle| {
            Some(platform.get_bounding_client_rect(&WitElement::from_raw(handle)))
        }),
        get_scroll_top_from_point: Box::new(|x, y| platform.get_scroll_top_from_point(x, y)),
        query_selector: Box::new(|sel| platform.query_selector(sel).map(|e| e.as_raw())),
        query_selector_all: Box::new(|sel| {
            platform
                .query_selector_all(sel)
                .into_iter()
                .map(|e| e.as_raw())
                .collect()
        }),
        get_element_by_id: Box::new(|id| platform.get_element_by_id(id).map(|e| e.as_raw())),
        get_element_rect_by_id: Box::new(|id| platform.get_element_rect_by_id(id)),
        get_scroll_top_by_selector: Box::new(|sel| platform.get_scroll_top_by_selector(sel)),
        get_bounding_rect_by_class: Box::new(|class, handle| {
            platform.get_bounding_rect_by_class(class, &WitElement::from_raw(handle))
        }),
        create_resize_observer: Box::new(|cb| {
            let mut cb = cb;
            platform.create_resize_observer(Box::new(move |_entries| {
                cb();
            }))
        }),
        observe_resize: Box::new(|_observer, _element| {}),
        disconnect_resize: Box::new(|observer| platform.disconnect_resize(observer)),
        create_mutation_observer: Box::new(|cb| {
            let mut cb = cb;
            platform.create_mutation_observer(Box::new(move |_records| {
                cb();
            }))
        }),
        observe_mutations_element: Box::new(|_observer, _element, _cl, _attr, _cd, _subtree| {}),
        disconnect_mutation: Box::new(|observer| platform.disconnect_mutation(observer)),
        draw_qrcode_on_canvas: Box::new(|canvas_id, matrix, modules, color, bg| {
            platform.draw_qrcode_on_canvas_by_id(canvas_id, matrix, modules as u64, color, bg)
        }),
        get_contenteditable_state: Box::new(|handle| {
            platform
                .get_contenteditable_state(&WitElement::from_raw(handle))
                .map(|s| ContentEditableState {
                    editable: s.editable,
                    focused: s.focused,
                })
        }),
        set_content_editable: Box::new(|handle, editable| {
            platform.set_content_editable(&WitElement::from_raw(handle), editable)
        }),
        exec_command: Box::new(|cmd, val| platform.exec_command(cmd, val)),
        get_selection_start: Box::new(|handle| {
            platform.get_selection_start(&WitElement::from_raw(handle))
        }),
        get_selection_end: Box::new(|handle| {
            platform.get_selection_end(&WitElement::from_raw(handle))
        }),
        get_inner_html: Box::new(|handle| platform.get_inner_html(&WitElement::from_raw(handle))),
        set_inner_html: Box::new(|handle, html| {
            platform.set_inner_html(&WitElement::from_raw(handle), html)
        }),
        request_fullscreen: Box::new(|handle| {
            platform.request_fullscreen(&WitElement::from_raw(handle))
        }),
        get_element_scroll_top: Box::new(|handle| {
            platform.get_element_scroll_top(&WitElement::from_raw(handle))
        }),
        set_element_scroll_top: Box::new(|handle, value| {
            platform.set_element_scroll_top(&WitElement::from_raw(handle), value)
        }),
        video_play: Box::new(|handle| platform.video_play(&WitElement::from_raw(handle))),
        video_pause: Box::new(|handle| platform.video_pause(&WitElement::from_raw(handle))),
        video_get_current_time: Box::new(|handle| {
            platform.video_get_current_time(&WitElement::from_raw(handle))
        }),
        video_get_duration: Box::new(|handle| {
            platform.video_get_duration(&WitElement::from_raw(handle))
        }),
        video_seek: Box::new(|handle, time| {
            platform.video_seek(&WitElement::from_raw(handle), time)
        }),
        video_set_muted: Box::new(|handle, muted| {
            platform.video_set_muted(&WitElement::from_raw(handle), muted)
        }),
        video_set_volume: Box::new(|handle, volume| {
            platform.video_set_volume(&WitElement::from_raw(handle), volume)
        }),
        create_audio_context: Box::new(|| platform.create_audio_context()),
        create_analyser_node: Box::new(|ctx| platform.create_analyser_node(ctx)),
        create_media_element_source: Box::new(|ctx, el| {
            platform.create_media_element_source(ctx, el)
        }),
        analyser_get_frequency_data: Box::new(|analyser| {
            platform.analyser_node_get_frequency_data(analyser)
        }),
        analyser_get_time_domain_data: Box::new(|analyser| {
            platform.analyser_node_get_time_domain_data(analyser)
        }),
    };
    init(hp);
}
