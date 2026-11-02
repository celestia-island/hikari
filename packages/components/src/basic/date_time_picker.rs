// hi-components/src/basic/date_time_picker.rs
// DateTimePicker — mirror of the canonical Vue `HkDateTimePicker`: the
// calendar (day / month / year grids with navigation and drill-down) plus the
// hour+minute stepper row, rendered either INLINE (the default) or behind a
// trigger in POPUP mode.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDateTimePicker.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-dtp*` class name is literal and
// identical in both forms. `@use "./HkPickerPane"` resolves against the
// mirrored partial, so the fixed view stage and the `hk-picker-pane-*`
// keyframes ship in the same bundle entry.
//
// DOM contract (mirrors the Vue render output):
//
//   ── inline mode (default) ──────────────────────────────────────────
//   div.hk-dtp [.is-touch] [role=group][aria-label]     (host class appended)
//     div.hk-dtp-stage [data-dir=fwd|back]
//       div.hk-dtp-pane
//         div.hk-dtp-header
//           div.hk-dtp-header-side [button.hk-dtp-back] button.hk-dtp-nav
//           div.hk-dtp-title [button.hk-dtp-title-btn …]
//           div.hk-dtp-header-side[data-side=right] > button.hk-dtp-nav
//         ── days ──
//         div.hk-dtp-weekdays > span.hk-dtp-wd ×7
//         div.hk-dtp-grid > button.hk-dtp-cell
//             [.is-out][.is-disabled][.is-selected][.is-today][disabled]
//           span.hk-dtp-cell-num                    {day}
//           span.hk-dtp-cell-dot                    (marked && !selected)
//         ── months / years ──
//         div.hk-dtp-grid[data-variant=pick] > button.hk-dtp-cell
//             [data-variant=pick][.is-selected][.is-today]
//     div.hk-dtp-time
//       div.hk-dtp-step  button.hk-dtp-step-btn / span.hk-dtp-step-val / button.hk-dtp-step-btn
//       span.hk-dtp-time-sep          (only with `show_time`)
//       div.hk-dtp-step               (the minute stepper)
//       button.hk-dtp-today
//     div.hk-dtp-popup-foot > button.hk-dtp-popup-confirm
//                                   (popup mode + a confirm label)
//   ── popup mode ─────────────────────────────────────────────────────
//   div.hk-dtp-popup-root
//     div.hk-dtp-trigger-wrap  (click toggles)
//       button.hk-dtp-trigger [aria-expanded]
//         div.hk-icon.hk-dtp-trigger-icon / span.hk-dtp-trigger-val
//         / div.hk-icon.hk-dtp-trigger-chev[.is-open]
//       (or the host's `trigger` vnode)
//     div.hk-popover-panel.hk-popover-{placement}   (style: fixed geometry, open only)
//       div.hk-dtp-popup > the body above
//   ── native branch (`native_on_mobile` + a mobile viewport) ─────────
//   input.hk-dtp-native[type=datetime-local|date][value][min][max][aria-label]
//
// State contract (the tairitsu 0.5.22 limit this wave works under): the Vue
// component keeps `viewYear`, `viewMonth`, `view`, `viewStack`, `drift` and
// the popup `open` flag in local `ref`s. tairitsu has no per-instance
// component state, so the SAME controlled shape `basic/date_picker.rs` uses
// carries them here ([`DateTimePickerViewState`] is that module's state
// machine, re-exported): the host owns the value and every handler is a pure
// call on it. `today` is an optional prop standing in for Vue's `now`
// snapshot (`new Date()` at setup — it does NOT refresh in Vue's date-time
// picker), and `model_value` is the ISO wire string because a Rust prop
// cannot carry a JS `Date`.
//
// Behaviour deltas vs Vue (documented):
//   * no `<Teleport>` / popup-manager: the popup renders in place with the
//     inline `position: fixed` geometry [`dtp_popout_style`] computes from
//     the trigger rect (`anchor`) and the twelve-value `placement` prop. No
//     auto-flip, no viewport clamp, no mobile bottom sheet — those need the
//     measured panel box and the popover's own sheet contract, neither of
//     which exists in this wave. (The popup reuses Vue's `.hk-popover-panel`
//     chrome class; register the popover sheet alongside this one — the
//     crate's default `StyleRegistry` does.)
//   * the `<Transition name="hk-picker-pane">` view swap is instant; `data-dir`
//     is still emitted so a host that adds the animation class animates the
//     same keyframes.
//   * `modelValue` is `Option<String>` (`YYYY-MM-DDTHH:mm`, or a bare
//     `YYYY-MM-DD` = 00:00, or an epoch-MILLISECONDS string). Vue's prop is a
//     REQUIRED `Date`; a `None` model falls back to `today`, which is the
//     closest honest analogue of "always has a Date".
//   * the `markedDays` `Set<string>` becomes `Vec<String>` (day keys); the
//     membership test is the same.
//   * `emit("open")` / `emit("confirm")` carry no payload in Vue; the mirror
//     exposes them as `Option<EventHandler<()>>`.
//   * the `trigger` slot is a `Option<Element>` prop — a host passes the same
//     vnode it would have written into the slot.
//   * `Intl.DateTimeFormat` does not exist on wasm32-wasip2: month / weekday
//     NAMES come from chrono's locale data and the segment order from a
//     per-language table — the full delta list lives on
//     [`crate::basic::date_picker::DateLocale`]. One shape is specific to this
//     component: the trigger label is the medium date PLUS a 24-hour clock
//     ("Oct 6, 2024, 09:05"). Vue's Intl pattern for that label is
//     `{month, day, hour, minute, hourCycle: "h23"}`, i.e. no year — the
//     mirror keeps the year so the trigger cannot be ambiguous across years.
//   * the trigger's `.hk-dtp-trigger-icon` / `.hk-dtp-trigger-chev` classes
//     land on the crate's `div.hk-icon` glyph wrapper (Vue puts them on the
//     lucide `<svg>` directly) — the same `hikari_icons::Icon` delta
//     `basic/button.rs` documents.
//   * the day-cell `aria-label` is not emitted: Vue's date-time picker never
//     sets one (the DATE picker does, and that mirror keeps it).

use chrono::{Datelike, NaiveDate, NaiveDateTime, Timelike};
use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::basic::date_picker::{
    DateLocale, DatePickerNavGlyph, date_locale, date_picker_nav, is_disabled_day, month_grid,
    parse_iso_date, to_iso_date, year_block_start,
};
use crate::basic::date_tag::{active_language, date_tag_parse_value};
use crate::platform;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DateTimePickerComponent;

/// The view-state machine is shared with the date picker: same five Vue refs
/// (`viewYear` / `viewMonth` / `view` / `viewStack` / `drift`), same pure
/// transitions. Only the model→view re-anchor rule differs (Vue re-anchors
/// this picker only when the DAY changes — see [`day_key`]).
pub type DateTimePickerViewState = crate::basic::date_picker::DatePickerViewState;

/// The shared view enum (Vue: `ViewKind`).
pub type DateTimePickerView = crate::basic::date_picker::DatePickerView;

/// The shared drift enum (Vue's `drift` ref).
pub type DateTimePickerDrift = crate::basic::date_picker::DatePickerDrift;

