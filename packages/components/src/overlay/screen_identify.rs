// overlay/screen_identify.rs
// ScreenIdentify — mirrors of the canonical Vue screen-identify family:
//
//   * `useScreenIdentify` / `showScreenIdentify` / `dismissScreenIdentify`
//     (`packages/vue/src/runtime/useScreenIdentify.ts`) — the state half: the
//     per-window payload, the dwell and the ticked countdown;
//   * `HkScreenIdentifyCard` (`packages/vue/src/components/HkScreenIdentifyCard.tsx`)
//     — the large numbered "which screen is this?" card;
//   * `HkScreenIdentifyHost` (`packages/vue/src/components/HkScreenIdentifyHost.tsx`)
//     — the glue that renders the card on the ambient HUD layer.
//
// "Which screen is this?" is a first-class hikari surface: one window (or one
// physical screen) flashes a large numbered card in a corner when the user
// asks the app to identify the display it belongs to. THE APP OWNS DISCOVERY
// — how screens find each other, how numbers are assigned, how one screen asks
// another to flash (BroadcastChannel, Tauri windows, WebSocket). HIKARI OWNS
// the dwell (auto-dismiss + countdown), the layer (the card rides
// `AmbientLayer` on the ambient-HUD band) and the view grammar.
//
// The card's stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkScreenIdentifyCard.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the class names and
// the `data-placement` branches are literal and identical in both forms.
//
// DOM contract for the card (mirrors Vue one-to-one):
//
//   div.hk-screen-identify
//       data-placement="bottom-left|bottom-right|top-left|top-right"
//       role="status" aria-label={composed accessible name}
//     span.hk-screen-identify-num   {number}
//     span.hk-screen-identify-name  {name}             (only with a name)
//     span.hk-screen-identify-count [aria-hidden=true] (only while seconds > 0)
//       span.hk-countdown-digit …                         (the shared rolling digit)
//
// What is mirrored, and the Rust-side deltas (documented, not accidental):
//   * STATE HOME — Vue keeps the context in a module singleton so any module
//     can call `showScreenIdentify`. The Rust form mirrors that exactly: one
//     `thread_local!` signal per thread/page (one page = one window), so
//     [`show_screen_identify`] / [`dismiss_screen_identify`] work from
//     anywhere while a component is mounted. This is also the only correct
//     home in tairitsu 0.5.26 — `use_signal` allocates a fresh signal on every
//     render (no hook slot), so render-scoped state would reset the flash the
//     moment it re-rendered. [`ScreenIdentifyState`] stays a pure value
//     (show / tick / dismiss) so the dwell and countdown are testable without
//     a browser and a host may drive it from its own clock.
//   * TIMERS — Vue schedules `setTimeout` + `setInterval`. Tairitsu has no
//     component-scoped timer hook, so `show_screen_identify` schedules one
//     `platform::set_timeout` chain (tick every 100 ms) and guards it with a
//     generation counter: a restart or a dismiss bumps the generation, the
//     in-flight chain observes the mismatch and stops. Ticks only REPORT the
//     remainder and the tick that crosses the deadline ends the flash — the
//     Vue round-2 bug (a tick clearing the dwell timeout and leaving the flash
//     active forever) and the round-2 S3 (a tick painting a zero remainder
//     one frame early) both stay fixed in the Rust form. A held-open flash
//     (`duration_ms: Some(0)`) schedules NO chain, exactly like Vue.
//   * LABELS — Vue composes the accessible name from `t("hikari::screenIdentify.label")`
//     / `labelNamed`; the Rust form reads the same sentences from
//     `hikari-i18n` (`components.hk.screenIdentify.label` / `labelNamed`) and
//     substitutes `{number}` / `{name}` itself. A non-empty `label` prop wins,
//     exactly like Vue (`if (props.label) return props.label`).
//   * NO runtime registry — Vue registers the context with `readHkRuntime`;
//     the Rust crate has no such registry. [`use_screen_identify`] IS the
//     accessor (and always succeeds, like Vue's module-singleton accessor).

