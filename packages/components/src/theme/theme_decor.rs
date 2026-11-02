// packages/components/src/theme/theme_decor.rs
// ThemeDecor — mirror of the canonical Vue `HkThemeDecor` (resolve a
// decor slot against the ambient theme and render whatever that theme
// registered for it — nothing more).
//
// STYLESHEET: none — upstream ships no sheet for this component (it
// renders NO element of its own; the resolved decor's root IS the node),
// so `styles()` is empty by convention (`basic::kbd` & co).
//
// DOM contract (the whole component):
//
//   {the resolved record's node, VERBATIM — no wrapper element, no
//    position, no placeholder}
//   <empty>                             (an unregistered slot renders
//                                        nothing at all — "this theme has
//                                        no tray" is a legitimate state)
//
// The component's contract is "content, never placement": it never sets
// `position` of its own (upstream guards the TSX/sheet sources against
// literal `position:` declarations — `themeDecorLayout.contract.test.ts`)
// and never wraps, so a slot inside a footer stays a child of that
// footer.
//
// The decor REGISTRY is host-owned (the wave ruling): Vue's module-level
// reactive table (`registerThemeDecor` / `themeDecorVersion`) and the
// ambient `useTheme().currentTheme` have no tairitsu analogues, so the
// host passes the registry snapshot and the theme id as props and
// re-renders on change — the resolution itself stays PURE below.
//
// Deltas vs Vue (documented, not accidental):
//   * A registration carries a `render` CALLBACK (host-built node)
//     instead of a Vue component reference: tairitsu has no component
//     metadata to introspect, so the `size`-declaration question
//     (`declaresSize`) is an explicit record field, and the callback
//     receives the effective forwarded size — prop assembly (registered
//     defaults + the host's `decorProps` overrides) happens inside it,
//     keeping Vue's precedence: an explicit `size` wins when the target
//     declares one, and is dropped (never leaked onto a DOM node) when it
//     does not.
//   * No reactivity: a registration landing after first render, or a
//     theme switch, re-resolves because the HOST re-renders with new
//     props (Vue tracks `themeDecorVersion` / `currentTheme` itself).
//   * The size ladder stays STRING-ONLY (`xs|sm|md|lg` and beyond) — the
//     upstream contract deliberately has no numeric size.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ThemeDecorComponent;

/// `"*"` — the wildcard theme id (level 2 of the resolution order).
pub const THEME_DECOR_WILDCARD: &str = "*";

/// The one accepted spelling of a slot name (Vue:
/// `THEME_DECOR_SLOT_PATTERN`, `^[a-z][a-z0-9.-]*$` — e.g.
/// `status.tray`, `placeholder.section`).
pub fn theme_decor_slot_is_valid(slot: &str) -> bool {
    let mut chars = slot.chars();
    match chars.next() {
        Some(first) if first.is_ascii_lowercase() => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '-')
        && !slot.is_empty()
}

/// Is this record's theme id the wildcard level?
pub fn theme_decor_is_wildcard(theme_id: &str) -> bool {
    theme_id == THEME_DECOR_WILDCARD
}

/// One registration (Vue: `ThemeDecorRegistration` + the builtin floor
/// flag from `registerThemeDecorBuiltin`). `PartialEq` is identity of the
/// render closure (the props DSL derives it on the registry vector).
#[derive(Clone, PartialEq)]
pub struct ThemeDecorRecord {
    /// Exact theme id, or `"*"` for the wildcard fallback.
    pub theme_id: String,
    /// The slot this registration serves.
    pub slot: String,
    /// The FLOOR level: below every theme id and below the wildcard
    /// (hikari's own defaults, never a level a host must fight).
    pub builtin: bool,
    /// Does the target declare a `size` prop (Vue: `declaresSize`)?
    pub declares_size: bool,
    /// Builds the decor node, receiving the effective forwarded size
    /// (`Some` only when the target declares one and the host asked).
    pub render: Callback<Option<String>, Element>,
}

/// Resolve a decor slot under a theme (Vue: `getThemeDecor`) — the exact
/// theme entry, then the `"*"` fallback, then the built-in floor, then
/// nothing. Levels 2 and 3 stay distinct on purpose.
pub fn theme_decor_resolve<'a>(
    records: &'a [ThemeDecorRecord],
    slot: &str,
    theme_id: &str,
) -> Option<&'a ThemeDecorRecord> {
    let in_slot = |record: &ThemeDecorRecord| record.slot == slot;
    records
        .iter()
        .find(|record| in_slot(record) && record.theme_id == theme_id && !record.builtin)
        .or_else(|| {
            records.iter().find(|record| {
                in_slot(record) && theme_decor_is_wildcard(&record.theme_id) && !record.builtin
            })
        })
        .or_else(|| {
            records
                .iter()
                .find(|record| in_slot(record) && record.builtin)
        })
}

