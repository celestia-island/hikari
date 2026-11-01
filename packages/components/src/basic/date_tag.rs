// hi-components/src/basic/date_tag.rs
// DateTag — mirror of the canonical Vue `HkDateTag`: a locale-aware date pill
// on ONE horizontal line whose calendar segments read in the order the ACTIVE
// hikari locale writes dates (zh: 2024/10/06 — year first; en: 10/06/2024 —
// the year LAST; ru: 06.10.2024 — day first), joined by that locale's own
// literal separators. With `time` a fourth, muted segment carries the clock
// (hour + minute, 2-digit) after a blank separator.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDateTag.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-date-tag*` class name is literal and
// identical in both forms. The DOM contract below mirrors the Vue render
// output one-to-one:
//
//   span.hk-date-tag
//     span.hk-date-tag__sep                          (a locale literal separator)
//     span.hk-date-tag__seg.hk-date-tag__seg--year   (the year, wherever the locale puts it)
//     span.hk-date-tag__seg                          (month / day figures)
//     span.hk-date-tag__sep                          (the blank separator before the time)
//     span.hk-date-tag__seg.hk-date-tag__seg--time   (hour + minute, 2-digit)
//
// The part stream is Vue's `formatToParts` stream: year/month/day values
// interleaved with the locale's literal separators, and an empty-input pill
// renders the bare shell with NO children (Vue: `parts` is `[]`, so the map
// yields nothing).
//
// Locale contract (the wasm32-wasip2 limit this wave works under):
// `Intl.DateTimeFormat` does not exist here, so the segment ORDER and the
// separators come from [`date_tag_layout`] — the per-language layout
// `Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit",
// day: "2-digit" })` produces, transcribed for the nine hikari languages
// (`hikari_i18n::Language`). The ACTIVE language is read from the live i18n
// context on every render, so a host `provide_i18n` re-orders the line — the
// same reactivity contract as Vue's `computed` over `activeLocale()`.
//
// Behaviour deltas vs Vue (documented):
//   * `value` is the only Rust-side wire shape: the Vue prop accepts
//     `Date | number | string` and normalizes with `new Date(value)`; a Rust
//     prop cannot carry a JS `Date`, so the mirror takes the string form
//     (`YYYY-MM-DD`, optional `THH:MM[:SS]`), a decimal epoch-MILLISECONDS
//     string, and reads epoch input as UTC (Vue renders the instant in the
//     host's local zone — this crate has no zone database in this wave).
//   * the mirror tolerates UNPADDED month/day (`2024-1-6`); Vue's `Date`
//     parser rejects that string and renders the empty pill. Everything
//     else stays strict: out-of-range dates (`2026-02-31`) parse to `None`
//     exactly like Vue's invalid-Date branch, because the mirror validates
//     the calendar instead of letting a normalizing constructor roll over.
//   * the time segment is 24-hour `HH:mm` for every locale. Vue's
//     `Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" })`
//     switches to a 12-hour clock plus a day-period for some locales
//     (en-US: "10:30 PM"); the mirror has no day-period vocabulary here.
//   * Arabic renders Latin digits (Vue's ar locale formats Arabic-Indic
//     digits).
//   * Vue drops an unknown/unparseable value to the empty pill and the CALLER
//     owns the empty state — the mirror keeps that contract verbatim (a
//     `None`/unparseable `value` renders the shell only).
//   * the host `class` is appended to the root span (Vue spreads attrs, so a
//     caller class also lands on the root).

use chrono::{Datelike, NaiveDate, NaiveDateTime, Timelike};
use hikari_i18n::Language;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DateTagComponent;

/// The active hikari language of the thread-local i18n context.
///
/// `t_lang` is used as the probe because `use_i18n()` CLONES the whole
/// translation table on every call, and this runs once per render.
pub fn active_language() -> Language {
    hikari_i18n::t_lang("hikari::dateTag.probe", "").1
}

/// One calendar figure, named for the position it takes in a locale layout.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum DateTagField {
    Year,
    Month,
    Day,
}

/// A locale's date layout: the field order plus the two literal separators
/// `Intl.DateTimeFormat` writes between the figures.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct DateTagLayout {
    /// Fields west → east, in the order the locale writes them.
    pub order: [DateTagField; 3],
    /// The two separators sitting BETWEEN the figures.
    pub separators: [&'static str; 2],
}

