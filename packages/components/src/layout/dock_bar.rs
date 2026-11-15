// hi-components/src/layout/dock_bar.rs
// DockBar — mirror of the canonical Vue `HkDockBar`: the ONE dock container
// every floating surface (cruise docks, corner step pagers, floating chat bars,
// nameplate pills) mounts its content inside.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDockBar.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `scripts/sync-vue-mirror.py`'s W5
// `LAYOUT_SHEETS`), compiled with `no_hash` so the `.hk-dock-bar*` class names
// are literal and identical in both forms. DOM contract (mirrors the Vue render
// output one-to-one):
//
//   section.hk-dock-bar data-anchor={anchor} data-surface={surface} [+class]
//          (style: --dock-width / --dock-max-width / --dock-max-height /
//                  --dock-padding; omitted when no size prop is set)
//     div.hk-dock-bar-surface
//       {children}                       (Vue: the default slot)
//
// State: none. The sheet owns every geometry and finish decision — the anchor
// table ([`dock_bar_placement`]) is the mirror-side transcription of it, the
// component itself only emits the two `data-*` hooks plus the four size custom
// properties. No signal, no registry, no inline positioning (inventing geometry
// here would drift from the vendored sheet).
//
// Anchors — the full eight-way compass (4 edges + 4 corners) plus the two
// horizontal planes, exactly Vue's set:
//   `page` (default) and `bottom` are the SOUTH edge (identical geometry;
//   `page` is the 2026-09-02 spelling kept for existing callers), `top` the
//   north edge, `left`/`right` the vertical edge midpoints, the four corners,
//   and `plane` — the only IN-FLOW anchor, for hosts that own the positioning
//   (a fixed footer band) and only want the surface centered.
//
// Pointer-events contract (sheet, not mirror): the anchored box is transparent
// to canvas gestures (`pointer-events: none`) and `.hk-dock-bar-surface`
// catches them (`pointer-events: auto`). Nothing to mirror in Rust.
//
// Deltas vs Vue (documented, not accidental):
//   * Vue ships NO SVG and no icon of any kind here (the dock is chrome; the
//     content is the host's slot), so this file carries no `dangerous_inner_html`
//     host and no consumer string can bypass tairitsu's escaper.
//   * Vue ships no `role`/`aria-*` on the dock either (a bare `<section>`, which
//     is a landmark only when the HOST names it); the mirror adds none — naming
//     the dock is the host's call, and inventing a label would put a title the
//     Vue form does not have into the accessibility tree.
//   * [D] `class` is a prop appended last (Vue merges the fallthrough class
//     itself).
//   * [D] the four size props are CSS value strings, exactly as in Vue
//     (`--dock-width` etc.). Vue assigns them through `style.setProperty`,
//     which REJECTS a value carrying `;` / braces; the mirror renders them into
//     the style attribute instead, where such a value would start a new
//     declaration — so [`dock_bar_style`] drops those values (see
//     [`safe_declaration_value`]) rather than letting one prop rewrite the
//     element's style. Legitimate CSS values for these four properties never
//     contain those characters.
//
// Edge gap contract (2026-11-15) — the sheet's per-edge resolver:
//
//   G(edge) = var(--hk-dock-gap-<edge>,
//                 var(--hk-dock-inset, var(--hk-dock-gap, var(--space-16, 1rem))))
//
// `--hk-dock-gap` is declared exactly ONCE by the foundation layer (Vue:
// scale.scss, 16px); the per-edge names and the older single-value
// `--hk-dock-inset` are overrides only (any ancestor), and the Vue `gap` prop
// writes `--hk-dock-gap` inline. Nothing is pre-declared per edge on `:root`: a
// custom property resolves on the element that DECLARES it, so a root-level
// `--hk-dock-gap-bottom: var(--hk-dock-gap)` would freeze that edge against
// every descendant override. [`dock_bar_gap`] / [`dock_bar_inset`] transcribe
// the resolved chain; each [`DockBarPlacement`] row carries the content-side
// band.
//
// A dock owns BOTH distances on its content side: the RESTING INSET from the
// viewport edge it hugs (the gap plus that edge's safe-area inset — 0 on a
// desktop viewport) and a transparent CONTENT BAND on the face that points at
// the content. The band lives in the dock's own box, which is why a host that
// measures the box (Vue: getBoundingClientRect, padding included) reserves
// band + surface + inset with no JS ever reading a CSS length, and why the
// pin-slot form needs no view padding at all.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] no `gap` prop: the four size props stay the whole style surface. A
//     Rust host that wants a larger (or per-edge) gap sets `--hk-dock-gap` /
//     `--hk-dock-gap-<edge>` on an ancestor or its own wrapper style; the
//     sheet's chain resolves it exactly as the Vue inline prop would.
//
// Replaces nothing: the family had no Rust counterpart for the dock container.
// Relationship to the scroll family (kept from Vue): docks that live INSIDE a
// scrolling region belong to the scroll container's dock slots; this component
// carries docks that FLOAT over a canvas/page. Do not nest it inside a scroll
// viewport expecting pinning.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DockBarComponent;

