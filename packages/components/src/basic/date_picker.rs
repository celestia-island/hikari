// hi-components/src/basic/date_picker.rs
// DatePicker — mirror of the canonical Vue `HkDatePicker`: the input-like
// trigger plus the calendar popout (day grid → month grid → year grid
// drill-down, month/year navigation, bounded days, Today footer).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDatePicker.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-dp*` class name is literal and
// identical in both forms. Its `@use "./HkPickerPane"` target is mirrored too
// (`HkPickerPane.scss` = the shared fixed-size view stage + the
// `hk-picker-pane-*` keyframes this component's `data-dir` keys into).
//
// DOM contract (mirrors the Vue render output):
//
//   div.hk-dp [.is-disabled]                                (host class appended)
//     ── native branch (`native_on_mobile` + a mobile viewport) ──
//     input.hk-dp-native[type=date][value][min][max][disabled][aria-label]
//     ── custom branch ──
//     div.hk-dp-trigger.hk-dp-trigger-{sm|md} [.is-open]
//         [role=combobox][aria-haspopup=dialog][aria-expanded][aria-disabled]
//         [tabindex] [onclick] [onkeydown]
//       span.hk-dp-value [data-empty]                     {display | placeholder}
//       button.hk-dp-clear [type=button][tabindex=-1][aria-label]   (clearable && value && !disabled)
//         svg (the ✕ glyph)
//       span.hk-dp-icon
//         svg (the calendar glyph)
//     ── popup branch, only while open ──
//     div.hk-popover-panel.hk-dp-popover.hk-popover-bottom-start  (style: fixed geometry)
//       div.hk-dp-panel [.is-touch]
//         div.hk-dp-stage [data-dir=fwd|back]
//           div.hk-dp-pane
//             div.hk-dp-header
//               div.hk-dp-header-side [button.hk-dp-back] button.hk-dp-nav
//               div.hk-dp-title [button.hk-dp-title-btn]
//               div.hk-dp-header-side[data-side=right] > button.hk-dp-nav
//             ── days ──
//             div.hk-dp-weekdays > span.hk-dp-wd ×7
//             div.hk-dp-grid > button.hk-dp-cell
//                 [.is-out][.is-disabled][.is-selected][.is-today]
//                 [disabled][aria-label]
//             ── months / years ──
//             div.hk-dp-grid[data-variant=pick] > button.hk-dp-cell
//                 [data-variant=pick][.is-selected][.is-today]
//         div.hk-dp-footer > button.hk-btn.hk-btn-primary.hk-btn-sm
//
// State contract (the tairitsu 0.5.22 limit this wave works under): the Vue
// component keeps `open`, `viewYear`, `viewMonth`, `view`, `viewStack`,
// `drift` and `today` in local `ref`s. tairitsu has no per-instance component
// state — `use_signal` allocates a fresh signal per render and `use_state`
// shares ONE slot per component type — so the view refs are CONTROLLED here:
// [`DatePickerProps::view_state`] carries exactly Vue's five values and
// [`DatePickerProps::on_view_state_change`] emits the next one; every handler
// is a pure call on [`DatePickerViewState`] (`drill` / `back` / `shift_month`
// / `shift_year` / `pick_month` / `pick_year` / `reset` / `reanchored`), so
// the host stays a one-line reducer and the state machine is unit-testable.
// `open` is controlled too ([`DatePickerProps::on_open_change`]); `today` is
// an optional prop that falls back to `Local::now()`.
//
// Behaviour deltas vs Vue (documented):
//   * no `<Teleport>` and no popup-manager: the calendar renders in place
//     with the inline `position: fixed` geometry [`date_picker_popout_style`]
//     computes from the trigger rect (`anchor`), exactly the 6px
//     `bottom-start` placement Vue hard-codes for this picker. There is no
//     auto-flip and no viewport clamp — those need the MEASURED panel box,
//     and tairitsu 0.5.22 has no ref + measurement pairing; a trigger in the
//     bottom band should pass its own anchor.
//   * no mobile bottom sheet (`HPopover`'s `sheetOnMobile`): the sheet branch
//     is the popover's own chrome + history contract and is not mirrored in
//     this wave. The calendar keeps the `is-touch` enlargement marker when
//     the viewport is below 768px (Vue's `isTouch`), so the touch geometry
//     still applies.
//   * the panel reuses Vue's `.hk-popover-panel` chrome class (background,
//     border, shadow, padding): register the popover sheet alongside this one
//     — the crate's default `StyleRegistry` does — otherwise the panel keeps
//     only its own `.hk-dp-panel` box.
//   * the `<Transition name="hk-picker-pane">` view swap is instant: tairitsu
//     has no transition group, so the enter/leave classes are never applied
//     and Vue's focus-restore hook has no analogue. `data-dir` is still
//     emitted, so a host that adds the animation class animates the same
//     keyframes.
//   * the `modelValue` watcher (re-anchor the grid, drift back to the day
//     view) is the HOST's: [`DatePickerViewState::reanchored`] is exactly that
//     watcher, and [`DatePickerProps::on_view_state_change`] is how the host
//     writes the result back.
//   * `Intl.DateTimeFormat` does not exist on wasm32-wasip2: month and
//     weekday NAMES come from chrono's locale data ([`DateLocale`]), and the
//     segment order / separators from a per-language table. See the
//     [`DateLocale`] delta list for the two shapes that differ from Intl.
//   * `min` / `max` compare as ISO day keys, exactly Vue's string comparison
//     (both props are normalized through the parser first, so an unparseable
//     bound drops out instead of pinning the whole grid).
//   * the trigger's Enter/Space/ArrowDown (open), Escape (close) and
//     Backspace/Delete (clear) keys are mirrored; the clear button keeps
//     Vue's `tabindex={-1}` and its keydown stop-propagation.
// Replaces the retired legacy `DatePicker` (a bare `<input type="date">` with
// an `hk-date-picker*` markup family, `format`/`readonly` props and no
// calendar at all).
//
// MIGRATION (this wave REPLACES the legacy Rust `DatePicker`): the old surface
// was `value/min/max/format/readonly/on_change/on_focus/on_blur`; the mirror is
// Vue's `DatePickerProps` — `model_value: Option<String>` (ISO `YYYY-MM-DD`),
// `placeholder`, `disabled`, `clearable`, `size`, `min`/`max` day keys,
// `locale`, `anchor`, `view_state`, and the `on_*` callbacks. Anything the old
// API exposed that Vue does not have is gone; hosts that need a formatter keep
// it on their side.

use chrono::{Datelike, Locale, NaiveDate};
use hikari_i18n::{Language, t};
use hikari_icons::{Icon, MdiIcon};

use crate::basic::button::{Button, ButtonSize};
use crate::basic::date_tag::active_language;
use crate::platform;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DatePickerComponent;

/// The trigger rect the popout anchors against — the SAME rect contract the
/// anchored surfaces already share (`feedback::popover`), reused so the crate
/// keeps exactly one anchor shape.
pub type DatePickerAnchorRect = crate::feedback::PopoverAnchorRect;

// ── Vue's `ViewKind` ─────────────────────────────────────────────────────

/// Which grid the pane shows (Vue: `ViewKind`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DatePickerView {
    #[default]
    Days,
    Months,
    Years,
}

impl DatePickerView {
    /// The Vue union token (`"days" | "months" | "years"`).
    pub fn token(self) -> &'static str {
        match self {
            DatePickerView::Days => "days",
            DatePickerView::Months => "months",
            DatePickerView::Years => "years",
        }
    }
}

/// The last view transition's direction (Vue's `drift` ref) — the
/// `hk-dp-stage[data-dir]` attribute the registered keyframes key off.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DatePickerDrift {
    #[default]
    Fwd,
    Back,
}