/// The effective forwarded size (Vue: `forwarded.size`): the explicit
/// `size` lands on the target only when that target declares a `size`
/// prop; without the declaration the prop is dropped entirely (it never
/// leaks onto a DOM node as a stray attribute).
pub fn theme_decor_forwards_size(size: Option<&str>, target_declares_size: bool) -> Option<String> {
    match (size, target_declares_size) {
        (Some(size), true) => Some(size.to_string()),
        _ => None,
    }
}

#[define_props]
pub struct ThemeDecorProps {
    /// The decor slot to resolve (Vue: required, e.g. `status.tray`).
    #[default]
    pub slot: String,

    /// The ambient theme id (Vue: `useTheme().currentTheme`).
    #[default]
    pub theme_id: String,

    /// The registry snapshot (Vue: the module-level reactive table; the
    /// host re-renders on registration or theme change).
    #[default(Vec::new())]
    pub registry: Vec<ThemeDecorRecord>,

    /// Forwarded to the decor when its record declares a `size` prop
    /// (Vue: string-only ladder `xs|sm|md|lg`, default undefined).
    pub size: Option<String>,
}

#[component]
pub fn ThemeDecor(props: ThemeDecorProps) -> Element {
    let Some(record) = theme_decor_resolve(&props.registry, &props.slot, &props.theme_id) else {
        // An unregistered slot renders nothing at all — no placeholder
        // node, no throw.
        return empty_vnode();
    };
    let effective_size = theme_decor_forwards_size(props.size.as_deref(), record.declares_size);
    // The resolved node IS the tree: no wrapper, no placement.
    record.render.call(effective_size)
}