/// The trigger rect the popup anchors against — the crate's one anchor shape.
pub type DateTimePickerAnchorRect = crate::feedback::PopoverAnchorRect;

/// Vue's `mode` prop: the calendar either sits in the page or behind a
/// trigger.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DateTimePickerMode {
    #[default]
    Inline,
    Popup,
}

impl DateTimePickerMode {
    pub fn token(self) -> &'static str {
        match self {
            DateTimePickerMode::Inline => "inline",
            DateTimePickerMode::Popup => "popup",
        }
    }
}

/// Vue's `PopupPlacement` union — the twelve popup placements.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DateTimePickerPlacement {
    Top,
    TopStart,
    TopEnd,
    Bottom,
    #[default]
    BottomStart,
    BottomEnd,
    Left,
    LeftStart,
    LeftEnd,
    Right,
    RightStart,
    RightEnd,
}

impl DateTimePickerPlacement {
    /// The Vue union token (`"bottom-start"` …).
    pub fn token(self) -> &'static str {
        match self {
            DateTimePickerPlacement::Top => "top",
            DateTimePickerPlacement::TopStart => "top-start",
            DateTimePickerPlacement::TopEnd => "top-end",
            DateTimePickerPlacement::Bottom => "bottom",
            DateTimePickerPlacement::BottomStart => "bottom-start",
            DateTimePickerPlacement::BottomEnd => "bottom-end",
            DateTimePickerPlacement::Left => "left",
            DateTimePickerPlacement::LeftStart => "left-start",
            DateTimePickerPlacement::LeftEnd => "left-end",
            DateTimePickerPlacement::Right => "right",
            DateTimePickerPlacement::RightStart => "right-start",
            DateTimePickerPlacement::RightEnd => "right-end",
        }
    }

    /// The `hk-popover-{placement}` class the panel carries (Vue's popover
    /// merges the same modifier).
    pub fn class_name(self) -> &'static str {
        match self {
            DateTimePickerPlacement::Top => "hk-popover-top",
            DateTimePickerPlacement::TopStart => "hk-popover-top-start",
            DateTimePickerPlacement::TopEnd => "hk-popover-top-end",
            DateTimePickerPlacement::Bottom => "hk-popover-bottom",
            DateTimePickerPlacement::BottomStart => "hk-popover-bottom-start",
            DateTimePickerPlacement::BottomEnd => "hk-popover-bottom-end",
            DateTimePickerPlacement::Left => "hk-popover-left",
            DateTimePickerPlacement::LeftStart => "hk-popover-left-start",
            DateTimePickerPlacement::LeftEnd => "hk-popover-left-end",
            DateTimePickerPlacement::Right => "hk-popover-right",
            DateTimePickerPlacement::RightStart => "hk-popover-right-start",
            DateTimePickerPlacement::RightEnd => "hk-popover-right-end",
        }
    }
}

// ── pure time math (the whole model algebra) ─────────────────────────────

/// Zero-pad to two digits (Vue: `pad2`).
pub fn dtp_pad2(value: u32) -> String {
    format!("{value:02}")
}

/// The model's wire format: `YYYY-MM-DDTHH:mm` (the value a host stores and
/// passes back through [`DateTimePickerProps::model_value`]).
pub fn dtp_to_value(value: NaiveDateTime) -> String {
    format!(
        "{}T{:02}:{:02}",
        to_iso_date(value.date()),
        value.hour(),
        value.minute()
    )
}

/// Parse the model's wire format. Accepts everything
/// [`crate::basic::date_tag::date_tag_parse_value`] accepts (a bare date is
/// midnight, an epoch-MILLISECONDS string is UTC), so the two date-family
/// components read the same string shapes.
pub fn dtp_parse_value(raw: &str) -> Option<NaiveDateTime> {
    date_tag_parse_value(raw)
}

/// The native input's wire format (Vue: `toNativeInputValue`) —
/// `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` when the clock is shown.
pub fn to_native_input_value(value: NaiveDateTime, with_time: bool) -> String {
    let date = to_iso_date(value.date());
    if with_time {
        format!("{date}T{:02}:{:02}", value.hour(), value.minute())
    } else {
        date
    }
}

/// The parts of a native-input value (Vue: `parseNativeInputValue`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct NativeInputParts {
    pub year: i32,
    pub month: u32,
    pub day: u32,
    /// `None` when the value carried no clock (a bare date input).
    pub hour: Option<u32>,
    pub minute: Option<u32>,
}

/// Parse `YYYY-MM-DD` with an optional `THH:mm[:SS]` — the native input's
/// wire format. Rollovers such as `2026-02-31` are rejected, never
/// normalized into the next month (Vue's probe date check).
pub fn parse_native_input_value(value: &str) -> Option<NativeInputParts> {
    let text = value.trim();
    if text.is_empty() {
        return None;
    }
    let (date_text, time_text) = match text.find('T') {
        Some(index) => (&text[..index], Some(&text[index + 1..])),
        None => (text, None),
    };
    let date = parse_iso_date(date_text)?;
    // Vue's wire regex demands TWO digits per clock field
    // (`(?:T(\d{2}):(\d{2})(?::\d{2})?)?`) and tolerates — then drops —
    // the optional seconds.
    let two_digits = |text: &str| -> Option<u32> {
        if text.len() == 2 && text.bytes().all(|byte| byte.is_ascii_digit()) {
            text.parse::<u32>().ok()
        } else {
            None
        }
    };
    let (hour, minute) = match time_text {
        None => (None, None),
        Some(time_text) => {
            let mut pieces = time_text.split(':');
            let hour = two_digits(pieces.next()?)?;
            let minute = two_digits(pieces.next()?)?;
            if let Some(seconds) = pieces.next() {
                two_digits(seconds)?;
            }
            if pieces.next().is_some() {
                return None;
            }
            (Some(hour), Some(minute))
        }
    };
    Some(NativeInputParts {
        year: date.year(),
        month: date.month(),
        day: date.day(),
        hour,
        minute,
    })
}

/// The `YYYY-MM-DD` day key Vue's model watcher compares
/// (`lastDayKey`), and the key `marked_days` holds.
pub fn day_key(date: NaiveDate) -> String {
    to_iso_date(date)
}

/// Vue's `startOfDay` — the calendar date of a date-time.
pub fn start_of_day(value: NaiveDateTime) -> NaiveDate {
    value.date()
}

/// Keep the clock of one value on another day (Vue's `selectDay`).
pub fn combine_day_time(day: NaiveDate, hour: u32, minute: u32) -> Option<NaiveDateTime> {
    day.and_hms_opt(hour.min(23), minute.min(59), 0)
}

/// Vue's `bump("h", delta)`: the hour wraps inside one day.
pub fn bump_hour(hour: u32, delta: i32) -> u32 {
    (hour as i32 + delta).rem_euclid(24) as u32
}

/// Vue's `bump("m", delta)`: the minute wraps inside one hour.
pub fn bump_minute(minute: u32, delta: i32) -> u32 {
    (minute as i32 + delta).rem_euclid(60) as u32
}

