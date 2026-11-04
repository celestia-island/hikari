//! Render + behaviour contracts for the screen-identify family (the Rust half
//! of the canonical Vue `useScreenIdentify` / `HkScreenIdentifyCard` /
//! `HkScreenIdentifyHost` / `HkAmbientLayer` mirrors).
//!
//! The state machine tests drive the dwell on an explicit clock (the module
//! singleton feeds it `platform::now_timestamp()`); the render tests assert the
//! DOM shape the vendored Vue sheets key on; the live-runtime test mounts the
//! real host through tairitsu's runtime to pin the show/dismiss repaint path.
//! The cross-form sheet comparison lives in `vue_mirror_drift_tests.rs`.

use hikari_components::overlay::*;
use hikari_components::prelude::*;

fn render(node: Element) -> String {
    node.render_to_html()
}

fn ambient_style_band() -> String {
    format!("var(--hk-z-hud, {})", AMBIENT_LAYER_DOCUMENT_Z)
}

// ── The dwell / countdown state machine ─────────────────────────────

#[test]
fn default_constants_match_the_vue_family() {
    assert_eq!(SCREEN_IDENTIFY_DEFAULT_MS, 3_000);
    assert_eq!(SCREEN_IDENTIFY_TICK_MS, 100);
}

#[test]
fn state_starts_idle() {
    let state = ScreenIdentifyState::default();
    assert!(!state.active());
    assert_eq!(state.number(), "");
    assert_eq!(state.name(), None);
    assert_eq!(state.remaining_ms(), 0);
    assert_eq!(state.seconds_left(), 0);
    assert!(!state.held_open());
}

#[test]
fn show_uses_the_default_dwell_and_counts_down_whole_seconds() {
    let mut state = ScreenIdentifyState::default();
    state.show(
        &ScreenIdentifyRequest::new("7").with_name("Wall B"),
        1_000.0,
    );
    assert!(state.active());
    assert_eq!(state.number(), "7");
    assert_eq!(state.name(), Some("Wall B"));
    assert_eq!(state.remaining_ms(), SCREEN_IDENTIFY_DEFAULT_MS);
    // Vue's `Math.ceil(remainingMs / 1000)`: 3000 -> 3.
    assert_eq!(state.seconds_left(), 3);

    // A tick only reports the remainder — 100 ms in, the card still reads 3.
    assert!(state.tick(1_100.0));
    assert_eq!(state.seconds_left(), 3);
    assert!(state.tick(2_000.0));
    assert_eq!(state.seconds_left(), 2);
    assert!(state.tick(3_000.0));
    assert_eq!(state.seconds_left(), 1);
    // 1 ms left still reads whole "1s" (never 0 while the card is up).
    assert!(state.tick(3_999.0));
    assert_eq!(state.seconds_left(), 1);
    // The tick that crosses the deadline ends the flash.
    assert!(!state.tick(4_000.0));
    assert!(!state.active());
    assert_eq!(state.remaining_ms(), 0);
    assert_eq!(state.seconds_left(), 0);
}

#[test]
fn show_restarts_an_inflight_flash_instead_of_inheriting_the_deadline() {
    let mut state = ScreenIdentifyState::default();
    state.show(&ScreenIdentifyRequest::new("1"), 0.0);
    state.tick(2_000.0);
    assert_eq!(state.seconds_left(), 1);
    let generation = state.generation();

    // A second identify restarts both the payload and the dwell.
    state.show(&ScreenIdentifyRequest::new("2").with_name("Back"), 2_500.0);
    assert_eq!(state.number(), "2");
    assert_eq!(state.remaining_ms(), SCREEN_IDENTIFY_DEFAULT_MS);
    assert_eq!(state.seconds_left(), 3);
    assert_ne!(state.generation(), generation);
    // The old deadline is gone: the flash lives until the restarted one.
    assert!(state.tick(5_499.0));
    assert_eq!(state.seconds_left(), 1);
    assert!(!state.tick(5_500.0));
    assert!(!state.active());
}