impl DatePickerDrift {
    /// The Vue union token (`"fwd" | "back"`).
    pub fn token(self) -> &'static str {
        match self {
            DatePickerDrift::Fwd => "fwd",
            DatePickerDrift::Back => "back",
        }
    }
}

/// Trigger size step (Vue: `size`, default `"md"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DatePickerSize {
    Sm,
    #[default]
    Md,
}

impl DatePickerSize {
    /// The `hk-dp-trigger-{size}` modifier exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            DatePickerSize::Sm => "hk-dp-trigger-sm",
            DatePickerSize::Md => "hk-dp-trigger-md",
        }
    }
}

/// Vue's five view refs (`viewYear`, `viewMonth`, `view`, `viewStack`) plus
/// `drift`, bundled as ONE controlled value.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct DatePickerViewState {
    /// Vue: `viewYear`.
    pub year: i32,
    /// Vue: `viewMonth` (0-based inside Vue, 1-based here — the month number
    /// `chrono` and the ISO wire format both use).
    pub month: u32,
    /// Vue: `view`.
    pub view: DatePickerView,
    /// Vue: `viewStack`.
    pub stack: Vec<DatePickerView>,
    /// Vue: `drift`.
    pub drift: DatePickerDrift,
}

impl DatePickerViewState {
    /// Vue's initial state: the anchor date's month, the day view, an empty
    /// drill stack, forward drift.
    pub fn anchored(anchor: NaiveDate) -> Self {
        DatePickerViewState {
            year: anchor.year(),
            month: anchor.month(),
            view: DatePickerView::Days,
            stack: Vec::new(),
            drift: DatePickerDrift::Fwd,
        }
    }

    /// `resetView()` on a new anchor, KEEPING the drift direction — Vue's
    /// `toggle()` re-anchor (it only resets the drill, not `drift`).
    pub fn reset(self, anchor: NaiveDate) -> Self {
        DatePickerViewState {
            year: anchor.year(),
            month: anchor.month(),
            view: DatePickerView::Days,
            stack: Vec::new(),
            drift: self.drift,
        }
    }

    /// Vue's `watch(() => props.modelValue)`: re-anchor, drift BACK, and
    /// reset the drill-down (an external model change is a reset, not a
    /// drill).
    pub fn reanchored(self, anchor: NaiveDate) -> Self {
        DatePickerViewState {
            drift: DatePickerDrift::Back,
            ..self.reset(anchor)
        }
    }

    /// Vue's `drillTo(next)`: forward drift, push the current view.
    pub fn drill(self, next: DatePickerView) -> Self {
        let mut stack = self.stack;
        stack.push(self.view);
        DatePickerViewState {
            view: next,
            stack,
            drift: DatePickerDrift::Fwd,
            ..self
        }
    }

    /// Vue's `goBack()`: back drift, pop the stack (falling back to the day
    /// view).
    pub fn back(self) -> Self {
        let mut stack = self.stack;
        let view = stack.pop().unwrap_or(DatePickerView::Days);
        DatePickerViewState {
            view,
            stack,
            drift: DatePickerDrift::Back,
            ..self
        }
    }

    /// Vue's `shiftMonth(delta)`.
    pub fn shifted_month(self, delta: i32) -> Self {
        let (year, month) = shift_month(self.year, clamp_month(self.month), delta);
        DatePickerViewState {
            year,
            month,
            ..self
        }
    }

    /// Vue's `shiftYear(delta)`.
    pub fn shifted_year(self, delta: i32) -> Self {
        DatePickerViewState {
            year: self.year + delta,
            ..self
        }
    }

    /// Vue's `pickMonth(i)`: set the month, then go back a view.
    pub fn picked_month(self, month: u32) -> Self {
        DatePickerViewState {
            month: clamp_month(month),
            ..self
        }
        .back()
    }

    /// Vue's `pickYear(y)`: set the year, then go back a view.
    pub fn picked_year(self, year: i32) -> Self {
        DatePickerViewState { year, ..self }.back()
    }

    /// The month clamped into 1..=12 — the render path normalizes a
    /// host-owned value through this so a bad month can never produce an
    /// empty grid.
    pub fn clamped(self) -> Self {
        DatePickerViewState {
            month: clamp_month(self.month),
            ..self
        }
    }
}

// ── pure date math (the calendar's whole algebra) ────────────────────────

/// `YYYY-MM-DD` → a calendar date, or `None`.
///
/// Mirrors Vue's `parseISODate`: the pattern is exactly
/// `^\d{4}-\d{2}-\d{2}$` (unpadded input is rejected, like the regex) and a
/// rollover such as `2026-02-31` is rejected too (Vue's parser validates the
/// normalized date instead of letting `new Date` roll it into March).
pub fn parse_iso_date(value: &str) -> Option<NaiveDate> {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return None;
    }
    let digits = |range: std::ops::Range<usize>| -> Option<u32> {
        let slice = value.get(range)?;
        if !slice.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
        slice.parse::<u32>().ok()
    };
    let year = digits(0..4)? as i32;
    let month = digits(5..7)?;
    let day = digits(8..10)?;
    NaiveDate::from_ymd_opt(year, month, day)
}

/// `NaiveDate` → the `YYYY-MM-DD` wire format (Vue: `toISODate`).
pub fn to_iso_date(date: NaiveDate) -> String {
    format!("{}-{:02}-{:02}", date.year(), date.month(), date.day())
}

/// Gregorian leap-year rule.
pub fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// Days in one month of one year (1-based month).
pub fn days_in_month(year: i32, month: u32) -> u32 {
    match clamp_month(month) {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        _ => {
            if is_leap_year(year) {
                29
            } else {
                28
            }
        }
    }
}

/// Clamp a month number into 1..=12.
pub fn clamp_month(month: u32) -> u32 {
    month.clamp(1, 12)
}

/// Clamp a day into the month's real length (`2024-02-31` → 29).
pub fn clamp_day(year: i32, month: u32, day: u32) -> u32 {
    let month = clamp_month(month);
    day.clamp(1, days_in_month(year, month))
}

/// The first year of the 12-year block a year belongs to (Vue:
/// `viewYear - (viewYear % 12)`).
pub fn year_block_start(year: i32) -> i32 {
    year - year.rem_euclid(12)
}

/// Vue's `shiftMonth`: the first of the shifted month, normalized through the
/// calendar (December + 1 → January of the next year).
pub fn shift_month(year: i32, month: u32, delta: i32) -> (i32, u32) {
    let month_index = clamp_month(month) as i32 - 1 + delta;
    let year_delta = month_index.div_euclid(12);
    let month = month_index.rem_euclid(12) + 1;
    (year + year_delta, month as u32)
}

/// The 42 day cells of a month grid (6 rows × 7 columns), starting on the
/// locale's first weekday — Vue's `cells` computed, one to one.
pub fn month_grid(year: i32, month: u32, first_weekday: u32) -> Vec<NaiveDate> {
    let Some(first) = NaiveDate::from_ymd_opt(year, clamp_month(month), 1) else {
        return Vec::new();
    };
    // Vue: `(first.getDay() - firstDay + 7) % 7` days of leading slack.
    let lead = (first.weekday().num_days_from_sunday() + 7 - first_weekday % 7) % 7;
    let mut cursor = first;
    for _ in 0..lead {
        cursor = match cursor.pred_opt() {
            Some(previous) => previous,
            None => return Vec::new(),
        };
    }
    let mut cells = Vec::with_capacity(42);
    for _ in 0..42 {
        cells.push(cursor);
        cursor = match cursor.succ_opt() {
            Some(next) => next,
            None => break,
        };
    }
    cells
}

