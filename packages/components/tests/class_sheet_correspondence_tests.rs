//! Class ↔ sheet correspondence guards.
//!
//! Keeps the class names a legacy component emits (palette `*Class`
//! enums rendered through `UtilityClass::as_class()`, `hk-` prefixed) in
//! bidirectional correspondence with the atoms its stylesheet styles.
//!
//! Why this exists: the `Sort` family shipped fully unstyled from
//! genesis (2026-05, commit `0879fec1`) until 2026-11 — the sheet was
//! written against one name set (`hk-sort-trigger/-icon/-clear-btn`,
//! modeled after the filter family) while the component emitted another
//! (`hk-sort-button/-title/-indicator/-clear…`). Both sides compiled,
//! all existing tests stayed green, and no rule ever matched a real DOM
//! node; the component rendered as bare UA buttons the whole time. This
//! guard makes that drift fail CI the day any of the three legs is
//! touched: sheet↔hand-written emission list, emission list↔palette
//! enum, and component render→DOM classes.
//!
//! Adding a pair: fix any drift first, then append to `pairs()`. A name
//! that is deliberately on only one side (emitted-but-unstyled, or
//! styled-but-never-emitted state/layout classes) goes into that pair's
//! `whitelist` **with a reason** — the whitelist is how known-dead API
//! surfaces stay recorded next to the guard that watches them.
//!
//! Known dormant surfaces NOT covered by a pair yet (no sheet exists /
//! alignment unverified): `FilterClass` (no `filter.scss`; the
//! `FilterIcon`/`FilterClearBtn` variants are emitted by no component
//! and styled by no sheet) and `PaginationClass` (sheet carries many
//! state/size atoms whose emission path is not enum-driven;
//! correspondence unverified — 2026-11 sort-class-drift wave ledger).

use hikari_components::data::ColumnDef;
use hikari_components::data::{Sort, SortDirection, SortProps};
use hikari_palette::classes::UtilityClass;
use hikari_palette::classes::components::data::SortClass;
use std::collections::BTreeSet;

const SORT_SHEET: &str = include_str!("../src/styles/components/sort.scss");

/// One component family: the classes it emits vs the sheet it ships.
struct Pair {
    component: &'static str,
    sheet: &'static str,
    /// Hand-written `as_class()` literals — deliberately NOT derived from
    /// the enum here, so the sync test below has a side to compare against.
    emitted: Vec<&'static str>,
    /// (`name`, reason) for names deliberately on only one side.
    whitelist: &'static [(&'static str, &'static str)],
}

fn pairs() -> Vec<Pair> {
    vec![Pair {
        component: "sort",
        sheet: SORT_SHEET,
        emitted: vec![
            "hk-sort",
            "hk-sort-button",
            "hk-sort-active",
            "hk-sort-clear",
            "hk-sort-title",
            "hk-sort-indicator",
            "hk-sort-clear-text",
            "hk-sort-clear-icon",
        ],
        whitelist: &[],
    }]
}

/// Extract every `.hk-<name>` atom from a stylesheet source.
///
/// Nested SCSS (`&:hover` inside `.hk-sort-clear`) and descendant
/// selectors both contribute their atoms. Scans comments too — keep
/// `.hk-…` literals out of sheet comments (or whitelist them).
fn sheet_atoms(sheet: &str) -> BTreeSet<String> {
    let bytes = sheet.as_bytes();
    let mut atoms = BTreeSet::new();
    let mut i = 0;
    while i + 4 <= bytes.len() {
        if &bytes[i..i + 4] == b".hk-" {
            let mut j = i + 4;
            while j < bytes.len()
                && (bytes[j].is_ascii_lowercase() || bytes[j].is_ascii_digit() || bytes[j] == b'-')
            {
                j += 1;
            }
            let atom = sheet[i + 1..j].trim_end_matches('-').to_string();
            if !atom.is_empty() {
                atoms.insert(atom);
            }
            i = j;
        } else {
            i += 1;
        }
    }
    atoms
}