use super::ambient_layer::{AmbientLayer, AmbientLayerPointerEvents, AmbientLayerProps};
use crate::display::CountdownDigit;
use crate::prelude::*;
use crate::styled::StyledComponent;

/// Default dwell — long enough to walk along a wall of screens, short enough
/// that a stray click does not leave a number hanging (Vue: 3_000 ms).
pub const SCREEN_IDENTIFY_DEFAULT_MS: u64 = 3_000;

/// Countdown tick (Vue: 100 ms — the visible card prints whole seconds).
pub const SCREEN_IDENTIFY_TICK_MS: u32 = 100;

/// One identify request (Vue: `ScreenIdentifyRequest`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ScreenIdentifyRequest {
    /// The fleet-wide screen number the app assigned (1-based by convention),
    /// or any short label the card should print. Vue accepts `number | string`;
    /// Rust callers pass the formatted text.
    pub number: String,

    /// Stable screen name printed under the number (Tauri window label, short
    /// id, user title).
    pub name: Option<String>,

    /// Dwell in ms. `None` uses [`SCREEN_IDENTIFY_DEFAULT_MS`]; `Some(0)` keeps
    /// the card up until [`ScreenIdentifyContext::dismiss`] is called (Vue:
    /// `durationMs <= 0`). The card prints WHOLE SECONDS through the shared
    /// single-digit countdown surface, so dwells above 9 s render a clipped
    /// tens digit — identify is a glance; keep it in single digits.
    pub duration_ms: Option<u64>,
}

impl ScreenIdentifyRequest {
    /// A request for `number` with the default dwell and no name.
    pub fn new(number: impl Into<String>) -> Self {
        Self {
            number: number.into(),
            ..Self::default()
        }
    }

    /// Attach the stable screen name line.
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    /// Override the dwell; `0` holds the card open until dismissed.
    pub fn with_duration_ms(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    /// The effective dwell (Vue: `request.durationMs ?? SCREEN_IDENTIFY_DEFAULT_MS`).
    pub fn effective_duration_ms(&self) -> u64 {
        self.duration_ms.unwrap_or(SCREEN_IDENTIFY_DEFAULT_MS)
    }
}

/// The screen-identify state machine (Vue: the four `ref`s + `endsAt`), as a
/// plain value so it can be unit-tested and driven by any clock.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ScreenIdentifyState {
    active: bool,
    number: String,
    name: Option<String>,
    remaining_ms: u64,
    /// Dwell deadline on the caller's clock (ms); `0.0` when idle/held open.
    deadline_ms: f64,
    held_open: bool,
    /// Bumped on every show/dismiss so an older timer chain can bow out.
    generation: u32,
}

impl ScreenIdentifyState {
    /// Whether a card is up.
    pub fn active(&self) -> bool {
        self.active
    }

    /// The number the card prints (the last payload; `dismiss` keeps it).
    pub fn number(&self) -> &str {
        &self.number
    }

    /// The optional name line.
    pub fn name(&self) -> Option<&str> {
        self.name.as_deref()
    }

    /// Milliseconds left on the dwell (0 when idle or held open).
    pub fn remaining_ms(&self) -> u64 {
        self.remaining_ms
    }

    /// Whole seconds left, clamped to ≥1 while active (the card's rolling
    /// digit); 0 while idle or held open — the countdown badge then unmounts,
    /// exactly like Vue's `secondsLeft` computed.
    pub fn seconds_left(&self) -> u32 {
        if self.active && self.remaining_ms > 0 {
            ((self.remaining_ms.div_ceil(1000)) as u32).max(1)
        } else {
            0
        }
    }

    /// Whether the flash is held open by the caller (`duration_ms <= 0`).
    pub fn held_open(&self) -> bool {
        self.held_open
    }

    /// The restart guard's token (see [`schedule_screen_identify_tick`]).
    pub fn generation(&self) -> u32 {
        self.generation
    }

