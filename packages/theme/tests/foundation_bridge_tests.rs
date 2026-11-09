//! Foundation bridge guards.
//!
//! `packages/theme/styles/foundation.scss` sits outside every other read
//! face: it is not a registered sheet (so the registry-bundle needles never
//! see it), vendored-sync does not track it, tokenInventory harvests the
//! vue-side seed sheets, and boot-landing pins only its own literals. The
//! 2026-11 radius wave review proved deleting a `--hi-radius-*` bridge
//! line stayed green across all of those. This file is the read face: the
//! radius bridges and the component drivers that consume them must exist
//! in their canonical form, so a broken bridge reds here instead of
//! silently un-styling every `--hi-*` consumer in downstream hosts.

const FOUNDATION: &str = include_str!("../styles/foundation.scss");

/// (`token`, exact canonical value) for every radius bridge foundation
/// ships. The `--radius-*` side of each bridge is the runtime scale
/// (packages/vue/src/styles/theme/scale.scss); the fallback keeps the
/// value sane in hosts that load foundation without the scale seed.
const RADIUS_BRIDGES: &[(&str, &str)] = &[
    ("--hi-radius-none", "0"),
    ("--hi-radius-sm", "var(--radius-sm, 4px)"),
    ("--hi-radius-md", "var(--radius-md, 8px)"),
    ("--hi-radius-lg", "var(--radius-lg, 12px)"),
    ("--hi-radius-xl", "var(--radius-xl, 16px)"),
    ("--hi-radius-full", "var(--radius-full, 9999px)"),
];

/// Semantic drivers that route foundation radii into components. Losing
/// one of these breaks button/input/card/modal/badge/icon shapes in every
/// host that consumes the `--hi-*` surface.
const RADIUS_DRIVERS: &[(&str, &str)] = &[
    ("--hi-button-radius", "var(--hi-radius-md)"),
    ("--hi-input-radius", "var(--hi-radius-md)"),
    ("--hi-card-radius", "var(--hi-radius-lg)"),
    ("--hi-modal-radius", "var(--hi-radius-xl)"),
    ("--hi-icon-radius", "var(--hi-radius-sm)"),
    ("--hi-badge-radius", "var(--hi-radius-full)"),
];

#[test]
fn foundation_ships_every_radius_bridge_in_canonical_form() {
    for (name, value) in RADIUS_BRIDGES {
        let needle = format!("{name}: {value};");
        assert!(
            FOUNDATION.contains(&needle),
            "foundation bridge missing or altered: {needle}"
        );
    }
}

#[test]
fn foundation_ships_every_component_radius_driver() {
    for (name, value) in RADIUS_DRIVERS {
        let needle = format!("{name}: {value};");
        assert!(
            FOUNDATION.contains(&needle),
            "foundation radius driver missing or altered: {needle}"
        );
    }
}

#[test]
fn foundation_bridge_needles_are_unique() {
    // Granularity control: each needle must appear exactly once, so a
    // single deleted line reds with an attributable message instead of
    // being masked by a duplicate elsewhere in the file.
    for (name, value) in RADIUS_BRIDGES.iter().chain(RADIUS_DRIVERS) {
        let needle = format!("{name}: {value};");
        assert_eq!(
            FOUNDATION.matches(&needle).count(),
            1,
            "needle {needle} must appear exactly once in foundation.scss"
        );
    }
}