/// The terminal fallback of the edge gap family — the foundation default
/// (`scale.scss` DECLARES `--hk-dock-gap: var(--space-16, 1rem)`).
pub const DOCK_BAR_GAP_DEFAULT: &str = "var(--space-16, 1rem)";

/// The edge-agnostic part of the chain: the legacy single-value entry over the
/// foundation default. This is what any edge resolves to when no
/// `--hk-dock-gap-<edge>` override exists (the sheet composes it inside each
/// private `--_hk-dock-gap-<edge>` declaration, see [`dock_bar_gap`]).
pub const DOCK_BAR_INSET: &str = "var(--hk-dock-inset, var(--hk-dock-gap, var(--space-16, 1rem)))";

/// The fallback chain ONE edge resolves through, spelled exactly as the sheet's
/// private `--_hk-dock-gap-<edge>` declaration. `edge` is a logical edge token:
/// `top` / `right` / `bottom` / `left`.
pub fn dock_bar_gap(edge: &str) -> String {
    format!("var(--hk-dock-gap-{edge}, {DOCK_BAR_INSET})")
}

/// The RESTING INSET one anchored edge applies: the resolved gap plus that
/// edge's safe-area inset (which is 0 on a viewport without a notch, so the gap
/// is the visual distance there). The `plane` anchor reads the same value as
/// its `margin-block-end`.
pub fn dock_bar_inset(edge: &str) -> String {
    format!(
        "calc({} + env(safe-area-inset-{edge}, 0px))",
        dock_bar_gap(edge)
    )
}

/// One content-side band an anchor opens: which logical padding property the
/// sheet sets, and which edge's resolved gap fills it. Transcribed from the
/// sheet's anchor rules — the content never comes closer to the surface than
/// the gap on that face.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct DockBarBand {
    /// The logical padding property, exactly as the sheet spells it
    /// (`padding-block-start`, `padding-block-end`, `padding-inline-start`,
    /// `padding-inline-end`).
    pub padding: &'static str,
    /// The edge whose resolved gap fills it.
    pub edge: &'static str,
}

/// Which plane carries the dock: a compass anchor (4 edges + 4 corners,
/// `page` being the south edge) or a host plane (in-flow). Vue default `page`.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DockBarAnchor {
    #[default]
    Page,
    Plane,
    Top,
    Bottom,
    Left,
    Right,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

impl DockBarAnchor {
    /// The `data-anchor` token exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            DockBarAnchor::Page => "page",
            DockBarAnchor::Plane => "plane",
            DockBarAnchor::Top => "top",
            DockBarAnchor::Bottom => "bottom",
            DockBarAnchor::Left => "left",
            DockBarAnchor::Right => "right",
            DockBarAnchor::TopLeft => "top-left",
            DockBarAnchor::TopRight => "top-right",
            DockBarAnchor::BottomLeft => "bottom-left",
            DockBarAnchor::BottomRight => "bottom-right",
        }
    }
}