    /// Start (or restart) the flash. Restarts an in-flight flash — a second
    /// identify must not inherit the old deadline.
    pub fn show(&mut self, request: &ScreenIdentifyRequest, now_ms: f64) {
        self.active = true;
        self.number = request.number.clone();
        self.name = request.name.clone();
        self.held_open = false;
        self.deadline_ms = 0.0;
        self.remaining_ms = 0;
        self.generation = self.generation.wrapping_add(1);

        let duration = request.effective_duration_ms();
        if duration == 0 {
            // Held open by the caller: no dwell, no countdown.
            self.held_open = true;
            return;
        }
        self.deadline_ms = now_ms + duration as f64;
        self.remaining_ms = duration;
    }

    /// Advance the dwell to `now_ms`. Returns whether the flash is still up.
    ///
    /// Mirrors Vue's tick contract: a tick only REPORTS the remainder, and the
    /// tick that reaches the deadline ends the flash (it never leaves a
    /// zero-remainder frame painted, and it cannot outlive its generation).
    pub fn tick(&mut self, now_ms: f64) -> bool {
        if !self.active || self.held_open {
            return self.active;
        }
        let left = self.deadline_ms - now_ms;
        if left > 0.0 {
            self.remaining_ms = left.ceil() as u64;
            true
        } else {
            self.remaining_ms = 0;
            self.active = false;
            false
        }
    }

    /// Hide the flash immediately (idempotent).
    pub fn dismiss(&mut self) {
        self.generation = self.generation.wrapping_add(1);
        self.active = false;
        self.remaining_ms = 0;
        self.deadline_ms = 0.0;
        self.held_open = false;
        self.name = None;
    }
}

/// The screen-identify context handed to components and app code
/// (Vue: the `useScreenIdentify()` read side + `show`/`dismiss`).
#[derive(Clone)]
pub struct ScreenIdentifyContext {
    /// The live state signal (private: writes go through `show` / `dismiss`
    /// so an in-flight timer chain cannot drift from the visible state; read
    /// it through [`ScreenIdentifyContext::state`], like Vue's `readonly()`
    /// refs).
    state: Signal<ScreenIdentifyState>,
    /// Start (or restart) the flash.
    pub show: Callback<ScreenIdentifyRequest>,
    /// Hide immediately.
    pub dismiss: Callback<()>,
}

impl ScreenIdentifyContext {
    /// A snapshot of the live state (Vue: the readonly refs).
    pub fn state(&self) -> ScreenIdentifyState {
        self.state.get()
    }
}

thread_local! {
    /// The one identify signal per thread/page. Created on first access so
    /// importing the module has no side effects.
    static IDENTIFY_SIGNAL: std::cell::RefCell<Option<Signal<ScreenIdentifyState>>> =
        const { std::cell::RefCell::new(None) };
}

/// The live signal (module singleton, Vue's module `state` refs). Private:
/// app code reads through [`use_screen_identify`] / [`show_screen_identify`].
fn screen_identify_signal() -> Signal<ScreenIdentifyState> {
    IDENTIFY_SIGNAL.with(|slot| {
        let mut slot = slot.borrow_mut();
        slot.get_or_insert_with(|| Signal::new(ScreenIdentifyState::default()))
            .clone()
    })
}

/// Republish the signal so a mounted host repaints.
///
/// tairitsu 0.5.26's `Signal::write()` mutates WITHOUT notifying subscribers;
/// the only component-dirty path is `set()` (`runtime::notify_signal`). The
/// toast store does the same `get()`-then-`set()` dance (`feedback/toast.rs`);
/// without it the flash would change state invisibly.
fn republish_screen_identify(state: &Signal<ScreenIdentifyState>) {
    let snapshot = state.get();
    state.set(snapshot);
}

/// Start (or restart) the flash. Any module may call this, like Vue's
/// `showScreenIdentify`; the host is notified by the republish below.
pub fn show_screen_identify(request: ScreenIdentifyRequest) {
    let state = screen_identify_signal();
    let now = crate::platform::now_timestamp();
    let generation = {
        let mut current = state.write();
        current.show(&request, now);
        current.generation()
    };
    republish_screen_identify(&state);
    // Held-open flashes schedule no timer chain (Vue returns before any
    // timer for `durationMs <= 0`).
    if screen_identify_should_tick(&state.get()) {
        screen_identify_tick_chain(generation);
    }
}

