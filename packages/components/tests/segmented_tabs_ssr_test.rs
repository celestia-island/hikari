//! SSR contract for the Rust `SegmentedTabs` component.
//!
//! The component exists so a server-built page shows the family's segmented
//! pill from the FIRST BYTE — the exact DOM the Vue `HkTabs` renders before
//! its measurement pass — instead of a hand-written look-alike that the boot
//! pass later swapped (the stale-pill flash on the docs diagram cards,
//! reported 2026-11-28). These pins hold the emitted markup to that contract;
//! the visual side is the vendored `HkTabs.scss` mirror, whose byte-fidelity
//! the mirror-drift suite already guards.

use hikari_components::navigation::{SegmentedTabOption, SegmentedTabs, SegmentedTabsProps};

fn render(props: SegmentedTabsProps) -> String {
    SegmentedTabs(props).render_to_html()
}

fn two_options() -> Vec<SegmentedTabOption> {
    vec![
        SegmentedTabOption {
            key: "preview".to_string(),
            label: "Preview".to_string(),
            attrs: vec![("data-pane".to_string(), "preview".to_string())],
            ..Default::default()
        },
        SegmentedTabOption {
            key: "source".to_string(),
            label: "Source".to_string(),
            attrs: vec![("data-pane".to_string(), "source".to_string())],
            ..Default::default()
        },
    ]
}