/// Is a day outside the inclusive `min` / `max` bounds? Both bounds are ISO
/// day keys (already normalized by the parser), and — exactly like Vue — the
/// comparison is a lexicographic string comparison, which is chronological
/// for zero-padded ISO dates.
pub fn is_disabled_day(day: NaiveDate, min_key: Option<&str>, max_key: Option<&str>) -> bool {
    let key = to_iso_date(day);
    if let Some(min_key) = min_key
        && key.as_str() < min_key
    {
        return true;
    }
    if let Some(max_key) = max_key
        && key.as_str() > max_key
    {
        return true;
    }
    false
}

/// The inline geometry that pins the `position: fixed` panel under its
/// trigger (Vue: the popup manager's `positionPanel` for the hard-coded
/// `bottom-start` placement, minus the measured flip/clamp pass).
pub fn date_picker_popout_style(anchor: DatePickerAnchorRect, offset: f64) -> String {
    format!(
        "position:fixed;left:{}px;top:{}px",
        anchor.x,
        anchor.y + anchor.height + offset
    )
}

// ── locale layer (the `Intl.DateTimeFormat` stand-in) ────────────────────

/// How a language writes a numeric date: the field order only.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum DateOrder {
    MonthDayYear,
    DayMonthYear,
    YearMonthDay,
}

/// The per-language date vocabulary the calendar needs.
///
/// Vue derives ALL of this from `Intl.DateTimeFormat` for the active locale
/// (month names, weekday names, header / display / aria-label shapes,
/// `Intl.Locale#weekInfo.firstDay`). wasm32-wasip2 has no `Intl`, so the
/// mirror splits the two halves:
///
///   * NAMES (month short/long, weekday long/short) come from chrono's locale
///     data — `NaiveDate::format_localized("%b" / "%B" / "%a" / "%A")` — for
///     the nine `hikari_i18n::Language` values. That data is the glibc
///     `LC_TIME` set, so it matches Intl for en / zh / ja / ko / fr / ru and
///     differs in two documented places: Spanish June/July abbreviations are
///     `jun`/`jul` (Intl: `jun`/`jul`), the Spanish weekday narrow forms come
///     from the abbreviated name (`m` for `miércoles`, where Intl uses `X`),
///     and Russian month names are the genitive form (`октября`), which is
///     what `%d %B` needs but makes the month-only header read
///     "октября 2024" instead of Intl's nominative "октябрь 2024 г.".
///   * ORDER and SEPARATORS come from the small per-language table this
///     module carries ([`DateOrder`] plus the CJK/Korean glue), transcribed
///     from `Intl.DateTimeFormat`'s output for `dateStyle: "medium"` / the
///     `{year, month}` header.
///
/// Digits stay Latin (Intl's `ar` locale formats Arabic-Indic digits), and no
/// era / day-period suffix is emitted.
#[derive(Clone, Copy, Debug)]
pub struct DateLocale {
    pub language: Language,
    /// The chrono locale whose `LC_TIME` data supplies the names.
    pub chrono_locale: Locale,
    /// 0 = Sunday … 6 = Saturday (`Intl.Locale#weekInfo.firstDay`).
    pub first_weekday: u32,
    pub order: DateOrder,
}

impl DateLocale {
    /// Abbreviated month name (Vue: `{month: "short"}`).
    pub fn month_short(&self, month: u32) -> String {
        self.month_name(month, "%b")
    }

    /// Full month name (Vue: `{month: "long"}`).
    pub fn month_long(&self, month: u32) -> String {
        self.month_name(month, "%B")
    }

    fn month_name(&self, month: u32, fmt: &str) -> String {
        // 2024-<month>-15: any day inside the month names it.
        match NaiveDate::from_ymd_opt(2024, clamp_month(month), 15) {
            Some(date) => date.format_localized(fmt, self.chrono_locale).to_string(),
            None => String::new(),
        }
    }

    /// The seven weekday labels of the grid's header row — Vue builds them
    /// from 2024-01-07 (a Sunday) offset by the locale's first weekday, and
    /// `narrow` picks the single-character form (`{weekday: "narrow"}`) over
    /// the abbreviated one (`{weekday: "short"}`).
    pub fn weekday_labels(&self, narrow: bool) -> Vec<String> {
        (0..7)
            .map(|index| {
                // 2024-01-07 … 2024-01-13 are Sunday … Saturday.
                let day_of_month = 7 + (self.first_weekday + index) % 7;
                let name = match NaiveDate::from_ymd_opt(2024, 1, day_of_month) {
                    Some(date) => date.format_localized("%a", self.chrono_locale).to_string(),
                    None => String::new(),
                };
                if narrow {
                    name.chars().next().map(String::from).unwrap_or_default()
                } else {
                    name
                }
            })
            .collect()
    }

    /// The full weekday name of one date (Vue: `dateStyle: "full"`).
    pub fn weekday_long(&self, date: NaiveDate) -> String {
        date.format_localized("%A", self.chrono_locale).to_string()
    }

    /// The header title (Vue: `{year: "numeric", month: "long"}`).
    pub fn header_label(&self, year: i32, month: u32) -> String {
        let month = clamp_month(month);
        match self.language {
            Language::ChineseSimplified | Language::ChineseTraditional | Language::Japanese => {
                format!("{year}年{month}月")
            }
            Language::Korean => format!("{year}년 {month}월"),
            _ => format!("{} {year}", self.month_long(month)),
        }
    }

    /// The trigger's display text (Vue: `dateStyle: "medium"`).
    pub fn display_text(&self, date: NaiveDate) -> String {
        let month = self.month_short(date.month());
        match self.language {
            Language::ChineseSimplified | Language::ChineseTraditional | Language::Japanese => {
                format!("{}年{}月{}日", date.year(), date.month(), date.day())
            }
            Language::Korean => format!("{}. {}. {}.", date.year(), date.month(), date.day()),
            _ => match self.order {
                DateOrder::MonthDayYear => {
                    format!("{month} {}, {}", date.day(), date.year())
                }
                DateOrder::DayMonthYear => {
                    format!("{} {month} {}", date.day(), date.year())
                }
                DateOrder::YearMonthDay => {
                    format!("{} {month} {}", date.year(), date.day())
                }
            },
        }
    }

    /// The MONTH + DAY medium text WITHOUT a year (Vue's `triggerDateTime`
    /// formatter: `{month: "short", day: "numeric"}`).
    pub fn short_text(&self, date: NaiveDate) -> String {
        let month = self.month_short(date.month());
        match self.language {
            Language::ChineseSimplified | Language::ChineseTraditional | Language::Japanese => {
                format!("{}月{}日", date.month(), date.day())
            }
            Language::Korean => format!("{}월 {}일", date.month(), date.day()),
            _ => match self.order {
                DateOrder::MonthDayYear | DateOrder::YearMonthDay => {
                    format!("{month} {}", date.day())
                }
                DateOrder::DayMonthYear => format!("{} {month}", date.day()),
            },
        }
    }

    /// The day cell's `aria-label` (Vue: `dateStyle: "full"`).
    pub fn full_text(&self, date: NaiveDate) -> String {
        let weekday = self.weekday_long(date);
        let month = self.month_long(date.month());
        match self.language {
            Language::ChineseSimplified | Language::ChineseTraditional | Language::Japanese => {
                format!(
                    "{}年{}月{}日{}",
                    date.year(),
                    date.month(),
                    date.day(),
                    weekday
                )
            }
            Language::Korean => format!(
                "{}년 {}월 {}일 {}",
                date.year(),
                date.month(),
                date.day(),
                weekday
            ),
            _ => match self.order {
                DateOrder::MonthDayYear => {
                    format!("{weekday}, {month} {}, {}", date.day(), date.year())
                }
                DateOrder::DayMonthYear => {
                    format!("{weekday} {} {month} {}", date.day(), date.year())
                }
                DateOrder::YearMonthDay => {
                    format!("{} {month} {weekday} {}", date.year(), date.day())
                }
            },
        }
    }
}