/// Hide the flash immediately (idempotent).
pub fn dismiss_screen_identify() {
    let state = screen_identify_signal();
    state.write().dismiss();
    republish_screen_identify(&state);
}

/// The identify context accessor (Vue: `useScreenIdentify()`). Always
/// succeeds — the state is a module singleton, not a provider.
pub fn use_screen_identify() -> ScreenIdentifyContext {
    ScreenIdentifyContext {
        state: screen_identify_signal(),
        show: Callback::new(show_screen_identify),
        dismiss: Callback::new(|_| dismiss_screen_identify()),
    }
}

/// Whether the flash needs a tick chain: an active, timed flash does; an
/// idle or held-open one does not.
pub fn screen_identify_should_tick(state: &ScreenIdentifyState) -> bool {
    state.active() && !state.held_open()
}

/// One chain step on an explicit clock: advance the dwell only when this
/// chain's generation still owns the flash. Split from the timer closure so
/// the stale-chain guard and the deadline crossing are directly testable.
pub fn screen_identify_chain_step(
    state: &mut ScreenIdentifyState,
    generation: u32,
    now_ms: f64,
) -> bool {
    // A newer show/dismiss superseded this chain: bow out.
    if state.generation() != generation {
        return false;
    }
    state.tick(now_ms)
}

/// Test-only reset; NOT part of the public API. Tests share the thread-local
/// singleton, so each module-state case starts from a clean host.
#[doc(hidden)]
pub fn _reset_screen_identify_for_tests() {
    IDENTIFY_SIGNAL.with(|slot| {
        *slot.borrow_mut() = None;
    });
}

/// The accessible-name composer for the card (Vue: the `accessibleLabel`
/// computed). `override_label` wins when non-empty; with a name the
/// `{number}`/`{name}` templates are used, otherwise the plain `{number}` one.
pub fn screen_identify_label_with(
    number: &str,
    name: Option<&str>,
    override_label: Option<&str>,
    plain_template: &str,
    named_template: &str,
) -> String {
    if let Some(label) = override_label.filter(|value| !value.is_empty()) {
        return label.to_string();
    }
    match name.filter(|value| !value.is_empty()) {
        Some(name) => named_template
            .replace("{number}", number)
            .replace("{name}", name),
        None => plain_template.replace("{number}", number),
    }
}

/// The same composer, sourcing the sentences from `hikari-i18n`
/// (`components.hk.screenIdentify.label` / `labelNamed`).
pub fn screen_identify_label(
    number: &str,
    name: Option<&str>,
    override_label: Option<&str>,
) -> String {
    let plain = hikari_i18n::t("components.hk.screenIdentify.label", "Screen {number}");
    let named = hikari_i18n::t(
        "components.hk.screenIdentify.labelNamed",
        "Screen {number}, {name}",
    );
    screen_identify_label_with(number, name, override_label, &plain, &named)
}

thread_local! {
    /// Test-only timer capture (see [`screen_identify_capture_timers`]).
    static CAPTURED_CHAINS: std::cell::RefCell<Vec<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(Vec::new()) };
    /// Test-only capture switch (see [`screen_identify_capture_timers`]).
    static CAPTURE_TIMERS: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

/// Route scheduled chain steps to a thread-local queue instead of
/// `platform::set_timeout`.
///
/// The non-wasm platform's `set_timeout` is a no-op and its clock is frozen,
/// so the chain WIRING (schedule on show, reschedule while active, no
/// schedule for held-open) is unobservable on the test lane — R7 recorded
/// exactly that blind spot. With capture on, tests take the queued closures
/// and run them by hand, making the wiring itself a guarded contract.
#[doc(hidden)]
pub fn screen_identify_capture_timers(capture: bool) {
    CAPTURE_TIMERS.with(|flag| flag.set(capture));
    if !capture {
        CAPTURED_CHAINS.with(|queue| queue.borrow_mut().clear());
    }
}