/// The inline geometry pinning the `position: fixed` panel to its trigger for
/// one of the twelve placements (Vue: the popup manager's `positionPanel`,
/// minus the measured flip/clamp pass). Start/end alignments write a
/// percentage pull-back, so no panel width is needed; the top/left arms anchor
/// the FAR edge, so no panel height is needed either.
pub fn dtp_popout_style(
    placement: DateTimePickerPlacement,
    anchor: DateTimePickerAnchorRect,
    offset: f64,
) -> String {
    // Horizontal align along the x axis for the top/bottom sides, vertical
    // align along the y axis for the left/right sides — the same split Vue's
    // `computePosition` makes.
    let align = match placement {
        DateTimePickerPlacement::TopStart
        | DateTimePickerPlacement::BottomStart
        | DateTimePickerPlacement::LeftStart
        | DateTimePickerPlacement::RightStart => 0,
        DateTimePickerPlacement::Top
        | DateTimePickerPlacement::Bottom
        | DateTimePickerPlacement::Left
        | DateTimePickerPlacement::Right => 1,
        _ => 2,
    };
    let mut style = match placement {
        // A top placement anchors the panel's FAR (bottom) edge, so no panel
        // height is needed.
        DateTimePickerPlacement::Top
        | DateTimePickerPlacement::TopStart
        | DateTimePickerPlacement::TopEnd => format!(
            "position:fixed;left:{}px;bottom:calc(100vh - {}px)",
            match align {
                0 => anchor.x,
                1 => anchor.x + anchor.width / 2.0,
                _ => anchor.x + anchor.width,
            },
            anchor.y - offset
        ),
        DateTimePickerPlacement::Bottom
        | DateTimePickerPlacement::BottomStart
        | DateTimePickerPlacement::BottomEnd => format!(
            "position:fixed;left:{}px;top:{}px",
            match align {
                0 => anchor.x,
                1 => anchor.x + anchor.width / 2.0,
                _ => anchor.x + anchor.width,
            },
            anchor.y + anchor.height + offset
        ),
        DateTimePickerPlacement::Left
        | DateTimePickerPlacement::LeftStart
        | DateTimePickerPlacement::LeftEnd => format!(
            "position:fixed;right:calc(100vw - {}px);top:{}px",
            anchor.x - offset,
            match align {
                0 => anchor.y,
                1 => anchor.y + anchor.height / 2.0,
                _ => anchor.y + anchor.height,
            }
        ),
        DateTimePickerPlacement::Right
        | DateTimePickerPlacement::RightStart
        | DateTimePickerPlacement::RightEnd => format!(
            "position:fixed;left:{}px;top:{}px",
            anchor.x + anchor.width + offset,
            match align {
                0 => anchor.y,
                1 => anchor.y + anchor.height / 2.0,
                _ => anchor.y + anchor.height,
            }
        ),
    };
    // Start needs no pull-back; center/end pull the panel onto the anchor.
    let vertical_side = matches!(
        placement,
        DateTimePickerPlacement::Top
            | DateTimePickerPlacement::TopStart
            | DateTimePickerPlacement::TopEnd
            | DateTimePickerPlacement::Bottom
            | DateTimePickerPlacement::BottomStart
            | DateTimePickerPlacement::BottomEnd
    );
    match (align, vertical_side) {
        (0, _) => {}
        (1, true) => style.push_str(";transform:translateX(-50%)"),
        (1, false) => style.push_str(";transform:translateY(-50%)"),
        (_, true) => style.push_str(";transform:translateX(-100%)"),
        (_, false) => style.push_str(";transform:translateY(-100%)"),
    }
    style
}

/// The trigger's display text (Vue's `triggerLabel`): the medium date with
/// the 24-hour clock, or the plain medium date when the clock is hidden.
pub fn dtp_trigger_label(value: NaiveDateTime, with_time: bool, locale: &DateLocale) -> String {
    if with_time {
        // Vue's `triggerDateTime`: `{month: "short", day: "numeric", hour,
        // minute, hourCycle: "h23"}` — NO year in this form.
        format!(
            "{}, {:02}:{:02}",
            locale.short_text(value.date()),
            value.hour(),
            value.minute()
        )
    } else {
        // Vue's `triggerDate`: `{year, month: "short", day}`.
        locale.display_text(value.date())
    }
}

// ── props ────────────────────────────────────────────────────────────────

#[define_props]
pub struct DateTimePickerProps {
    /// The selected date-time as `YYYY-MM-DDTHH:mm` (a bare date is
    /// midnight; an epoch-MILLISECONDS string is read as UTC). `None` falls
    /// back to `today` — Vue's prop is a REQUIRED `Date` with no null
    /// semantics.
    pub model_value: Option<String>,

    /// Inclusive lower bound (same wire shapes as the model).
    pub min: Option<String>,

    /// Inclusive upper bound (same wire shapes as the model).
    pub max: Option<String>,

    /// Day keys (`YYYY-MM-DD`) that render the marked dot (Vue:
    /// `markedDays: Set<string>`).
    pub marked_days: Vec<String>,

    #[default]
    pub mode: DateTimePickerMode,

    #[default]
    pub placement: DateTimePickerPlacement,

    /// Gap between the trigger and the popup, in px (Vue default 6).
    #[default(6.0)]
    pub offset: f64,

    /// Popup mode's confirm button label; without it the footer is not
    /// rendered (Vue: `mode === "popup" && confirmLabel`).
    pub confirm_label: Option<String>,

    /// Show the hour/minute stepper row (Vue default `true`).
    #[default(true)]
    pub show_time: bool,

    /// Render the OS native `<input type="datetime-local">` on touch-sized
    /// viewports (Vue default `false`).
    #[default]
    pub native_on_mobile: bool,

    // ── controlled state (Vue keeps all of these in local refs) ──────────
    /// The popup's open flag (Vue: the local `open`).
    #[default]
    pub open: bool,

    /// Vue's `viewYear` / `viewMonth` / `view` / `viewStack` / `drift`.
    /// `None` derives the initial state from the model (or `today`), exactly
    /// Vue's setup seed.
    pub view_state: Option<DateTimePickerViewState>,

    /// Vue's `now` snapshot (`new Date()` at setup — the date-time picker
    /// does not refresh it). `None` reads the system clock.
    pub today: Option<String>,

    /// The trigger rect the popup anchors against.
    pub anchor: Option<DateTimePickerAnchorRect>,

    /// Popup mode's trigger content (Vue: the `trigger` slot). Without it the
    /// default trigger button renders.
    pub trigger: Option<Element>,

    /// Appended to the root element (`.hk-dtp` / `.hk-dtp-popup-root`), after
    /// the family class.
    #[default]
    pub class: String,

    /// Fires with the next model value (Vue: `update:modelValue`).
    pub on_value_change: Option<EventHandler<Option<String>>>,

