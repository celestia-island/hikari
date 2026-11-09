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
//! 2026-11 guard-promotion wave: the live filter family (four mirrored
//! sheets, hand-written emission) and pagination joined as pairs, and
//! the `FilterClass` palette enum is pinned as a recorded dormant API
//! (see `filter_class_enum_is_a_recorded_dormant_api`). Four live
//! emitted-but-unstyled names are whitelisted with reasons — the styling
//! direction call is registered in the ledger, not smuggled in here.

use hikari_components::data::ColumnDef;
use hikari_components::data::{Sort, SortDirection, SortProps};
use hikari_palette::classes::UtilityClass;
use hikari_palette::classes::components::data::{FilterClass, PaginationClass, SortClass};
use std::collections::BTreeSet;

const SORT_SHEET: &str = include_str!("../src/styles/components/sort.scss");
const PAGINATION_SHEET: &str = include_str!("../src/styles/components/pagination.scss");
const FILTER_BAR_SHEET: &str = include_str!("../src/styles/vue-mirror/components/HkFilterBar.scss");
const FILTER_CHIP_SHEET: &str =
    include_str!("../src/styles/vue-mirror/components/HkFilterChip.scss");
const FILTER_PANEL_SHEET: &str =
    include_str!("../src/styles/vue-mirror/components/HkFilterPanel.scss");