#[test]
fn zero_duration_holds_the_card_open_until_dismissed() {
    let mut state = ScreenIdentifyState::default();
    state.show(&ScreenIdentifyRequest::new("0").with_duration_ms(0), 0.0);
    assert!(state.active());
    assert!(state.held_open());
    assert_eq!(state.remaining_ms(), 0);
    // No countdown badge while held open (Vue: secondsLeft === 0).
    assert_eq!(state.seconds_left(), 0);
    // Ticks do not end a held-open flash, even much later.
    assert!(state.tick(600_000.0));
    assert!(state.active());

    state.dismiss();
    assert!(!state.active());
    assert!(!state.held_open());
    assert_eq!(state.remaining_ms(), 0);
}

#[test]
fn dismiss_hides_immediately_and_is_idempotent() {
    let mut state = ScreenIdentifyState::default();
    state.show(&ScreenIdentifyRequest::new("3").with_name("Desk"), 0.0);
    state.dismiss();
    assert!(!state.active());
    assert_eq!(state.remaining_ms(), 0);
    // Vue's dismiss clears the name; the number is left as the last payload.
    assert_eq!(state.name(), None);
    assert_eq!(state.number(), "3");
    let generation = state.generation();
    state.dismiss();
    assert!(!state.active());
    assert_eq!(state.remaining_ms(), 0);
    assert_ne!(state.generation(), generation);
}

#[test]
fn request_derives_the_effective_dwell() {
    assert_eq!(
        ScreenIdentifyRequest::new("1").effective_duration_ms(),
        SCREEN_IDENTIFY_DEFAULT_MS
    );
    assert_eq!(
        ScreenIdentifyRequest::new("1")
            .with_duration_ms(0)
            .effective_duration_ms(),
        0
    );
    assert_eq!(
        ScreenIdentifyRequest::new("1")
            .with_duration_ms(5_000)
            .effective_duration_ms(),
        5_000
    );
}

// ── Labels and placement ────────────────────────────────────────────

#[test]
fn placement_tokens_are_the_vue_data_values() {
    assert_eq!(
        ScreenIdentifyPlacement::default().data_value(),
        "bottom-left"
    );
    let all = [
        (ScreenIdentifyPlacement::BottomLeft, "bottom-left"),
        (ScreenIdentifyPlacement::BottomRight, "bottom-right"),
        (ScreenIdentifyPlacement::TopLeft, "top-left"),
        (ScreenIdentifyPlacement::TopRight, "top-right"),
    ];
    for (placement, token) in all {
        assert_eq!(placement.data_value(), token);
    }
}

#[test]
fn label_composer_substitutes_the_number_and_name() {
    let plain = "Screen {number}";
    let named = "Screen {number}, {name}";
    assert_eq!(
        screen_identify_label_with("7", None, None, plain, named),
        "Screen 7"
    );
    assert_eq!(
        screen_identify_label_with("7", Some("Wall B"), None, plain, named),
        "Screen 7, Wall B"
    );
    // An empty name falls back to the plain sentence (Vue: `props.name` falsy).
    assert_eq!(
        screen_identify_label_with("7", Some(""), None, plain, named),
        "Screen 7"
    );
    // A non-empty override wins; an empty one falls through.
    assert_eq!(
        screen_identify_label_with("7", Some("Wall B"), Some("Left wall"), plain, named),
        "Left wall"
    );
    assert_eq!(
        screen_identify_label_with("7", None, Some(""), plain, named),
        "Screen 7"
    );
}

#[test]
fn label_composer_reads_the_english_fallback_from_i18n() {
    // No `provide_i18n` in the unit-test process: `t` falls back to its
    // English literal, which must be the same sentence Vue ships.
    assert_eq!(screen_identify_label("7", None, None), "Screen 7");
    assert_eq!(
        screen_identify_label("7", Some("Wall B"), None),
        "Screen 7, Wall B"
    );
}

// ── The card ────────────────────────────────────────────────────────