    /// Fires with the desired popup open state.
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the next view state (the Rust-side stand-in for Vue's view
    /// ref writes).
    pub on_view_state_change: Option<EventHandler<DateTimePickerViewState>>,

    /// Fires when the popup opens (Vue: `emit("open")`).
    pub on_open: Option<EventHandler<()>>,

    /// Fires on the confirm button (Vue: `emit("confirm")`).
    pub on_confirm: Option<EventHandler<()>>,
}

// ── the controlled event wiring ──────────────────────────────────────────

#[derive(Clone)]
struct DateTimePickerWiring {
    mode: DateTimePickerMode,
    open: bool,
    state: DateTimePickerViewState,
    /// The effective model (the prop, or the `today` fallback).
    value: NaiveDateTime,
    today: NaiveDateTime,
    min_key: Option<String>,
    max_key: Option<String>,
    marked_days: Vec<String>,
    show_time: bool,
    on_value_change: Option<EventHandler<Option<String>>>,
    on_open_change: Option<EventHandler<bool>>,
    on_view_state_change: Option<EventHandler<DateTimePickerViewState>>,
    on_open: Option<EventHandler<()>>,
    on_confirm: Option<EventHandler<()>>,
}

impl DateTimePickerWiring {
    fn request_open(&self, open: bool) {
        if let Some(handler) = self.on_open_change.as_ref() {
            handler.call(open);
        }
    }

    fn request_state(&self, state: DateTimePickerViewState) {
        if let Some(handler) = self.on_view_state_change.as_ref() {
            handler.call(state);
        }
    }

    fn request_value(&self, value: NaiveDateTime) {
        if let Some(handler) = self.on_value_change.as_ref() {
            handler.call(Some(dtp_to_value(value)));
        }
    }

    /// Vue's `toggleOpen()`: flip the popup and announce the opening edge.
    fn toggle(&self) {
        if self.open {
            self.request_open(false);
            return;
        }
        self.request_open(true);
        if let Some(handler) = self.on_open.as_ref() {
            handler.call(());
        }
    }

    /// Vue's `onConfirm()`: announce, then close.
    fn confirm(&self) {
        if let Some(handler) = self.on_confirm.as_ref() {
            handler.call(());
        }
        self.request_open(false);
    }

    /// Vue's `selectDay(d)`: keep the clock, swap the day, never leave popup
    /// mode on a calendar click (Vue keeps the popup open until Confirm).
    fn select_day(&self, day: NaiveDate) {
        if is_disabled_day(day, self.min_key.as_deref(), self.max_key.as_deref()) {
            return;
        }
        if let Some(next) = combine_day_time(day, self.value.hour(), self.value.minute()) {
            self.request_value(next);
        }
    }

    /// Vue's `setHM(h, m)`.
    fn set_hm(&self, hour: u32, minute: u32) {
        if let Some(next) = combine_day_time(self.value.date(), hour, minute) {
            self.request_value(next);
        }
    }