#[test]
fn emitted_classes_match_their_sheets_in_both_directions() {
    for pair in pairs() {
        let atoms: BTreeSet<String> = sheet_atoms(pair.sheet);
        let emitted: BTreeSet<String> = pair.emitted.iter().map(|s| (*s).to_string()).collect();
        let allow: BTreeSet<&str> = pair.whitelist.iter().map(|(n, _)| *n).collect();

        let styled_but_never_emitted: Vec<&String> = atoms
            .iter()
            .filter(|a| !emitted.contains(*a) && !allow.contains(a.as_str()))
            .collect();
        assert!(
            styled_but_never_emitted.is_empty(),
            "{} sheet styles classes no component emits (drift): {:?}\n\
             fix: rename the selectors to the emitted names, or whitelist with a reason",
            pair.component,
            styled_but_never_emitted
        );

        let emitted_but_never_styled: Vec<&String> = emitted
            .iter()
            .filter(|c| !atoms.contains(*c) && !allow.contains(c.as_str()))
            .collect();
        assert!(
            emitted_but_never_styled.is_empty(),
            "{} emits classes its sheet never styles (drift): {:?}\n\
             fix: add rules for the emitted names, or whitelist with a reason",
            pair.component,
            emitted_but_never_styled
        );
    }
}

#[test]
fn sheet_atom_scanner_handles_nesting_and_descendants() {
    // Positive control: the scanner must see atoms through SCSS nesting,
    // descendant selectors and selector lists.
    let atoms = sheet_atoms(
        ".hk-a {\n  &:hover { color: red; }\n  .hk-b { .hk-c {} }\n}\n.d-hk-x { color: blue; }\n",
    );
    assert_eq!(
        atoms,
        BTreeSet::from(["hk-a".into(), "hk-b".into(), "hk-c".into()]),
        "scanner missed atoms or matched non-selector `.hk-` text (`.d-hk-x`)"
    );

    // Negative control: without the leading dot nothing is collected
    // (values like `var(--hk-x)` must not pollute the atom set).
    assert!(sheet_atoms("color: var(--hk-x); /* hk-y */").is_empty());
}

#[test]
fn sort_emission_list_stays_in_sync_with_the_palette_enum() {
    // The `emitted` list in `pairs()` is hand-written literals on
    // purpose (it documents the API surface, and a renamed variant then
    // fails here first with a readable diff). This test pins the list to
    // the enum so the two cannot drift apart silently.
    let from_enum: Vec<String> = SortClass::all().iter().map(|c| c.as_class()).collect();
    let in_pairs: Vec<String> = pairs()[0]
        .emitted
        .iter()
        .map(|s| (*s).to_string())
        .collect();
    assert_eq!(
        in_pairs, from_enum,
        "SortClass variants changed — update the sort pair in pairs()"
    );
}

/// Collect every class-attribute token from rendered HTML, split on
/// whitespace. Token-exact: the class `hk-sort-button` never satisfies a
/// check for `hk-sort` — bare substring matching would let a deleted
/// container/clear emission site hide behind its own children's names.
fn html_class_tokens(html: &str) -> BTreeSet<String> {
    let mut tokens = BTreeSet::new();
    let mut rest = html;
    while let Some(pos) = rest.find("class=\"") {
        let start = pos + "class=\"".len();
        let Some(end) = rest[start..].find('"') else {
            break;
        };
        for token in rest[start..start + end].split_whitespace() {
            tokens.insert(token.to_string());
        }
        rest = &rest[start + end..];
    }
    tokens
}

#[test]
fn sort_renders_every_emitted_class_into_the_dom() {
    // The component→DOM leg: deleting any emission site in the Sort view
    // must red here, even though the enum↔sheet pin above stays green.
    // Assertion is token-exact (see html_class_tokens), so no needle can
    // be satisfied by another class it is a prefix of.
    let props = SortProps {
        column: "name".to_string(),
        direction: SortDirection::Ascending,
        columns: vec![ColumnDef {
            column_key: "name".to_string(),
            title: "Name".to_string(),
            sortable: true,
            ..Default::default()
        }],
        ..Default::default()
    };
    let html = Sort(props).render_to_html();
    let tokens = html_class_tokens(&html);
    for needle in pairs()[0].emitted.clone() {
        assert!(
            tokens.contains(needle),
            "class token missing {needle}: {html}"
        );
    }
}

// Compile-time exhaustiveness probe: this match has no wildcard arm, so
// adding a `SortClass` variant without updating this file fails to
// compile and drags the author into the guard that must be extended.
// Keeping the arm bodies as the literal class names also gives a readable
// diff when a suffix is renamed.
#[allow(dead_code)]
fn sort_class_exhaustiveness_probe(class: SortClass) -> &'static str {
    match class {
        SortClass::Sort => "hk-sort",
        SortClass::SortButton => "hk-sort-button",
        SortClass::SortActive => "hk-sort-active",
        SortClass::SortClear => "hk-sort-clear",
        SortClass::SortTitle => "hk-sort-title",
        SortClass::SortIndicator => "hk-sort-indicator",
        SortClass::SortClearText => "hk-sort-clear-text",
        SortClass::SortClearIcon => "hk-sort-clear-icon",
    }
}
