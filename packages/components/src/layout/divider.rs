// hi-components/src/layout/divider.rs
// Divider — mirror of the canonical Vue `HkDivider`: the presentational rule
// line. Four orthogonal modifier axes (orientation, tone, variant, spacing —
// plus the vertical-only length axis) compose onto one bare `div`; the
// component carries no children, no text and no state, and hides from the
// accessibility tree (`aria-hidden="true"`, exactly Vue).
//
// MIGRATION (this file REPLACES the legacy Rust divider, wave W8):
//   * RETIRED PROPS: `text` (and the `hk-divider-text` span — the canonical
//     divider is a bare rule; text-in-divider is not a Vue feature),
//     `divider_type` together with the `DividerType` export (the legacy
//     `Dotted` variant died; the canonical sheet knows `solid` / `dashed`
//     through `border-*-style` only), `text_align` (no text to align),
//     `rtl` (and the `hk-divider-rtl` class — the canonical sheet is
//     direction-agnostic: the vertical rule margins through `margin-inline`
//     logical properties), and the `class` passthrough.
//   * RETIRED WIRING: `hikari_palette::classes::{ClassesBuilder,
//     DividerClass}` and `crate::theme::use_layout_direction` — the class list
//     is built by the pure [`divider_classes`] from plain enums.
//   * RETIRED SHEET: the legacy inline stylesheet (with-text rules, dotted
//     rule, dark-theme overrides) was removed ahead of this mirror (commit
//     "Retire the divider sheet ahead of its mirror"); the canonical Vue
//     `HkDivider.scss` now vendored under `src/styles/vue-mirror/` replaces
//     it, compiled with `no_hash`.
//   * KEPT EXPORTS: `Divider` / `DividerProps` / `DividerComponent` (and
//     `DividerOrientation`, now defaulting `Horizontal` exactly Vue).
//   * NEW: `DividerTone` / `DividerVariant` / `DividerSpacing` /
//     `DividerLength` and the [`divider_classes`] composer.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDivider.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-divider*` class names are literal and
// identical in both forms. The sheet's spacing margins ride the
// `[class*="hk-divider-spacing-"]` ATTRIBUTE SUBSTRING selector, so the
// modifier classes must be emitted with their exact literal spelling
// (`hk-divider-spacing-xs` …) — [`divider_classes`] guarantees that
// character-for-character. DOM contract:
//
//   div.hk-divider
//     [.hk-divider-vertical]        (orientation, HORIZONTAL emits nothing)
//     [.hk-divider-dashed]          (variant, SOLID emits nothing)
//     [.hk-divider-faint | .hk-divider-input]   (tone, SUBTLE emits nothing)
//     [.hk-divider-spacing-{xs,sm,md,lg,xl}]    (spacing, NONE emits nothing)
//     [.hk-divider-length-{xs,sm,md,lg,xl}]     (length, STRETCH emits nothing)
//     aria-hidden="true"            (no children, ever)
//
// Defaults (Vue): horizontal / subtle / solid / none / stretch — the bare
// `hk-divider` rule: full width, 1px top border, `flex-shrink: 0`.
//
// NO i18n: the canonical divider carries no strings in either form.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DividerComponent;

/// The rule's axis (Vue: `orientation`, default `"horizontal"`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerOrientation {
    #[default]
    Horizontal,
    Vertical,
}

impl DividerOrientation {
    /// The `hk-divider-vertical` modifier exactly as Vue emits it — the
    /// horizontal rule is the unmodified base class, so it emits NOTHING.
    pub fn class_name(self) -> Option<&'static str> {
        match self {
            DividerOrientation::Horizontal => None,
            DividerOrientation::Vertical => Some("hk-divider-vertical"),
        }
    }
}

/// The rule's color weight (Vue: `tone`, default `"subtle"` — the sheet's
/// `--hi-color-border` at its base alpha).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerTone {
    #[default]
    Subtle,
    /// Lighter (`rgba(…,0.06)` fallback) — hairline zones.
    Faint,
    /// Heavier (`rgba(…,0.15)` fallback) — input separators.
    Input,
}

impl DividerTone {
    /// The tone modifier class; the default `subtle` tone emits NOTHING (it
    /// is the sheet's base `--hk-divider-color`).
    pub fn class_name(self) -> Option<&'static str> {
        match self {
            DividerTone::Subtle => None,
            DividerTone::Faint => Some("hk-divider-faint"),
            DividerTone::Input => Some("hk-divider-input"),
        }
    }
}

/// The rule's stroke (Vue: `variant`, default `"solid"`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerVariant {
    #[default]
    Solid,
    Dashed,
}