/// The locale snapshot of one hikari language.
pub fn date_locale(language: Language) -> DateLocale {
    let (chrono_locale, first_weekday, order) = match language {
        Language::English => (Locale::en_US, 0, DateOrder::MonthDayYear),
        Language::ChineseSimplified => (Locale::zh_CN, 0, DateOrder::YearMonthDay),
        Language::ChineseTraditional => (Locale::zh_TW, 0, DateOrder::YearMonthDay),
        Language::Japanese => (Locale::ja_JP, 0, DateOrder::YearMonthDay),
        Language::Korean => (Locale::ko_KR, 0, DateOrder::YearMonthDay),
        Language::French => (Locale::fr_FR, 1, DateOrder::DayMonthYear),
        Language::Spanish => (Locale::es_ES, 1, DateOrder::DayMonthYear),
        Language::Russian => (Locale::ru_RU, 1, DateOrder::DayMonthYear),
        Language::Arabic => (Locale::ar_SA, 0, DateOrder::DayMonthYear),
    };
    DateLocale {
        language,
        chrono_locale,
        first_weekday,
        order,
    }
}

/// Today's local calendar date (Vue: `new Date()`, refreshed on every open).
pub fn today_date() -> NaiveDate {
    chrono::Local::now().date_naive()
}

// ── inline SVG (the two glyphs the Rust icon set does not carry) ─────────

/// lucide `calendar` — 15px, matching Vue's `size={15}`.
const CALENDAR_SVG: &str = r#"<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>"#;

/// lucide `x` — 14px, matching Vue's `size={14}` on the clear affordance.
const CLEAR_SVG: &str = r#"<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>"#;

/// lucide `arrow-left` — 15px, the header's back glyph. The Rust icon set has
/// no `ArrowLeft` (`MdiIcon` carries `ArrowRight` / `ArrowUp` only), so the
/// glyph travels as markup.
const ARROW_LEFT_SVG: &str = r#"<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>"#;

/// An SVG glyph's host element.
///
/// `dangerous_inner_html` SUPPRESSES an element's children (and an rsx `svg {}`
/// child lands in the HTML namespace in this host stack), so every inline SVG
/// rides a dedicated, childless `display:contents` host — the shape
/// `basic/fab.rs` established. `display:contents` keeps the wrapper out of
/// layout, so the glyph sits directly inside the styled box.
pub(crate) fn svg_host(svg: &'static str) -> VNode {
    VNode::Element(Box::new(
        VElement::new("div")
            .attr("style", "display:contents")
            .dangerous_inner_html(svg),
    ))
}

/// One header control: a `hk-dp-nav` chevron or the `hk-dp-back` arrow.
#[derive(Clone, Copy)]
pub(crate) enum DatePickerNavGlyph {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
}

pub(crate) fn date_picker_nav(
    class: &'static str,
    label: String,
    glyph: DatePickerNavGlyph,
    on_click: impl Fn(MouseEvent) + 'static,
) -> VNode {
    let glyph_node = match glyph {
        DatePickerNavGlyph::ArrowLeft => svg_host(ARROW_LEFT_SVG),
        DatePickerNavGlyph::ChevronLeft => rsx! {
            Icon { icon: MdiIcon::ChevronLeft, size: 16 }
        },
        DatePickerNavGlyph::ChevronRight => rsx! {
            Icon { icon: MdiIcon::ChevronRight, size: 16 }
        },
    };
    rsx! {
        button {
            class: class,
            "type": "button",
            "aria-label": label,
            onclick: on_click,
            {glyph_node}
        }
    }
}

// ── props ────────────────────────────────────────────────────────────────

#[define_props]
pub struct DatePickerProps {
    /// The selected date as an ISO `YYYY-MM-DD` string (Vue: `modelValue`,
    /// the native input's wire format, default `null`).
    pub model_value: Option<String>,

    /// Shown while the model is empty (Vue default: the translated
    /// "Pick a date").
    pub placeholder: Option<String>,

    #[default]
    pub disabled: bool,

    /// Vue default `true`: the ✕ affordance (and the Backspace/Delete path).
    #[default(true)]
    pub clearable: bool,

    #[default]
    pub size: DatePickerSize,

    /// Inclusive lower bound as an ISO date; earlier days render disabled.
    pub min: Option<String>,

    /// Inclusive upper bound as an ISO date; later days render disabled.
    pub max: Option<String>,

    /// Render the OS native `<input type="date">` on touch-sized viewports
    /// (Vue default `false` since 2026-10-11: no native controls anywhere).
    #[default]
    pub native_on_mobile: bool,

    // ── controlled state (Vue keeps all of these in local refs) ──────────
    /// Panel visibility (Vue: the local `open`).
    #[default]
    pub open: bool,

    /// Vue's `viewYear` / `viewMonth` / `view` / `viewStack` / `drift`.
    /// `None` derives the initial state from the model (or today), exactly
    /// Vue's `anchorDate` seed.
    pub view_state: Option<DatePickerViewState>,

    /// Vue's `today` ref (refresh it when opening so the today highlight and
    /// the footer button cannot go stale). `None` reads the system clock.
    pub today: Option<String>,

    /// The trigger rect the popout anchors against. Without it the panel
    /// keeps the fixed default position (Vue without an anchor).
    pub anchor: Option<DatePickerAnchorRect>,

    /// Gap between the trigger and the panel, in px (Vue hard-codes 6 here).
    #[default(6.0)]
    pub offset: f64,

    /// Appended to the root div, after `hk-dp`.
    #[default]
    pub class: String,

    /// Fires with the chosen ISO date, or `None` for a clear (Vue:
    /// `update:modelValue`).
    pub on_value_change: Option<EventHandler<Option<String>>>,

    /// Fires with the desired open state (Vue: Vue's local `open` writes).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the next view state (the Rust-side stand-in for Vue's
    /// `viewYear` / `viewMonth` / `view` / `viewStack` / `drift` writes).
    pub on_view_state_change: Option<EventHandler<DatePickerViewState>>,
}

// ── the controlled event wiring ──────────────────────────────────────────

/// The controlled event wiring every layer shares: the current open flag, the
/// current view state, the bounds and the three callbacks, bundled so the
/// trigger, the header and the grids each build their closures from one
/// value.
#[derive(Clone)]
struct DatePickerWiring {
    disabled: bool,
    open: bool,
    state: DatePickerViewState,
    anchor_date: NaiveDate,
    today: NaiveDate,
    min_key: Option<String>,
    max_key: Option<String>,
    clearable: bool,
    has_value: bool,
    on_open_change: Option<EventHandler<bool>>,
    on_value_change: Option<EventHandler<Option<String>>>,
    on_view_state_change: Option<EventHandler<DatePickerViewState>>,
}

impl DatePickerWiring {
    fn request_open(&self, open: bool) {
        if let Some(handler) = self.on_open_change.as_ref() {
            handler.call(open);
        }
    }

    fn request_state(&self, state: DatePickerViewState) {
        if let Some(handler) = self.on_view_state_change.as_ref() {
            handler.call(state);
        }
    }

    fn request_value(&self, value: Option<String>) {
        if let Some(handler) = self.on_value_change.as_ref() {
            handler.call(value);
        }
    }

    /// Vue's `toggle()`: flip the panel, and on the opening edge re-anchor the
    /// grid to the model (the same arm that refreshes `today` in Vue — the
    /// host owns that value here).
    fn toggle(&self) {
        if self.disabled {
            return;
        }
        if self.open {
            self.request_open(false);
            return;
        }
        self.request_state(self.state.clone().reset(self.anchor_date));
        self.request_open(true);
    }