/// Take every chain closure queued while capture was on (test-only).
#[doc(hidden)]
pub fn screen_identify_take_captured_chains() -> Vec<Box<dyn FnOnce()>> {
    CAPTURED_CHAINS.with(|queue| std::mem::take(&mut *queue.borrow_mut()))
}

fn screen_identify_tick_chain(generation: u32) {
    let step = move || {
        let still_active = screen_identify_tick_step(generation, crate::platform::now_timestamp());
        if still_active {
            screen_identify_tick_chain(generation);
        }
    };
    let capture = CAPTURE_TIMERS.with(|flag| flag.get());
    if capture {
        CAPTURED_CHAINS.with(|queue| queue.borrow_mut().push(Box::new(step)));
    } else {
        crate::platform::set_timeout(step, SCREEN_IDENTIFY_TICK_MS as i32);
    }
}

/// One tick step on the module singleton (the timer body). Advances the dwell,
/// republishes the signal so the host repaints (the countdown move and the
/// card's disappearance both ride this), and reports whether the flash is
/// still up. A superseded generation returns immediately without repainting.
///
/// `#[doc(hidden)]` but public so tests can drive an explicit clock: the
/// non-wasm platform's `set_timeout` is a no-op, so the shipped lane cannot
/// otherwise execute a chain step.
#[doc(hidden)]
pub fn screen_identify_tick_step(generation: u32, now_ms: f64) -> bool {
    let state = screen_identify_signal();
    if state.get().generation() != generation {
        return false;
    }
    let still_active = {
        let mut current = state.write();
        screen_identify_chain_step(&mut current, generation, now_ms)
    };
    republish_screen_identify(&state);
    still_active
}

/// Where the card parks on the physical screen (Vue: `ScreenIdentifyPlacement`).
/// Logical: RTL mirrors the physical left/right pair; the top/bottom edges stay
/// put (the sheet keys `inset-inline-*` for left/right and `top`/`bottom` for
/// the vertical edges).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ScreenIdentifyPlacement {
    #[default]
    BottomLeft,
    BottomRight,
    TopLeft,
    TopRight,
}

impl ScreenIdentifyPlacement {
    /// The `data-placement` token the sheet's corner rules key on.
    pub fn data_value(self) -> &'static str {
        match self {
            ScreenIdentifyPlacement::BottomLeft => "bottom-left",
            ScreenIdentifyPlacement::BottomRight => "bottom-right",
            ScreenIdentifyPlacement::TopLeft => "top-left",
            ScreenIdentifyPlacement::TopRight => "top-right",
        }
    }
}

/// Card props (Vue: `HkScreenIdentifyCard`'s props).
#[define_props]
pub struct ScreenIdentifyCardProps {
    /// Fleet-wide screen number (or any short label).
    pub number: String,

    /// Stable screen name printed under the number (optional).
    pub name: Option<String>,

    /// Whole seconds left; 0 hides the countdown badge (Vue: `secondsLeft`).
    #[default]
    pub seconds_left: u32,

    /// Screen corner (Vue: `placement`, default `bottom-left`).
    #[default]
    pub placement: ScreenIdentifyPlacement,

    /// Accessible label override. When absent the card composes one from the
    /// number and the optional name.
    pub label: Option<String>,

    /// Mirror-only: identity for the shared `CountdownDigit` flip registry
    /// (the same seam [`CountdownDigitProps::instance_key`] documents). The
    /// host composes number + flash generation so a re-flash of the same
    /// number starts from a resting slot; Vue gets the equivalent for free by
    /// remounting its digit. Empty falls back to the number alone.
    #[default]
    pub countdown_key: String,
}

fn span_with_text(class: &str, text: &str) -> VNode {
    VNode::Element(Box::new(
        VElement::new("span")
            .class(class)
            .child(VNode::Text(VText::new(text))),
    ))
}