impl StyledComponent for ThemeDecorComponent {
    fn styles() -> &'static str {
        // Upstream ships no sheet for this component: it renders no
        // element of its own. An empty table, not an error; same
        // convention as `basic::kbd`.
        ""
    }

    fn name() -> &'static str {
        "theme-decor"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node_for(mark: &'static str) -> Callback<Option<String>, Element> {
        Callback::new(move |size: Option<String>| {
            let size = size.unwrap_or_else(|| "unset".to_string());
            rsx! {
                div { class: "decor-node", {format!("mark:{mark}:size:{size}")} }
            }
        })
    }

    fn record(theme_id: &str, slot: &str, mark: &'static str) -> ThemeDecorRecord {
        ThemeDecorRecord {
            theme_id: theme_id.to_string(),
            slot: slot.to_string(),
            builtin: false,
            declares_size: false,
            render: node_for(mark),
        }
    }

    #[test]
    fn theme_decor_defaults_match_the_vue_props() {
        let props = ThemeDecorProps::default();
        assert_eq!(props.slot, "");
        assert_eq!(props.theme_id, "");
        assert!(props.registry.is_empty());
        assert!(props.size.is_none());
    }

    #[test]
    fn theme_decor_slot_names_follow_the_vue_pattern() {
        assert!(theme_decor_slot_is_valid("status.tray"));
        assert!(theme_decor_slot_is_valid("placeholder.section"));
        assert!(theme_decor_slot_is_valid("a"));
        assert!(theme_decor_slot_is_valid("x-9.y-z"));
        // Uppercase, digits, underscores and a leading separator are all
        // rejected by the one accepted spelling.
        assert!(!theme_decor_slot_is_valid("Status.tray"));
        assert!(!theme_decor_slot_is_valid("1status"));
        assert!(!theme_decor_slot_is_valid(".tray"));
        assert!(!theme_decor_slot_is_valid("status_tray"));
        assert!(!theme_decor_slot_is_valid(""));
        assert!(theme_decor_is_wildcard(THEME_DECOR_WILDCARD));
        assert!(!theme_decor_is_wildcard("default"));
    }

    #[test]
    fn theme_decor_resolution_follows_the_vue_order() {
        let registry = vec![
            // Order in the table must not matter — the levels decide.
            record("*", "status.tray", "wildcard"),
            record("chest", "status.tray", "exact"),
            ThemeDecorRecord {
                theme_id: "*".to_string(),
                slot: "status.tray".to_string(),
                builtin: true,
                declares_size: false,
                render: node_for("builtin"),
            },
            record("chest", "other.slot", "wrong-slot"),
        ];
        // 1. The exact theme entry wins.
        let resolved = theme_decor_resolve(&registry, "status.tray", "chest");
        assert!(resolved.is_some());
        // 2. Without an exact entry the wildcard answers.
        let resolved = theme_decor_resolve(&registry, "status.tray", "brand");
        assert!(resolved.is_some());
        // 3. An unregistered slot renders nothing at all.
        assert!(theme_decor_resolve(&registry, "nobody.slot", "chest").is_none());
        // A registry with ONLY the floor still resolves through level 3.
        let floor_only = vec![ThemeDecorRecord {
            theme_id: "*".to_string(),
            slot: "status.tray".to_string(),
            builtin: true,
            declares_size: false,
            render: node_for("builtin"),
        }];
        assert!(theme_decor_resolve(&floor_only, "status.tray", "chest").is_some());
    }

    #[test]
    fn theme_decor_resolution_picks_the_level_winner_not_the_table_order() {
        // The exact entry sits LAST in the table: resolution is by level,
        // not by registration order.
        let registry = vec![record("*", "s", "wildcard"), record("brand", "s", "exact")];
        let resolved = theme_decor_resolve(&registry, "s", "brand").unwrap();
        // The record identity is observable through its render output.
        let html = resolved.render.call(None).render_to_html();
        assert!(html.contains("mark:exact"), "{html}");
        // And the wildcard serves every other theme.
        let resolved = theme_decor_resolve(&registry, "s", "other").unwrap();
        let html = resolved.render.call(None).render_to_html();
        assert!(html.contains("mark:wildcard"), "{html}");
    }

    #[test]
    fn theme_decor_size_forwarding_matches_the_vue_precedence() {
        // Declared target: the explicit size lands.
        assert_eq!(
            theme_decor_forwards_size(Some("md"), true),
            Some("md".to_string())
        );
        // Undeclared target: the prop is dropped, never leaked.
        assert_eq!(theme_decor_forwards_size(Some("md"), false), None);
        // No explicit size: nothing forwarded either way.
        assert_eq!(theme_decor_forwards_size(None, true), None);
        assert_eq!(theme_decor_forwards_size(None, false), None);
    }

    #[test]
    fn theme_decor_renders_the_resolved_node_with_no_wrapper() {
        let html = ThemeDecor(ThemeDecorProps {
            slot: "status.tray".to_string(),
            theme_id: "chest".to_string(),
            registry: vec![record("chest", "status.tray", "tray")],
            ..Default::default()
        })
        .render_to_html();
        // The resolved component's root IS the node the layout sees.
        assert!(html.starts_with(r#"<div class="decor-node">"#), "{html}");
        assert!(html.contains("mark:tray:size:unset"), "{html}");
        assert!(
            !html.contains("theme-decor"),
            "no wrapper, no placeholder: {html}"
        );
    }

    #[test]
    fn theme_decor_forwards_the_size_only_to_declaring_targets() {
        let registry = vec![ThemeDecorRecord {
            theme_id: "chest".to_string(),
            slot: "status.tray".to_string(),
            builtin: false,
            declares_size: true,
            render: node_for("tray"),
        }];
        let html = ThemeDecor(ThemeDecorProps {
            slot: "status.tray".to_string(),
            theme_id: "chest".to_string(),
            registry,
            size: Some("lg".to_string()),
        })
        .render_to_html();
        assert!(html.contains("size:lg"), "{html}");

        // An undeclaring target drops the very same prop.
        let registry = vec![record("chest", "status.tray", "tray")];
        let html = ThemeDecor(ThemeDecorProps {
            slot: "status.tray".to_string(),
            theme_id: "chest".to_string(),
            registry,
            size: Some("lg".to_string()),
        })
        .render_to_html();
        assert!(html.contains("size:unset"), "{html}");
    }

    #[test]
    fn theme_decor_renders_nothing_for_an_unregistered_slot() {
        let html = ThemeDecor(ThemeDecorProps {
            slot: "status.tray".to_string(),
            theme_id: "chest".to_string(),
            registry: vec![record("other", "status.tray", "tray")],
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "no placeholder node, no throw: {html:?}");
    }

    #[test]
    fn theme_decor_has_no_sheet() {
        assert_eq!(
            <ThemeDecorComponent as StyledComponent>::styles(),
            "",
            "the Vue decor ships no sheet; the mirror must invent none"
        );
        assert_eq!(
            <ThemeDecorComponent as StyledComponent>::name(),
            "theme-decor"
        );
    }
}
