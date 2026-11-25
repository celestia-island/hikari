//! Guards for the generated date vocabulary.
//!
//! `src/dates/names.rs` is a build product of `scripts/gen-date-names.ts`;
//! `src/dates/names.golden.toml` is the frozen CLDR snapshot it came from. Two
//! failure modes matter, and they are the two directions of that pair:
//!
//! 1. **A hand edit of the table.** Someone "fixes" a month name in `names.rs`
//!    without touching the snapshot — the components then render a string no
//!    generator run can reproduce. [`vocabulary_matches_the_frozen_cldr_snapshot`]
//!    compares every cell of every locale and names the offending cell.
//! 2. **A silent CLDR drift.** A Node/ICU bump changes the snapshot, and with it
//!    the text users see. That diff is legitimate but must be reviewed as a UI
//!    change; the snapshot pins it, and regeneration is the only way to move it.
//!    (The comparison above goes red for the intermediate states, and for the
//!    final one the diff itself is the review artefact.)
//!
//! [`every_language_has_a_complete_vocabulary`] covers the shape side: one row
//! per `Language`, twelve months and seven weekdays per shape, nothing empty and
//! no index out of range. [`weekday_labels_rotate_from_the_locales_first_day`]
//! and [`out_of_range_indexes_answer_empty`] pin the two behaviours the accessors
//! promise (rotation and totality) so a caller can rely on them.

use std::collections::BTreeMap;

use hikari_i18n::Language;
use hikari_i18n::dates::{DateVocabulary, all_vocabularies, date_vocabulary};

/// The frozen CLDR snapshot — the same file the generator writes.
const GOLDEN: &str = include_str!("../src/dates/names.golden.toml");

/// One row of the snapshot, as TOML values.
struct GoldenRow {
    first_weekday: u32,
    shapes: BTreeMap<&'static str, Vec<String>>,
}

/// Reads one name out of a vocabulary: months are 1-based, weekdays 0-based.
type NameAccessor = fn(&DateVocabulary, u32) -> &'static str;

/// The seven name shapes, keyed exactly as the generator emits them.
const SHAPES: [(&str, NameAccessor); 7] = [
    ("month_short", DateVocabulary::month_short_standalone),
    ("month_long", DateVocabulary::month_long_standalone),
    ("month_short_fmt", DateVocabulary::month_short_format),
    ("month_long_fmt", DateVocabulary::month_long_format),
    ("weekday_short", DateVocabulary::weekday_short),
    ("weekday_long", DateVocabulary::weekday_long),
    ("weekday_narrow", DateVocabulary::weekday_narrow),
];

fn golden() -> BTreeMap<String, GoldenRow> {
    // R3's M12: an extra `[xx]` section appended to the snapshot used to pass
    // every test, because the guard only walks `Language::ALL`.
    let document: toml::Value = toml::from_str(GOLDEN).expect("names.golden.toml parses as TOML");
    assert_eq!(
        document.as_table().map(toml::map::Map::len),
        Some(Language::ALL.len()),
        "the snapshot must carry exactly one row per Language — no extra section, none missing"
    );
    assert_eq!(
        SHAPES.len(),
        7,
        "every name shape must be compared; a shape missing here is a shape unguarded"
    );
    let document: toml::Value = toml::from_str(GOLDEN).expect("names.golden.toml parses as TOML");
    let table = document
        .as_table()
        .expect("the snapshot is a table of locales");
    table
        .iter()
        .map(|(code, value)| {
            let row = value
                .as_table()
                .unwrap_or_else(|| panic!("{code}: snapshot row is a table"));
            let first_weekday = row
                .get("first_weekday")
                .and_then(toml::Value::as_integer)
                .unwrap_or_else(|| panic!("{code}: missing integer first_weekday"));
            let shapes = SHAPES
                .iter()
                .map(|(shape, _)| {
                    let values = row
                        .get(*shape)
                        .and_then(toml::Value::as_array)
                        .unwrap_or_else(|| panic!("{code}: missing array {shape}"))
                        .iter()
                        .map(|value| {
                            value
                                .as_str()
                                .unwrap_or_else(|| panic!("{code}.{shape}: entry is not a string"))
                                .to_string()
                        })
                        .collect();
                    (*shape, values)
                })
                .collect();
            // R4's mutation added a `month_narrow` shape to the table, the
            // golden and `DateVocabulary`: every test stayed green because the
            // guard walks SHAPES, never the row's own keys. Pin the key set.
            let expected_keys: std::collections::BTreeSet<&str> =
                SHAPES.iter().map(|(shape, _)| *shape).collect();
            let actual_keys: std::collections::BTreeSet<&str> = row
                .keys()
                .map(String::as_str)
                .filter(|key| *key != "first_weekday")
                .collect();
            assert_eq!(
                actual_keys, expected_keys,
                "{code}: the snapshot carries shapes this guard does not compare"
            );
            (
                code.clone(),
                GoldenRow {
                    first_weekday: u32::try_from(first_weekday)
                        .unwrap_or_else(|_| panic!("{code}: first_weekday out of range")),
                    shapes,
                },
            )
        })
        .collect()
}