/// The layout of one hikari language — the `{year, month: "2-digit",
/// day: "2-digit"}` shape `Intl.DateTimeFormat` produces for it.
pub fn date_tag_layout(language: Language) -> DateTagLayout {
    match language {
        // "10/06/2024"
        Language::English => DateTagLayout {
            order: [DateTagField::Month, DateTagField::Day, DateTagField::Year],
            separators: ["/", "/"],
        },
        // "2024/10/06"
        Language::ChineseSimplified => DateTagLayout {
            order: [DateTagField::Year, DateTagField::Month, DateTagField::Day],
            separators: ["/", "/"],
        },
        Language::ChineseTraditional => DateTagLayout {
            order: [DateTagField::Year, DateTagField::Month, DateTagField::Day],
            separators: ["/", "/"],
        },
        Language::Japanese => DateTagLayout {
            order: [DateTagField::Year, DateTagField::Month, DateTagField::Day],
            separators: ["/", "/"],
        },
        // "2024. 10. 06." — the trailing dot rides the LAST separator arm, so
        // the third figure closes the sentence like Intl writes it.
        Language::Korean => DateTagLayout {
            order: [DateTagField::Year, DateTagField::Month, DateTagField::Day],
            separators: [". ", ". "],
        },
        // "06/10/2024"
        Language::French => DateTagLayout {
            order: [DateTagField::Day, DateTagField::Month, DateTagField::Year],
            separators: ["/", "/"],
        },
        Language::Spanish => DateTagLayout {
            order: [DateTagField::Day, DateTagField::Month, DateTagField::Year],
            separators: ["/", "/"],
        },
        // "06.10.2024"
        Language::Russian => DateTagLayout {
            order: [DateTagField::Day, DateTagField::Month, DateTagField::Year],
            separators: [".", "."],
        },
        Language::Arabic => DateTagLayout {
            order: [DateTagField::Day, DateTagField::Month, DateTagField::Year],
            separators: ["/", "/"],
        },
    }
}

/// One `Intl.DateTimeFormatPart`.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum DateTagPart {
    Literal(String),
    Year(String),
    Month(String),
    Day(String),
}

impl DateTagPart {
    /// The span class the part renders as (Vue: `literal` → `__sep`,
    /// `year` → `__seg __seg--year`, everything else → `__seg`).
    pub fn class_name(&self) -> &'static str {
        match self {
            DateTagPart::Literal(_) => "hk-date-tag__sep",
            DateTagPart::Year(_) => "hk-date-tag__seg hk-date-tag__seg--year",
            DateTagPart::Month(_) | DateTagPart::Day(_) => "hk-date-tag__seg",
        }
    }

    /// The part text.
    pub fn text(&self) -> &str {
        match self {
            DateTagPart::Literal(text)
            | DateTagPart::Year(text)
            | DateTagPart::Month(text)
            | DateTagPart::Day(text) => text,
        }
    }
}

/// Zero-pad to two digits (Vue: `month: "2-digit"` / `day: "2-digit"`).
pub fn date_tag_pad2(value: u32) -> String {
    format!("{value:02}")
}

/// The part stream for one date in the given locale — Vue's
/// `formatToParts` equivalent. Empty literals are skipped (Vue's
/// `part.value ? <span> : null` guard).
pub fn date_tag_parts(date: NaiveDate, language: Language) -> Vec<DateTagPart> {
    let layout = date_tag_layout(language);
    let mut parts = Vec::with_capacity(5);
    for (index, field) in layout.order.iter().enumerate() {
        if index > 0 {
            let separator = layout.separators[index - 1];
            if !separator.is_empty() {
                parts.push(DateTagPart::Literal(separator.to_string()));
            }
        }
        parts.push(match field {
            // Vue: `year: "numeric"` — no padding, no grouping.
            DateTagField::Year => DateTagPart::Year(format!("{}", date.year())),
            DateTagField::Month => DateTagPart::Month(date_tag_pad2(date.month())),
            DateTagField::Day => DateTagPart::Day(date_tag_pad2(date.day())),
        });
    }
    parts
}

/// The muted time segment (`hour + minute`, 2-digit) — `None` when the pill
/// did not opt in (`time` is off), matching Vue's `timeText` computed.
pub fn date_tag_time_text(date: NaiveDateTime, time: bool) -> Option<String> {
    if !time {
        return None;
    }
    Some(format!("{:02}:{:02}", date.hour(), date.minute()))
}

/// `YYYY-M-D` → a calendar date, rejecting rollovers (`2026-02-31` is not a
/// real day, so it never normalizes into March).
fn date_tag_parse_ymd(text: &str) -> Option<NaiveDate> {
    let mut pieces = text.split('-');
    let year = pieces.next()?.parse::<i32>().ok()?;
    let month = pieces.next()?.parse::<u32>().ok()?;
    let day = pieces.next()?.parse::<u32>().ok()?;
    // A trailing piece means this is not a plain date.
    if pieces.next().is_some() {
        return None;
    }
    NaiveDate::from_ymd_opt(year, month, day)
}