const FILTER_TRIGGER_SHEET: &str =
    include_str!("../src/styles/vue-mirror/components/HkFilterTrigger.scss");

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
    vec![
        Pair {
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
        },
        Pair {
            component: "filter_bar",
            sheet: FILTER_BAR_SHEET,
            emitted: vec![
                "hk-filter-bar",
                "hk-filter-bar-actions",
                "hk-filter-bar-count",
                "hk-filter-bar-fields",
                "hk-filter-bar-panel",
                "hk-filter-bar-footer",
                "hk-filter-bar-popover",
            ],
            whitelist: &[
                (
                    "hk-btn-ghost",
                    "cross-family emission, styled by the shared HkButton sheet",
                ),
                (
                    "hk-btn-primary",
                    "cross-family emission, styled by the shared HkButton sheet",
                ),
            ],
        },
        Pair {
            component: "filter_chip",
            sheet: FILTER_CHIP_SHEET,
            emitted: vec![
                "hk-filter-chip",
                "hk-filter-chip-text",
                "hk-filter-chip-anchor",
                "hk-filter-chip-body",
                "hk-filter-chip-caret",
                "hk-filter-chip-hint",
                "hk-filter-chip--on",
            ],
            whitelist: &[
                (
                    "hk-filter-chip-text",
                    "emitted on both sides (rs + vue twin), styled by no sheet — recorded live drift, styling is a pending direction call (2026-11-09 ledger)",
                ),
                (
                    "hk-filter-chip--on",
                    "selected-state marker emitted on both sides, styled by no sheet — recorded live drift, styling is a pending direction call (2026-11-09 ledger)",
                ),
                (
                    "hk-pill-group",
                    "cross-family emission, styled by the shared HkPillToggleGroup sheet",
                ),
                (
                    "hk-pill-group-pill",
                    "cross-family emission, styled by the shared HkPillToggleGroup sheet",
                ),
                (
                    "hk-pill-group-icon",
                    "cross-family emission, styled by the shared HkPillToggleGroup sheet",
                ),
            ],
        },
        Pair {
            component: "filter_panel",
            sheet: FILTER_PANEL_SHEET,
            emitted: vec![
                "hk-filter-panel",
                "hk-filter-panel-row",
                "hk-filter-panel-ops",
                "hk-filter-panel-op",
                "hk-filter-panel-value",
                "hk-filter-panel-control",
                "hk-filter-panel-remove",
                "hk-filter-panel-addrow",
                "hk-filter-panel-add",
                "hk-filter-panel-field",
                "hk-filter-add-list",
                "hk-filter-add-item",
                "hk-filter-add-item-label",
                "hk-filter-add-content",
            ],
            whitelist: &[
                (
                    "hk-filter-add-item-label",
                    "emitted on both sides (rs + vue twin), styled by no sheet — recorded live drift, styling is a pending direction call (2026-11-09 ledger)",
                ),
                (
                    "hk-filter-add-viewport",
                    "styled; emitted only by the vue twin HkFilterPanel.tsx (HkScrollContainer wrapper), not by the rust component",
                ),
                (
                    "hk-is-sheet",
                    "comment mention of the shared sheet token context, not a selector (scanner reads comments)",
                ),
                (
                    "hk-scroll-container-viewport",
                    "descendant styling of the shared HkScrollContainer viewport inside the panel",
                ),
            ],
        },
        Pair {
            component: "filter_trigger",
            sheet: FILTER_TRIGGER_SHEET,
            emitted: vec![
                "hk-filter-trigger",
                "hk-filter-trigger-body",
                "hk-filter-trigger-footer",
            ],
            whitelist: &[
                (
                    "hk-filter-trigger-body",
                    "emitted on both sides (rs + vue twin), styled by no sheet — recorded live drift, styling is a pending direction call (2026-11-09 ledger)",
                ),
                (
                    "hk-icon-button-icon",
                    "cross-family emission, styled by the shared HkIconButton sheet",
                ),
                (
                    "hk-corner-badge-anchor",
                    "cross-family emission, styled by the shared HkCornerBadge sheet",
                ),
                (
                    "hk-corner-badge--dot",
                    "cross-family emission, styled by the shared HkCornerBadge sheet",
                ),
                (
                    "hk-filter-panel",
                    "cross-component embed, guarded by the filter_panel pair",
                ),
                (
                    "hk-filter-panel-row",
                    "cross-component embed, guarded by the filter_panel pair",
                ),
                (
                    "hk-filter-panel-add",
                    "cross-component embed, guarded by the filter_panel pair",
                ),
            ],
        },
        Pair {
            component: "pagination",
            sheet: PAGINATION_SHEET,
            emitted: vec![
                "hk-pagination",
                "hk-pagination-total",
                "hk-pagination-sizer",
                "hk-pagination-pages",
                "hk-pagination-item",
                "hk-pagination-prev",
                "hk-pagination-next",
                "hk-pagination-active",
            ],
            // The sheet is the legacy full chrome (modes, sizes, jump
            // UI, state atoms). The rust component is the simple core;
            // nothing applies the mode/size wrappers today (2026-11-09
            // census across hikari + chest found zero appliers).
            whitelist: &[
                (
                    "hk-pagination-sizer",
                    "emitted by the rust component, styled by no sheet — the sheet carries the -size-selector family instead; recorded live drift, naming divergence pending (2026-11-09 ledger)",
                ),
                (
                    "hk-pagination-ellipsis",
                    "styled; enum variant exists, emission pending",
                ),
                (
                    "hk-pagination-jump",
                    "styled; enum variant exists, emission pending (the component only builds jump-* DOM ids)",
                ),
                (
                    "hk-pagination-jumper",
                    "styled; no emitter — reserved jump UI",
                ),
                (
                    "hk-pagination-jumper-button",
                    "styled; no emitter — reserved jump UI",
                ),
                (
                    "hk-pagination-jumper-input",
                    "styled; no emitter — reserved jump UI",
                ),
                (
                    "hk-pagination-jumper-invalid",
                    "styled; no emitter — reserved jump UI",
                ),
                (
                    "hk-pagination-jumper-label",
                    "styled; enum variant PaginationJumpLabel maps here since the 2026-11 promotion wave, emission pending",
                ),
                (
                    "hk-pagination-first",
                    "styled; no emitter — reserved chrome",
                ),
                ("hk-pagination-last", "styled; no emitter — reserved chrome"),
                (
                    "hk-pagination-left",
                    "styled; no emitter — reserved alignment",
                ),
                (
                    "hk-pagination-right",
                    "styled; no emitter — reserved alignment",
                ),
                (
                    "hk-pagination-center",
                    "styled; no emitter — reserved alignment",
                ),
                (
                    "hk-pagination-animate",
                    "styled; no emitter — reserved mode",
                ),
                (
                    "hk-pagination-loading",
                    "styled; no emitter — reserved mode",
                ),
                (
                    "hk-pagination-compact",
                    "styled; no emitter — reserved mode",
                ),
                ("hk-pagination-simple", "styled; no emitter — reserved mode"),
                ("hk-pagination-lg", "styled; no emitter — reserved size"),
                ("hk-pagination-md", "styled; no emitter — reserved size"),
                ("hk-pagination-sm", "styled; no emitter — reserved size"),
                (
                    "hk-pagination-size-label",
                    "styled; no emitter — reserved size-selector chrome",
                ),
                (
                    "hk-pagination-size-select",
                    "styled; no emitter — reserved size-selector chrome",
                ),
                (
                    "hk-pagination-size-selector",
                    "styled; no emitter — reserved size-selector chrome",
                ),
                (
                    "hk-pagination-total-label",
                    "styled; no emitter — reserved total chrome",
                ),
                (
                    "hk-pagination-total-highlight",
                    "styled; no emitter — reserved total chrome",
                ),
                (
                    "hk-pagination-total-separator",
                    "styled; no emitter — reserved total chrome",
                ),
            ],
        },
    ]
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

