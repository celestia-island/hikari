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
        countdown_key: String::new(),
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

// ── The timer wiring (capture seam) ─────────────────────────────────

/// The chain WIRING is a contract, not an implementation detail: a timed
/// flash schedules exactly one chain, a held-open flash schedules none, and
/// an active step re-arms while a finished one does not. R7 recorded these
/// as unobservable because the non-wasm `set_timeout` is a no-op; the
/// capture seam makes them testable.
#[test]
fn the_timer_wiring_schedules_exactly_the_right_chains() {
    _reset_screen_identify_for_tests();
    screen_identify_capture_timers(true);

    // Held-open: the call site must not schedule anything.
    show_screen_identify(ScreenIdentifyRequest::new("0").with_duration_ms(0));
    assert!(
        screen_identify_take_captured_chains().is_empty(),
        "a held-open flash must not schedule a chain"
    );

    // Timed flash: exactly one chain.
    show_screen_identify(ScreenIdentifyRequest::new("7"));
    let generation = use_screen_identify().state().generation();
    let mut chains = screen_identify_take_captured_chains();
    assert_eq!(chains.len(), 1, "a timed flash schedules exactly one chain");

    // Running the scheduled step while active re-arms exactly one more
    // (the reschedule wiring). The frozen stub clock keeps the remainder
    // constant here — the dwell ADVANCE itself is pinned by the
    // explicit-clock tests below.
    let step = chains.remove(0);
    step();
    let mut rearmed = screen_identify_take_captured_chains();
    assert_eq!(rearmed.len(), 1, "an active step re-arms exactly one chain");
    assert_eq!(use_screen_identify().state().seconds_left(), 3);

    // A superseded chain neither advances nor re-arms.
    show_screen_identify(ScreenIdentifyRequest::new("2"));
    let restarted = use_screen_identify().state().generation();
    assert_ne!(generation, restarted);
    screen_identify_take_captured_chains();
    // `rearmed` is the generation-7 chain's re-arm: after the restart it is
    // exactly the stale wake a real timer would still fire.
    let stale = rearmed.remove(0);
    stale();
    assert!(screen_identify_take_captured_chains().is_empty());
    assert_eq!(use_screen_identify().state().number(), "2");

    // Dismissal retires the scheduled chain: its next wake observes the new
    // generation and neither advances nor re-arms (the stub clock is frozen,
    // so the deadline arm is covered by the explicit-clock tests above).
    show_screen_identify(ScreenIdentifyRequest::new("3"));
    let mut scheduled = screen_identify_take_captured_chains();
    assert_eq!(scheduled.len(), 1);
    dismiss_screen_identify();
    let step = scheduled.remove(0);
    step();
    assert!(screen_identify_take_captured_chains().is_empty());
    assert!(!use_screen_identify().state().active());

    screen_identify_capture_timers(false);
    _reset_screen_identify_for_tests();
}

// ── The live runtime repaint path ───────────────────────────────────

/// Mount the real host through tairitsu's runtime and assert the state is
/// REPUBLISHED: `Signal::write()` alone does not dirty a component in 0.5.26,
/// so a flash would change invisibly if `set()` were missing (R3's S1).
#[test]
fn a_mounted_host_repaints_on_show_countdown_and_dismiss() {
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

    // The default dwell is used, so the painted card carries the countdown.
    show_screen_identify(ScreenIdentifyRequest::new("7").with_name("Wall B"));
    let generation = use_screen_identify().state().generation();
    runtime::flush_render();
    let painted = html(id);
    for needle in [
        "hk-ambient-layer",
        "hk-screen-identify",
        "aria-label=\"Screen 7, Wall B\"",
        "hk-screen-identify-count",
        "hk-countdown-digit",
    ] {
        assert!(painted.contains(needle), "missing {needle}: {painted}");
    }
    // The host adds no second landmark: the card carries the status role.
    assert!(!painted.contains("role=\"region\""), "{painted}");

    // The timer body is drivable on an explicit clock: one second in the host
    // must repaint the countdown (3s -> 2s), and the deadline step must remove
    // the card from the DOM.
    assert!(screen_identify_tick_step(generation, 1_000.0));
    runtime::flush_render();
    let counted = html(id);
    assert!(counted.contains("hk-countdown-digit"), "{counted}");
    assert!(
        counted.contains(">2<"),
        "countdown should read 2s: {counted}"
    );
    assert!(!screen_identify_tick_step(
        generation,
        SCREEN_IDENTIFY_DEFAULT_MS as f64
    ));
    runtime::flush_render();
    assert!(!html(id).contains("hk-screen-identify"), "{}", html(id));

    dismiss_screen_identify();
    runtime::flush_render();
    assert!(!html(id).contains("hk-screen-identify"), "{}", html(id));

    _reset_screen_identify_for_tests();
}