    /// Vue's `jumpToday()`: anchor on today (or `max` when today is past the
    /// upper bound), reset the drill-down, select it.
    fn jump_today(&self) {
        let today = start_of_day(self.today);
        let max_day = self.max_key.as_deref().and_then(parse_iso_date);
        let target = match max_day {
            Some(max_day) if max_day < today => max_day,
            _ => today,
        };
        self.request_state(self.state.clone().reset(target));
        self.select_day(target);
    }
}

// ── the component ────────────────────────────────────────────────────────

#[component]
pub fn DateTimePicker(props: DateTimePickerProps) -> Element {
    let locale = date_locale(active_language());
    let today = props
        .today
        .as_deref()
        .and_then(dtp_parse_value)
        .unwrap_or_else(|| chrono::Local::now().naive_local());
    let value = props
        .model_value
        .as_deref()
        .and_then(dtp_parse_value)
        .unwrap_or(today);
    let state = props
        .view_state
        .clone()
        .unwrap_or_else(|| DateTimePickerViewState::anchored(value.date()))
        .clamped();
    let view_year = state.year;
    let view_month = state.month;

    let min_key = props
        .min
        .as_deref()
        .and_then(dtp_parse_value)
        .map(|bound| day_key(bound.date()));
    let max_key = props
        .max
        .as_deref()
        .and_then(dtp_parse_value)
        .map(|bound| day_key(bound.date()));

    let is_mobile = platform::inner_width() < 768;
    let use_native = props.native_on_mobile && is_mobile;
    let is_touch = is_mobile && !use_native;
    let pick_label = t("hikari::dateTimePicker.pickDate", "Pick a date and time");

    // ── native mobile branch ─────────────────────────────────────────
    if use_native {
        let native_value = to_native_input_value(value, props.show_time);
        let native_min = props
            .min
            .as_deref()
            .and_then(dtp_parse_value)
            .map(|bound| to_native_input_value(bound, props.show_time));
        let native_max = props
            .max
            .as_deref()
            .and_then(dtp_parse_value)
            .map(|bound| to_native_input_value(bound, props.show_time));
        let fallback = value;
        let on_value_change = props.on_value_change.clone();
        let min_bound = min_key.clone();
        let max_bound = max_key.clone();
        let on_native_change = move |event: ChangeEvent| {
            let raw = event.value.clone();
            let Some(parts) = parse_native_input_value(&raw) else {
                // A cleared or malformed field keeps the model (Vue writes
                // the element value back; the controlled mirror emits
                // nothing).
                return;
            };
            let Some(day) = NaiveDate::from_ymd_opt(parts.year, parts.month, parts.day) else {
                return;
            };
            if is_disabled_day(day, min_bound.as_deref(), max_bound.as_deref()) {
                return;
            }
            // Without a clock part the field keeps the model's time (Vue's
            // `parsed.hh ?? cur.getHours()`).
            let hour = parts.hour.unwrap_or_else(|| fallback.hour());
            let minute = parts.minute.unwrap_or_else(|| fallback.minute());
            if let Some(next) = combine_day_time(day, hour, minute)
                && let Some(handler) = on_value_change.as_ref()
            {
                handler.call(Some(dtp_to_value(next)));
            }
        };
        let native_type = if props.show_time {
            "datetime-local"
        } else {
            "date"
        };
        let native_label = pick_label.clone();
        return rsx! {
            input {
                class: "hk-dtp-native",
                "type": native_type,
                value: native_value,
                min: native_min,
                max: native_max,
                "aria-label": native_label,
                onchange: on_native_change,
            }
        };
    }

    // ── shared wiring ────────────────────────────────────────────────
    let wiring = DateTimePickerWiring {
        mode: props.mode,
        open: props.open,
        state: state.clone(),
        value,
        today,
        min_key: min_key.clone(),
        max_key: max_key.clone(),
        marked_days: props.marked_days.clone(),
        show_time: props.show_time,
        on_value_change: props.on_value_change.clone(),
        on_open_change: props.on_open_change.clone(),
        on_view_state_change: props.on_view_state_change.clone(),
        on_open: props.on_open.clone(),
        on_confirm: props.on_confirm.clone(),
    };

    // ── the body (header + content + time row) ───────────────────────
    let body = {
        let header = dtp_build_header(&wiring, &locale, view_year, view_month);
        let content = dtp_build_content(&wiring, &locale, view_year, view_month, value, today);
        let time_row = dtp_build_time_row(&wiring, &locale);
        let mut body_classes = String::from("hk-dtp");
        if is_touch {
            body_classes.push_str(" is-touch");
        }
        // Inline mode's body IS the root, so the host class rides it; in popup
        // mode the root is `.hk-dtp-popup-root` (Vue's attrs fallthrough
        // target) and the body stays clean.
        if props.mode == DateTimePickerMode::Inline && !props.class.is_empty() {
            body_classes.push(' ');
            body_classes.push_str(&props.class);
        }
        let confirm = match (wiring.mode, props.confirm_label.clone()) {
            (DateTimePickerMode::Popup, Some(label)) => {
                let confirm_wiring = wiring.clone();
                Some(rsx! {
                    div { class: "hk-dtp-popup-foot",
                        button {
                            class: "hk-dtp-popup-confirm",
                            "type": "button",
                            onclick: move |_event: MouseEvent| confirm_wiring.confirm(),
                            {label}
                        }
                    }
                })
            }
            _ => None,
        };
        rsx! {
            div { class: body_classes, "role": "group", "aria-label": pick_label,
                div { class: "hk-dtp-stage", "data-dir": state.drift.token(),
                    div { class: "hk-dtp-pane",
                        {header}
                        {content}
                    }
                }
                {time_row}
                if let Some(confirm) = confirm {
                    {confirm}
                }
            }
        }
    };

    if wiring.mode == DateTimePickerMode::Inline {
        return body;
    }

    // ── popup mode ───────────────────────────────────────────────────
    let toggle_wiring = wiring.clone();
    let toggle_click = move |_event: MouseEvent| toggle_wiring.toggle();
    let is_open = props.open;
    let aria_expanded = if is_open { "true" } else { "false" };
    let trigger_label = dtp_trigger_label(value, props.show_time, &locale);
    let mut chev_classes = String::from("hk-dtp-trigger-chev");
    if is_open {
        chev_classes.push_str(" is-open");
    }
    let default_trigger = rsx! {
        button {
            class: "hk-dtp-trigger",
            "type": "button",
            "aria-expanded": aria_expanded,
            Icon {
                icon: MdiIcon::Calendar,
                size: 14,
                class: "hk-dtp-trigger-icon".to_string(),
            }
            span { class: "hk-dtp-trigger-val", {trigger_label} }
            Icon {
                icon: MdiIcon::ChevronDown,
                size: 14,
                class: chev_classes,
            }
        }
    };
    let trigger = match props.trigger.clone() {
        Some(trigger) => trigger,
        None => default_trigger,
    };

    let layer = if is_open {
        let geometry = match props.anchor {
            Some(anchor) => dtp_popout_style(props.placement, anchor, props.offset),
            None => String::new(),
        };
        let mut panel_classes = String::from("hk-popover-panel ");
        panel_classes.push_str(props.placement.class_name());
        Some(rsx! {
            div {
                class: panel_classes,
                style: geometry,
                div { class: "hk-dtp-popup",
                    {body}
                }
            }
        })
    } else {
        None
    };

    let mut root_classes = String::from("hk-dtp-popup-root");
    if !props.class.is_empty() {
        // Vue's attrs fall through to this root in popup mode.
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    rsx! {
        div { class: root_classes,
            div { class: "hk-dtp-trigger-wrap", onclick: toggle_click,
                {trigger}
            }
            if let Some(layer) = layer {
                {layer}
            }
        }
    }
}

/// The pane's header (Vue's `renderHeader`): the same three-column skeleton in
/// every view, with the date-time picker's two title buttons on the day view.
fn dtp_build_header(
    wiring: &DateTimePickerWiring,
    locale: &DateLocale,
    view_year: i32,
    view_month: u32,
) -> VNode {
    use crate::basic::date_picker::DatePickerView;

    let state = &wiring.state;
    let back_label = t("hikari::dateTimePicker.back", "Back");

    match state.view {
        DatePickerView::Years => {
            let start = year_block_start(view_year);
            let title = format!("{start}–{}", start + 11);
            let back_wiring = wiring.clone();
            let prev_wiring = wiring.clone();
            let next_wiring = wiring.clone();
            rsx! {
                div { class: "hk-dtp-header",
                    div { class: "hk-dtp-header-side",
                        {date_picker_nav(
                            "hk-dtp-back",
                            back_label,
                            DatePickerNavGlyph::ArrowLeft,
                            move |_event: MouseEvent| back_wiring.request_state(back_wiring.state.clone().back()),
                        )}
                        {date_picker_nav(
                            "hk-dtp-nav",
                            t("hikari::dateTimePicker.prevYears", "Previous years"),
                            DatePickerNavGlyph::ChevronLeft,
                            move |_event: MouseEvent| prev_wiring.request_state(prev_wiring.state.clone().shifted_year(-12)),
                        )}
                    }
                    div { class: "hk-dtp-title", {title} }
                    div { class: "hk-dtp-header-side", "data-side": "right",
                        {date_picker_nav(
                            "hk-dtp-nav",
                            t("hikari::dateTimePicker.nextYears", "Next years"),
                            DatePickerNavGlyph::ChevronRight,
                            move |_event: MouseEvent| next_wiring.request_state(next_wiring.state.clone().shifted_year(12)),
                        )}
                    }
                }
            }
        }
        DatePickerView::Months => {
            let drill_wiring = wiring.clone();
            let back_wiring = wiring.clone();
            let prev_wiring = wiring.clone();
            let next_wiring = wiring.clone();
            rsx! {
                div { class: "hk-dtp-header",
                    div { class: "hk-dtp-header-side",
                        {date_picker_nav(
                            "hk-dtp-back",
                            back_label,
                            DatePickerNavGlyph::ArrowLeft,
                            move |_event: MouseEvent| back_wiring.request_state(back_wiring.state.clone().back()),
                        )}
                        {date_picker_nav(
                            "hk-dtp-nav",
                            t("hikari::dateTimePicker.prevYear", "Previous year"),
                            DatePickerNavGlyph::ChevronLeft,
                            move |_event: MouseEvent| prev_wiring.request_state(prev_wiring.state.clone().shifted_year(-1)),
                        )}
                    }
                    div { class: "hk-dtp-title",
                        button {
                            class: "hk-dtp-title-btn",
                            "type": "button",
                            onclick: move |_event: MouseEvent| {
                                drill_wiring.request_state(drill_wiring.state.clone().drill(DatePickerView::Years));
                            },
                            {view_year.to_string()}
                        }
                    }
                    div { class: "hk-dtp-header-side", "data-side": "right",
                        {date_picker_nav(
                            "hk-dtp-nav",
                            t("hikari::dateTimePicker.nextYear", "Next year"),
                            DatePickerNavGlyph::ChevronRight,
                            move |_event: MouseEvent| next_wiring.request_state(next_wiring.state.clone().shifted_year(1)),
                        )}
                    }
                }
            }
        }
        DatePickerView::Days => {
            let month_wiring = wiring.clone();
            let year_wiring = wiring.clone();
            let prev_wiring = wiring.clone();
            let next_wiring = wiring.clone();
            let month_name = locale.month_long(view_month);
            rsx! {
                div { class: "hk-dtp-header",
                    div { class: "hk-dtp-header-side",
                        {date_picker_nav(
                            "hk-dtp-nav",
                            t("hikari::dateTimePicker.prevMonth", "Previous month"),
                            DatePickerNavGlyph::ChevronLeft,
                            move |_event: MouseEvent| prev_wiring.request_state(prev_wiring.state.clone().shifted_month(-1)),
                        )}
                    }
                    div { class: "hk-dtp-title",
                        button {
                            class: "hk-dtp-title-btn",
                            "type": "button",
                            onclick: move |_event: MouseEvent| {
                                month_wiring.request_state(month_wiring.state.clone().drill(DatePickerView::Months));
                            },
                            {month_name}
                        }
                        button {
                            class: "hk-dtp-title-btn",
                            "type": "button",
                            onclick: move |_event: MouseEvent| {
                                year_wiring.request_state(year_wiring.state.clone().drill(DatePickerView::Years));
                            },
                            {view_year.to_string()}
                        }
                    }
                    div { class: "hk-dtp-header-side", "data-side": "right",
                        {date_picker_nav(
                            "hk-dtp-nav",
                            t("hikari::dateTimePicker.nextMonth", "Next month"),
                            DatePickerNavGlyph::ChevronRight,
                            move |_event: MouseEvent| next_wiring.request_state(next_wiring.state.clone().shifted_month(1)),
                        )}
                    }
                }
            }
        }
    }
}

/// The pane's body: the day grid (weekday row + marked dots) or the month/year
/// pick grid (Vue's `renderContent`).
fn dtp_build_content(
    wiring: &DateTimePickerWiring,
    locale: &DateLocale,
    view_year: i32,
    view_month: u32,
    value: NaiveDateTime,
    today: NaiveDateTime,
) -> VNode {
    use crate::basic::date_picker::DatePickerView;

    let selected = value.date();
    let now = today.date();

    match wiring.state.view {
        DatePickerView::Months => {
            let mut cells: Vec<VNode> = Vec::with_capacity(12);
            for month in 1..=12u32 {
                let is_selected = view_year == selected.year() && month == selected.month();
                let is_now = view_year == now.year() && month == now.month();
                let mut class = String::from("hk-dtp-cell");
                if is_selected {
                    class.push_str(" is-selected");
                }
                if is_now {
                    class.push_str(" is-today");
                }
                let label = locale.month_short(month);
                let cell_wiring = wiring.clone();
                cells.push(rsx! {
                    button {
                        class: class,
                        "type": "button",
                        "data-variant": "pick",
                        onclick: move |_event: MouseEvent| {
                            cell_wiring.request_state(cell_wiring.state.clone().picked_month(month));
                        },
                        {label}
                    }
                });
            }
            rsx! {
                div { class: "hk-dtp-grid", "data-variant": "pick",
                    {VNode::Fragment(cells)}
                }
            }
        }
        DatePickerView::Years => {
            let start = year_block_start(view_year);
            let mut cells: Vec<VNode> = Vec::with_capacity(12);
            for offset in 0..12 {
                let year = start + offset;
                let is_selected = year == selected.year();
                let is_now = year == now.year();
                let mut class = String::from("hk-dtp-cell");
                if is_selected {
                    class.push_str(" is-selected");
                }
                if is_now {
                    class.push_str(" is-today");
                }
                let cell_wiring = wiring.clone();
                cells.push(rsx! {
                    button {
                        class: class,
                        "type": "button",
                        "data-variant": "pick",
                        onclick: move |_event: MouseEvent| {
                            cell_wiring.request_state(cell_wiring.state.clone().picked_year(year));
                        },
                        {year}
                    }
                });
            }
            rsx! {
                div { class: "hk-dtp-grid", "data-variant": "pick",
                    {VNode::Fragment(cells)}
                }
            }
        }
        DatePickerView::Days => {
            // The date-time picker labels its weekday row with the SHORT form
            // (Vue: `weekday: "short"`), where the date picker uses narrow.
            let weekdays: Vec<VNode> = locale
                .weekday_labels(false)
                .into_iter()
                .map(|label| {
                    rsx! {
                        span { class: "hk-dtp-wd", {label} }
                    }
                })
                .collect();

            let cells = month_grid(view_year, view_month, locale.first_weekday);
            let mut day_buttons: Vec<VNode> = Vec::with_capacity(cells.len());
            for day in cells {
                let out_of_month = day.month() != view_month || day.year() != view_year;
                let day_disabled =
                    is_disabled_day(day, wiring.min_key.as_deref(), wiring.max_key.as_deref());
                let is_selected = day == selected;
                let is_today = day == now;
                let marked = wiring.marked_days.iter().any(|key| key == &day_key(day));
                let mut class = String::from("hk-dtp-cell");
                if out_of_month {
                    class.push_str(" is-out");
                }
                if day_disabled {
                    class.push_str(" is-disabled");
                }
                if is_selected {
                    class.push_str(" is-selected");
                }
                if is_today {
                    class.push_str(" is-today");
                }
                let show_dot = marked && !is_selected;
                let cell_wiring = wiring.clone();
                day_buttons.push(rsx! {
                    button {
                        class: class,
                        "type": "button",
                        disabled: day_disabled,
                        onclick: move |_event: MouseEvent| cell_wiring.select_day(day),
                        span { class: "hk-dtp-cell-num", {day.day()} }
                        if show_dot {
                            span { class: "hk-dtp-cell-dot" }
                        }
                    }
                });
            }

            rsx! {
                div { class: "hk-dtp-weekdays",
                    {VNode::Fragment(weekdays)}
                }
                div { class: "hk-dtp-grid",
                    {VNode::Fragment(day_buttons)}
                }
            }
        }
    }
}

/// The time row: the hour/minute steppers and the Today button (Vue's
/// `renderBody` time band, outside the transitioned pane so the footprint
/// never changes between views).
fn dtp_build_time_row(wiring: &DateTimePickerWiring, _locale: &DateLocale) -> VNode {
    let hour_label = t("hikari::dateTimePicker.hour", "Hour");
    let minute_label = t("hikari::dateTimePicker.minute", "Minute");
    let today_label = t("hikari::dateTimePicker.today", "Today");
    let show_time = wiring.show_time;
    let hour_value = wiring.value.hour();
    let minute_value = wiring.value.minute();

    let hour_up = wiring.clone();
    let hour_down = wiring.clone();
    let minute_up = wiring.clone();
    let minute_down = wiring.clone();
    let today_wiring = wiring.clone();

    let hour_stepper = if show_time {
        Some(rsx! {
            div { class: "hk-dtp-step",
                button {
                    class: "hk-dtp-step-btn",
                    "type": "button",
                    "aria-label": format!("{hour_label} +"),
                    onclick: move |_event: MouseEvent| {
                        hour_up.set_hm(bump_hour(hour_value, 1), minute_value);
                    },
                    Icon { icon: MdiIcon::ChevronUp, size: 13 }
                }
                span { class: "hk-dtp-step-val", {dtp_pad2(hour_value)} }
                button {
                    class: "hk-dtp-step-btn",
                    "type": "button",
                    "aria-label": format!("{hour_label} -"),
                    onclick: move |_event: MouseEvent| {
                        hour_down.set_hm(bump_hour(hour_value, -1), minute_value);
                    },
                    Icon { icon: MdiIcon::ChevronDown, size: 13 }
                }
            }
        })
    } else {
        None
    };

    let minute_stepper = if show_time {
        Some(rsx! {
            div { class: "hk-dtp-step",
                button {
                    class: "hk-dtp-step-btn",
                    "type": "button",
                    "aria-label": format!("{minute_label} +"),
                    onclick: move |_event: MouseEvent| {
                        minute_up.set_hm(hour_value, bump_minute(minute_value, 1));
                    },
                    Icon { icon: MdiIcon::ChevronUp, size: 13 }
                }
                span { class: "hk-dtp-step-val", {dtp_pad2(minute_value)} }
                button {
                    class: "hk-dtp-step-btn",
                    "type": "button",
                    "aria-label": format!("{minute_label} -"),
                    onclick: move |_event: MouseEvent| {
                        minute_down.set_hm(hour_value, bump_minute(minute_value, -1));
                    },
                    Icon { icon: MdiIcon::ChevronDown, size: 13 }
                }
            }
        })
    } else {
        None
    };

    rsx! {
        div { class: "hk-dtp-time",
            if let Some(hour_stepper) = hour_stepper {
                {hour_stepper}
                span { class: "hk-dtp-time-sep", ":" }
                if let Some(minute_stepper) = minute_stepper {
                    {minute_stepper}
                }
            }
            button {
                class: "hk-dtp-today",
                "type": "button",
                onclick: move |_event: MouseEvent| today_wiring.jump_today(),
                {today_label}
            }
        }
    }
}

impl StyledComponent for DateTimePickerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (`no_hash` keeps the
        // `.hk-dtp*` names literal). Its `@use "./HkPickerPane"` resolves
        // against the mirrored partial, so the shared stage ships with it.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDateTimePicker.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "date-time-picker"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hikari_i18n::Language;

    fn moment(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(year, month, day)
            .and_then(|date| date.and_hms_opt(hour, minute, 0))
            .expect("valid test date-time")
    }

    fn anchor() -> DateTimePickerAnchorRect {
        DateTimePickerAnchorRect {
            x: 100.0,
            y: 50.0,
            width: 40.0,
            height: 20.0,
        }
    }

    #[test]
    fn date_time_picker_props_default_matches_the_vue_props() {
        let props = DateTimePickerProps::default();
        assert_eq!(props.model_value, None);
        assert_eq!(props.min, None);
        assert_eq!(props.max, None);
        assert!(props.marked_days.is_empty());
        assert_eq!(props.mode, DateTimePickerMode::Inline);
        assert_eq!(props.placement, DateTimePickerPlacement::BottomStart);
        assert_eq!(props.offset, 6.0);
        assert_eq!(props.confirm_label, None);
        assert!(props.show_time);
        assert!(!props.native_on_mobile);
        assert!(!props.open);
        assert!(props.view_state.is_none());
        assert!(props.today.is_none());
        assert!(props.anchor.is_none());
        assert!(props.trigger.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_value_change.is_none());
        assert!(props.on_open_change.is_none());
        assert!(props.on_view_state_change.is_none());
        assert!(props.on_open.is_none());
        assert!(props.on_confirm.is_none());
    }

    #[test]
    fn date_time_picker_placement_tokens_match_the_vue_union() {
        assert_eq!(DateTimePickerPlacement::Top.token(), "top");
        assert_eq!(DateTimePickerPlacement::TopStart.token(), "top-start");
        assert_eq!(DateTimePickerPlacement::Bottom.token(), "bottom");
        assert_eq!(DateTimePickerPlacement::BottomEnd.token(), "bottom-end");
        assert_eq!(DateTimePickerPlacement::Right.token(), "right");
        assert_eq!(DateTimePickerPlacement::BottomStart.token(), "bottom-start");
        assert_eq!(
            DateTimePickerPlacement::LeftEnd.class_name(),
            "hk-popover-left-end"
        );
        assert_eq!(
            DateTimePickerPlacement::RightStart.class_name(),
            "hk-popover-right-start"
        );
        assert_eq!(
            DateTimePickerPlacement::default(),
            DateTimePickerPlacement::BottomStart
        );
        assert_eq!(DateTimePickerMode::Popup.token(), "popup");
    }

    #[test]
    fn date_time_picker_wire_formats_round_trip() {
        let value = moment(2024, 10, 6, 9, 5);
        assert_eq!(dtp_to_value(value), "2024-10-06T09:05");
        assert_eq!(dtp_parse_value("2024-10-06T09:05"), Some(value));
        // A bare date is midnight, a space separator and seconds are fine.
        assert_eq!(
            dtp_parse_value("2024-10-06"),
            Some(moment(2024, 10, 6, 0, 0))
        );
        assert_eq!(dtp_parse_value("2024-10-06 09:05"), Some(value));
        // The model wire format has minute resolution, so seconds are read
        // but never written back.
        assert!(dtp_parse_value("2024-10-06T09:05:59").is_some());
        assert_eq!(dtp_parse_value("nope"), None);
        assert_eq!(dtp_parse_value("2026-02-31T10:00"), None);
        // The native input's formats, with and without the clock.
        assert_eq!(to_native_input_value(value, true), "2024-10-06T09:05");
        assert_eq!(to_native_input_value(value, false), "2024-10-06");
        assert_eq!(day_key(value.date()), "2024-10-06");
        assert_eq!(start_of_day(value), value.date());
    }

    #[test]
    fn date_time_picker_parses_the_native_input_value() {
        let parts = parse_native_input_value("2024-10-06T09:05").expect("datetime-local");
        assert_eq!(
            parts,
            NativeInputParts {
                year: 2024,
                month: 10,
                day: 6,
                hour: Some(9),
                minute: Some(5),
            }
        );
        // Some engines append seconds; Vue tolerates and drops them.
        let parts = parse_native_input_value("2024-10-06T09:05:59").expect("with seconds");
        assert_eq!(parts.hour, Some(9));
        // A bare date carries no clock.
        let parts = parse_native_input_value("2024-10-06").expect("date only");
        assert_eq!((parts.hour, parts.minute), (None, None));
        // Rollovers and garbage are rejected.
        assert_eq!(parse_native_input_value("2026-02-31"), None);
        assert_eq!(parse_native_input_value(""), None);
        assert_eq!(parse_native_input_value("2024-10-06T9:5"), None);
    }

    #[test]
    fn date_time_picker_clock_math_wraps_and_clamps() {
        // Vue: `(cur.getHours() + delta + 24) % 24`.
        assert_eq!(bump_hour(0, -1), 23);
        assert_eq!(bump_hour(23, 1), 0);
        assert_eq!(bump_hour(12, 0), 12);
        assert_eq!(bump_hour(5, -24), 5);
        assert_eq!(bump_minute(0, -1), 59);
        assert_eq!(bump_minute(59, 1), 0);
        assert_eq!(bump_minute(30, -90), 0);
        assert_eq!(dtp_pad2(9), "09");
        assert_eq!(dtp_pad2(23), "23");
        // Day + clock composition, with the clock clamped into range.
        let day = NaiveDate::from_ymd_opt(2024, 10, 6).expect("day");
        assert_eq!(combine_day_time(day, 9, 5), Some(moment(2024, 10, 6, 9, 5)));
        assert_eq!(
            combine_day_time(day, 99, 99),
            Some(moment(2024, 10, 6, 23, 59))
        );
    }

    #[test]
    fn date_time_picker_popout_geometry() {
        assert_eq!(
            dtp_popout_style(DateTimePickerPlacement::BottomStart, anchor(), 6.0),
            "position:fixed;left:100px;top:76px"
        );
        assert_eq!(
            dtp_popout_style(DateTimePickerPlacement::Bottom, anchor(), 6.0),
            "position:fixed;left:120px;top:76px;transform:translateX(-50%)"
        );
        assert_eq!(
            dtp_popout_style(DateTimePickerPlacement::BottomEnd, anchor(), 6.0),
            "position:fixed;left:140px;top:76px;transform:translateX(-100%)"
        );
        // A top placement anchors the panel's far (bottom) edge, so it needs
        // no panel height.
        assert_eq!(
            dtp_popout_style(DateTimePickerPlacement::TopStart, anchor(), 6.0),
            "position:fixed;left:100px;bottom:calc(100vh - 44px)"
        );
        assert_eq!(
            dtp_popout_style(DateTimePickerPlacement::RightStart, anchor(), 6.0),
            "position:fixed;left:146px;top:50px"
        );
    }

    #[test]
    fn date_time_picker_trigger_label_follows_the_locale() {
        let english = date_locale(Language::English);
        let value = moment(2024, 10, 6, 9, 5);
        // Vue: `triggerDateTime` = {month:"short", day, hour, minute} — NO
        // year; `triggerDate` keeps the year.
        assert_eq!(dtp_trigger_label(value, true, &english), "Oct 6, 09:05");
        assert_eq!(dtp_trigger_label(value, false, &english), "Oct 6, 2024");
        let chinese = date_locale(Language::ChineseSimplified);
        assert_eq!(dtp_trigger_label(value, true, &chinese), "10月6日, 09:05");
        assert_eq!(dtp_trigger_label(value, false, &chinese), "2024年10月6日");
    }

    #[test]
    fn date_time_picker_view_state_is_the_shared_machine() {
        let seeded = DateTimePickerViewState::anchored(moment(2024, 10, 6, 9, 5).date());
        assert_eq!((seeded.year, seeded.month), (2024, 10));
        // The date-time picker can drill days → years directly (its day
        // header carries both title buttons), so back must pop to days.
        let drilled = seeded.clone().drill(DateTimePickerView::Years);
        assert_eq!(drilled.stack, vec![DateTimePickerView::Days]);
        let back = drilled.back();
        assert_eq!(back.view, DateTimePickerView::Days);
        assert_eq!(back.drift, DateTimePickerDrift::Back);
        // Jumping home resets the drill but keeps the drift.
        let reset = DateTimePickerViewState::anchored(moment(2024, 10, 6, 9, 5).date())
            .drill(DateTimePickerView::Months)
            .reset(NaiveDate::from_ymd_opt(2024, 12, 31).expect("day"));
        assert_eq!((reset.year, reset.month), (2024, 12));
        assert_eq!(reset.view, DateTimePickerView::Days);
    }

    #[test]
    fn date_time_picker_renders_the_inline_calendar() {
        let html = DateTimePicker(DateTimePickerProps {
            model_value: Some("2024-10-06T09:05".to_string()),
            marked_days: vec!["2024-10-20".to_string()],
            today: Some("2024-10-06T09:05".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-dtp",
            "hk-dtp-stage",
            "data-dir=\"fwd\"",
            "hk-dtp-pane",
            "hk-dtp-header",
            "hk-dtp-title-btn",
            "hk-dtp-weekdays",
            "hk-dtp-wd",
            "hk-dtp-grid",
            "hk-dtp-cell",
            "hk-dtp-cell-num",
            "hk-dtp-time",
            "hk-dtp-step",
            "hk-dtp-step-btn",
            "hk-dtp-step-val",
            "hk-dtp-time-sep",
            "hk-dtp-today",
            "09",
            "05",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // 42 day cells (one `.hk-dtp-cell-num` each), one selected (today),
        // and exactly one marked dot.
        assert_eq!(html.matches("hk-dtp-cell-num").count(), 42, "{html}");
        assert_eq!(html.matches("hk-dtp-cell-dot").count(), 1, "{html}");
        assert!(html.contains("is-selected"), "{html}");
        // Inline mode renders no trigger and no popup wrapper.
        assert!(!html.contains("hk-dtp-popup-root"), "{html}");
        assert!(!html.contains("hk-dtp-trigger"), "{html}");
    }

    #[test]
    fn date_time_picker_renders_the_popup_mode() {
        let html = DateTimePicker(DateTimePickerProps {
            model_value: Some("2024-10-06T09:05".to_string()),
            today: Some("2024-10-06T09:05".to_string()),
            mode: DateTimePickerMode::Popup,
            confirm_label: Some("OK".to_string()),
            open: true,
            anchor: Some(anchor()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-dtp-popup-root",
            "hk-dtp-trigger-wrap",
            "hk-dtp-trigger",
            "hk-dtp-trigger-val",
            "aria-expanded=\"true\"",
            "hk-popover-panel",
            "hk-popover-bottom-start",
            "position:fixed;left:100px;top:76px",
            "hk-dtp-popup",
            "hk-dtp-popup-foot",
            "hk-dtp-popup-confirm",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The body still renders inside the popup.
        assert!(html.contains("hk-dtp-grid"), "{html}");
        // The trigger shows the locale date + 24-hour clock.
        assert!(html.contains("Oct 6, 09:05"), "{html}");
    }

    #[test]
    fn date_time_picker_renders_the_month_and_year_grids() {
        let state = DateTimePickerViewState::anchored(moment(2024, 10, 6, 9, 5).date())
            .drill(DateTimePickerView::Months);
        let months = DateTimePicker(DateTimePickerProps {
            model_value: Some("2024-10-06T09:05".to_string()),
            today: Some("2024-10-06T09:05".to_string()),
            view_state: Some(state),
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(months.matches("data-variant=\"pick\"").count(), 13);
        assert!(months.contains("hk-dtp-back"), "{months}");

        let state = DateTimePickerViewState::anchored(moment(2024, 10, 6, 9, 5).date())
            .drill(DateTimePickerView::Years);
        let years = DateTimePicker(DateTimePickerProps {
            model_value: Some("2024-10-06T09:05".to_string()),
            today: Some("2024-10-06T09:05".to_string()),
            view_state: Some(state),
            ..Default::default()
        })
        .render_to_html();
        assert!(years.contains("2016–2027"), "{years}");
        // The time row survives every view (Vue keeps it outside the pane).
        assert!(years.contains("hk-dtp-time"), "{years}");
    }

    #[test]
    fn date_time_picker_styles_come_from_the_canonical_vue_sheet() {
        let css = DateTimePickerComponent::styles();
        for needle in [
            ".hk-dtp",
            ".hk-dtp-header",
            ".hk-dtp-grid",
            ".hk-dtp-cell",
            ".hk-dtp-time",
            ".hk-dtp-step",
            ".hk-dtp-today",
            ".hk-dtp-popup-root",
            ".hk-dtp-trigger",
            ".hk-dtp-native",
            // The shared pane partial's stage rules.
            ".hk-dtp-stage",
            "@keyframes hk-picker-pane-back-in",
        ] {
            assert!(css.contains(needle), "missing {needle} in dtp css");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored date-time-picker sheet"
        );
    }
}