impl DividerVariant {
    /// The `hk-divider-dashed` modifier; `solid` emits NOTHING (the border's
    /// default style).
    pub fn class_name(self) -> Option<&'static str> {
        match self {
            DividerVariant::Solid => None,
            DividerVariant::Dashed => Some("hk-divider-dashed"),
        }
    }
}

/// Breathing room around the rule (Vue: `spacing`, default `"none"`): the
/// class sets `--hk-divider-space`, and the sheet's
/// `[class*="hk-divider-spacing-"]` substring selector turns it into
/// `margin-block` (horizontal) / `margin-inline` (vertical).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerSpacing {
    #[default]
    None,
    Xs,
    Sm,
    Md,
    Lg,
    Xl,
}

impl DividerSpacing {
    /// The `hk-divider-spacing-{step}` class; `none` emits NOTHING so the
    /// substring selector does not match and no margins land.
    pub fn class_name(self) -> Option<&'static str> {
        match self {
            DividerSpacing::None => None,
            DividerSpacing::Xs => Some("hk-divider-spacing-xs"),
            DividerSpacing::Sm => Some("hk-divider-spacing-sm"),
            DividerSpacing::Md => Some("hk-divider-spacing-md"),
            DividerSpacing::Lg => Some("hk-divider-spacing-lg"),
            DividerSpacing::Xl => Some("hk-divider-spacing-xl"),
        }
    }
}

/// The vertical rule's height (Vue: `length`, default `"stretch"`): a
/// non-stretch length centers the rule (`align-self: center`) and pins its
/// height; `stretch` keeps the default `align-self: stretch` with `height:
/// auto`. Horizontal rules ignore the axis (the sheet scopes every length
/// rule under `.hk-divider-vertical`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerLength {
    #[default]
    Stretch,
    Xs,
    Sm,
    Md,
    Lg,
    Xl,
}

impl DividerLength {
    /// The `hk-divider-length-{step}` class; `stretch` emits NOTHING.
    pub fn class_name(self) -> Option<&'static str> {
        match self {
            DividerLength::Stretch => None,
            DividerLength::Xs => Some("hk-divider-length-xs"),
            DividerLength::Sm => Some("hk-divider-length-sm"),
            DividerLength::Md => Some("hk-divider-length-md"),
            DividerLength::Lg => Some("hk-divider-length-lg"),
            DividerLength::Xl => Some("hk-divider-length-xl"),
        }
    }
}

