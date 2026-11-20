//! Localized date vocabulary: month names, weekday names, and the first day of
//! the week, for the eleven [`Language`] values.
//!
//! # Why a generated table instead of a date library
//!
//! The Rust components used to take their names from `chrono`'s
//! `unstable-locales` data, which is glibc's `LC_TIME`. The Vue components
//! derive the same names from `Intl` at runtime, i.e. from CLDR. The two data
//! sets disagree — 154 cells across the eleven languages when measured, from
//! letter case and abbreviation style down to a Russian genitive/nominative
//! split — so the same locale rendered differently depending on which half of
//! the design system drew the calendar.
//!
//! The table is generated from CLDR by `scripts/gen-date-names.mjs` and frozen
//! in `names.golden.toml`; `tests/date_vocabulary_tests.rs` fails when the compiled
//! table and the golden snapshot drift apart, so a CLDR change has to be
//! reviewed as the user-visible text change it is.
//!
//! # Standalone vs format shapes
//!
//! CLDR carries two shapes of the same name. *Standalone* is the bare name,
//! for places where it stands on its own — a month header ("октябрь 2024").
//! *Format* is the shape a name takes inside a composed date ("6 октября
//! 2024"). glibc only provided the second, which is why a standalone month
//! header used to read "октября 2024" in Russian. Pick by use site:
//!
//! - a month header / a month picker → [`DateVocabulary::month_long_standalone`]
//! - inside a composed date (trigger text, day cell, aria-label) →
//!   [`DateVocabulary::month_long_format`] / [`DateVocabulary::month_short_format`]
//!
//! # Weekdays are Sunday-first
//!
//! Weekday arrays are indexed `0 = Sunday … 6 = Saturday` — the same numbering
//! a JavaScript `Date#getDay()` answers and the numbering
//! [`DateVocabulary::first_weekday`] uses, so a grid can be laid out without a
//! conversion table.

use crate::Language;

mod names;

/// The date vocabulary of one language.
///
/// The arrays are fixed-size by construction (12 months, 7 weekdays); the
/// accessors are total and answer `""` for an out-of-range index rather than
/// panicking, because the callers work on already-validated dates and an empty
/// label degrades better than a trap in a render path.
#[derive(Debug)]
pub struct DateVocabulary {
    /// Which language this row belongs to (`Language::ALL` covers all of them).
    pub language: Language,
    /// First day of the week: `0 = Sunday … 6 = Saturday`.
    pub first_weekday: u32,
    month_short: &'static [&'static str],
    month_long: &'static [&'static str],
    month_short_fmt: &'static [&'static str],
    month_long_fmt: &'static [&'static str],
    weekday_short: &'static [&'static str],
    weekday_long: &'static [&'static str],
    weekday_narrow: &'static [&'static str],
}

/// Months per row — `tests/date_vocabulary_tests.rs` pins the generated rows to
/// this length, so a truncated table cannot pass as a shorter month list.
const MONTHS: usize = 12;
/// Weekdays per row — pinned by the same guard.
const WEEKDAYS: usize = 7;

impl DateVocabulary {
    /// Abbreviated month name for a bare month (a picker cell, a chart axis).
    pub fn month_short_standalone(&self, month: u32) -> &'static str {
        pick(self.month_short, month_index(month))
    }

    /// Full month name for a bare month — the calendar header ("октябрь 2024").
    pub fn month_long_standalone(&self, month: u32) -> &'static str {
        pick(self.month_long, month_index(month))
    }

    /// Abbreviated month name inside a composed date ("6 окт. 2024").
    pub fn month_short_format(&self, month: u32) -> &'static str {
        pick(self.month_short_fmt, month_index(month))
    }

    /// Full month name inside a composed date ("6 октября 2024").
    pub fn month_long_format(&self, month: u32) -> &'static str {
        pick(self.month_long_fmt, month_index(month))
    }

    /// Abbreviated weekday name, `0 = Sunday`.
    pub fn weekday_short(&self, weekday: u32) -> &'static str {
        pick(self.weekday_short, weekday_index(weekday))
    }

    /// Full weekday name, `0 = Sunday`.
    pub fn weekday_long(&self, weekday: u32) -> &'static str {
        pick(self.weekday_long, weekday_index(weekday))
    }

    /// Single-letter weekday name (CLDR's disambiguated narrow form, e.g. `X`
    /// for Wednesday in Spanish — not the first letter of the abbreviation).
    pub fn weekday_narrow(&self, weekday: u32) -> &'static str {
        pick(self.weekday_narrow, weekday_index(weekday))
    }

    /// The localized weekday names of a grid, rotated so the locale's first day
    /// comes first. `narrow` picks CLDR's narrow forms over the abbreviations.
    pub fn weekday_labels(&self, narrow: bool) -> Vec<&'static str> {
        (0..WEEKDAYS as u32)
            .map(|offset| {
                let weekday = (self.first_weekday + offset) % WEEKDAYS as u32;
                if narrow {
                    self.weekday_narrow(weekday)
                } else {
                    self.weekday_short(weekday)
                }
            })
            .collect()
    }
}

/// 1-based month → 0-based array index, `None` outside `1..=12`.
fn month_index(month: u32) -> Option<usize> {
    (1..=MONTHS as u32)
        .contains(&month)
        .then(|| (month - 1) as usize)
}

/// 0-based Sunday-first weekday → array index, `None` outside `0..=6`.
fn weekday_index(weekday: u32) -> Option<usize> {
    (weekday < WEEKDAYS as u32).then_some(weekday as usize)
}

fn pick(row: &'static [&'static str], index: Option<usize>) -> &'static str {
    index
        .and_then(|index| row.get(index).copied())
        .unwrap_or("")
}

/// Every vocabulary row, in `Language::ALL` order.
///
/// The guard tests walk this (so a table row without a language, or a language
/// without a row, is visible); UI code should call [`date_vocabulary`].
pub fn all_vocabularies() -> &'static [DateVocabulary] {
    names::VOCABULARIES
}

/// The vocabulary of `language`.
///
/// `Language` is `#[non_exhaustive]`, so a language added upstream compiles
/// through here and keeps the English row until a generator run adds its own —
/// the same fallback shape the components had before the table existed.
pub fn date_vocabulary(language: Language) -> &'static DateVocabulary {
    names::VOCABULARIES
        .iter()
        .find(|vocabulary| vocabulary.language == language)
        .unwrap_or_else(|| {
            names::VOCABULARIES
                .first()
                .expect("the date vocabulary table is never empty")
        })
}