/// MUT:segmented-static-shape — diverging from the Vue pre-measurement DOM
/// (variant markers, radiogroup semantics, indicator node, aria-checked,
/// data-active, roving tabindex) never passes this shape pin.
#[test]
fn the_static_dom_matches_the_vue_pre_measurement_shape() {
    let html = render(SegmentedTabsProps {
        items: two_options(),
        active_key: "preview".to_string(),
        aria_label: "Preview / Source".to_string(),
        ..Default::default()
    });
    // Root carries the segmented variant marker (attribute ORDER is not part
    // of the contract — the SSR emitter sorts attrs its own way — so every
    // pin below matches presence, never sequence).
    assert!(html.contains(r#"class="hk-tabs""#), "root missing: {html}");
    assert!(
        html.contains("data-variant=\"segmented\""),
        "root variant marker missing: {html}"
    );
    assert!(
        html.contains("data-tauri-drag-region=\"false\""),
        "drag-region literal missing: {html}"
    );
    // …the track is a NAMED radiogroup…
    assert!(
        html.contains(r#"class="hk-tabs-list""#),
        "radiogroup track missing: {html}"
    );
    assert_eq!(
        html.matches("role=\"radiogroup\"").count(),
        1,
        "track must be exactly one radiogroup: {html}"
    );
    assert_eq!(
        html.matches("data-variant=\"segmented\"").count(),
        2,
        "variant marker on root AND track: {html}"
    );
    assert!(html.contains(r#"aria-label="Preview / Source""#), "{html}");
    // …the indicator node exists in its unmeasured (data-ready-less) state…
    assert!(html.contains(r#"class="hk-tabs-indicator""#), "{html}");
    assert!(
        !html.contains("data-ready"),
        "pre-measured indicator: {html}"
    );
    // …and the triggers are radios with roving tabindex, NOT tabs.
    assert_eq!(
        html.matches("role=\"radio\"").count(),
        2,
        "trigger semantics: {html}"
    );
    assert_eq!(
        html.matches("aria-checked=\"true\"").count(),
        1,
        "exactly one checked: {html}"
    );
    assert_eq!(
        html.matches("aria-checked=\"false\"").count(),
        1,
        "exactly one unchecked: {html}"
    );
    assert!(!html.contains("aria-checked=\"aria-checked\""), "{html}");
    assert!(
        html.matches("data-active").count() == 1,
        "exactly one active trigger: {html}"
    );
    assert!(
        html.contains(r#"tabindex="-1""#),
        "roving tabindex missing: {html}"
    );
    // Per-TRIGGER grouping (attribute order inside one trigger is not part
    // of the contract): exactly one trigger carries checked+active together
    // and never -1; the other carries unchecked + -1 and never data-active.
    let triggers: Vec<&str> = html.split("<button").skip(1).collect();
    assert_eq!(triggers.len(), 2, "trigger count: {html}");
    let with_active: Vec<&&str> = triggers
        .iter()
        .filter(|t| t.contains("aria-checked=\"true\"") && t.contains("data-active=\"true\""))
        .collect();
    assert_eq!(with_active.len(), 1, "checked+active same trigger: {html}");
    assert!(
        !with_active[0].contains("tabindex=\"-1\""),
        "the ACTIVE trigger must join the tab sequence: {html}"
    );
    let with_inactive: Vec<&&str> = triggers
        .iter()
        .filter(|t| t.contains("aria-checked=\"false\"") && t.contains("tabindex=\"-1\""))
        .collect();
    assert_eq!(with_inactive.len(), 1, "unchecked+roving: {html}");
    assert!(
        !with_inactive[0].contains("data-active"),
        "the inactive trigger must stay unmarked: {html}"
    );
}

/// HkTabs' roving-tabindex FALLBACK: when `active_key` matches no navigable
/// option, the first navigable option keeps the tab stop instead — the
/// radiogroup must never become keyboard-unreachable (HkTabs.tsx
/// `fallbackTabbableIdx`).
///
/// MUT:segmented-tab-fallback — dropping the fallback (tab stop only on an
/// exact active match) leaves EVERY trigger at tabindex="-1" in both cases
/// and turns this red.
#[test]
fn the_tab_stop_falls_back_to_the_first_navigable_option() {
    // No match at all: both triggers unchecked; the FIRST one is tabbable.
    let nomatch = render(SegmentedTabsProps {
        items: two_options(),
        active_key: "missing".to_string(),
        ..Default::default()
    });
    let triggers: Vec<&str> = nomatch.split("<button").skip(1).collect();
    assert_eq!(triggers.len(), 2, "{nomatch}");
    let tabbable: Vec<&&str> = triggers
        .iter()
        .filter(|t| !t.contains("tabindex=\"-1\""))
        .collect();
    assert_eq!(tabbable.len(), 1, "exactly one tab stop: {nomatch}");
    assert!(
        tabbable[0].contains(r#"data-pane="preview""#),
        "the FIRST navigable option keeps the tab stop: {nomatch}"
    );
    // Active key set but that option is disabled: the fallback moves the tab
    // stop to the (enabled) source trigger.
    let disabled_active = render(SegmentedTabsProps {
        items: vec![
            SegmentedTabOption {
                key: "preview".to_string(),
                label: "Preview".to_string(),
                attrs: vec![("data-pane".to_string(), "preview".to_string())],
                disabled: true,
            },
            SegmentedTabOption {
                key: "source".to_string(),
                label: "Source".to_string(),
                attrs: vec![("data-pane".to_string(), "source".to_string())],
                ..Default::default()
            },
        ],
        active_key: "preview".to_string(),
        ..Default::default()
    });
    let dtriggers: Vec<&str> = disabled_active.split("<button").skip(1).collect();
    let dtabbable: Vec<&&str> = dtriggers
        .iter()
        .filter(|t| !t.contains("tabindex=\"-1\""))
        .collect();
    assert_eq!(dtabbable.len(), 1, "{disabled_active}");
    assert!(
        dtabbable[0].contains(r#"data-pane="source""#),
        "the tab stop must move to the enabled option: {disabled_active}"
    );
    assert!(
        dtriggers[0].contains("aria-disabled=\"true\""),
        "the disabled option still announces itself: {disabled_active}"
    );
}

/// Passthrough attributes (a host hooks its own behaviour with e.g.
/// `data-pane`) ride verbatim, per option, on the RIGHT trigger.
///
/// MUT:segmented-passthrough — dropping or misrouting the per-option
/// attributes turns this red.
#[test]
fn passthrough_attributes_reach_their_own_trigger() {
    let html = render(SegmentedTabsProps {
        items: two_options(),
        active_key: "source".to_string(),
        ..Default::default()
    });
    // Per-trigger grouping (attribute order inside one trigger is not part
    // of the contract).
    let triggers: Vec<&str> = html.split("<button").skip(1).collect();
    assert_eq!(triggers.len(), 2, "{html}");
    let preview_chunk = triggers
        .iter()
        .find(|t| t.contains(r#"data-pane="preview""#))
        .unwrap_or_else(|| panic!("preview trigger missing: {html}"));
    let source_chunk = triggers
        .iter()
        .find(|t| t.contains(r#"data-pane="source""#))
        .unwrap_or_else(|| panic!("source trigger missing: {html}"));
    assert!(
        preview_chunk.contains(r#"data-pane="preview""#),
        "preview trigger lost its hook: {html}"
    );
    assert!(
        source_chunk.contains(r#"data-pane="source""#),
        "source trigger lost its hook: {html}"
    );
    // The ACTIVE one here is source — its data-active must sit on the same
    // trigger as the data-pane="source" hook, not on the preview trigger.
    assert!(
        source_chunk.contains(r#"data-active="true""#),
        "active marker on the wrong trigger: {html}"
    );
    assert!(
        !preview_chunk.contains(r#"data-active="true""#),
        "preview must stay inactive: {html}"
    );
}

/// `aria-checked` renders as the STRING "true"/"false" (a quoted attribute),
/// and the active value flips with `active_key` — the two-state contract the
/// delegated legacy runtime and the boot pass both read.
#[test]
fn the_checked_state_follows_the_active_key() {
    let first = render(SegmentedTabsProps {
        items: two_options(),
        active_key: "preview".to_string(),
        ..Default::default()
    });
    let second = render(SegmentedTabsProps {
        items: two_options(),
        active_key: "source".to_string(),
        ..Default::default()
    });
    assert!(first.contains("aria-checked=\"true\""), "{first}");
    assert!(second.contains("aria-checked=\"true\""), "{second}");
    // The two renders must disagree about WHICH trigger is checked.
    let first_at = first.find("aria-checked=\"true\"").unwrap();
    let second_at = second.find("aria-checked=\"true\"").unwrap();
    assert_ne!(
        first.get(first_at.saturating_sub(120)..first_at),
        second.get(second_at.saturating_sub(120)..second_at),
        "checked state did not move with active_key: {first} || {second}"
    );
}

/// An empty `aria_label` omits the attribute (mirrors the Vue render's
/// `ariaLabel || undefined`), and the class prop joins the root.
#[test]
fn the_name_is_omitted_when_empty_and_class_joins_the_root() {
    let html = render(SegmentedTabsProps {
        items: two_options(),
        active_key: "preview".to_string(),
        aria_label: String::new(),
        class: "lg-diagram-switch".to_string(),
    });
    assert!(!html.contains("aria-label"), "empty name leaked: {html}");
    assert!(
        html.contains(r#"class="hk-tabs lg-diagram-switch""#),
        "host class missing: {html}"
    );
}