/// The complete class list in Vue's order: base, vertical, dashed, tone,
/// spacing, length — Vue builds the same array and filters falsy entries, so
/// the default axes (horizontal / subtle / solid / none / stretch) collapse to
/// the bare `hk-divider`.
pub fn divider_classes(
    orientation: DividerOrientation,
    tone: DividerTone,
    variant: DividerVariant,
    spacing: DividerSpacing,
    length: DividerLength,
) -> String {
    let mut classes = String::from("hk-divider");
    for class in [
        orientation.class_name(),
        variant.class_name(),
        tone.class_name(),
        spacing.class_name(),
        length.class_name(),
    ]
    .into_iter()
    .flatten()
    {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

#[define_props]
pub struct DividerProps {
    /// The rule's axis (Vue default `"horizontal"`).
    #[default]
    pub orientation: DividerOrientation,

    /// Color weight (Vue default `"subtle"`).
    #[default]
    pub tone: DividerTone,

    /// Stroke (Vue default `"solid"`).
    #[default]
    pub variant: DividerVariant,

    /// Breathing room (Vue default `"none"`).
    #[default]
    pub spacing: DividerSpacing,

    /// Vertical height (Vue default `"stretch"`).
    #[default]
    pub length: DividerLength,
}

#[component]
pub fn Divider(props: DividerProps) -> Element {
    let classes = divider_classes(
        props.orientation,
        props.tone,
        props.variant,
        props.spacing,
        props.length,
    );
    rsx! {
        div { class: classes, "aria-hidden": "true" }
    }
}

impl StyledComponent for DividerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-divider*` names — and the `[class*="hk-divider-spacing-"]`
        // substring selector — literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDivider.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "divider"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn divider_defaults_match_the_vue_props() {
        let props = DividerProps::default();
        assert_eq!(props.orientation, DividerOrientation::Horizontal);
        assert_eq!(props.tone, DividerTone::Subtle);
        assert_eq!(props.variant, DividerVariant::Solid);
        assert_eq!(props.spacing, DividerSpacing::None);
        assert_eq!(props.length, DividerLength::Stretch);
    }

    #[test]
    fn divider_orientation_and_tone_classes_match_vue() {
        // Horizontal and subtle are the UNMODIFIED base — Vue emits no class.
        assert_eq!(DividerOrientation::Horizontal.class_name(), None);
        assert_eq!(
            DividerOrientation::Vertical.class_name(),
            Some("hk-divider-vertical")
        );
        assert_eq!(DividerTone::Subtle.class_name(), None);
        assert_eq!(DividerTone::Faint.class_name(), Some("hk-divider-faint"));
        assert_eq!(DividerTone::Input.class_name(), Some("hk-divider-input"));
        assert_eq!(DividerVariant::Solid.class_name(), None);
        assert_eq!(
            DividerVariant::Dashed.class_name(),
            Some("hk-divider-dashed")
        );
    }

    #[test]
    fn divider_spacing_classes_spell_the_substring_selector() {
        // The sheet keys its margins on `[class*="hk-divider-spacing-"]`, so
        // every step must carry the exact literal spelling.
        assert_eq!(DividerSpacing::None.class_name(), None);
        for (step, class) in [
            (DividerSpacing::Xs, "hk-divider-spacing-xs"),
            (DividerSpacing::Sm, "hk-divider-spacing-sm"),
            (DividerSpacing::Md, "hk-divider-spacing-md"),
            (DividerSpacing::Lg, "hk-divider-spacing-lg"),
            (DividerSpacing::Xl, "hk-divider-spacing-xl"),
        ] {
            assert_eq!(step.class_name(), Some(class));
            assert!(class.contains("hk-divider-spacing-"));
        }
    }

    #[test]
    fn divider_length_classes_match_vue() {
        assert_eq!(DividerLength::Stretch.class_name(), None);
        for (step, class) in [
            (DividerLength::Xs, "hk-divider-length-xs"),
            (DividerLength::Sm, "hk-divider-length-sm"),
            (DividerLength::Md, "hk-divider-length-md"),
            (DividerLength::Lg, "hk-divider-length-lg"),
            (DividerLength::Xl, "hk-divider-length-xl"),
        ] {
            assert_eq!(step.class_name(), Some(class));
        }
    }

    #[test]
    fn divider_classes_compose_in_vue_order() {
        // Every default axis collapses to the bare base class.
        assert_eq!(
            divider_classes(
                DividerOrientation::Horizontal,
                DividerTone::Subtle,
                DividerVariant::Solid,
                DividerSpacing::None,
                DividerLength::Stretch,
            ),
            "hk-divider"
        );
        // Vue's array order: base, vertical, dashed, tone, spacing, length.
        assert_eq!(
            divider_classes(
                DividerOrientation::Vertical,
                DividerTone::Faint,
                DividerVariant::Dashed,
                DividerSpacing::Sm,
                DividerLength::Lg,
            ),
            "hk-divider hk-divider-vertical hk-divider-dashed hk-divider-faint \
             hk-divider-spacing-sm hk-divider-length-lg"
        );
        // The tone axis swaps independently of the rest.
        assert_eq!(
            divider_classes(
                DividerOrientation::Horizontal,
                DividerTone::Input,
                DividerVariant::Solid,
                DividerSpacing::Md,
                DividerLength::Stretch,
            ),
            "hk-divider hk-divider-input hk-divider-spacing-md"
        );
    }

    #[test]
    fn divider_renders_the_vue_dom_contract() {
        let html = Divider(DividerProps::default()).render_to_html();
        assert!(html.contains(r#"class="hk-divider""#), "{html}");
        assert!(html.contains(r#"aria-hidden="true""#), "{html}");
        // A bare rule: no children, no legacy text span.
        assert!(!html.contains("<span"), "{html}");
        assert!(!html.contains("hk-divider-text"), "{html}");

        let html = Divider(DividerProps {
            orientation: DividerOrientation::Vertical,
            variant: DividerVariant::Dashed,
            spacing: DividerSpacing::Md,
            length: DividerLength::Xl,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(
                "hk-divider hk-divider-vertical hk-divider-dashed \
                 hk-divider-spacing-md hk-divider-length-xl"
            ),
            "{html}"
        );
        assert!(html.contains(r#"aria-hidden="true""#), "{html}");
    }

    #[test]
    fn divider_styles_come_from_the_canonical_vue_sheet() {
        let css = DividerComponent::styles();
        for selector in [
            ".hk-divider",
            ".hk-divider-vertical",
            ".hk-divider-faint",
            ".hk-divider-input",
            ".hk-divider-length-xl",
        ] {
            assert!(
                css.contains(selector),
                "divider css must carry the vue selector {selector:?}"
            );
        }
        // The spacing margins ride the attribute SUBSTRING selector — it
        // must survive compilation (grass unquotes the value, the same
        // canonical form the Vue build's own styles test asserts).
        assert!(
            css.contains(r#"[class*=hk-divider-spacing-]"#),
            "divider css must carry the substring selector: {css}"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored divider sheet"
        );
    }
}