#[test]
fn a_held_open_flash_is_removed_by_dismiss() {
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

    // Held open: only dismiss can remove the card, so this is the strongest
    // observation of the dismiss repaint path (the delayed path above ends
    // the flash on the tick step before dismiss is reached).
    show_screen_identify(
        ScreenIdentifyRequest::new("9")
            .with_name("Back")
            .with_duration_ms(0),
    );
    runtime::flush_render();
    assert!(html(id).contains("hk-screen-identify"), "{}", html(id));

    dismiss_screen_identify();
    runtime::flush_render();
    assert!(!html(id).contains("hk-screen-identify"), "{}", html(id));

    _reset_screen_identify_for_tests();
}

#[test]
fn a_superseded_generation_never_ticks_or_repaints_the_new_flash() {
    use std::cell::Cell;
    use std::rc::Rc;

    use tairitsu_vdom::runtime;

    _reset_screen_identify_for_tests();

    // Count host renders so the "returns immediately WITHOUT repainting" claim
    // is pinned, not just the state outcome (removing the pre-check would
    // otherwise survive on the inner chain-step guard).
    let renders = Rc::new(Cell::new(0u32));
    let renders_for_component = Rc::clone(&renders);
    let id = runtime::use_component(move || {
        renders_for_component.set(renders_for_component.get() + 1);
        ScreenIdentifyHost(ScreenIdentifyHostProps::default())
    });
    // Render once so the host's `get()` subscribes it before any state write.
    runtime::mark_dirty(id);
    runtime::flush_render();
    assert!(renders.get() >= 1, "the host should have rendered once");

    show_screen_identify(ScreenIdentifyRequest::new("1"));
    let first_generation = use_screen_identify().state().generation();
    show_screen_identify(ScreenIdentifyRequest::new("2"));
    let restarted_generation = use_screen_identify().state().generation();
    assert_ne!(first_generation, restarted_generation);
    runtime::flush_render();
    let after_restart = renders.get();

    // A late timer from the first flash must neither advance nor repaint the
    // second one.
    assert!(!screen_identify_tick_step(first_generation, 2_000.0));
    runtime::flush_render();
    assert_eq!(
        renders.get(),
        after_restart,
        "a superseded generation must not repaint the host"
    );
    let state = use_screen_identify().state();
    assert_eq!(state.number(), "2");
    assert_eq!(state.remaining_ms(), SCREEN_IDENTIFY_DEFAULT_MS);
    assert_eq!(state.seconds_left(), 3);

    // The owning generation does advance and repaint.
    assert!(screen_identify_tick_step(restarted_generation, 2_000.0));
    runtime::flush_render();
    assert!(
        renders.get() > after_restart,
        "the owning step must repaint"
    );
    let advanced = use_screen_identify().state();
    assert_eq!(advanced.seconds_left(), 1);
    _reset_screen_identify_for_tests();
}

// ── Per-flash flip registry keying ──────────────────────────────────