/// Parse the Rust-side value surface into a date-time.
///
/// Accepted shapes: `YYYY-M-D`, `YYYY-M-DTHH:MM[:SS]`,
/// `YYYY-M-D HH:MM[:SS]`, and a decimal epoch-MILLISECONDS string. Anything
/// else is `None`, the same "invalid input renders the empty pill" branch as
/// Vue's `Number.isNaN(d.getTime())` guard.
pub fn date_tag_parse_value(raw: &str) -> Option<NaiveDateTime> {
    let text = raw.trim();
    if text.is_empty() {
        return None;
    }
    // The `number` arm: epoch MILLISECONDS (never seconds — Vue's
    // `new Date(number)` contract). A zone or clock suffix is not a number.
    if text.len() >= 12 && text.chars().all(|c| c.is_ascii_digit()) {
        let millis = text.parse::<i64>().ok()?;
        return chrono::DateTime::<chrono::Utc>::from_timestamp_millis(millis)
            .map(|stamp| stamp.naive_utc());
    }
    let (date_text, time_text) = match text.find(['T', ' ']) {
        Some(index) => (&text[..index], Some(&text[index + 1..])),
        None => (text, None),
    };
    let date = date_tag_parse_ymd(date_text)?;
    let Some(time_text) = time_text else {
        return date.and_hms_opt(0, 0, 0);
    };
    let mut pieces = time_text.split(':');
    let hour = pieces.next()?.parse::<u32>().ok()?;
    let minute = pieces.next()?.parse::<u32>().ok()?;
    let second = match pieces.next() {
        Some(value) => value.parse::<u32>().ok()?,
        None => 0,
    };
    if pieces.next().is_some() {
        return None;
    }
    date.and_hms_opt(hour, minute, second)
}

#[define_props]
pub struct DateTagProps {
    /// The date to render — `YYYY-M-D`, `YYYY-M-DTHH:MM[:SS]` or a decimal
    /// epoch-MILLISECONDS string (Vue: `Date | number | string`, required).
    /// `None` or unparseable input renders the empty pill.
    pub value: Option<String>,

    /// Append the muted time segment (Vue default `false`).
    #[default]
    pub time: bool,

    /// Appended to the root span, after `hk-date-tag`.
    #[default]
    pub class: String,
}

#[component]
pub fn DateTag(props: DateTagProps) -> Element {
    let language = active_language();
    let parsed = props
        .value
        .as_deref()
        .and_then(date_tag_parse_value)
        .map(|stamp| (stamp.date(), stamp));

    let mut children: Vec<VNode> = Vec::new();
    if let Some((date, stamp)) = parsed {
        for part in date_tag_parts(date, language) {
            let class = part.class_name();
            let text = part.text().to_string();
            children.push(rsx! {
                span { class: class, {text} }
            });
        }
        if let Some(time_text) = date_tag_time_text(stamp, props.time) {
            // The blank separator keeps the time segment off the date: the
            // sheet's `white-space: pre` is what holds that single space.
            children.push(rsx! {
                span { class: "hk-date-tag__sep", {" "} }
            });
            children.push(rsx! {
                span { class: "hk-date-tag__seg hk-date-tag__seg--time", {time_text} }
            });
        }
    }

    let mut root_classes = String::from("hk-date-tag");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    rsx! {
        span { class: root_classes,
            {VNode::Fragment(children)}
        }
    }
}