#[test]
fn card_renders_the_vue_dom_contract() {
    let html = render(ScreenIdentifyCard(ScreenIdentifyCardProps {
        number: "7".to_string(),
        name: Some("Wall B".to_string()),
        seconds_left: 3,
        ..Default::default()
    }));

    for needle in [
        "hk-screen-identify",
        "data-placement=\"bottom-left\"",
        "role=\"status\"",
        "aria-label=\"Screen 7, Wall B\"",
        "hk-screen-identify-num",
        ">7<",
        "hk-screen-identify-name",
        ">Wall B<",
        "hk-screen-identify-count",
        "aria-hidden=\"true\"",
        "hk-countdown-digit",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn card_hides_the_name_and_countdown_when_absent() {
    let html = render(ScreenIdentifyCard(ScreenIdentifyCardProps {
        number: "2".to_string(),
        name: None,
        seconds_left: 0,
        ..Default::default()
    }));
    assert!(html.contains("hk-screen-identify-num"), "{html}");
    assert!(!html.contains("hk-screen-identify-name"), "{html}");
    assert!(!html.contains("hk-screen-identify-count"), "{html}");
    assert!(!html.contains("hk-countdown-digit"), "{html}");
    assert!(html.contains("aria-label=\"Screen 2\""), "{html}");
}

#[test]
fn card_honours_label_override_and_placement() {
    let html = render(ScreenIdentifyCard(ScreenIdentifyCardProps {
        number: "7".to_string(),
        name: Some("Wall B".to_string()),
        seconds_left: 1,
        placement: ScreenIdentifyPlacement::TopRight,
        label: Some("The far right wall".to_string()),
    }));
    assert!(html.contains("aria-label=\"The far right wall\""), "{html}");
    assert!(html.contains("data-placement=\"top-right\""), "{html}");
}

// ── The host decision ───────────────────────────────────────────────

#[test]
fn host_renders_nothing_while_idle() {
    let html = render(screen_identify_host_content(
        &ScreenIdentifyState::default(),
        ScreenIdentifyPlacement::BottomLeft,
        None,
    ));
    assert!(!html.contains("hk-screen-identify"), "{html}");
    assert!(!html.contains("hk-ambient-layer"), "{html}");
}

#[test]
fn host_puts_the_card_on_the_ambient_layer_while_active() {
    let mut state = ScreenIdentifyState::default();
    state.show(&ScreenIdentifyRequest::new("7").with_name("Wall B"), 0.0);
    let html = render(screen_identify_host_content(
        &state,
        ScreenIdentifyPlacement::TopLeft,
        None,
    ));
    for needle in [
        "hk-ambient-layer",
        "hk-screen-identify",
        "data-placement=\"top-left\"",
        "aria-label=\"Screen 7, Wall B\"",
        "hk-screen-identify-count",
        "hk-countdown-digit",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
    // The host still forwards the caller's label override.
    let overridden = render(screen_identify_host_content(
        &state,
        ScreenIdentifyPlacement::TopLeft,
        Some("The far right wall".to_string()),
    ));
    assert!(
        overridden.contains("aria-label=\"The far right wall\""),
        "{overridden}"
    );
}

// ── The module singleton + timer-chain guards ───────────────────────

#[test]
fn show_and_dismiss_drive_the_singleton_state() {
    _reset_screen_identify_for_tests();
    // A held-open request keeps the card up without scheduling a timer chain.
    show_screen_identify(
        ScreenIdentifyRequest::new("7")
            .with_name("Wall B")
            .with_duration_ms(0),
    );
    let state = use_screen_identify().state();
    assert!(state.active());
    assert!(state.held_open());
    assert_eq!(state.number(), "7");
    assert_eq!(state.name(), Some("Wall B"));
    assert!(!screen_identify_should_tick(&state));

    // The module singleton is the same handle every accessor sees.
    let identify = use_screen_identify();
    assert_eq!(identify.state().number(), "7");
    identify.dismiss.call(());
    assert!(!use_screen_identify().state().active());
    _reset_screen_identify_for_tests();
}

#[test]
fn host_renders_the_live_singleton_state_and_goes_away_on_dismiss() {
    _reset_screen_identify_for_tests();

    // Idle: the host paints nothing.
    let idle = render(ScreenIdentifyHost(ScreenIdentifyHostProps::default()));
    assert!(!idle.contains("hk-screen-identify"), "{idle}");

    // A held-open flash: the host paints the card on the ambient layer.
    show_screen_identify(
        ScreenIdentifyRequest::new("7")
            .with_name("Wall B")
            .with_duration_ms(0),
    );
    let active = render(ScreenIdentifyHost(ScreenIdentifyHostProps::default()));
    for needle in [
        "hk-ambient-layer",
        "hk-screen-identify",
        "aria-label=\"Screen 7, Wall B\"",
    ] {
        assert!(active.contains(needle), "missing {needle}: {active}");
    }

    // Restart with a different payload: the host repaints from the singleton.
    show_screen_identify(ScreenIdentifyRequest::new("8").with_duration_ms(0));
    let restarted = render(ScreenIdentifyHost(ScreenIdentifyHostProps::default()));
    assert!(restarted.contains("aria-label=\"Screen 8\""), "{restarted}");

    identify_dismiss_for_test();
    let after = render(ScreenIdentifyHost(ScreenIdentifyHostProps::default()));
    assert!(!after.contains("hk-screen-identify"), "{after}");
    _reset_screen_identify_for_tests();
}

/// The `Callback` path is what app code uses; exercise it directly so the
/// test does not depend on a component event loop.
fn identify_dismiss_for_test() {
    let identify = use_screen_identify();
    identify.dismiss.call(());
}

#[test]
fn only_timed_flashes_need_a_tick_chain() {
    let mut state = ScreenIdentifyState::default();
    assert!(!screen_identify_should_tick(&state));

    state.show(&ScreenIdentifyRequest::new("1"), 0.0);
    assert!(screen_identify_should_tick(&state));

    state.show(&ScreenIdentifyRequest::new("1").with_duration_ms(0), 0.0);
    assert!(!screen_identify_should_tick(&state));
}

#[test]
fn a_superseded_chain_step_bows_out_instead_of_ticking_the_new_flash() {
    let mut state = ScreenIdentifyState::default();
    state.show(&ScreenIdentifyRequest::new("1"), 0.0);
    let first_generation = state.generation();

    // Restart: the old generation must no longer advance the state.
    state.show(&ScreenIdentifyRequest::new("2"), 0.0);
    let restarted_generation = state.generation();
    assert_ne!(first_generation, restarted_generation);
    assert!(!screen_identify_chain_step(
        &mut state,
        first_generation,
        10.0
    ));
    assert_eq!(state.number(), "2");
    assert_eq!(state.remaining_ms(), SCREEN_IDENTIFY_DEFAULT_MS);
    assert!(screen_identify_chain_step(
        &mut state,
        restarted_generation,
        10.0
    ));

    // Dismiss also retires the chain.
    state.dismiss();
    assert!(!screen_identify_chain_step(
        &mut state,
        restarted_generation,
        20.0
    ));
}

#[test]
fn chain_step_crosses_the_deadline_and_ceils_fractional_remainders() {
    let mut state = ScreenIdentifyState::default();
    state.show(
        &ScreenIdentifyRequest::new("1").with_duration_ms(1_000),
        0.0,
    );
    let generation = state.generation();

    // A fractional last millisecond still prints whole "1s" (Vue's ceil); a
    // truncating implementation would report 0 and unmount the badge early.
    assert!(screen_identify_chain_step(&mut state, generation, 999.5));
    assert_eq!(state.remaining_ms(), 1);
    assert_eq!(state.seconds_left(), 1);

    // The step that reaches the deadline ends the flash.
    assert!(!screen_identify_chain_step(&mut state, generation, 1_000.0));
    assert!(!state.active());
    assert_eq!(state.remaining_ms(), 0);
}

// ── The live runtime repaint path ───────────────────────────────────

/// Mount the real host through tairitsu's runtime and assert the state is
/// REPUBLISHED: `Signal::write()` alone does not dirty a component in 0.5.26,
/// so a flash would change invisibly if `set()` were missing (R3's S1).
#[test]
fn a_mounted_host_repaints_on_show_and_dismiss() {
    use tairitsu_vdom::runtime;

    _reset_screen_identify_for_tests();
    let id = runtime::use_component(|| ScreenIdentifyHost(ScreenIdentifyHostProps::default()));

    runtime::mark_dirty(id);
    runtime::flush_render();
    let html = |id| {
        runtime::get_current_vnode(id)
            .expect("host should have rendered")
            .render_to_html()
    };
    assert!(!html(id).contains("hk-screen-identify"), "{}", html(id));

    show_screen_identify(
        ScreenIdentifyRequest::new("7")
            .with_name("Wall B")
            .with_duration_ms(0),
    );
    runtime::flush_render();
    let painted = html(id);
    for needle in [
        "hk-ambient-layer",
        "hk-screen-identify",
        "aria-label=\"Screen 7, Wall B\"",
    ] {
        assert!(painted.contains(needle), "missing {needle}: {painted}");
    }

    dismiss_screen_identify();
    runtime::flush_render();
    assert!(!html(id).contains("hk-screen-identify"), "{}", html(id));

    _reset_screen_identify_for_tests();
}

// ── The ambient HUD layer ───────────────────────────────────────────

#[test]
fn ambient_layer_style_rides_the_hud_band() {
    // Default seat = the band floor (Vue: local z-index 1 inside the HUD root).
    assert_eq!(
        ambient_layer_style(1),
        format!("z-index:calc({} + 0)", ambient_style_band())
    );
    // Larger numbers stack nearer the user without leaving the band.
    assert_eq!(
        ambient_layer_style(3),
        format!("z-index:calc({} + 2)", ambient_style_band())
    );
    // Vue's default is 1; a non-positive order clamps to the same floor.
    assert_eq!(ambient_layer_style(0), ambient_layer_style(1));
    assert_eq!(ambient_layer_style(-4), ambient_layer_style(1));
}

#[test]
fn ambient_layer_renders_the_ghost_wrapper() {
    let html = render(AmbientLayer(AmbientLayerProps {
        pointer_events: AmbientLayerPointerEvents::None,
        z_index: 1,
        label: None,
        children: VNode::Text(VText::new("annotation")),
    }));
    for needle in [
        "hk-ambient-layer",
        "data-pointer-events=\"none\"",
        "z-index:calc(var(--hk-z-hud, 90050) + 0)",
        "annotation",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
    assert!(!html.contains("role=\"region\""), "{html}");
    assert!(!html.contains("aria-label"), "{html}");
}

#[test]
fn ambient_layer_opt_in_and_landmark() {
    let html = render(AmbientLayer(AmbientLayerProps {
        pointer_events: AmbientLayerPointerEvents::Auto,
        z_index: 2,
        label: Some("Recording".to_string()),
        children: VNode::Text(VText::new("dot")),
    }));
    for needle in [
        "data-pointer-events=\"auto\"",
        "role=\"region\"",
        "aria-label=\"Recording\"",
        "z-index:calc(var(--hk-z-hud, 90050) + 1)",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn ambient_layer_empty_label_drops_the_role_but_keeps_the_empty_aria_label() {
    // Vue binds `aria-label={props.label}` unconditionally: an empty label
    // emits `aria-label=""` and no role. Match the DOM exactly.
    let html = render(AmbientLayer(AmbientLayerProps {
        pointer_events: AmbientLayerPointerEvents::None,
        z_index: 1,
        label: Some(String::new()),
        children: VNode::Text(VText::new("dot")),
    }));
    assert!(!html.contains("role=\"region\""), "{html}");
    assert!(html.contains("aria-label=\"\""), "{html}");
}

// ── Style-registry membership ───────────────────────────────────────

#[test]
fn registry_ships_both_vendored_sheets() {
    let mut registry = StyleRegistry::default();
    registry.register_all();
    let bundle = registry.css_bundle();
    for needle in [".hk-ambient-layer", ".hk-screen-identify"] {
        assert!(
            bundle.contains(needle),
            "registry bundle is missing {needle}"
        );
    }
    // The component tables are the vendored Vue copies, not empty stubs.
    assert!(!AmbientLayerComponent::styles().is_empty());
    assert!(!ScreenIdentifyCardComponent::styles().is_empty());
    // The host composes existing surfaces and ships no sheet of its own.
    assert!(ScreenIdentifyHostComponent::styles().is_empty());
}