/// The digit rendered inside a flip span of the serialized host HTML
/// (`render_to_html` emits `<span class="hk-flip-out" style="…">3</span>`).
fn flip_digit(html: &str, class: &str) -> String {
    let marker = format!("class=\"{class}\"");
    let start = html
        .find(&marker)
        .unwrap_or_else(|| panic!("{class} span not found in: {html}"));
    let text_start = start + html[start..].find('>').expect("span opening tag") + 1;
    let text = &html[text_start..];
    let digits: String = text.chars().take_while(|c| c.is_ascii_digit()).collect();
    assert!(!digits.is_empty(), "{class} carries no digit: {html}");
    digits
}

/// The host keys the shared `CountdownDigit` flip registry PER FLASH
/// (number + generation). Three renders through the pure host-content
/// function pin both halves of that contract:
///   * within one flash, a seconds-changing tick must FLIP (out = previous,
///     in = new) — a key that churned per tick would rest instead (R3 M1);
///   * a dismiss + re-show of the same number must start from a RESTING
///     pair — a number-only key would keep the old slot and flip 2->3
///     (R3 M2). Vue gets both for free by remounting its digit.
#[test]
fn the_host_keys_the_flip_registry_per_flash() {
    let mut state = ScreenIdentifyState::default();
    let render_host = |state: &ScreenIdentifyState| {
        render(screen_identify_host_content(
            state,
            ScreenIdentifyPlacement::BottomLeft,
            None,
        ))
    };

    // First paint of the flash: a resting 3/3 pair.
    state.show(&ScreenIdentifyRequest::new("7"), 0.0);
    let first = render_host(&state);
    assert_eq!(flip_digit(&first, "hk-flip-out"), "3", "{first}");
    assert_eq!(flip_digit(&first, "hk-flip-in"), "3", "{first}");

    // Same flash, one tick: the slot is REUSED, so the outgoing value is
    // the previous "3" — continuity only holds while the key is stable.
    state.tick(1_000.0);
    let second = render_host(&state);
    assert_eq!(flip_digit(&second, "hk-flip-out"), "3", "{second}");
    assert_eq!(flip_digit(&second, "hk-flip-in"), "2", "{second}");

    // Dismiss + re-show the same number: generation bumped, NEW slot, and
    // the pair rests again even though the registry still holds "2" under
    // the old key.
    state.dismiss();
    state.show(&ScreenIdentifyRequest::new("7"), 0.0);
    let third = render_host(&state);
    assert_eq!(flip_digit(&third, "hk-flip-out"), "3", "{third}");
    assert_eq!(flip_digit(&third, "hk-flip-in"), "3", "{third}");
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

// ── Static bundle + cross-form band pins ─────────────────────────────

#[test]
fn the_static_bundle_imports_the_family_sheets() {
    let index = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/styles/index.scss"
    ))
    .expect("styles/index.scss should exist");
    for sheet in ["HkAmbientLayer.scss", "HkScreenIdentifyCard.scss"] {
        assert!(
            index.contains(&format!("./vue-mirror/components/{sheet}")),
            "styles/index.scss is missing the {sheet} import"
        );
    }
}

#[test]
fn the_rust_band_matches_the_vue_hud_root() {
    // The upstream file only exists in a repo checkout (a crates.io sdist
    // carries the mirrors but not packages/vue) — skip there, like the drift
    // test does.
    let hud_root = concat!(env!("CARGO_MANIFEST_DIR"), "/../vue/src/overlay/hudRoot.ts");
    let Ok(source) = std::fs::read_to_string(hud_root) else {
        return;
    };
    let line = source
        .lines()
        .find(|line| line.contains("HUD_ROOT_DOCUMENT_Z"))
        .expect("hudRoot.ts should declare HUD_ROOT_DOCUMENT_Z");
    assert!(
        line.contains(&AMBIENT_LAYER_DOCUMENT_Z.to_string()),
        "the Rust ambient band ({}) must match the Vue HUD root: {line}",
        AMBIENT_LAYER_DOCUMENT_Z
    );
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
    // The host composes existing surfaces and ships no sheet of its own (it
    // is registered like the crate's other empty-sheet members).
    assert!(ScreenIdentifyHostComponent::styles().is_empty());
}