    /// Vue's `selectDay(d)`: reject a bounded day, emit the ISO key, close.
    fn commit_day(&self, day: NaiveDate) {
        if is_disabled_day(day, self.min_key.as_deref(), self.max_key.as_deref()) {
            return;
        }
        self.request_value(Some(to_iso_date(day)));
        self.request_open(false);
    }

    /// Vue's `jumpToday()`: re-anchor on today, reset the drill, select it.
    fn jump_today(&self) {
        if is_disabled_day(self.today, self.min_key.as_deref(), self.max_key.as_deref()) {
            return;
        }
        self.request_state(self.state.clone().reset(self.today));
        self.commit_day(self.today);
    }

    /// Vue's `onTriggerKeydown`, re-expressed in controlled terms.
    fn trigger_key(&self, event: KeyboardEvent) {
        if self.disabled {
            return;
        }
        match event.key.as_str() {
            "Enter" | " " | "ArrowDown" => {
                event.prevent_default();
                if !self.open {
                    self.toggle();
                }
            }
            "Escape" => {
                if self.open {
                    event.prevent_default();
                    self.request_open(false);
                }
            }
            // The keyboard path to the clear affordance (the ✕ is
            // mouse-oriented).
            "Backspace" | "Delete" if self.clearable && self.has_value => {
                event.prevent_default();
                self.request_value(None);
            }
            _ => {}
        }
    }
}

// ── the component ────────────────────────────────────────────────────────

#[component]
pub fn DatePicker(props: DatePickerProps) -> Element {
    let locale = date_locale(active_language());
    let selected = props.model_value.as_deref().and_then(parse_iso_date);
    let today = props
        .today
        .as_deref()
        .and_then(parse_iso_date)
        .unwrap_or_else(today_date);
    let anchor_date = selected.unwrap_or(today);
    let state = props
        .view_state
        .clone()
        .unwrap_or_else(|| DatePickerViewState::anchored(anchor_date))
        .clamped();
    let view_year = state.year;
    let view_month = state.month;
    let has_value = selected.is_some();
    let disabled = props.disabled;

    // Vue normalizes both bounds through the parser, so an unparseable bound
    // drops out instead of pinning the grid.
    let min_key = props
        .min
        .as_deref()
        .and_then(parse_iso_date)
        .map(to_iso_date);
    let max_key = props
        .max
        .as_deref()
        .and_then(parse_iso_date)
        .map(to_iso_date);

    let mut root_classes = String::from("hk-dp");
    if disabled {
        root_classes.push_str(" is-disabled");
    }
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    let is_mobile = platform::inner_width() < 768;
    let use_native = props.native_on_mobile && is_mobile;
    let is_touch = is_mobile && !use_native;

    let pick_date_label = t("hikari::datePicker.pickDate", "Pick a date");

    // ── native mobile branch ─────────────────────────────────────────
    if use_native {
        let native_value = props.model_value.clone().unwrap_or_default();
        let native_min = props.min.clone();
        let native_max = props.max.clone();
        let on_value_change = props.on_value_change.clone();
        let on_native_change = move |event: ChangeEvent| {
            let raw = event.value.clone();
            if raw.is_empty() {
                if let Some(handler) = on_value_change.as_ref() {
                    handler.call(None);
                }
                return;
            }
            // Out-of-range or malformed input re-syncs to the model (Vue
            // writes the element value back; the controlled mirror simply
            // emits nothing, and the host re-renders the prop).
            if let Some(day) = parse_iso_date(&raw)
                && !is_disabled_day(day, min_key.as_deref(), max_key.as_deref())
                && let Some(handler) = on_value_change.as_ref()
            {
                handler.call(Some(to_iso_date(day)));
            }
        };
        let native_label = pick_date_label.clone();
        return rsx! {
            div { class: root_classes,
                input {
                    class: "hk-dp-native",
                    "type": "date",
                    value: native_value,
                    min: native_min,
                    max: native_max,
                    disabled: disabled,
                    "aria-label": native_label,
                    onchange: on_native_change,
                }
            }
        };
    }

    // ── shared wiring ────────────────────────────────────────────────
    let wiring = DatePickerWiring {
        disabled,
        open: props.open,
        state: state.clone(),
        anchor_date,
        today,
        min_key: min_key.clone(),
        max_key: max_key.clone(),
        clearable: props.clearable,
        has_value,
        on_open_change: props.on_open_change.clone(),
        on_value_change: props.on_value_change.clone(),
        on_view_state_change: props.on_view_state_change.clone(),
    };

    // ── the opened calendar ──────────────────────────────────────────
    let layer = if props.open {
        let header = build_header(&wiring, &locale, view_year, view_month);
        let content = build_content(
            &wiring, &locale, view_year, view_month, selected, today, is_touch,
        );
        let jump_wiring = wiring.clone();
        let today_label = t("hikari::datePicker.today", "Today");
        let today_disabled =
            is_disabled_day(today, wiring.min_key.as_deref(), wiring.max_key.as_deref());
        let geometry = match props.anchor {
            Some(anchor) => date_picker_popout_style(anchor, props.offset),
            None => String::new(),
        };
        let mut panel_body_classes = String::from("hk-dp-panel");
        if is_touch {
            panel_body_classes.push_str(" is-touch");
        }
        Some(rsx! {
            div {
                class: "hk-popover-panel hk-dp-popover hk-popover-bottom-start",
                style: geometry,
                div { class: panel_body_classes,
                    div { class: "hk-dp-stage", "data-dir": state.drift.token(),
                        div { class: "hk-dp-pane",
                            {header}
                            {content}
                        }
                    }
                    div { class: "hk-dp-footer",
                        Button {
                            size: ButtonSize::Sm,
                            disabled: today_disabled,
                            onclick: Some(EventHandler::new(move |_event: MouseEvent| {
                                jump_wiring.jump_today();
                            })),
                            children: VNode::Text(VText::new(&today_label)),
                        }
                    }
                }
            }
        })
    } else {
        None
    };

    // ── trigger ──────────────────────────────────────────────────────
    let trigger_click_wiring = wiring.clone();
    let trigger_click = move |_event: MouseEvent| trigger_click_wiring.toggle();
    let trigger_key_wiring = wiring.clone();
    let trigger_keydown = move |event: KeyboardEvent| trigger_key_wiring.trigger_key(event);

    let display_text = match selected {
        Some(day) => locale.display_text(day),
        None => props
            .placeholder
            .clone()
            .unwrap_or_else(|| t("hikari::datePicker.placeholder", "Pick a date")),
    };

    let mut trigger_classes = String::from("hk-dp-trigger ");
    trigger_classes.push_str(props.size.class_name());
    if props.open {
        trigger_classes.push_str(" is-open");
    }

    let clear_wiring = wiring.clone();
    let clear_label = t("hikari::datePicker.clear", "Clear date");
    let clear_click = move |event: MouseEvent| {
        // Vue's `onClear` stops the trigger's own toggle from firing.
        event.stop_propagation();
        clear_wiring.request_value(None);
    };
    let clear_keydown = move |event: KeyboardEvent| event.stop_propagation();
    let show_clear = props.clearable && has_value && !disabled;
    let aria_disabled = if disabled {
        Some("true".to_string())
    } else {
        None
    };
    let aria_expanded = if props.open { "true" } else { "false" };
    let tabindex = if disabled { -1 } else { 0 };
    let value_empty = !has_value;

    rsx! {
        div { class: root_classes,
            div {
                class: trigger_classes,
                "role": "combobox",
                "aria-haspopup": "dialog",
                "aria-expanded": aria_expanded,
                "aria-disabled": aria_disabled,
                "tabindex": tabindex,
                onclick: trigger_click,
                onkeydown: trigger_keydown,
                span {
                    class: "hk-dp-value",
                    "data-empty": value_empty,
                    {display_text}
                }
                if show_clear {
                    button {
                        class: "hk-dp-clear",
                        "type": "button",
                        "tabindex": -1,
                        "aria-label": clear_label,
                        onclick: clear_click,
                        onkeydown: clear_keydown,
                        {svg_host(CLEAR_SVG)}
                    }
                }
                span { class: "hk-dp-icon",
                    {svg_host(CALENDAR_SVG)}
                }
            }
            if let Some(layer) = layer {
                {layer}
            }
        }
    }
}