/// The surface finish (Vue default `glass`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum DockBarSurface {
    /// Translucent surface + backdrop blur (the default).
    #[default]
    Glass,
    /// Opaque, no blur — for moving canvases (per-frame backdrop re-sampling
    /// over a live WebGL scene is expensive).
    Solid,
}

impl DockBarSurface {
    /// The `data-surface` token exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            DockBarSurface::Glass => "glass",
            DockBarSurface::Solid => "solid",
        }
    }
}

// ── the anchor table (the sheet's geometry, transcribed once) ────────────

/// Where one anchor puts the dock — the sheet's geometry contract expressed as
/// data, so the mirror never re-invents positioning and a host composing its
/// own surface can read the same table.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct DockBarPlacement {
    /// `position: absolute` for every compass anchor; the `plane` anchor is
    /// in-flow.
    pub absolute: bool,
    /// The centering transform the sheet applies (`""` when the corner inset
    /// does the centering).
    pub transform: &'static str,
    /// The `align-items` override the corner anchors set on the flex column;
    /// `None` keeps the base `center`.
    pub align_items: Option<&'static str>,
    /// The edges whose resolved gap ([`dock_bar_inset`]) sets the dock's
    /// RESTING distance from that viewport edge, in the sheet's order.
    /// Absolute anchors pin them through `bottom` / `top` / `left` / `right`;
    /// the in-flow `plane` anchor reads the bottom edge as its
    /// `margin-block-end` instead of pinning anything.
    pub inset_edges: &'static [&'static str],
    /// The content-side bands the anchor opens, in the sheet's declaration
    /// order (block axis first, then inline).
    pub bands: &'static [DockBarBand],
    /// The vertical side anchors cap the surface height viewport-aware
    /// (`calc(100dvh - top gap - bottom gap)`) by default; `--dock-max-height`
    /// still overrides.
    pub caps_viewport_height: bool,
}

/// The content-side band of a south-edge dock: the block-start face points at
/// the content above the dock.
const BAND_SOUTH: &[DockBarBand] = &[DockBarBand {
    padding: "padding-block-start",
    edge: "bottom",
}];
/// The content-side band of a north-edge dock: the block-end face points down
/// at the content.
const BAND_NORTH: &[DockBarBand] = &[DockBarBand {
    padding: "padding-block-end",
    edge: "top",
}];
/// West-edge dock: the band faces the content on the inline end.
const BAND_WEST: &[DockBarBand] = &[DockBarBand {
    padding: "padding-inline-end",
    edge: "left",
}];
/// East-edge dock: the band faces the content on the inline start.
const BAND_EAST: &[DockBarBand] = &[DockBarBand {
    padding: "padding-inline-start",
    edge: "right",
}];
/// North-west corner: both content-facing faces open.
const BAND_NORTH_WEST: &[DockBarBand] = &[
    DockBarBand {
        padding: "padding-block-end",
        edge: "top",
    },
    DockBarBand {
        padding: "padding-inline-end",
        edge: "left",
    },
];
/// North-east corner.
const BAND_NORTH_EAST: &[DockBarBand] = &[
    DockBarBand {
        padding: "padding-block-end",
        edge: "top",
    },
    DockBarBand {
        padding: "padding-inline-start",
        edge: "right",
    },
];
/// South-west corner.
const BAND_SOUTH_WEST: &[DockBarBand] = &[
    DockBarBand {
        padding: "padding-block-start",
        edge: "bottom",
    },
    DockBarBand {
        padding: "padding-inline-end",
        edge: "left",
    },
];
/// South-east corner.
const BAND_SOUTH_EAST: &[DockBarBand] = &[
    DockBarBand {
        padding: "padding-block-start",
        edge: "bottom",
    },
    DockBarBand {
        padding: "padding-inline-start",
        edge: "right",
    },
];