/// The `FilterClass` palette enum is a recorded dormant API: it predates
/// the live filter family (filter_bar/chip/panel/trigger above), nothing
/// emits it, and only its `filter-trigger` name coincides with a live
/// atom. This test keeps that state honest: if someone starts emitting
/// the enum they must give it a real sheet + pair (or migrate to the
/// live families), and a rename on either side of the coinciding name
/// flags here instead of silently splitting the two surfaces.
#[test]
fn filter_class_enum_is_a_recorded_dormant_api() {
    let live_atoms: BTreeSet<String> = [
        FILTER_BAR_SHEET,
        FILTER_CHIP_SHEET,
        FILTER_PANEL_SHEET,
        FILTER_TRIGGER_SHEET,
    ]
    .iter()
    .flat_map(|sheet| sheet_atoms(sheet))
    .collect();

    let enum_classes: Vec<String> = FilterClass::all().iter().map(|c| c.as_class()).collect();

    // 16 of 17 names are styled by no live sheet — that is exactly the
    // recorded-dormant state; a new sheet or emitter must update this.
    let styled: Vec<String> = enum_classes
        .iter()
        .filter(|c| live_atoms.contains(*c))
        .cloned()
        .collect();
    assert_eq!(
        styled,
        vec!["hk-filter-trigger".to_string()],
        "FilterClass gained a second styled name — promote it to a real pair instead of extending this contract"
    );
}

#[test]
fn pagination_emission_stays_within_the_palette_enum() {
    let enum_classes: BTreeSet<String> = PaginationClass::all()
        .iter()
        .map(|c| c.as_class().to_string())
        .collect();
    for name in pairs()
        .iter()
        .find(|p| p.component == "pagination")
        .expect("pagination pair")
        .emitted
        .iter()
    {
        assert!(
            enum_classes.contains(*name),
            "pagination emits {name} outside the PaginationClass enum — add the variant (and keep this list in sync)"
        );
    }
}

/// Enum names the sheet deliberately does not style under the same
/// name. Each entry must carry its story in the pair whitelist above.
const PAGINATION_ENUM_DIVERGENCES: &[&str] = &["hk-pagination-sizer"];

#[test]
fn pagination_palette_enum_is_fully_styled_or_divergence_recorded() {
    let atoms = sheet_atoms(PAGINATION_SHEET);
    for class in PaginationClass::all().iter().map(|c| c.as_class()) {
        assert!(
            atoms.contains(&class.to_string())
                || PAGINATION_ENUM_DIVERGENCES.contains(&class.as_ref()),
            "PaginationClass::{class:?} has no sheet atom — style it, rename it, or record the divergence here and in the pair whitelist"
        );
    }
}

// Compile-time exhaustiveness probes (no wildcard arms): adding a
// variant without extending these matches fails to compile and drags
// the author into the guard that must be extended.
#[allow(dead_code)]
fn pagination_class_exhaustiveness_probe(class: PaginationClass) -> &'static str {
    match class {
        PaginationClass::Pagination => "hk-pagination",
        PaginationClass::PaginationTotal => "hk-pagination-total",
        PaginationClass::PaginationSizer => "hk-pagination-sizer",
        PaginationClass::PaginationPages => "hk-pagination-pages",
        PaginationClass::PaginationPrev => "hk-pagination-prev",
        PaginationClass::PaginationNext => "hk-pagination-next",
        PaginationClass::PaginationEllipsis => "hk-pagination-ellipsis",
        PaginationClass::PaginationItem => "hk-pagination-item",
        PaginationClass::PaginationActive => "hk-pagination-active",
        PaginationClass::PaginationJump => "hk-pagination-jump",
        PaginationClass::PaginationJumpLabel => "hk-pagination-jumper-label",
    }
}

#[allow(dead_code)]
fn filter_class_exhaustiveness_probe(class: FilterClass) -> &'static str {
    match class {
        FilterClass::Filter => "hk-filter",
        FilterClass::FilterContainer => "hk-filter-container",
        FilterClass::FilterTrigger => "hk-filter-trigger",
        FilterClass::FilterActive => "hk-filter-active",
        FilterClass::FilterIcon => "hk-filter-icon",
        FilterClass::FilterBadge => "hk-filter-badge",
        FilterClass::FilterDropdownIcon => "hk-filter-dropdown-icon",
        FilterClass::FilterDropdown => "hk-filter-dropdown",
        FilterClass::FilterHeader => "hk-filter-header",
        FilterClass::FilterTitle => "hk-filter-title",
        FilterClass::FilterClearBtn => "hk-filter-clear-btn",
        FilterClass::FilterOptions => "hk-filter-options",
        FilterClass::FilterOption => "hk-filter-option",
        FilterClass::FilterCheckbox => "hk-filter-checkbox",
        FilterClass::FilterLabel => "hk-filter-label",
        FilterClass::FilterFooter => "hk-filter-footer",
        FilterClass::FilterHint => "hk-filter-hint",
    }
}