/// The pane's header: the same three-column skeleton in every view (Vue's
/// `renderHeader`).
fn build_header(
    wiring: &DatePickerWiring,
    locale: &DateLocale,
    view_year: i32,
    view_month: u32,
) -> VNode {
    let state = &wiring.state;
    let back_label = t("hikari::datePicker.back", "Back");

    match state.view {
        DatePickerView::Years => {
            let start = year_block_start(view_year);
            let title = format!("{start}–{}", start + 11);
            let back_wiring = wiring.clone();
            let prev_wiring = wiring.clone();
            let next_wiring = wiring.clone();
            rsx! {
                div { class: "hk-dp-header",
                    div { class: "hk-dp-header-side",
                        {date_picker_nav(
                            "hk-dp-back",
                            back_label,
                            DatePickerNavGlyph::ArrowLeft,
                            move |_event: MouseEvent| back_wiring.request_state(back_wiring.state.clone().back()),
                        )}
                        {date_picker_nav(
                            "hk-dp-nav",
                            t("hikari::datePicker.prevYears", "Previous years"),
                            DatePickerNavGlyph::ChevronLeft,
                            move |_event: MouseEvent| prev_wiring.request_state(prev_wiring.state.clone().shifted_year(-12)),
                        )}
                    }
                    div { class: "hk-dp-title", {title} }
                    div { class: "hk-dp-header-side", "data-side": "right",
                        {date_picker_nav(
                            "hk-dp-nav",
                            t("hikari::datePicker.nextYears", "Next years"),
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
                div { class: "hk-dp-header",
                    div { class: "hk-dp-header-side",
                        {date_picker_nav(
                            "hk-dp-back",
                            back_label,
                            DatePickerNavGlyph::ArrowLeft,
                            move |_event: MouseEvent| back_wiring.request_state(back_wiring.state.clone().back()),
                        )}
                        {date_picker_nav(
                            "hk-dp-nav",
                            t("hikari::datePicker.prevYear", "Previous year"),
                            DatePickerNavGlyph::ChevronLeft,
                            move |_event: MouseEvent| prev_wiring.request_state(prev_wiring.state.clone().shifted_year(-1)),
                        )}
                    }
                    div { class: "hk-dp-title",
                        button {
                            class: "hk-dp-title-btn",
                            "type": "button",
                            onclick: move |_event: MouseEvent| {
                                drill_wiring.request_state(drill_wiring.state.clone().drill(DatePickerView::Years));
                            },
                            {view_year.to_string()}
                        }
                    }
                    div { class: "hk-dp-header-side", "data-side": "right",
                        {date_picker_nav(
                            "hk-dp-nav",
                            t("hikari::datePicker.nextYear", "Next year"),
                            DatePickerNavGlyph::ChevronRight,
                            move |_event: MouseEvent| next_wiring.request_state(next_wiring.state.clone().shifted_year(1)),
                        )}
                    }
                }
            }
        }
        DatePickerView::Days => {
            let drill_wiring = wiring.clone();
            let prev_wiring = wiring.clone();
            let next_wiring = wiring.clone();
            let title = locale.header_label(view_year, view_month);
            rsx! {
                div { class: "hk-dp-header",
                    div { class: "hk-dp-header-side",
                        {date_picker_nav(
                            "hk-dp-nav",
                            t("hikari::datePicker.prevMonth", "Previous month"),
                            DatePickerNavGlyph::ChevronLeft,
                            move |_event: MouseEvent| prev_wiring.request_state(prev_wiring.state.clone().shifted_month(-1)),
                        )}
                    }
                    div { class: "hk-dp-title",
                        button {
                            class: "hk-dp-title-btn",
                            "type": "button",
                            onclick: move |_event: MouseEvent| {
                                drill_wiring.request_state(drill_wiring.state.clone().drill(DatePickerView::Months));
                            },
                            {title}
                        }
                    }
                    div { class: "hk-dp-header-side", "data-side": "right",
                        {date_picker_nav(
                            "hk-dp-nav",
                            t("hikari::datePicker.nextMonth", "Next month"),
                            DatePickerNavGlyph::ChevronRight,
                            move |_event: MouseEvent| next_wiring.request_state(next_wiring.state.clone().shifted_month(1)),
                        )}
                    }
                }
            }
        }
    }
}

/// The pane's body: the day grid (with its weekday row) or the month/year
/// pick grid (Vue's `renderContent`).
#[allow(clippy::too_many_arguments)]
fn build_content(
    wiring: &DatePickerWiring,
    locale: &DateLocale,
    view_year: i32,
    view_month: u32,
    selected: Option<NaiveDate>,
    today: NaiveDate,
    _is_touch: bool,
) -> VNode {
    match wiring.state.view {
        DatePickerView::Months => {
            let mut cells: Vec<VNode> = Vec::with_capacity(12);
            for month in 1..=12u32 {
                let is_selected =
                    selected.is_some_and(|day| day.year() == view_year && day.month() == month);
                let is_today = today.year() == view_year && today.month() == month;
                let mut class = String::from("hk-dp-cell");
                if is_selected {
                    class.push_str(" is-selected");
                }
                if is_today {
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
                div { class: "hk-dp-grid", "data-variant": "pick",
                    {VNode::Fragment(cells)}
                }
            }
        }
        DatePickerView::Years => {
            let start = year_block_start(view_year);
            let mut cells: Vec<VNode> = Vec::with_capacity(12);
            for offset in 0..12 {
                let year = start + offset;
                let is_selected = selected.is_some_and(|day| day.year() == year);
                let is_today = today.year() == year;
                let mut class = String::from("hk-dp-cell");
                if is_selected {
                    class.push_str(" is-selected");
                }
                if is_today {
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
                div { class: "hk-dp-grid", "data-variant": "pick",
                    {VNode::Fragment(cells)}
                }
            }
        }
        DatePickerView::Days => {
            let weekday_labels = locale.weekday_labels(true);
            let weekdays: Vec<VNode> = weekday_labels
                .into_iter()
                .map(|label| {
                    rsx! {
                        span { class: "hk-dp-wd", {label} }
                    }
                })
                .collect();

            let cells = month_grid(view_year, view_month, locale.first_weekday);
            let mut day_buttons: Vec<VNode> = Vec::with_capacity(cells.len());
            for day in cells {
                let out_of_month = day.month() != view_month || day.year() != view_year;
                let day_disabled =
                    is_disabled_day(day, wiring.min_key.as_deref(), wiring.max_key.as_deref());
                let is_selected = selected == Some(day);
                let is_today = day == today;
                let mut class = String::from("hk-dp-cell");
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
                let aria_label = locale.full_text(day);
                let cell_wiring = wiring.clone();
                day_buttons.push(rsx! {
                    button {
                        class: class,
                        "type": "button",
                        disabled: day_disabled,
                        "aria-label": aria_label,
                        onclick: move |_event: MouseEvent| cell_wiring.commit_day(day),
                        {day.day()}
                    }
                });
            }

            rsx! {
                div { class: "hk-dp-weekdays",
                    {VNode::Fragment(weekdays)}
                }
                div { class: "hk-dp-grid",
                    {VNode::Fragment(day_buttons)}
                }
            }
        }
    }
}

impl StyledComponent for DatePickerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (`no_hash` keeps the
        // `.hk-dp*` names literal so this CSS matches the Vue build). Its
        // `@use "./HkPickerPane"` resolves against the mirrored partial.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDatePicker.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "date-picker"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
    }

    fn anchor() -> DatePickerAnchorRect {
        DatePickerAnchorRect {
            x: 100.0,
            y: 50.0,
            width: 40.0,
            height: 20.0,
        }
    }

    /// The drill path Vue's picker has (days → months → years), as the
    /// controlled state the host would hold.
    fn state_with_view(view: DatePickerView) -> DatePickerViewState {
        let seeded = DatePickerViewState::anchored(date(2024, 10, 6));
        match view {
            DatePickerView::Days => seeded,
            DatePickerView::Months => seeded.drill(DatePickerView::Months),
            DatePickerView::Years => seeded
                .drill(DatePickerView::Months)
                .drill(DatePickerView::Years),
        }
    }

    #[test]
    fn date_picker_props_default_matches_the_vue_props() {
        let props = DatePickerProps::default();
        assert_eq!(props.model_value, None);
        assert_eq!(props.placeholder, None);
        assert!(!props.disabled);
        assert!(props.clearable);
        assert_eq!(props.size, DatePickerSize::Md);
        assert_eq!(props.min, None);
        assert_eq!(props.max, None);
        assert!(!props.native_on_mobile);
        assert!(!props.open);
        assert!(props.view_state.is_none());
        assert!(props.today.is_none());
        assert!(props.anchor.is_none());
        assert_eq!(props.offset, 6.0);
        assert_eq!(props.class, "");
        assert!(props.on_value_change.is_none());
        assert!(props.on_open_change.is_none());
        assert!(props.on_view_state_change.is_none());
    }

    #[test]
    fn date_picker_size_and_view_tokens_match_vue() {
        assert_eq!(DatePickerSize::Sm.class_name(), "hk-dp-trigger-sm");
        assert_eq!(DatePickerSize::Md.class_name(), "hk-dp-trigger-md");
        assert_eq!(DatePickerView::Days.token(), "days");
        assert_eq!(DatePickerView::Months.token(), "months");
        assert_eq!(DatePickerView::Years.token(), "years");
        assert_eq!(DatePickerDrift::Fwd.token(), "fwd");
        assert_eq!(DatePickerDrift::Back.token(), "back");
    }

    #[test]
    fn date_picker_parses_and_formats_the_iso_wire_format() {
        assert_eq!(parse_iso_date("2024-10-06"), Some(date(2024, 10, 6)));
        assert_eq!(to_iso_date(date(2024, 10, 6)), "2024-10-06");
        // Single-digit figures are padded on the way out…
        assert_eq!(to_iso_date(date(987, 1, 6)), "987-01-06");
        // …and rejected on the way in (Vue's `^\d{4}-\d{2}-\d{2}$`).
        assert_eq!(parse_iso_date("2024-1-6"), None);
        assert_eq!(parse_iso_date("2024-10-06T00:00"), None);
        assert_eq!(parse_iso_date(""), None);
        // Rollovers are rejected instead of normalized into the next month.
        assert_eq!(parse_iso_date("2026-02-31"), None);
        assert_eq!(parse_iso_date("2026-13-01"), None);
        assert_eq!(parse_iso_date("2026-00-10"), None);
    }

    #[test]
    fn date_picker_month_lengths_and_clamping() {
        assert_eq!(days_in_month(2024, 2), 29);
        assert_eq!(days_in_month(2023, 2), 28);
        assert_eq!(days_in_month(2000, 2), 29);
        assert_eq!(days_in_month(1900, 2), 28);
        assert_eq!(days_in_month(2024, 4), 30);
        assert_eq!(days_in_month(2024, 12), 31);
        assert!(is_leap_year(2024) && !is_leap_year(2023));
        // Illegal month/day values are clamped, never silently wrapped.
        assert_eq!(clamp_month(0), 1);
        assert_eq!(clamp_month(13), 12);
        assert_eq!(clamp_day(2024, 2, 31), 29);
        assert_eq!(clamp_day(2023, 2, 0), 1);
        assert_eq!(clamp_day(2024, 4, 31), 30);
    }

    #[test]
    fn date_picker_month_and_year_arithmetic() {
        // Vue's shiftMonth normalizes through the calendar.
        assert_eq!(shift_month(2024, 1, -1), (2023, 12));
        assert_eq!(shift_month(2024, 12, 1), (2025, 1));
        assert_eq!(shift_month(2024, 10, 0), (2024, 10));
        assert_eq!(shift_month(2024, 6, -18), (2022, 12));
        // The 12-year block a year sits in (Vue: `year - year % 12`).
        assert_eq!(year_block_start(2024), 2016);
        assert_eq!(year_block_start(2016), 2016);
        assert_eq!(year_block_start(2023), 2016);
        // Vue: `viewYear - (viewYear % 12)` → 2027 - 11 = 2016.
        assert_eq!(year_block_start(2027), 2016);
    }

    #[test]
    fn date_picker_grid_starts_on_the_locale_weekday() {
        // 2024-02-01 is a Thursday.
        let sunday_first = month_grid(2024, 2, 0);
        assert_eq!(sunday_first.len(), 42);
        assert_eq!(sunday_first[0], date(2024, 1, 28)); // a Sunday
        assert_eq!(sunday_first[4], date(2024, 2, 1));
        assert_eq!(sunday_first[41], date(2024, 3, 9));
        // Monday-first locales shift the whole grid by one day.
        let monday_first = month_grid(2024, 2, 1);
        assert_eq!(monday_first[0], date(2024, 1, 29));
        assert_eq!(monday_first[3], date(2024, 2, 1));
        // A month that starts on the locale's first weekday has no slack.
        // 2024-09-01 is a Sunday.
        let september = month_grid(2024, 9, 0);
        assert_eq!(september[0], date(2024, 9, 1));
        // Every month of a leap year fills exactly six rows.
        for month in 1..=12u32 {
            assert_eq!(month_grid(2024, month, 0).len(), 42, "month {month}");
        }
    }

    #[test]
    fn date_picker_bounds_compare_as_iso_day_keys() {
        let day = date(2024, 10, 6);
        assert!(!is_disabled_day(day, None, None));
        assert!(!is_disabled_day(
            day,
            Some("2024-10-06"),
            Some("2024-10-06")
        ));
        assert!(is_disabled_day(day, Some("2024-10-07"), None));
        assert!(!is_disabled_day(day, Some("2024-10-05"), None));
        assert!(is_disabled_day(day, None, Some("2024-10-05")));
        assert!(!is_disabled_day(day, None, Some("2024-10-07")));
        // The year boundary is where a naive comparison breaks.
        assert!(is_disabled_day(
            date(2023, 12, 31),
            Some("2024-01-01"),
            None
        ));
        assert!(is_disabled_day(date(2025, 1, 1), None, Some("2024-12-31")));
    }

    #[test]
    fn date_picker_view_state_mirrors_the_vue_refs() {
        let seeded = DatePickerViewState::anchored(date(2024, 10, 6));
        assert_eq!((seeded.year, seeded.month), (2024, 10));
        assert_eq!(seeded.view, DatePickerView::Days);
        assert!(seeded.stack.is_empty());
        assert_eq!(seeded.drift, DatePickerDrift::Fwd);

        // days → months → years, and back again pops the stack.
        let drilled = seeded.clone().drill(DatePickerView::Months);
        assert_eq!(drilled.view, DatePickerView::Months);
        assert_eq!(drilled.stack, vec![DatePickerView::Days]);
        assert_eq!(drilled.drift, DatePickerDrift::Fwd);
        let drilled = drilled.drill(DatePickerView::Years);
        assert_eq!(
            drilled.stack,
            vec![DatePickerView::Days, DatePickerView::Months]
        );
        let back = drilled.clone().back();
        assert_eq!(back.view, DatePickerView::Months);
        assert_eq!(back.drift, DatePickerDrift::Back);
        let back = back.back();
        assert_eq!(back.view, DatePickerView::Days);
        // One more back stays on the day view.
        assert_eq!(back.back().view, DatePickerView::Days);

        // Navigation.
        assert_eq!(seeded.clone().shifted_month(-1).month, 9);
        let december = DatePickerViewState::anchored(date(2024, 12, 6)).shifted_month(1);
        assert_eq!((december.year, december.month), (2025, 1));
        assert_eq!(seeded.clone().shifted_year(-1).year, 2023);

        // Picking a month/year lands back on the parent view.
        let picked = seeded
            .clone()
            .drill(DatePickerView::Months)
            .drill(DatePickerView::Years)
            .picked_year(2019);
        assert_eq!(picked.year, 2019);
        assert_eq!(picked.view, DatePickerView::Months);
        let picked = picked.picked_month(3);
        assert_eq!(picked.month, 3);
        assert_eq!(picked.view, DatePickerView::Days);

        // `reset` keeps the drift, `reanchored` forces it back.
        let back_drift = seeded.clone().back();
        let reset = back_drift.clone().reset(date(2020, 1, 1));
        assert_eq!((reset.year, reset.month), (2020, 1));
        assert_eq!(reset.drift, DatePickerDrift::Back);
        let reanchored = seeded.reanchored(date(2020, 1, 1));
        assert_eq!(reanchored.drift, DatePickerDrift::Back);
        assert_eq!(reanchored.view, DatePickerView::Days);
        // A host-owned month outside 1..=12 is clamped on the render path.
        let clamped = DatePickerViewState {
            month: 42,
            ..DatePickerViewState::anchored(date(2024, 10, 6))
        }
        .clamped();
        assert_eq!(clamped.month, 12);
    }

    #[test]
    fn date_picker_popout_geometry_is_bottom_start() {
        assert_eq!(
            date_picker_popout_style(anchor(), 6.0),
            "position:fixed;left:100px;top:76px"
        );
        assert_eq!(
            date_picker_popout_style(anchor(), 0.0),
            "position:fixed;left:100px;top:70px"
        );
    }

    #[test]
    fn date_picker_locale_names_and_shapes() {
        let english = date_locale(Language::English);
        assert_eq!(english.first_weekday, 0);
        assert_eq!(english.month_short(10), "Oct");
        assert_eq!(english.month_long(10), "October");
        assert_eq!(english.header_label(2024, 10), "October 2024");
        assert_eq!(english.display_text(date(2024, 10, 6)), "Oct 6, 2024");
        assert_eq!(
            english.full_text(date(2024, 10, 6)),
            "Sunday, October 6, 2024"
        );
        // Narrow weekday labels, Sunday first (Vue's `weekday: "narrow"`).
        assert_eq!(
            english.weekday_labels(true),
            vec!["S", "M", "T", "W", "T", "F", "S"]
        );

        // zh: year first, no separators inside the header.
        let chinese = date_locale(Language::ChineseSimplified);
        assert_eq!(chinese.header_label(2024, 10), "2024年10月");
        assert_eq!(chinese.display_text(date(2024, 10, 6)), "2024年10月6日");
        assert!(
            chinese
                .full_text(date(2024, 10, 6))
                .starts_with("2024年10月6日")
        );

        // fr: Monday-first, day-first date.
        let french = date_locale(Language::French);
        assert_eq!(french.first_weekday, 1);
        assert_eq!(french.weekday_labels(true)[0], "l");
        assert_eq!(french.display_text(date(2024, 10, 6)), "6 oct. 2024");

        // ko: dotted medium form.
        let korean = date_locale(Language::Korean);
        assert_eq!(korean.display_text(date(2024, 10, 6)), "2024. 10. 6.");

        // ru: dot-separated day-first.
        let russian = date_locale(Language::Russian);
        assert_eq!(russian.display_text(date(2024, 10, 6)), "6 окт 2024");
    }

    #[test]
    fn date_picker_renders_the_closed_trigger() {
        let html = DatePicker(DatePickerProps {
            model_value: Some("2024-10-06".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-dp",
            "hk-dp-trigger",
            "hk-dp-trigger-md",
            "hk-dp-value",
            "hk-dp-clear",
            "hk-dp-icon",
            "role=\"combobox\"",
            "aria-haspopup=\"dialog\"",
            "aria-expanded=\"false\"",
            "tabindex=\"0\"",
            "Oct 6, 2024",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // A closed picker has no calendar in the tree.
        assert!(!html.contains("hk-dp-panel"), "{html}");
        assert!(!html.contains("hk-dp-cell"), "{html}");
    }

    #[test]
    fn date_picker_renders_the_open_calendar() {
        let html = DatePicker(DatePickerProps {
            model_value: Some("2024-10-06".to_string()),
            open: true,
            anchor: Some(anchor()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            // The panel chain (Vue's `.hk-dp-popover.hk-popover-panel` pair).
            "hk-popover-panel",
            "hk-dp-popover",
            "hk-popover-bottom-start",
            "position:fixed;left:100px;top:76px",
            "hk-dp-panel",
            "hk-dp-stage",
            "data-dir=\"fwd\"",
            "hk-dp-pane",
            // The day view: header + weekday row + the six-row grid.
            "hk-dp-header",
            "hk-dp-header-side",
            "hk-dp-title-btn",
            "hk-dp-weekdays",
            "hk-dp-wd",
            "hk-dp-grid",
            "hk-dp-cell",
            "hk-dp-footer",
            "hk-btn",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // 42 day cells + one selected cell + one today cell.
        assert_eq!(html.matches("hk-dp-cell").count(), 42, "{html}");
        assert_eq!(html.matches("is-selected").count(), 1, "{html}");
        // The selected day carries its full-date aria-label.
        assert!(html.contains("Sunday, October 6, 2024"), "{html}");
    }

    #[test]
    fn date_picker_renders_the_month_and_year_grids() {
        let months = DatePicker(DatePickerProps {
            model_value: Some("2024-10-06".to_string()),
            open: true,
            view_state: Some(state_with_view(DatePickerView::Months)),
            ..Default::default()
        })
        .render_to_html();
        assert!(months.contains("hk-dp-grid"), "{months}");
        // One pick grid + its twelve month cells.
        assert_eq!(months.matches("data-variant=\"pick\"").count(), 13);
        assert!(months.contains("is-selected"), "{months}");
        // The month view's header drills into the year grid.
        assert!(months.contains("hk-dp-back"), "{months}");

        let years = DatePicker(DatePickerProps {
            model_value: Some("2024-10-06".to_string()),
            open: true,
            view_state: Some(state_with_view(DatePickerView::Years)),
            ..Default::default()
        })
        .render_to_html();
        // The 12-year block around 2024 is 2016 … 2027, rendered as a dash
        // separated title.
        assert!(years.contains("2016–2027"), "{years}");
        assert_eq!(years.matches("data-variant=\"pick\"").count(), 13);
    }

    #[test]
    fn date_picker_styles_come_from_the_canonical_vue_sheet() {
        let css = DatePickerComponent::styles();
        for needle in [
            ".hk-dp-trigger",
            ".hk-dp-value",
            ".hk-dp-panel",
            ".hk-dp-header",
            ".hk-dp-grid",
            ".hk-dp-cell",
            ".hk-dp-footer",
            // The shared pane partial's stage rules.
            ".hk-dp-stage",
            ".hk-dp-pane",
            "@keyframes hk-picker-pane-fwd-in",
        ] {
            assert!(css.contains(needle), "missing {needle} in date-picker css");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored date-picker sheet"
        );
        // The retired legacy markup family must not come back.
        assert!(!css.contains(".hk-date-picker"), "legacy classes retired");
    }
}