#[test]
fn vocabulary_matches_the_frozen_cldr_snapshot() {
    let snapshot = golden();
    let mut mismatches: Vec<String> = Vec::new();

    for language in Language::ALL {
        let code = language.code();
        let Some(row) = snapshot.get(code) else {
            mismatches.push(format!("{code}: no row in the snapshot"));
            continue;
        };
        let vocabulary = date_vocabulary(*language);

        if vocabulary.language != *language {
            mismatches.push(format!(
                "{code}: table row claims to be {:?}",
                vocabulary.language
            ));
        }
        if vocabulary.first_weekday != row.first_weekday {
            mismatches.push(format!(
                "{code}.first_weekday: table {} != snapshot {}",
                vocabulary.first_weekday, row.first_weekday
            ));
        }

        for (shape, accessor) in SHAPES {
            let expected = &row.shapes[shape];
            let months = shape.starts_with("month");
            // Pin the snapshot row's length: the loop below iterates the
            // snapshot, so a truncated row would otherwise leave the table's
            // tail cells uncompared and still pass.
            assert_eq!(
                expected.len(),
                if months { 12 } else { 7 },
                "{code}.{shape}: snapshot row is truncated or over-long"
            );
            for (index, want) in expected.iter().enumerate() {
                // Months are 1-based, weekdays 0-based — the accessors' contract.
                let key = if months {
                    (index + 1) as u32
                } else {
                    index as u32
                };
                let got = accessor(vocabulary, key);
                if got != want {
                    mismatches.push(format!(
                        "{code}.{shape}[{index}]: table {got:?} != snapshot {want:?}"
                    ));
                }
            }
        }
    }

    assert!(
        mismatches.is_empty(),
        "the compiled date vocabulary drifted from the frozen CLDR snapshot \
         (regenerate with `node scripts/gen-date-names.ts` and review the diff):\n{}",
        mismatches.join("\n")
    );
}

#[test]
fn every_language_has_a_complete_vocabulary() {
    let rows = all_vocabularies();
    assert_eq!(
        rows.len(),
        Language::ALL.len(),
        "one date-vocabulary row per Language, no more, no less"
    );

    for (index, language) in Language::ALL.iter().enumerate() {
        let vocabulary = date_vocabulary(*language);
        assert_eq!(
            vocabulary.language,
            *language,
            "{:?} resolves its own row",
            language.code()
        );
        // `all_vocabularies()` promises `Language::ALL` order; a reordered
        // generator or enum would otherwise diverge from its doc silently.
        assert_eq!(
            rows[index].language,
            *language,
            "all_vocabularies()[{index}] must be {:?}",
            language.code()
        );
        assert!(
            vocabulary.first_weekday < 7,
            "{}: first_weekday must be 0..=6",
            language.code()
        );

        for (shape, accessor) in SHAPES {
            let count = if shape.starts_with("month") { 12 } else { 7 };
            for index in 0..count {
                let key = if shape.starts_with("month") {
                    index + 1
                } else {
                    index
                };
                let name = accessor(vocabulary, key);
                assert!(
                    !name.trim().is_empty(),
                    "{}.{shape}[{index}] is empty",
                    language.code()
                );
                assert_eq!(
                    name,
                    name.trim(),
                    "{}.{shape}[{index}] has surrounding whitespace ({name:?}) — glibc data \
                     used to carry it, CLDR data must not",
                    language.code()
                );
            }
        }
    }
}

#[test]
fn weekday_labels_rotate_from_the_locales_first_day() {
    for language in Language::ALL {
        let vocabulary = date_vocabulary(*language);
        let labels = vocabulary.weekday_labels(false);
        assert_eq!(
            labels.len(),
            7,
            "{}: a week has seven labels",
            language.code()
        );
        assert_eq!(
            labels[0],
            vocabulary.weekday_short(vocabulary.first_weekday),
            "{}: the grid starts at the locale's first weekday",
            language.code()
        );
        // A rotation, not a truncation: seven DISTINCT names. Replacing the
        // `% 7` with `% 6` yields Sun..Fri plus a repeated Sunday and used to
        // keep every test green.
        let mut distinct = labels.clone();
        distinct.sort_unstable();
        distinct.dedup();
        assert_eq!(
            distinct.len(),
            7,
            "{}: the labels are a rotation of seven distinct weekdays",
            language.code()
        );

        // The same rotation contract for the narrow forms. Narrow names are
        // NOT all distinct per language (German is S/M/D/M/D/F/S — only four
        // letters), so this compares against the seven-step rotation spelled
        // out with `% 7` rather than counting distinct labels: a `% 6` in the
        // implementation produced Sun..Fri plus a repeated Sunday and stayed
        // green before this assertion existed.
        let narrow = vocabulary.weekday_labels(true);
        let expected_narrow: Vec<&str> = (0..7u32)
            .map(|offset| vocabulary.weekday_narrow((vocabulary.first_weekday + offset) % 7))
            .collect();
        assert_eq!(
            narrow,
            expected_narrow,
            "{}: narrow labels are the seven-step rotation from the first weekday",
            language.code()
        );
        assert_eq!(
            narrow[0],
            vocabulary.weekday_narrow(vocabulary.first_weekday)
        );
        // The narrow forms come from CLDR, not from truncating the abbreviation
        // (Spanish Wednesday is `X`, not `m` — `m` would collide with Tuesday).
        assert!(
            vocabulary
                .weekday_narrow((vocabulary.first_weekday + 2) % 7)
                .chars()
                .count()
                <= 2,
            "{}: narrow weekday names stay short",
            language.code()
        );
    }
}

#[test]
fn out_of_range_indexes_answer_empty() {
    let vocabulary = date_vocabulary(Language::English);
    assert_eq!(vocabulary.month_long_standalone(0), "");
    assert_eq!(vocabulary.month_long_standalone(13), "");
    assert_eq!(vocabulary.weekday_short(7), "");
    assert_eq!(vocabulary.month_short_format(0), "");
    assert_eq!(vocabulary.month_long_format(99), "");
}
