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
// Replaces nothing: the family had no Rust counterpart for the dock container.
// Relationship to the scroll family (kept from Vue): docks that live INSIDE a
// scrolling region belong to the scroll container's dock slots; this component
// carries docks that FLOAT over a canvas/page. Do not nest it inside a scroll
// viewport expecting pinning.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DockBarComponent;

/// The shared inset token every anchored mode reads (declared by the
/// foundation layer; the sheet's fallback is 12px).
pub const DOCK_BAR_INSET: &str = "var(--hk-dock-inset, 12px)";

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
    /// The edges pinned with [`DOCK_BAR_INSET`], in the sheet's order.
    pub inset_edges: &'static [&'static str],
    /// The vertical side anchors cap the surface height viewport-aware
    /// (`calc(100dvh - …)`) by default; `--dock-max-height` still overrides.
    pub caps_viewport_height: bool,
}

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
            caps_viewport_height: false,
        },
        DockBarAnchor::Top => DockBarPlacement {
            absolute: true,
            transform: "translateX(-50%)",
            align_items: None,
            inset_edges: &["top"],
            caps_viewport_height: false,
        },
        // Vertical docks run along the tall axis and are centered by
        // translateY; their surface gets the viewport-aware height cap.
        DockBarAnchor::Left => DockBarPlacement {
            absolute: true,
            transform: "translateY(-50%)",
            align_items: None,
            inset_edges: &["left"],
            caps_viewport_height: true,
        },
        DockBarAnchor::Right => DockBarPlacement {
            absolute: true,
            transform: "translateY(-50%)",
            align_items: None,
            inset_edges: &["right"],
            caps_viewport_height: true,
        },
        DockBarAnchor::TopLeft => DockBarPlacement {
            absolute: true,
            transform: "",
            align_items: Some("flex-start"),
            inset_edges: &["top", "left"],
            caps_viewport_height: false,
        },
        DockBarAnchor::TopRight => DockBarPlacement {
            absolute: true,
            transform: "",
            align_items: Some("flex-end"),
            inset_edges: &["top", "right"],
            caps_viewport_height: false,
        },
        DockBarAnchor::BottomLeft => DockBarPlacement {
            absolute: true,
            transform: "",
            align_items: Some("flex-start"),
            inset_edges: &["bottom", "left"],
            caps_viewport_height: false,
        },
        DockBarAnchor::BottomRight => DockBarPlacement {
            absolute: true,
            transform: "",
            align_items: Some("flex-end"),
            inset_edges: &["bottom", "right"],
            caps_viewport_height: false,
        },
        // NOT a compass direction: the host provides the plane (e.g. a fixed
        // footer band) and this container only centers the surface in flow.
        DockBarAnchor::Plane => DockBarPlacement {
            absolute: false,
            transform: "",
            align_items: None,
            inset_edges: &[],
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
        // plane is the ONLY in-flow anchor: the host provides the plane.
        let plane = dock_bar_placement(DockBarAnchor::Plane);
        assert!(!plane.absolute);
        assert!(plane.inset_edges.is_empty());
        assert_eq!(plane.transform, "");
        assert_eq!(DOCK_BAR_INSET, "var(--hk-dock-inset, 12px)");
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
}