/// The card. Presentational only: it paints what it is given; the dwell and
/// countdown live in [`ScreenIdentifyState`] and the HUD layer comes from
/// [`ScreenIdentifyHost`].
#[component]
pub fn ScreenIdentifyCard(props: ScreenIdentifyCardProps) -> Element {
    let accessible_label =
        screen_identify_label(&props.number, props.name.as_deref(), props.label.as_deref());

    let mut root = VElement::new("div")
        .class("hk-screen-identify")
        .attr("data-placement", props.placement.data_value())
        .attr("role", "status")
        .attr("aria-label", accessible_label);
    root = root.child(span_with_text("hk-screen-identify-num", &props.number));

    if let Some(name) = props.name.as_deref().filter(|value| !value.is_empty()) {
        root = root.child(span_with_text("hk-screen-identify-name", name));
    }

    if props.seconds_left > 0 {
        let instance_key = if props.countdown_key.is_empty() {
            format!("screen-identify-{}", props.number)
        } else {
            props.countdown_key.clone()
        };
        let count = VElement::new("span")
            .class("hk-screen-identify-count")
            .attr("aria-hidden", "true")
            .child(CountdownDigit(CountdownDigitProps {
                value: props.seconds_left as f64,
                instance_key,
            }));
        root = root.child(VNode::Element(Box::new(count)));
    }

    VNode::Element(Box::new(root))
}

/// Host props (Vue: `HkScreenIdentifyHost`'s props).
#[define_props]
pub struct ScreenIdentifyHostProps {
    /// Screen corner; defaults to the shared bottom-left seat.
    #[default]
    pub placement: ScreenIdentifyPlacement,

    /// Accessible label override forwarded to the card.
    pub label: Option<String>,
}

/// Mount ONCE per window to render the screen-identify card.
///
/// It is the glue between the two halves of the identify contract: the
/// module singleton owns the payload/dwell/countdown, and [`AmbientLayer`]
/// owns the LAYER — the card rides the ambient-HUD band, which paints above
/// every popup, the modal backdrop included. The host decides nothing else:
/// no transport, no numbering, no app policy.
///
/// [`screen_identify_host_content`] is the host's whole decision as a pure
/// function (idle renders nothing; an active flash renders the card on the
/// ambient layer), and the live-runtime test mounts the real component to prove
/// the show/dismiss repaint path.
pub fn screen_identify_host_content(
    state: &ScreenIdentifyState,
    placement: ScreenIdentifyPlacement,
    label: Option<String>,
) -> Element {
    if !state.active() {
        return empty_vnode();
    }

    let card = ScreenIdentifyCard(ScreenIdentifyCardProps {
        number: state.number().to_string(),
        name: state.name().map(|name| name.to_string()),
        seconds_left: state.seconds_left(),
        placement,
        label,
        // Per-flash flip identity: a re-flash of the same number must start
        // from a resting countdown slot (Vue remounts its digit per mount).
        countdown_key: format!("screen-identify-{}-{}", state.number(), state.generation()),
    });

    AmbientLayer(AmbientLayerProps {
        pointer_events: AmbientLayerPointerEvents::None,
        z_index: 1,
        // No label on the layer: the card carries the status role and the
        // accessible name; a second landmark for a decorative host would just
        // add noise (Vue does the same).
        label: None,
        children: card,
    })
}

#[component]
pub fn ScreenIdentifyHost(props: ScreenIdentifyHostProps) -> Element {
    let snapshot = screen_identify_signal().get();
    screen_identify_host_content(&snapshot, props.placement, props.label.clone())
}

/// The card's style-registry member (the vendored Vue sheet).
pub struct ScreenIdentifyCardComponent;

impl StyledComponent for ScreenIdentifyCardComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkScreenIdentifyCard.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "screen-identify-card"
    }
}

/// The host has no stylesheet of its own (Vue ships none): it composes the
/// card with the ambient layer, whose sheet already owns both boxes.
pub struct ScreenIdentifyHostComponent;

impl StyledComponent for ScreenIdentifyHostComponent {
    fn styles() -> &'static str {
        ""
    }

    fn name() -> &'static str {
        "screen-identify-host"
    }
}