/// The placement of one anchor, transcribed from `HkDockBar.scss`.
pub fn dock_bar_placement(anchor: DockBarAnchor) -> DockBarPlacement {
    match anchor {
        // The two south-edge spellings share geometry exactly (Vue: `page`
        // kept for the 2026-09-02 call sites, `bottom` its compass alias).
        DockBarAnchor::Page | DockBarAnchor::Bottom => DockBarPlacement {
            absolute: true,
            transform: "translateX(-50%)",
            align_items: None,
            inset_edges: &["bottom"],
            bands: BAND_SOUTH,
            caps_viewport_height: false,
        },
        DockBarAnchor::Top => DockBarPlacement {
            absolute: true,
            transform: "translateX(-50%)",
            align_items: None,
            inset_edges: &["top"],
            bands: BAND_NORTH,
            caps_viewport_height: false,
        },
        // Vertical docks run along the tall axis and are centered by
        // translateY; their surface gets the viewport-aware height cap.
        DockBarAnchor::Left => DockBarPlacement {
            absolute: true,
            transform: "translateY(-50%)",
            align_items: None,
            inset_edges: &["left"],
            bands: BAND_WEST,
            caps_viewport_height: true,
        },
        DockBarAnchor::Right => DockBarPlacement {
            absolute: true,
            transform: "translateY(-50%)",
            align_items: None,
            inset_edges: &["right"],
            bands: BAND_EAST,
            caps_viewport_height: true,
        },
        DockBarAnchor::TopLeft => DockBarPlacement {
            absolute: true,
            transform: "",
            align_items: Some("flex-start"),
            inset_edges: &["top", "left"],
            bands: BAND_NORTH_WEST,
            caps_viewport_height: false,
        },
        DockBarAnchor::TopRight => DockBarPlacement {
            absolute: true,
            transform: "",
            align_items: Some("flex-end"),
            inset_edges: &["top", "right"],
            bands: BAND_NORTH_EAST,
            caps_viewport_height: false,
        },
        DockBarAnchor::BottomLeft => DockBarPlacement {
            absolute: true,
            transform: "",
            align_items: Some("flex-start"),
            inset_edges: &["bottom", "left"],
            bands: BAND_SOUTH_WEST,
            caps_viewport_height: false,
        },
        DockBarAnchor::BottomRight => DockBarPlacement {
            absolute: true,
            transform: "",
            align_items: Some("flex-end"),
            inset_edges: &["bottom", "right"],
            bands: BAND_SOUTH_EAST,
            caps_viewport_height: false,
        },
        // NOT a compass direction: the host provides the plane (e.g. a fixed
        // footer band) and this container only centers the surface in flow.
        // Its rest distance is the bottom gap as a margin, and the content band
        // opens on the block-start face like any other south-edge dock.
        DockBarAnchor::Plane => DockBarPlacement {
            absolute: false,
            transform: "",
            align_items: None,
            inset_edges: &["bottom"],
            bands: BAND_SOUTH,
            caps_viewport_height: false,
        },
    }
}

// ── pure functions ───────────────────────────────────────────────────────

/// The root class list: the base class plus the host class.
pub fn dock_bar_root_classes(extra: &str) -> String {
    let mut classes = String::from("hk-dock-bar");
    if !extra.is_empty() {
        classes.push(' ');
        classes.push_str(extra);
    }
    classes
}

/// A CSS custom-property value is written into the style attribute, where a
/// `;` / `{` / `}` would start a NEW declaration — Vue assigns through
/// `style.setProperty`, which rejects such a value. The mirror keeps the same
/// effect by dropping the value (the sheet's fallback then applies) instead of
/// letting one prop rewrite the element's style. Blank values are dropped too:
/// they would emit a dead `--dock-x:` entry.
pub fn safe_declaration_value(value: &str) -> Option<&str> {
    let blank = value.trim().is_empty();
    let structural = value.contains(';') || value.contains('{') || value.contains('}');
    if blank || structural {
        None
    } else {
        Some(value)
    }
}