impl StyledComponent for DateTagComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (`no_hash` keeps the
        // `.hk-date-tag*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDateTag.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "date-tag"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
    }

    #[test]
    fn date_tag_props_default_matches_the_vue_props() {
        let props = DateTagProps::default();
        assert_eq!(props.value, None);
        assert!(!props.time);
        assert_eq!(props.class, "");
    }

    #[test]
    fn date_tag_order_and_separators_follow_the_locale() {
        // en: the year LAST, "/" separators.
        let english = date_tag_layout(Language::English);
        assert_eq!(
            english.order,
            [DateTagField::Month, DateTagField::Day, DateTagField::Year]
        );
        assert_eq!(english.separators, ["/", "/"]);
        // zh: year first.
        let chinese = date_tag_layout(Language::ChineseSimplified);
        assert_eq!(
            chinese.order,
            [DateTagField::Year, DateTagField::Month, DateTagField::Day]
        );
        assert_eq!(chinese.separators, ["/", "/"]);
        // ru: day first, dot separators.
        let russian = date_tag_layout(Language::Russian);
        assert_eq!(
            russian.order,
            [DateTagField::Day, DateTagField::Month, DateTagField::Year]
        );
        assert_eq!(russian.separators, [".", "."]);
        // ko: year first with ". " separators.
        let korean = date_tag_layout(Language::Korean);
        assert_eq!(korean.separators, [". ", ". "]);
    }

    #[test]
    fn date_tag_parts_pad_and_interleave_separators() {
        let parts = date_tag_parts(date(2024, 10, 6), Language::English);
        assert_eq!(
            parts,
            vec![
                DateTagPart::Month("10".to_string()),
                DateTagPart::Literal("/".to_string()),
                DateTagPart::Day("06".to_string()),
                DateTagPart::Literal("/".to_string()),
                DateTagPart::Year("2024".to_string()),
            ]
        );
        // The same instant, year-first.
        let parts = date_tag_parts(date(2024, 10, 6), Language::Japanese);
        assert_eq!(
            parts,
            vec![
                DateTagPart::Year("2024".to_string()),
                DateTagPart::Literal("/".to_string()),
                DateTagPart::Month("10".to_string()),
                DateTagPart::Literal("/".to_string()),
                DateTagPart::Day("06".to_string()),
            ]
        );
        // Single-digit figures are padded, the year never is.
        let parts = date_tag_parts(date(987, 1, 6), Language::Russian);
        assert_eq!(parts[0], DateTagPart::Day("06".to_string()));
        assert_eq!(parts[2], DateTagPart::Month("01".to_string()));
        assert_eq!(parts[4], DateTagPart::Year("987".to_string()));
    }

    #[test]
    fn date_tag_part_classes_match_the_sheet() {
        assert_eq!(
            DateTagPart::Literal("/".to_string()).class_name(),
            "hk-date-tag__sep"
        );
        assert_eq!(
            DateTagPart::Year("2024".to_string()).class_name(),
            "hk-date-tag__seg hk-date-tag__seg--year"
        );
        assert_eq!(
            DateTagPart::Month("10".to_string()).class_name(),
            "hk-date-tag__seg"
        );
        // The time segment carries its own modifier pair (the component
        // writes it directly, the part stream never holds it).
        assert_eq!(date_tag_pad2(6), "06");
        assert_eq!(date_tag_pad2(12), "12");
    }

    #[test]
    fn date_tag_parse_accepts_the_iso_and_space_shapes() {
        let parsed = date_tag_parse_value("2024-10-06").expect("plain date");
        assert_eq!(parsed.date(), date(2024, 10, 6));
        assert_eq!(date_tag_time_text(parsed, true), Some("00:00".to_string()));
        let parsed = date_tag_parse_value("2024-10-06T09:05").expect("T form");
        assert_eq!(date_tag_time_text(parsed, true), Some("09:05".to_string()));
        let parsed = date_tag_parse_value("2024-10-06 09:05:59").expect("space form");
        assert_eq!(date_tag_time_text(parsed, true), Some("09:05".to_string()));
        // The `time` flag is the only switch: without it there is no segment.
        assert_eq!(date_tag_time_text(parsed, false), None);
    }

    #[test]
    fn date_tag_parse_rejects_rollovers_and_epoch_outliers() {
        // 2026-02-31 is not a day; the mirror validates instead of letting a
        // normalizing constructor roll into March (Vue's invalid-Date branch).
        assert_eq!(date_tag_parse_value("2026-02-31"), None);
        assert_eq!(date_tag_parse_value("2026-13-01"), None);
        assert_eq!(date_tag_parse_value(""), None);
        assert_eq!(date_tag_parse_value("not-a-date"), None);
        assert_eq!(date_tag_parse_value("2024-10-06T09"), None);
        // Epoch MILLISECONDS (the `number` arm), read as UTC — 1728172800000
        // is 2024-10-06T00:00:00Z.
        let parsed = date_tag_parse_value("1728172800000").expect("epoch millis");
        assert_eq!(parsed.date(), date(2024, 10, 6));
        assert_eq!(date_tag_time_text(parsed, true), Some("00:00".to_string()));
        // A short digit string is not an epoch value.
        assert_eq!(date_tag_parse_value("20241006"), None);
    }

    #[test]
    fn date_tag_renders_the_vue_shell() {
        let html = DateTag(DateTagProps {
            value: Some("2024-10-06".to_string()),
            time: true,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-date-tag",
            "hk-date-tag__seg",
            "hk-date-tag__sep",
            "hk-date-tag__seg--year",
            "hk-date-tag__seg--time",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The locale-neutral figures still render (the active tests language
        // is whatever the thread-local context holds — the default is en).
        assert!(html.contains("2024"), "{html}");
    }

    #[test]
    fn date_tag_invalid_value_renders_the_empty_pill() {
        let html = DateTag(DateTagProps {
            value: Some("nope".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-date-tag"), "{html}");
        assert!(!html.contains("hk-date-tag__seg"), "{html}");
    }

    #[test]
    fn date_tag_styles_come_from_the_canonical_vue_sheet() {
        let css = DateTagComponent::styles();
        for needle in [
            ".hk-date-tag",
            ".hk-date-tag__seg",
            ".hk-date-tag__seg--year",
            ".hk-date-tag__seg--time",
            ".hk-date-tag__sep",
        ] {
            assert!(css.contains(needle), "missing {needle} in date-tag css");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored date-tag sheet"
        );
    }
}