/// The four size custom properties Vue writes from `width` / `maxWidth` /
/// `maxHeight` / `padding`, joined in that order (empty when none is set, so
/// the element carries no `style` attribute at all).
pub fn dock_bar_style(
    width: Option<&str>,
    max_width: Option<&str>,
    max_height: Option<&str>,
    padding: Option<&str>,
) -> String {
    let mut declarations: Vec<String> = Vec::new();
    for (name, value) in [
        ("--dock-width", width),
        ("--dock-max-width", max_width),
        ("--dock-max-height", max_height),
        ("--dock-padding", padding),
    ] {
        if let Some(value) = value.and_then(safe_declaration_value) {
            declarations.push(format!("{name}:{value}"));
        }
    }
    declarations.join(";")
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct DockBarProps {
    /// Which plane carries the dock (Vue default `page`).
    #[default]
    pub anchor: DockBarAnchor,

    /// Surface finish: glass (blur) or solid (moving canvas).
    #[default]
    pub surface: DockBarSurface,

    /// CSS width of the surface (`--dock-width`); unset = shrink-wrap content.
    pub width: Option<String>,

    /// CSS max-width of the surface (`--dock-max-width`).
    pub max_width: Option<String>,

    /// CSS max-height of the surface (`--dock-max-height`; the vertical side
    /// anchors add their own viewport-aware default in the sheet).
    pub max_height: Option<String>,

    /// CSS padding override (`--dock-padding`; the sheet's shared chrome
    /// rhythm applies when unset).
    pub padding: Option<String>,

    /// Extra class appended to the root.
    #[default]
    pub class: String,

    /// The dock's content (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn DockBar(props: DockBarProps) -> Element {
    let style = dock_bar_style(
        props.width.as_deref(),
        props.max_width.as_deref(),
        props.max_height.as_deref(),
        props.padding.as_deref(),
    );

    rsx! {
        section {
            class: dock_bar_root_classes(&props.class),
            "data-anchor": props.anchor.token(),
            "data-surface": props.surface.token(),
            style: style,
            div { class: "hk-dock-bar-surface",
                {props.children.clone()}
            }
        }
    }
}

impl StyledComponent for DockBarComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDockBar.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "dock-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL_ANCHORS: [DockBarAnchor; 10] = [
        DockBarAnchor::Page,
        DockBarAnchor::Plane,
        DockBarAnchor::Top,
        DockBarAnchor::Bottom,
        DockBarAnchor::Left,
        DockBarAnchor::Right,
        DockBarAnchor::TopLeft,
        DockBarAnchor::TopRight,
        DockBarAnchor::BottomLeft,
        DockBarAnchor::BottomRight,
    ];

    #[test]
    fn dock_bar_defaults_match_the_vue_props() {
        let props = DockBarProps::default();
        assert_eq!(props.anchor, DockBarAnchor::Page);
        assert_eq!(props.surface, DockBarSurface::Glass);
        assert!(props.width.is_none());
        assert!(props.max_width.is_none());
        assert!(props.max_height.is_none());
        assert!(props.padding.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn dock_bar_anchor_tokens_match_the_vue_data_attributes() {
        let tokens: Vec<&str> = ALL_ANCHORS.iter().map(|anchor| anchor.token()).collect();
        assert_eq!(
            tokens,
            vec![
                "page",
                "plane",
                "top",
                "bottom",
                "left",
                "right",
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
            ]
        );
        assert_eq!(DockBarSurface::Glass.token(), "glass");
        assert_eq!(DockBarSurface::Solid.token(), "solid");
    }

    #[test]
    fn dock_bar_placement_matches_the_sheet_geometry() {
        // page / bottom: absolute south edge, centered by translateX, same
        // single inset (the two spellings are one geometry).
        for anchor in [DockBarAnchor::Page, DockBarAnchor::Bottom] {
            let placement = dock_bar_placement(anchor);
            assert!(placement.absolute, "{anchor:?}");
            assert_eq!(placement.transform, "translateX(-50%)", "{anchor:?}");
            assert_eq!(placement.inset_edges.to_vec(), vec!["bottom"], "{anchor:?}");
            assert_eq!(placement.align_items, None, "{anchor:?}");
            assert!(!placement.caps_viewport_height, "{anchor:?}");
        }
        // top: the north edge, same centering.
        let top = dock_bar_placement(DockBarAnchor::Top);
        assert!(top.absolute);
        assert_eq!(top.transform, "translateX(-50%)");
        assert_eq!(top.inset_edges.to_vec(), vec!["top"]);
        // left / right: vertical edges, centered by translateY, viewport cap.
        for (anchor, edge) in [
            (DockBarAnchor::Left, "left"),
            (DockBarAnchor::Right, "right"),
        ] {
            let placement = dock_bar_placement(anchor);
            assert!(placement.absolute, "{anchor:?}");
            assert_eq!(placement.transform, "translateY(-50%)", "{anchor:?}");
            assert_eq!(placement.inset_edges.to_vec(), vec![edge], "{anchor:?}");
            assert!(placement.caps_viewport_height, "{anchor:?}");
            // A side dock must not pick up the horizontal-edge centering.
            assert_ne!(placement.transform, "translateX(-50%)", "{anchor:?}");
        }
        // corners: both insets, no centering transform, alignment flips.
        for (anchor, edges, align) in [
            (DockBarAnchor::TopLeft, ["top", "left"], "flex-start"),
            (DockBarAnchor::TopRight, ["top", "right"], "flex-end"),
            (DockBarAnchor::BottomLeft, ["bottom", "left"], "flex-start"),
            (DockBarAnchor::BottomRight, ["bottom", "right"], "flex-end"),
        ] {
            let placement = dock_bar_placement(anchor);
            assert!(placement.absolute, "{anchor:?}");
            assert_eq!(placement.transform, "", "{anchor:?}");
            assert_eq!(placement.inset_edges.to_vec(), edges.to_vec(), "{anchor:?}");
            assert_eq!(placement.align_items, Some(align), "{anchor:?}");
            assert!(!placement.caps_viewport_height, "{anchor:?}");
        }
        // plane is the ONLY in-flow anchor: the host provides the plane, and
        // its rest distance is the bottom gap as a margin (see the field doc).
        let plane = dock_bar_placement(DockBarAnchor::Plane);
        assert!(!plane.absolute);
        assert_eq!(plane.inset_edges.to_vec(), vec!["bottom"]);
        assert_eq!(plane.transform, "");
    }

    /** One anchor's content bands as (padding property, edge) pairs. */
    fn bands_of(anchor: DockBarAnchor) -> Vec<(&'static str, &'static str)> {
        dock_bar_placement(anchor)
            .bands
            .iter()
            .map(|band| (band.padding, band.edge))
            .collect()
    }

    #[test]
    fn dock_bar_content_bands_cover_every_anchor() {
        // The sheet's band table, transcribed: the padding face that points at
        // the content, and the edge gap that fills it. A dock that lost its
        // band would let content touch the surface again (the 2026-11-15 bug);
        // a band on the wrong face would push the surface off its edge.
        let cases: [(DockBarAnchor, &[(&str, &str)]); 10] = [
            (DockBarAnchor::Page, &[("padding-block-start", "bottom")]),
            (DockBarAnchor::Bottom, &[("padding-block-start", "bottom")]),
            (DockBarAnchor::Plane, &[("padding-block-start", "bottom")]),
            (DockBarAnchor::Top, &[("padding-block-end", "top")]),
            (DockBarAnchor::Left, &[("padding-inline-end", "left")]),
            (DockBarAnchor::Right, &[("padding-inline-start", "right")]),
            (
                DockBarAnchor::TopLeft,
                &[("padding-block-end", "top"), ("padding-inline-end", "left")],
            ),
            (
                DockBarAnchor::TopRight,
                &[("padding-block-end", "top"), ("padding-inline-start", "right")],
            ),
            (
                DockBarAnchor::BottomLeft,
                &[("padding-block-start", "bottom"), ("padding-inline-end", "left")],
            ),
            (
                DockBarAnchor::BottomRight,
                &[("padding-block-start", "bottom"), ("padding-inline-start", "right")],
            ),
        ];
        assert_eq!(cases.len(), ALL_ANCHORS.len());
        for (anchor, expected) in cases {
            assert_eq!(bands_of(anchor), expected.to_vec(), "{anchor:?}");
            // Every band reads a compass edge through the same chain the rest
            // inset uses — no band invents a fourth distance.
            for (padding, edge) in bands_of(anchor) {
                assert!(
                    matches!(edge, "top" | "right" | "bottom" | "left"),
                    "{anchor:?}: {padding} reads {edge}"
                );
                assert!(
                    matches!(
                        padding,
                        "padding-block-start"
                            | "padding-block-end"
                            | "padding-inline-start"
                            | "padding-inline-end"
                    ),
                    "{anchor:?}: {padding}"
                );
            }
        }
    }

    #[test]
    fn dock_bar_edge_gap_matches_the_sheet_chain() {
        // `--hk-dock-gap` is DECLARED once by the foundation layer; the
        // per-edge name, then the legacy single value, then the 16px default
        // are read-time fallbacks. Pre-declaring a per-edge alias on :root
        // would freeze it against descendant overrides, so the per-edge token
        // may only appear as the chain's FIRST link.
        assert_eq!(DOCK_BAR_GAP_DEFAULT, "var(--space-16, 1rem)");
        assert_eq!(
            DOCK_BAR_INSET,
            "var(--hk-dock-inset, var(--hk-dock-gap, var(--space-16, 1rem)))"
        );
        assert!(!DOCK_BAR_INSET.contains("--hk-dock-gap-"));
        for edge in ["top", "right", "bottom", "left"] {
            assert_eq!(
                dock_bar_gap(edge),
                format!("var(--hk-dock-gap-{edge}, {DOCK_BAR_INSET})"),
                "{edge}"
            );
            // The resting inset is the resolved gap PLUS that edge's
            // safe-area inset (0 on a desktop viewport).
            assert_eq!(
                dock_bar_inset(edge),
                format!(
                    "calc(var(--hk-dock-gap-{edge}, {DOCK_BAR_INSET}) + env(safe-area-inset-{edge}, 0px))"
                ),
                "{edge}"
            );
        }
    }

    #[test]
    fn dock_bar_style_writes_the_four_size_hooks() {
        assert_eq!(dock_bar_style(None, None, None, None), "");
        assert_eq!(
            dock_bar_style(Some("22rem"), None, None, None),
            "--dock-width:22rem"
        );
        assert_eq!(
            dock_bar_style(Some("22rem"), Some("30rem"), Some("60vh"), Some("4px 6px")),
            "--dock-width:22rem;--dock-max-width:30rem;--dock-max-height:60vh;--dock-padding:4px 6px"
        );
        // Blank values carry no hook.
        assert_eq!(dock_bar_style(Some(""), None, None, None), "");
    }

    #[test]
    fn dock_bar_style_drops_values_that_would_escape_their_declaration() {
        // Vue's `style.setProperty` rejects these; the mirror drops them so a
        // prop can never rewrite the element's style.
        assert_eq!(safe_declaration_value("22rem"), Some("22rem"));
        assert_eq!(safe_declaration_value("4px 6px"), Some("4px 6px"));
        assert_eq!(
            safe_declaration_value("var(--x, 1px)"),
            Some("var(--x, 1px)")
        );
        assert_eq!(safe_declaration_value("22rem;position:fixed"), None);
        assert_eq!(safe_declaration_value("22rem}body{"), None);
        assert_eq!(safe_declaration_value("   "), None);
        assert_eq!(
            dock_bar_style(Some("22rem;position:fixed"), None, None, None),
            ""
        );
        assert_eq!(
            dock_bar_style(Some("22rem"), Some("30rem;color:red"), None, None),
            "--dock-width:22rem"
        );
    }

    #[test]
    fn dock_bar_root_classes_match_the_vue_markup() {
        assert_eq!(dock_bar_root_classes(""), "hk-dock-bar");
        assert_eq!(dock_bar_root_classes("cruise"), "hk-dock-bar cruise");
    }

    #[test]
    fn dock_bar_render_contract() {
        let html = DockBar(DockBarProps {
            anchor: DockBarAnchor::TopLeft,
            surface: DockBarSurface::Solid,
            width: Some("22rem".to_string()),
            padding: Some("4px 6px".to_string()),
            children: rsx! {
                button { class: "probe", "go" }
            },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "<section",
            "class=\"hk-dock-bar\"",
            "data-anchor=\"top-left\"",
            "data-surface=\"solid\"",
            "class=\"hk-dock-bar-surface\"",
            ">go<",
            "probe",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The size hooks ride the style attribute; unset hooks stay absent.
        assert!(html.contains("--dock-width:22rem"), "{html}");
        assert!(html.contains("--dock-padding:4px 6px"), "{html}");
        assert!(!html.contains("--dock-max-width"), "{html}");
        assert!(!html.contains("--dock-max-height"), "{html}");
        // No invented role / aria / SVG host: the Vue dock ships none.
        assert!(!html.contains("role="), "{html}");
        assert!(!html.contains("aria-"), "{html}");
        assert!(!html.contains("display:contents"), "{html}");
    }

    #[test]
    fn dock_bar_omits_the_style_attribute_without_size_props() {
        let html = DockBar(DockBarProps {
            children: rsx! {
                span { "x" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("data-anchor=\"page\""), "{html}");
        assert!(html.contains("data-surface=\"glass\""), "{html}");
        assert!(!html.contains("style="), "{html}");
    }

    #[test]
    fn dock_bar_styles_come_from_the_canonical_vue_sheet() {
        let css = DockBarComponent::styles();
        assert!(
            css.contains(".hk-dock-bar")
                && css.contains(".hk-dock-bar-surface")
                && css.contains("data-anchor"),
            "dock-bar css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored dock-bar sheet"
        );
    }

    #[test]
    fn dock_bar_styles_compile_the_whole_edge_gap_geometry() {
        // The Rust form renders the SAME sheet, so the grass compile has to
        // carry the whole family: the four private per-edge resolvers, the
        // resting insets (gap + safe-area), the content bands and the two
        // viewport caps. A compiler that dropped or rewrote one of them would
        // ship unstyled geometry while the Vue form looked right.
        let css = DockBarComponent::styles();
        for edge in ["top", "right", "bottom", "left"] {
            let chain = format!(
                "--_hk-dock-gap-{edge}: var(--hk-dock-gap-{edge}, var(--hk-dock-inset, var(--hk-dock-gap, var(--space-16, 1rem))))"
            );
            assert!(css.contains(&chain), "missing {chain}\n{css}");
            let inset =
                format!("calc(var(--_hk-dock-gap-{edge}) + env(safe-area-inset-{edge}, 0px))");
            assert!(css.contains(&inset), "missing {inset}\n{css}");
        }
        for band in [
            "padding-block-start: var(--_hk-dock-gap-bottom)",
            "padding-block-end: var(--_hk-dock-gap-top)",
            "padding-inline-end: var(--_hk-dock-gap-left)",
            "padding-inline-start: var(--_hk-dock-gap-right)",
        ] {
            assert!(css.contains(band), "missing {band}\n{css}");
        }
        assert!(
            css.contains(
                "max-width: var(--dock-max-width, calc(100vw - var(--_hk-dock-gap-left) - var(--_hk-dock-gap-right)))"
            ),
            "{css}"
        );
        assert!(
            css.contains(
                "max-height: var(--dock-max-height, calc(100dvh - var(--_hk-dock-gap-top) - var(--_hk-dock-gap-bottom)))"
            ),
            "{css}"
        );
    }
}
