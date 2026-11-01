// packages/components/src/scene/minimap.rs
// Minimap — mirror of the canonical Vue `HkMinimap`: the corner overview map
// (boxes + hub + viewport rectangle) with its zoom bar, slider pop and the
// 2026-10-27 collapse affordance.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMinimap.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `manifest.tsv`), compiled with
// `no_hash` so `.hk-minimap*` / `.hk-mm-*` are literal and identical in both
// forms. The DOM contract below mirrors the Vue render output one-to-one:
//
//   div.hk-minimap[data-dragging][data-toolbar-only][data-collapsible]
//     span[style="display:contents"] > the map <svg>   (omitted with toolbarOnly)
//                                       (see `minimap_map_markup`)
//     div.hk-mm-zoom-bar
//       button.hk-mm-zoom-btn[disabled] aria-label="Zoom out" title=…
//       button.hk-mm-zoom-label[aria-haspopup=dialog][aria-expanded][title]
//              "{zoomPercent}%"
//       button.hk-mm-zoom-btn[disabled] aria-label="Zoom in" title=…
//       button.hk-mm-zoom-btn.hk-mm-zoom-reset-btn[aria-label="Reset zoom"]  (showReset)
//       button.hk-mm-zoom-btn.hk-mm-collapse-btn[aria-label="Hide minimap"]  (collapsible)
//     div.hk-mm-zoom-pop                              (sliderOpen only)
//       div.hk-slider…                                (the MIRRORED `Slider`, size sm)
//       div.hk-mm-zoom-pop-scale[aria-hidden="true"]
//         span "{minZoomPercent}%"  span "{maxZoomPercent}%"
//
//   button.hk-minimap.hk-minimap--collapsed[aria-label][title]   (collapsed)
//     span[style="display:contents"] > lucide map svg (16px)
//
// Vue prop mapping: `boxes` / `hubPos` / `imageSrc` / `imageBounds` → the
// [`MinimapBox`] / [`MinimapPoint`] / `image_src` / `image_bounds` props,
// `zoom` / `panX` / `panY` → the camera the map projects, `viewportWidth` /
// `viewportHeight` → the (unmeasured) viewport box, `contentBounds` →
// [`MinimapProps::content_bounds`], `zoomPercent` / `canZoomIn` /
// `canZoomOut` → the zoom bar's state, `zoomStepPercent` / `minZoomPercent` /
// `maxZoomPercent` → the governance, `showReset` / `toolbarOnly` /
// `collapsible` / `collapsed` → the render gates. Emits: `zoomTo(percent,
// source)` → [`MinimapProps::on_zoom_to`] carrying a
// [`MinimapZoomRequest`], `reset` → `on_reset`, `panDelta(dx, dy)` →
// `on_pan_delta`, `update:collapsed` → `on_collapsed_change`.
//
// The geometry is Vue's, helper by helper (see [`minimap_projection`],
// [`minimap_project`], [`minimap_viewport_rect`], [`minimap_pan_delta`],
// [`minimap_step_zoom`]) so a host can reproduce the drawn map exactly — the
// math assumes the main surface uses `translate(panX, panY) scale(zoom)` with
// `transform-origin: 0 0`, the `HkImageViewer` model.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] NO MEASUREMENT SEAM for the SVG. Vue reads
//     `root.querySelector("svg").getBoundingClientRect()` to convert drawn
//     pixels into viewBox units (the `HkMinimap.scale` contract). The crate
//     can only measure an element it holds a handle for — the drag surface's
//     own `currentTarget` — so [`minimap_pan_delta`] is fed the ROOT card's
//     measured width instead of the inner `<svg>`'s. The card is the svg plus
//     its 1px borders, so the conversion differs by ~1.25% on a 160px card
//     (and by exactly zero for a host that renders the map borderless); a
//     host that needs Vue's number recomputes it from the same helper.
//   * [D] NO POINTER CAPTURE. `setPointerCapture` is not exposed, so a drag
//     that leaves the card stops emitting until the pointer returns; `up` /
//     `cancel` on the card still end it. Same delta as the mirrored `Slider`.
//   * [D] NO DOCUMENT-LEVEL DISMISSAL for the slider pop. Vue installs
//     capture-phase `pointerdown` / `keydown` listeners on `document` while
//     the pop is open (outside click, Escape). This crate has no
//     document-level listener seam, so `slider_open` is a CONTROLLED prop:
//     the labels toggle it, a real map drag dismisses it (Vue does the same),
//     and the host owns Escape / outside-click (`on_slider_open_change`).
//   * [D] the drag flag lives in a module `thread_local!` cell keyed by the
//     drag surface's element handle (the house non-reactive pattern from
//     `basic/slider.rs`): only the surface that was pressed continues the
//     drag, and two minimaps on one page never cross-talk. `data-dragging` is
//     read from that cell at render time, so it can lag the gesture by one
//     render (the `panDelta` that re-renders the host catches it up); it
//     never gates behaviour.
//   * [D] the zoom-chrome guard. Vue tests
//     `target.closest(".hk-mm-zoom-bar") || target.closest(".hk-mm-zoom-pop")`
//     on the pointerdown target. The crate has no `closest()` on an event
//     target, so the bar and the pop mark the gesture in the same module
//     registry from their own `pointerdown` (which runs FIRST — they are the
//     descendants) and the card consumes that mark before arming a drag. The
//     observable rule is identical, and the event still bubbles to the host
//     exactly like Vue's (the mark does not stop propagation).
//   * [D] the map is ONE trusted markup string through `dangerous_inner_html`
//     on a `style="display:contents"` host (the crate-wide SVG rule:
//     tairitsu creates elements in the HTML namespace, so an rsx `svg {}`
//     child would never paint, and a `rect`/`circle`/`image` subtree cannot
//     be spelled in rsx at all). Every consumer string that enters that
//     markup (`box.color`, `imageSrc`) is attribute-escaped by
//     [`minimap_escape_attr`]; numbers are formatted by [`minimap_number`].
//   * [D] `{zoomPercent}%` is rendered through [`minimap_format_percent`]:
//     Vue interpolates the raw number (`String(100)` → `"100"`), and the
//     helper keeps that exact text instead of Rust's `100.0`.
//   * [D] `collapsed` is CONTROLLED. Vue's `collapsed` is `undefined` for the
//     uncontrolled form and the component owns the flag; the crate has no
//     internal state, so the mirror is controlled-only (`on_collapsed_change`
//     reports the `update:collapsed` intent from both the collapsed glyph and
//     the minimize button). Collapsing also dismisses the pop, like Vue.
//   * [D] `aria-label`s / `title`s read `components.hk.minimap.*` through
//     `hikari_i18n::t`; Vue hard-codes the English literals. The fallbacks are
//     those same words, so the English DOM is identical. The six keys are NEW
//     (listed in the wave receipt).
//   * the pop's slider is the MIRRORED `basic::slider::Slider` (`size: sm`,
//     `formatValue` → `"{v}%"`), so a registry host needs the `slider` entry
//     too — exactly the sub-sheet this component's Vue build imports.
//
// New file: the family had no Rust minimap.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamp chains, index loops and inline tuple types keep the
// port auditable against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::manual_clamp)]
#![allow(clippy::manual_range_contains)]
#![allow(clippy::needless_range_loop)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
use std::cell::Cell;

use hikari_i18n::t;
use tairitsu_vdom::{DomHandle, PointerEvent, get_bounding_client_rect};

use crate::basic::slider::{Slider, SliderSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MinimapComponent;

// ── geometry constants (Vue: `svgW` / `svgH`) ───────────────────────────

/// The map's viewBox width: `const svgW = 160`.
pub const MINIMAP_SVG_W: f64 = 160.0;

/// The map's viewBox height: `const svgH = 110`.
pub const MINIMAP_SVG_H: f64 = 110.0;

/// Vue's overpan floor for the content's own extent
/// (`Math.max(contentBounds.w * 0.5, viewportWidth * 0.3)`).
pub const MINIMAP_OVERPAN_CONTENT_RATIO: f64 = 0.5;

/// Vue's overpan floor for the viewport's extent.
pub const MINIMAP_OVERPAN_VIEWPORT_RATIO: f64 = 0.3;

/// Vue's float slack on both step guards (`max - 1e-9` / `min + 1e-9`) and on
/// the "did the step move?" test.
pub const MINIMAP_ZOOM_EPSILON: f64 = 1e-9;

// ── zoom governance defaults (Vue: `zoomStepPercent` / `min` / `max`) ───

/// Default `zoomStepPercent`.
pub const MINIMAP_ZOOM_STEP_PERCENT: f64 = 5.0;

/// Default `minZoomPercent`.
pub const MINIMAP_MIN_ZOOM_PERCENT: f64 = 50.0;

/// Default `maxZoomPercent`.
pub const MINIMAP_MAX_ZOOM_PERCENT: f64 = 200.0;

/// Default `zoomPercent` (100%).
pub const MINIMAP_DEFAULT_ZOOM_PERCENT: f64 = 100.0;

/// Vue's `contentBounds` default: `{ x: 0, y: 0, w: 1200, h: 800 }`.
pub const MINIMAP_DEFAULT_CONTENT_BOUNDS: MinimapRect = MinimapRect {
    x: 0.0,
    y: 0.0,
    w: 1200.0,
    h: 800.0,
};

/// The hub marker's radius in viewBox units (Vue: `r={3}`).
pub const MINIMAP_HUB_RADIUS: f64 = 3.0;

/// A box marker's corner radius (Vue: `rx={2}` on both rect families).
pub const MINIMAP_RECT_RADIUS: f64 = 2.0;

// ── models (Vue's exported interfaces) ──────────────────────────────────

/// One content block drawn on the map (Vue: `MinimapBox`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct MinimapBox {
    /// Stable id (Vue's render key `mm-{id}`).
    pub id: String,
    /// The block's world rectangle.
    pub bounds: MinimapRect,
    /// Any CSS colour; it rides the markup through [`minimap_escape_attr`].
    pub color: String,
}

/// A world rectangle / a viewBox rectangle (Vue: `MinimapRect`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct MinimapRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// The hub's world position (Vue: `hubPos: { x, y } | null`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct MinimapPoint {
    pub x: f64,
    pub y: f64,
}

/// The drawn map's projection: the overpanned world rect, its fit scale and
/// the centring offsets inside the viewBox. Computed once per render by
/// [`minimap_projection`]; every other geometry helper takes it as input.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct MinimapProjection {
    /// The world rect the map draws (content inflated by the overpan).
    pub map: MinimapRect,
    /// viewBox units per world unit (`min(sx, sy)`).
    pub scale: f64,
    /// Inline centring offset inside the viewBox.
    pub offset_x: f64,
    /// Block centring offset inside the viewBox.
    pub offset_y: f64,
}

/// Which gesture asked for a zoom (Vue's `zoomTo` second argument): `step`
/// is a RELATIVE one-rung request, `slider` is an ABSOLUTE target.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum MinimapZoomSource {
    /// The ± buttons (Vue: `"step"`).
    #[default]
    Step,
    /// The pop's slider (Vue: `"slider"`).
    Slider,
}

impl MinimapZoomSource {
    /// The token Vue emits.
    pub fn token(self) -> &'static str {
        match self {
            MinimapZoomSource::Step => "step",
            MinimapZoomSource::Slider => "slider",
        }
    }
}

/// Vue's `zoomTo(percent, source)` payload, resolved into one callback arg.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct MinimapZoomRequest {
    /// The clamped target percent.
    pub percent: f64,
    /// Where the request came from.
    pub source: MinimapZoomSource,
}

/// The lucide glyphs the card uses, each at Vue's own per-use size.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MinimapGlyph {
    /// The collapsed affordance's glyph (`<MapIcon size={16} />`).
    Map,
    /// The zoom-out button (`size={12}`).
    ZoomOut,
    /// The zoom-in button (`size={12}`).
    ZoomIn,
    /// The reset button (`size={11}`).
    RotateCcw,
    /// The minimize button (`size={11}`).
    Minimize2,
}

impl MinimapGlyph {
    /// The lucide icon name (drives the wrapper's `lucide-{name}` classes).
    pub fn lucide_name(self) -> &'static str {
        match self {
            MinimapGlyph::Map => "map",
            MinimapGlyph::ZoomOut => "zoom-out",
            MinimapGlyph::ZoomIn => "zoom-in",
            MinimapGlyph::RotateCcw => "rotate-ccw",
            MinimapGlyph::Minimize2 => "minimize-2",
        }
    }

    /// The icon's children, byte-identical to the lucide package.
    pub fn body(self) -> &'static str {
        match self {
            MinimapGlyph::Map => MAP_BODY,
            MinimapGlyph::ZoomOut => ZOOM_OUT_BODY,
            MinimapGlyph::ZoomIn => ZOOM_IN_BODY,
            MinimapGlyph::RotateCcw => ROTATE_CCW_BODY,
            MinimapGlyph::Minimize2 => MINIMIZE_2_BODY,
        }
    }

    /// The size Vue passes at this use site.
    pub fn size(self) -> u32 {
        match self {
            MinimapGlyph::Map => 16,
            MinimapGlyph::ZoomOut | MinimapGlyph::ZoomIn => 12,
            MinimapGlyph::RotateCcw | MinimapGlyph::Minimize2 => 11,
        }
    }
}

/// One child of the zoom bar, in Vue's DOM order (out → label → in → reset →
/// collapse; the last two only when their prop is set).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MinimapBarItem {
    /// The zoom-out button (`-zoomStepPercent`).
    StepOut,
    /// The percent label button (toggles the slider pop).
    Label,
    /// The zoom-in button (`+zoomStepPercent`).
    StepIn,
    /// The reset button (`showReset`).
    Reset,
    /// The minimize button (`collapsible`).
    Collapse,
}

// ── lucide glyph bodies (ISC; children of the shared svg frame) ──────────

const ZOOM_OUT_BODY: &str = r#"<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>"#;
const ZOOM_IN_BODY: &str = r#"<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>"#;
const ROTATE_CCW_BODY: &str =
    r#"<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>"#;
const MINIMIZE_2_BODY: &str =
    r#"<path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/>"#;
const MAP_BODY: &str = r#"<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>"#;

// ── the projection (pure) ──────────────────────────────────────────────

/// Vue's overpan for one axis: `Math.max(content * 0.5, viewport * 0.3)`.
pub fn minimap_overpan(content_extent: f64, viewport_extent: f64) -> f64 {
    (content_extent * MINIMAP_OVERPAN_CONTENT_RATIO)
        .max(viewport_extent * MINIMAP_OVERPAN_VIEWPORT_RATIO)
}

/// The world rect the map draws: the content inflated by the overpan on all
/// four sides (Vue's `mapRect` computed).
pub fn minimap_map_rect(
    content: MinimapRect,
    viewport_width: f64,
    viewport_height: f64,
) -> MinimapRect {
    let overpan_w = minimap_overpan(content.w, viewport_width);
    let overpan_h = minimap_overpan(content.h, viewport_height);
    MinimapRect {
        x: content.x - overpan_w,
        y: content.y - overpan_h,
        w: content.w + overpan_w * 2.0,
        h: content.h + overpan_h * 2.0,
    }
}

/// The fit scale: `min(svgW / mapRect.w, svgH / mapRect.h)`. Vue divides
/// unchecked; a degenerate (non-positive) extent resolves to `0` here so the
/// map paints nothing instead of an Infinity-scaled rect.
pub fn minimap_map_scale(map: &MinimapRect) -> f64 {
    if !(map.w > 0.0) || !(map.h > 0.0) || !map.w.is_finite() || !map.h.is_finite() {
        return 0.0;
    }
    (MINIMAP_SVG_W / map.w).min(MINIMAP_SVG_H / map.h)
}

/// Vue's `contentOffset`: where the drawn rect starts, centring the shorter
/// axis inside the viewBox.
pub fn minimap_map_offset(map: &MinimapRect, scale: f64) -> (f64, f64) {
    let drawn_w = map.w * scale;
    let drawn_h = map.h * scale;
    (
        (MINIMAP_SVG_W - drawn_w) / 2.0,
        (MINIMAP_SVG_H - drawn_h) / 2.0,
    )
}

/// The full projection — Vue computes `mapRect`, `scale` and `contentOffset`
/// as three computeds and every later call reads all three.
pub fn minimap_projection(
    content: MinimapRect,
    viewport_width: f64,
    viewport_height: f64,
) -> MinimapProjection {
    let map = minimap_map_rect(content, viewport_width, viewport_height);
    let scale = minimap_map_scale(&map);
    let (offset_x, offset_y) = minimap_map_offset(&map, scale);
    MinimapProjection {
        map,
        scale,
        offset_x,
        offset_y,
    }
}

/// Vue's `toMap(wx, wy)`: world units → viewBox units.
pub fn minimap_project(projection: &MinimapProjection, world_x: f64, world_y: f64) -> (f64, f64) {
    (
        (world_x - projection.map.x) * projection.scale + projection.offset_x,
        (world_y - projection.map.y) * projection.scale + projection.offset_y,
    )
}

/// One box's drawn rectangle (Vue: `toMap(bounds.x, bounds.y)` + `w * scale`).
pub fn minimap_box_rect(projection: &MinimapProjection, bounds: MinimapRect) -> MinimapRect {
    let (x, y) = minimap_project(projection, bounds.x, bounds.y);
    MinimapRect {
        x,
        y,
        w: bounds.w * projection.scale,
        h: bounds.h * projection.scale,
    }
}

/// Vue's `viewportRect` computed: the visible world window under
/// `translate(pan) scale(zoom)`, projected and floored at 1 unit so a fully
/// zoomed-out camera still paints a line.
pub fn minimap_viewport_rect(
    projection: &MinimapProjection,
    zoom: f64,
    pan_x: f64,
    pan_y: f64,
    viewport_width: f64,
    viewport_height: f64,
) -> MinimapRect {
    let zoom = if zoom > 0.0 && zoom.is_finite() {
        zoom
    } else {
        1.0
    };
    let left = -pan_x / zoom;
    let top = -pan_y / zoom;
    let (tl_x, tl_y) = minimap_project(projection, left, top);
    let (br_x, br_y) = minimap_project(
        projection,
        left + viewport_width / zoom,
        top + viewport_height / zoom,
    );
    MinimapRect {
        x: tl_x,
        y: tl_y,
        w: (br_x - tl_x).max(1.0),
        h: (br_y - tl_y).max(1.0),
    }
}

/// Vue's `onMove` pan conversion: one drawn pixel is `svgW / rect.width`
/// viewBox units, the scale turns those into world units, and the camera's
/// `zoom` turns those into the pan the host applies. The sign is negated: the
/// scene follows the pointer the other way.
pub fn minimap_pan_delta(
    dx_px: f64,
    dy_px: f64,
    drawn_width_px: f64,
    scale: f64,
    zoom: f64,
) -> (f64, f64) {
    if !(scale > 0.0) || !scale.is_finite() {
        return (0.0, 0.0);
    }
    // Vue: `rect && rect.width > 0 ? svgW / rect.width : 1`.
    let units = if drawn_width_px > 0.0 && drawn_width_px.is_finite() {
        MINIMAP_SVG_W / drawn_width_px
    } else {
        1.0
    };
    (
        (-dx_px * units / scale) * zoom,
        (-dy_px * units / scale) * zoom,
    )
}

// ── the zoom ladder (pure) ─────────────────────────────────────────────

/// Vue's `canStepIn`: `canZoomIn && zoomPercent < maxZoomPercent - 1e-9`.
pub fn minimap_can_step_in(can_zoom_in: bool, percent: f64, max_percent: f64) -> bool {
    can_zoom_in && percent < max_percent - MINIMAP_ZOOM_EPSILON
}

/// Vue's `canStepOut`: `canZoomOut && zoomPercent > minZoomPercent + 1e-9`.
pub fn minimap_can_step_out(can_zoom_out: bool, percent: f64, min_percent: f64) -> bool {
    can_zoom_out && percent > min_percent + MINIMAP_ZOOM_EPSILON
}

/// Vue's `stepZoom(dir)`: step by the fixed increment, clamp to `[min, max]`
/// (in Vue's order: `Math.min(max, Math.max(min, raw))`) and return `None`
/// when the clamped target does not move — Vue emits nothing there, which is
/// also what keeps the button visually inert at the bounds.
pub fn minimap_step_zoom(
    percent: f64,
    direction: i32,
    step: f64,
    min_percent: f64,
    max_percent: f64,
) -> Option<f64> {
    let raw = percent + f64::from(direction) * step;
    let next = raw.max(min_percent).min(max_percent);
    if (next - percent).abs() < MINIMAP_ZOOM_EPSILON {
        None
    } else {
        Some(next)
    }
}

// ── render gates + text (pure) ─────────────────────────────────────────

/// Vue's first render gate: `if (boxes.length === 0 && !imageSrc &&
/// !toolbarOnly) return null;`
pub fn minimap_visible(has_boxes: bool, has_image: bool, toolbar_only: bool) -> bool {
    has_boxes || has_image || toolbar_only
}

/// The percent label Vue interpolates (`{zoomPercent}%`), with JS's number
/// spelling (`100`, not Rust's `100.0`).
pub fn minimap_format_percent(percent: f64) -> String {
    format!("{}%", minimap_number(percent))
}

/// The zoom bar's children in Vue's DOM order (the gates only ever append).
pub fn minimap_bar_items(show_reset: bool, collapsible: bool) -> Vec<MinimapBarItem> {
    let mut items = vec![
        MinimapBarItem::StepOut,
        MinimapBarItem::Label,
        MinimapBarItem::StepIn,
    ];
    if show_reset {
        items.push(MinimapBarItem::Reset);
    }
    if collapsible {
        items.push(MinimapBarItem::Collapse);
    }
    items
}

/// The class list of one bar child, exactly as Vue spells it.
pub fn minimap_bar_item_classes(item: MinimapBarItem) -> &'static str {
    match item {
        MinimapBarItem::StepOut | MinimapBarItem::StepIn => "hk-mm-zoom-btn",
        MinimapBarItem::Label => "hk-mm-zoom-label",
        MinimapBarItem::Reset => "hk-mm-zoom-btn hk-mm-zoom-reset-btn",
        MinimapBarItem::Collapse => "hk-mm-zoom-btn hk-mm-collapse-btn",
    }
}

/// The `aria-label` / `title` Vue gives one bar child (the label button's is
/// the slider title — it has no `aria-label`, its text is the percent).
pub fn minimap_bar_item_label(item: MinimapBarItem) -> String {
    match item {
        MinimapBarItem::StepOut => t("components.hk.minimap.zoomOut", "Zoom out"),
        MinimapBarItem::StepIn => t("components.hk.minimap.zoomIn", "Zoom in"),
        MinimapBarItem::Label => t("components.hk.minimap.zoomSlider", "Zoom level"),
        MinimapBarItem::Reset => t("components.hk.minimap.reset", "Reset zoom"),
        MinimapBarItem::Collapse => t("components.hk.minimap.collapseMap", "Hide minimap"),
    }
}

/// The glyph of one bar child (`None` for the percent label).
pub fn minimap_bar_item_glyph(item: MinimapBarItem) -> Option<MinimapGlyph> {
    match item {
        MinimapBarItem::StepOut => Some(MinimapGlyph::ZoomOut),
        MinimapBarItem::StepIn => Some(MinimapGlyph::ZoomIn),
        MinimapBarItem::Reset => Some(MinimapGlyph::RotateCcw),
        MinimapBarItem::Collapse => Some(MinimapGlyph::Minimize2),
        MinimapBarItem::Label => None,
    }
}

/// Vue's disabled guards: the step buttons follow `canStepOut` / `canStepIn`;
/// the reset and collapse buttons are never disabled.
pub fn minimap_bar_item_disabled(
    item: MinimapBarItem,
    can_zoom_in: bool,
    can_zoom_out: bool,
    percent: f64,
    min_percent: f64,
    max_percent: f64,
) -> bool {
    match item {
        MinimapBarItem::StepOut => !minimap_can_step_out(can_zoom_out, percent, min_percent),
        MinimapBarItem::StepIn => !minimap_can_step_in(can_zoom_in, percent, max_percent),
        MinimapBarItem::Label | MinimapBarItem::Reset | MinimapBarItem::Collapse => false,
    }
}

// ── the drawn map (trusted markup) ─────────────────────────────────────

/// A number as the SVG markup spells it: at most two decimals, no trailing
/// zeros, never `-0` (Vue's SVG would carry the full JS float; two decimals
/// are below a viewBox unit's visible resolution).
pub fn minimap_number(value: f64) -> String {
    if !value.is_finite() {
        return "0".to_string();
    }
    if value == 0.0 {
        // Catches -0.0 as well: the markup must never read `x="-0"`.
        return "0".to_string();
    }
    let snapped = (value * 100.0).round() / 100.0;
    let mut text = format!("{snapped:.2}");
    while text.ends_with('0') {
        text.pop();
    }
    if text.ends_with('.') {
        text.pop();
    }
    text
}

/// Attribute escape for the consumer strings that enter the map markup
/// (`box.color`, `imageSrc`). Escaping the five markup-significant characters
/// is what keeps a hostile colour or URL from breaking out of the attribute.
pub fn minimap_escape_attr(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            // Newlines/tabs inside an attribute value would be folded by the
            // HTML parser anyway; keep them from smuggling whitespace runs.
            '\n' | '\r' | '\t' => out.push(' '),
            _ => out.push(ch),
        }
    }
    out
}

/// The lucide `<svg>` Vue renders for a glyph at its per-use size.
pub fn minimap_glyph_markup(glyph: MinimapGlyph) -> String {
    let name = glyph.lucide_name();
    let size = glyph.size();
    let body = glyph.body();
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-{name}-icon lucide-{name}" aria-hidden="true">{body}</svg>"#
    )
}

/// Everything the map markup needs beyond the projection.
pub struct MinimapMapRequest<'a> {
    /// The content blocks, in the caller's order (Vue's `v-for`).
    pub boxes: &'a [MinimapBox],
    /// The hub marker's world position, if any.
    pub hub: Option<MinimapPoint>,
    /// The viewport rectangle in viewBox units ([`minimap_viewport_rect`]).
    pub viewport: MinimapRect,
    /// The background image: its source and its world rect (Vue:
    /// `imageBounds ?? contentBounds`).
    pub image: Option<(&'a str, MinimapRect)>,
}

/// Vue's `svg.hk-minimap-svg` subtree, as one trusted markup string: image →
/// boxes → hub → viewport rectangle, in that paint order.
pub fn minimap_map_markup(
    projection: &MinimapProjection,
    request: &MinimapMapRequest<'_>,
) -> String {
    let mut svg = String::with_capacity(256);
    svg.push_str(&format!(
        r#"<svg viewBox="0 0 {} {}" width="{}" height="{}" class="hk-minimap-svg">"#,
        minimap_number(MINIMAP_SVG_W),
        minimap_number(MINIMAP_SVG_H),
        minimap_number(MINIMAP_SVG_W),
        minimap_number(MINIMAP_SVG_H),
    ));

    if let Some((src, bounds)) = request.image {
        let rect = minimap_box_rect(projection, bounds);
        svg.push_str(&format!(
            r#"<image href="{}" x="{}" y="{}" width="{}" height="{}" preserveAspectRatio="none" class="hk-mm-image"></image>"#,
            minimap_escape_attr(src),
            minimap_number(rect.x),
            minimap_number(rect.y),
            minimap_number(rect.w),
            minimap_number(rect.h),
        ));
    }

    for entry in request.boxes {
        let rect = minimap_box_rect(projection, entry.bounds);
        let color = minimap_escape_attr(&entry.color);
        svg.push_str(&format!(
            r#"<rect x="{}" y="{}" width="{}" height="{}" rx="{}" fill="{}" style="fill:{};stroke:{}" opacity="0.28" stroke="{}" stroke-width="0.6"></rect>"#,
            minimap_number(rect.x),
            minimap_number(rect.y),
            minimap_number(rect.w),
            minimap_number(rect.h),
            minimap_number(MINIMAP_RECT_RADIUS),
            color,
            color,
            color,
            color,
        ));
    }

    if let Some(hub) = request.hub {
        let (cx, cy) = minimap_project(projection, hub.x, hub.y);
        svg.push_str(&format!(
            r#"<circle cx="{}" cy="{}" r="{}" fill="rgb(var(--color-primary))" style="fill:rgb(var(--color-primary))" filter="drop-shadow(0 0 2px rgb(var(--color-primary) / 0.6))"></circle>"#,
            minimap_number(cx),
            minimap_number(cy),
            minimap_number(MINIMAP_HUB_RADIUS),
        ));
    }

    svg.push_str(&format!(
        r#"<rect x="{}" y="{}" width="{}" height="{}" fill="none" stroke="rgb(var(--color-primary))" style="stroke:rgb(var(--color-primary))" stroke-width="1" stroke-dasharray="3 2" rx="{}" opacity="0.85"></rect>"#,
        minimap_number(request.viewport.x),
        minimap_number(request.viewport.y),
        minimap_number(request.viewport.w.max(1.0)),
        minimap_number(request.viewport.h.max(1.0)),
        minimap_number(MINIMAP_RECT_RADIUS),
    ));

    svg.push_str("</svg>");
    svg
}

// ── gesture registries (the crate's non-reactive house pattern) ─────────

thread_local! {
    /// The in-flight map drag: `(drag surface handle, last client x, last
    /// client y)`. One pointer drags one surface, and the handle keeps two
    /// minimaps on one page from cross-talking.
    static MINIMAP_DRAG: Cell<Option<(u64, i32, i32)>> = const { Cell::new(None) };
    /// Set by the zoom bar / pop on their own `pointerdown`, consumed by the
    /// card in the same event (see the header's zoom-chrome delta).
    static MINIMAP_CHROME_PRESS: Cell<bool> = const { Cell::new(false) };
}

/// Arm the map drag for `surface` (a `None` handle — non-DOM builds — arms
/// nothing, so a measure-less host emits no bogus pan).
pub fn minimap_drag_begin(surface: Option<u64>, client_x: i32, client_y: i32) {
    let Some(surface) = surface else {
        return;
    };
    MINIMAP_DRAG.with(|drag| drag.set(Some((surface, client_x, client_y))));
}

/// The pointer delta since the last move ON THE SAME SURFACE, re-anchoring
/// the drag to this event. `None` when this surface is not the one dragging.
pub fn minimap_drag_delta(
    surface: Option<u64>,
    client_x: i32,
    client_y: i32,
) -> Option<(i32, i32)> {
    let surface = surface?;
    MINIMAP_DRAG.with(|drag| match drag.get() {
        Some((owner, last_x, last_y)) if owner == surface => {
            drag.set(Some((owner, client_x, client_y)));
            Some((client_x - last_x, client_y - last_y))
        }
        _ => None,
    })
}

/// End the drag (Vue: `onUp` / `onPointercancel`).
pub fn minimap_drag_end() {
    MINIMAP_DRAG.with(|drag| drag.set(None));
}

/// Whether a map drag is in flight (the `data-dragging` hook).
pub fn minimap_is_dragging() -> bool {
    MINIMAP_DRAG.with(|drag| drag.get().is_some())
}

/// Mark that the gesture began inside the zoom chrome (bar / pop).
pub fn minimap_mark_chrome_press() {
    MINIMAP_CHROME_PRESS.with(|flag| flag.set(true));
}

/// Consume the chrome-press mark: `true` when the gesture began in the chrome
/// and must not arm a map drag (Vue's `target.closest(...)` test).
pub fn minimap_take_chrome_press() -> bool {
    MINIMAP_CHROME_PRESS.with(|flag| flag.replace(false))
}

/// The measured width of the element behind an event handle, or `0` when the
/// host cannot measure it (non-DOM builds report a zero rect).
fn minimap_measured_width(handle: Option<u64>) -> f64 {
    let Some(handle) = handle else {
        return 0.0;
    };
    let rect = get_bounding_client_rect(DomHandle::from_raw(handle));
    if rect.width.is_finite() && rect.width > 0.0 {
        rect.width
    } else {
        0.0
    }
}

/// Vue's presence-attribute marker (`dragging ? "" : undefined`): the empty
/// value keeps `[data-dragging]` matching while the attribute is absent at
/// rest.
fn minimap_marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("") } else { None }
}

// ── render assembly ────────────────────────────────────────────────────

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule).
fn minimap_glyph_host(markup: &str) -> VNode {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

/// One round bar button (`button.hk-mm-zoom-btn[.hk-mm-zoom-*]`), Vue's own
/// chrome rather than the `HButton` family.
fn minimap_bar_button(
    item: MinimapBarItem,
    disabled: bool,
    onclick: EventHandler<MouseEvent>,
) -> VNode {
    let label = minimap_bar_item_label(item);
    let glyph = minimap_bar_item_glyph(item);
    let inner = match glyph {
        Some(glyph) => minimap_glyph_host(&minimap_glyph_markup(glyph)),
        None => empty_vnode(),
    };
    rsx! {
        button {
            class: minimap_bar_item_classes(item),
            "type": "button",
            "aria-label": label.clone(),
            title: label,
            disabled: disabled,
            onclick: move |event: MouseEvent| onclick.call(event),
            {inner}
        }
    }
}

// ── props ──────────────────────────────────────────────────────────────

#[define_props]
pub struct MinimapProps {
    /// The content blocks to draw (Vue: `boxes`, default `[]`).
    pub boxes: Vec<MinimapBox>,

    /// The hub marker (Vue: `hubPos`, default `null`).
    pub hub_pos: Option<MinimapPoint>,

    /// Optional background image source (Vue: `imageSrc`); when set the map
    /// renders even with no boxes (image-navigator form).
    pub image_src: Option<String>,

    /// The background image's world rect (Vue: `imageBounds`, falling back to
    /// [`MinimapProps::content_bounds`] like `imageBounds ?? contentBounds`).
    pub image_bounds: Option<MinimapRect>,

    /// The main surface's camera scale (`translate(panX, panY) scale(zoom)`).
    #[default(1.0)]
    pub zoom: f64,

    /// The main surface's camera pan, inline axis.
    #[default]
    pub pan_x: f64,

    /// The main surface's camera pan, block axis.
    #[default]
    pub pan_y: f64,

    /// The viewport's width in px (Vue measures it; the host passes it).
    #[default(800.0)]
    pub viewport_width: f64,

    /// The viewport's height in px.
    #[default(600.0)]
    pub viewport_height: f64,

    /// The pannable content's world rect (Vue: `contentBounds`).
    #[default(MINIMAP_DEFAULT_CONTENT_BOUNDS)]
    pub content_bounds: MinimapRect,

    /// The zoom bar's current percent (Vue: `zoomPercent`).
    #[default(MINIMAP_DEFAULT_ZOOM_PERCENT)]
    pub zoom_percent: f64,

    /// Extra zoom-in allowance (Vue: `canZoomIn`).
    #[default(true)]
    pub can_zoom_in: bool,

    /// Extra zoom-out allowance (Vue: `canZoomOut`).
    #[default(true)]
    pub can_zoom_out: bool,

    /// The zoom bar's fixed step (Vue: `zoomStepPercent`).
    #[default(MINIMAP_ZOOM_STEP_PERCENT)]
    pub zoom_step_percent: f64,

    /// The zoom bar's floor (Vue: `minZoomPercent`).
    #[default(MINIMAP_MIN_ZOOM_PERCENT)]
    pub min_zoom_percent: f64,

    /// The zoom bar's ceiling (Vue: `maxZoomPercent`).
    #[default(MINIMAP_MAX_ZOOM_PERCENT)]
    pub max_zoom_percent: f64,

    /// Render the reset button (Vue: `showReset`).
    #[default]
    pub show_reset: bool,

    /// Render the zoom bar alone, with no overview map (Vue: `toolbarOnly`).
    #[default]
    pub toolbar_only: bool,

    /// Render the minimize button (Vue: `collapsible`).
    #[default]
    pub collapsible: bool,

    /// The collapsed state (Vue: `collapsed`; controlled here, see the
    /// header) — the card folds into the semi-transparent map-icon button.
    #[default]
    pub collapsed: bool,

    /// Whether the slider pop is open (Vue's internal `sliderOpen`; controlled
    /// here, see the header).
    #[default]
    pub slider_open: bool,

    /// Zoom request — a clamped percent plus the gesture source (Vue:
    /// `zoomTo`).
    pub on_zoom_to: Option<EventHandler<MinimapZoomRequest>>,

    /// Reset intent (Vue: `reset`).
    pub on_reset: Option<EventHandler<MouseEvent>>,

    /// Pan request in world px (Vue: `panDelta`).
    pub on_pan_delta: Option<EventHandler<(f64, f64)>>,

    /// Collapse intent (Vue: `update:collapsed`).
    pub on_collapsed_change: Option<EventHandler<bool>>,

    /// Slider-pop open/close intent (Vue's local `sliderOpen` writes).
    pub on_slider_open_change: Option<EventHandler<bool>>,
}

#[component]
pub fn Minimap(props: MinimapProps) -> Element {
    let has_boxes = !props.boxes.is_empty();
    // Vue tests `props.imageSrc` for truthiness, so `""` is "no image".
    let has_image = props
        .image_src
        .as_deref()
        .is_some_and(|src| !src.is_empty());

    // Vue: `if (boxes.length === 0 && !imageSrc && !toolbarOnly) return null;`
    if !minimap_visible(has_boxes, has_image, props.toolbar_only) {
        return empty_vnode();
    }

    // ── the collapsed affordance ───────────────────────────────────────
    if props.collapsed {
        let label = t("components.hk.minimap.expandMap", "Show minimap");
        let on_expand = props.on_collapsed_change.clone();
        let glyph = minimap_glyph_host(&minimap_glyph_markup(MinimapGlyph::Map));
        return rsx! {
            button {
                class: "hk-minimap hk-minimap--collapsed",
                "type": "button",
                "aria-label": label.clone(),
                title: label,
                // Vue arms the collapsed glyph's pointer handlers too, but
                // `onDown` returns immediately while collapsed — so it is a
                // plain button, never a drag surface.
                onclick: move |_event: MouseEvent| {
                    if let Some(handler) = on_expand.as_ref() {
                        handler.call(false);
                    }
                },
                {glyph}
            }
        };
    }

    // ── the camera (all Copy, so the handlers below capture snapshots) ──
    let zoom = props.zoom;
    let pan_x = props.pan_x;
    let pan_y = props.pan_y;
    let zoom_percent = props.zoom_percent;
    let zoom_step = props.zoom_step_percent;
    let min_zoom = props.min_zoom_percent;
    let max_zoom = props.max_zoom_percent;
    let can_zoom_in = props.can_zoom_in;
    let can_zoom_out = props.can_zoom_out;
    let viewport_width = props.viewport_width;
    let viewport_height = props.viewport_height;
    let slider_open = props.slider_open;
    let toolbar_only = props.toolbar_only;

    let projection = minimap_projection(props.content_bounds, viewport_width, viewport_height);
    let viewport = minimap_viewport_rect(
        &projection,
        zoom,
        pan_x,
        pan_y,
        viewport_width,
        viewport_height,
    );

    // ── the map (one trusted markup string) ────────────────────────────
    let image = if has_image {
        let src = props.image_src.as_deref().unwrap_or_default();
        // Vue: `imageBounds ?? contentBounds`.
        Some((src, props.image_bounds.unwrap_or(props.content_bounds)))
    } else {
        None
    };
    let map_node = if toolbar_only {
        empty_vnode()
    } else {
        let markup = minimap_map_markup(
            &projection,
            &MinimapMapRequest {
                boxes: &props.boxes,
                hub: props.hub_pos,
                viewport,
                image,
            },
        );
        rsx! {
            span {
                style: "display:contents",
                dangerous_inner_html: markup,
            }
        }
    };

    // ── the zoom bar ───────────────────────────────────────────────────
    let on_zoom_to_step = props.on_zoom_to.clone();
    let step_out_handler = {
        let on_zoom_to = on_zoom_to_step.clone();
        move |_event: MouseEvent| {
            if let Some(percent) =
                minimap_step_zoom(zoom_percent, -1, zoom_step, min_zoom, max_zoom)
            {
                if let Some(handler) = on_zoom_to.as_ref() {
                    handler.call(MinimapZoomRequest {
                        percent,
                        source: MinimapZoomSource::Step,
                    });
                }
            }
        }
    };
    let step_in_handler = {
        let on_zoom_to = on_zoom_to_step;
        move |_event: MouseEvent| {
            if let Some(percent) = minimap_step_zoom(zoom_percent, 1, zoom_step, min_zoom, max_zoom)
            {
                if let Some(handler) = on_zoom_to.as_ref() {
                    handler.call(MinimapZoomRequest {
                        percent,
                        source: MinimapZoomSource::Step,
                    });
                }
            }
        }
    };
    let on_reset = props.on_reset.clone();
    let reset_handler = move |event: MouseEvent| {
        if let Some(handler) = on_reset.as_ref() {
            handler.call(event);
        }
    };
    let on_collapsed_change = props.on_collapsed_change.clone();
    let collapse_handler = move |_event: MouseEvent| {
        // Vue: `toggleCollapsed(true)` also dismisses the pop and ends a drag.
        minimap_drag_end();
        if let Some(handler) = on_collapsed_change.as_ref() {
            handler.call(true);
        }
    };
    let on_slider_open_change = props.on_slider_open_change.clone();
    let label_handler = move |_event: MouseEvent| {
        if let Some(handler) = on_slider_open_change.as_ref() {
            handler.call(!slider_open);
        }
    };

    let percent_label = minimap_format_percent(zoom_percent);
    // Pre-rendered because `rsx!` only interpolates the pure `"{expr}"` form as
    // a child of a plain element — a `"{x}%"` literal would paint verbatim.
    let min_zoom_label = minimap_format_percent(min_zoom);
    let max_zoom_label = minimap_format_percent(max_zoom);
    let zoom_slider_label = t("components.hk.minimap.zoomSlider", "Zoom level");
    let aria_expanded = if slider_open {
        "true".to_string()
    } else {
        "false".to_string()
    };
    let label_node = rsx! {
        button {
            class: minimap_bar_item_classes(MinimapBarItem::Label),
            "type": "button",
            "aria-haspopup": "dialog",
            "aria-expanded": aria_expanded,
            title: zoom_slider_label.clone(),
            onclick: label_handler,
            "{percent_label}"
        }
    };

    let mut bar_nodes: Vec<VNode> = Vec::with_capacity(5);
    for item in minimap_bar_items(props.show_reset, props.collapsible) {
        let disabled = minimap_bar_item_disabled(
            item,
            can_zoom_in,
            can_zoom_out,
            zoom_percent,
            min_zoom,
            max_zoom,
        );
        let node = match item {
            MinimapBarItem::Label => label_node.clone(),
            MinimapBarItem::StepOut => {
                minimap_bar_button(item, disabled, EventHandler::new(step_out_handler.clone()))
            }
            MinimapBarItem::StepIn => {
                minimap_bar_button(item, disabled, EventHandler::new(step_in_handler.clone()))
            }
            MinimapBarItem::Reset => {
                minimap_bar_button(item, disabled, EventHandler::new(reset_handler.clone()))
            }
            MinimapBarItem::Collapse => {
                minimap_bar_button(item, disabled, EventHandler::new(collapse_handler.clone()))
            }
        };
        bar_nodes.push(node);
    }
    let bar_node = rsx! {
        div {
            class: "hk-mm-zoom-bar",
            // Vue: the zoom chrome never starts a map drag (the mark is read
            // by the card's own pointerdown, which runs after this one).
            onpointerdown: move |_event: PointerEvent| minimap_mark_chrome_press(),
            {VNode::Fragment(bar_nodes)}
        }
    };

    // ── the slider pop ─────────────────────────────────────────────────
    let pop_node = if slider_open {
        let on_zoom_to = props.on_zoom_to.clone();
        let on_input = EventHandler::new(move |value: f64| {
            if let Some(handler) = on_zoom_to.as_ref() {
                handler.call(MinimapZoomRequest {
                    percent: value,
                    source: MinimapZoomSource::Slider,
                });
            }
        });
        let format_value = Callback::new(minimap_format_percent);
        rsx! {
            div {
                class: "hk-mm-zoom-pop",
                onpointerdown: move |_event: PointerEvent| minimap_mark_chrome_press(),
                Slider {
                    value: zoom_percent,
                    min: min_zoom,
                    max: max_zoom,
                    step: zoom_step,
                    size: SliderSize::Sm,
                    aria_label: Some(zoom_slider_label),
                    format_value: Some(format_value),
                    on_input: Some(on_input),
                }
                div {
                    class: "hk-mm-zoom-pop-scale",
                    "aria-hidden": "true",
                    span { "{min_zoom_label}" }
                    span { "{max_zoom_label}" }
                }
            }
        }
    } else {
        empty_vnode()
    };

    // ── the card ───────────────────────────────────────────────────────
    let on_pan_delta = props.on_pan_delta.clone();
    let on_slider_open_change = props.on_slider_open_change.clone();
    let pointer_down = move |event: PointerEvent| {
        // Vue: a press in the zoom chrome leaves everything alone (it returns
        // BEFORE dismissing the pop and before arming the drag).
        if minimap_take_chrome_press() {
            return;
        }
        // Vue: a real map drag puts the slider away.
        if slider_open {
            if let Some(handler) = on_slider_open_change.as_ref() {
                handler.call(false);
            }
        }
        event.stop_propagation();
        event.prevent_default();
        minimap_drag_begin(event.current_target, event.client_x, event.client_y);
    };
    let pointer_move = move |event: PointerEvent| {
        let Some((dx, dy)) =
            minimap_drag_delta(event.current_target, event.client_x, event.client_y)
        else {
            return;
        };
        event.stop_propagation();
        let drawn_width = minimap_measured_width(event.current_target);
        let (pan_dx, pan_dy) = minimap_pan_delta(
            f64::from(dx),
            f64::from(dy),
            drawn_width,
            projection.scale,
            zoom,
        );
        if let Some(handler) = on_pan_delta.as_ref() {
            handler.call((pan_dx, pan_dy));
        }
    };

    rsx! {
        div {
            class: "hk-minimap",
            "data-dragging": minimap_marker_attr(minimap_is_dragging()),
            "data-toolbar-only": minimap_marker_attr(toolbar_only),
            "data-collapsible": minimap_marker_attr(props.collapsible),
            onpointerdown: pointer_down,
            onpointermove: pointer_move,
            onpointerup: move |_event: PointerEvent| minimap_drag_end(),
            onpointercancel: move |_event: PointerEvent| minimap_drag_end(),
            {map_node}
            {bar_node}
            {pop_node}
        }
    }
}

impl StyledComponent for MinimapComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-minimap*` / `.hk-mm-*` names literal).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMinimap.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "minimap"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn boxed(id: &str) -> MinimapBox {
        MinimapBox {
            id: id.to_string(),
            bounds: MinimapRect {
                x: 0.0,
                y: 0.0,
                w: 100.0,
                h: 80.0,
            },
            color: "#e0533d".to_string(),
        }
    }

    fn approx(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-6,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn minimap_defaults_match_the_vue_props() {
        let props = MinimapProps::default();
        assert!(props.boxes.is_empty());
        assert_eq!(props.hub_pos, None);
        assert_eq!(props.image_src, None);
        assert_eq!(props.image_bounds, None);
        assert_eq!(props.zoom, 1.0);
        assert_eq!(props.pan_x, 0.0);
        assert_eq!(props.pan_y, 0.0);
        assert_eq!(props.viewport_width, 800.0);
        assert_eq!(props.viewport_height, 600.0);
        // Vue: `contentBounds: { x: 0, y: 0, w: 1200, h: 800 }`.
        assert_eq!(props.content_bounds, MINIMAP_DEFAULT_CONTENT_BOUNDS);
        assert_eq!(props.zoom_percent, 100.0);
        assert!(props.can_zoom_in);
        assert!(props.can_zoom_out);
        assert_eq!(props.zoom_step_percent, 5.0);
        assert_eq!(props.min_zoom_percent, 50.0);
        assert_eq!(props.max_zoom_percent, 200.0);
        assert!(!props.show_reset);
        assert!(!props.toolbar_only);
        assert!(!props.collapsible);
        // Vue: `collapsed` / `sliderOpen` start closed (the uncontrolled
        // form starts expanded and the pop starts shut).
        assert!(!props.collapsed);
        assert!(!props.slider_open);
        assert!(props.on_zoom_to.is_none());
        assert!(props.on_reset.is_none());
        assert!(props.on_pan_delta.is_none());
        assert!(props.on_collapsed_change.is_none());
        assert!(props.on_slider_open_change.is_none());
        // The exported viewBox is Vue's `const svgW/svgH`.
        assert_eq!(MINIMAP_SVG_W, 160.0);
        assert_eq!(MINIMAP_SVG_H, 110.0);
    }

    #[test]
    fn minimap_bar_class_names_match_the_vue_chrome() {
        assert_eq!(
            minimap_bar_item_classes(MinimapBarItem::StepOut),
            "hk-mm-zoom-btn"
        );
        assert_eq!(
            minimap_bar_item_classes(MinimapBarItem::StepIn),
            "hk-mm-zoom-btn"
        );
        assert_eq!(
            minimap_bar_item_classes(MinimapBarItem::Label),
            "hk-mm-zoom-label"
        );
        assert_eq!(
            minimap_bar_item_classes(MinimapBarItem::Reset),
            "hk-mm-zoom-btn hk-mm-zoom-reset-btn"
        );
        assert_eq!(
            minimap_bar_item_classes(MinimapBarItem::Collapse),
            "hk-mm-zoom-btn hk-mm-collapse-btn"
        );
        // The collapsed affordance's own root class pair.
        assert_eq!(MinimapGlyph::Map.size(), 16);
        assert_eq!(MinimapGlyph::ZoomOut.size(), 12);
        assert_eq!(MinimapGlyph::ZoomIn.size(), 12);
        assert_eq!(MinimapGlyph::RotateCcw.size(), 11);
        assert_eq!(MinimapGlyph::Minimize2.size(), 11);
        assert_eq!(MinimapZoomSource::Step.token(), "step");
        assert_eq!(MinimapZoomSource::Slider.token(), "slider");
    }

    #[test]
    fn minimap_bar_items_follow_the_vue_render_order_and_gates() {
        assert_eq!(
            minimap_bar_items(false, false),
            vec![
                MinimapBarItem::StepOut,
                MinimapBarItem::Label,
                MinimapBarItem::StepIn
            ]
        );
        assert_eq!(
            minimap_bar_items(true, true),
            vec![
                MinimapBarItem::StepOut,
                MinimapBarItem::Label,
                MinimapBarItem::StepIn,
                MinimapBarItem::Reset,
                MinimapBarItem::Collapse
            ]
        );
        // Labels are the i18n fallbacks Vue hard-codes.
        assert_eq!(minimap_bar_item_label(MinimapBarItem::StepOut), "Zoom out");
        assert_eq!(minimap_bar_item_label(MinimapBarItem::StepIn), "Zoom in");
        assert_eq!(minimap_bar_item_label(MinimapBarItem::Label), "Zoom level");
        assert_eq!(minimap_bar_item_label(MinimapBarItem::Reset), "Reset zoom");
        assert_eq!(
            minimap_bar_item_label(MinimapBarItem::Collapse),
            "Hide minimap"
        );
        assert_eq!(
            minimap_bar_item_glyph(MinimapBarItem::StepOut),
            Some(MinimapGlyph::ZoomOut)
        );
        assert_eq!(
            minimap_bar_item_glyph(MinimapBarItem::Collapse),
            Some(MinimapGlyph::Minimize2)
        );
        assert_eq!(minimap_bar_item_glyph(MinimapBarItem::Label), None);
    }

    #[test]
    fn minimap_projection_matches_the_vue_computeds() {
        // content 1200x800, viewport 800x600:
        //   overpan = max(600, 240) x max(400, 180) = 600 x 400
        //   mapRect = (-600, -400) 2400x1600
        //   scale   = min(160/2400, 110/1600) = 1/15
        //   offset  = (0, (110 - 1600/15)/2)
        let projection = minimap_projection(MINIMAP_DEFAULT_CONTENT_BOUNDS, 800.0, 600.0);
        assert_eq!(
            projection.map,
            MinimapRect {
                x: -600.0,
                y: -400.0,
                w: 2400.0,
                h: 1600.0,
            }
        );
        approx(projection.scale, 1.0 / 15.0);
        approx(projection.offset_x, 0.0);
        approx(projection.offset_y, (110.0 - 1600.0 / 15.0) / 2.0);

        // `toMap(0, 0)` is the content's top-left corner on the map.
        let (x, y) = minimap_project(&projection, 0.0, 0.0);
        approx(x, 40.0);
        approx(y, 400.0 / 15.0 + projection.offset_y);
        // An overpan helper is `max(content * 0.5, viewport * 0.3)`.
        assert_eq!(minimap_overpan(1200.0, 800.0), 600.0);
        assert_eq!(minimap_overpan(100.0, 800.0), 240.0);
        // A degenerate content rect paints nothing instead of Infinity.
        assert_eq!(
            minimap_map_scale(&MinimapRect {
                x: 0.0,
                y: 0.0,
                w: 0.0,
                h: 800.0
            }),
            0.0
        );
    }

    #[test]
    fn minimap_viewport_rect_projects_the_camera_window() {
        let projection = minimap_projection(MINIMAP_DEFAULT_CONTENT_BOUNDS, 800.0, 600.0);
        // zoom 1, pan 0: the window is the viewport itself.
        let viewport = minimap_viewport_rect(&projection, 1.0, 0.0, 0.0, 800.0, 600.0);
        approx(viewport.x, 40.0);
        approx(viewport.y, 400.0 / 15.0 + projection.offset_y);
        approx(viewport.w, 800.0 / 15.0);
        approx(viewport.h, 600.0 / 15.0);

        // Zooming in halves the window; panning right shifts it left.
        let zoomed = minimap_viewport_rect(&projection, 2.0, 0.0, 0.0, 800.0, 600.0);
        approx(zoomed.w, 400.0 / 15.0);
        // panX = 600 puts the window's top-left exactly on the content origin.
        let panned = minimap_viewport_rect(&projection, 1.0, 600.0, 0.0, 800.0, 600.0);
        approx(panned.x, 0.0);

        // A degenerate camera scale is read as 1 (Vue would divide by zero).
        let degenerate = minimap_viewport_rect(&projection, 0.0, 0.0, 0.0, 800.0, 600.0);
        approx(degenerate.w, 800.0 / 15.0);

        // The rect is floored at one unit so a tiny window still paints.
        let tiny = minimap_viewport_rect(&projection, 1000.0, 0.0, 0.0, 1.0, 1.0);
        assert!(tiny.w >= 1.0 && tiny.h >= 1.0);
    }

    #[test]
    fn minimap_pan_delta_scales_by_the_drawn_card_and_the_camera() {
        let projection = minimap_projection(MINIMAP_DEFAULT_CONTENT_BOUNDS, 800.0, 600.0);
        let scale = projection.scale;
        // A 40px rightward/20px downward drag at 1:1 drawing moves the scene
        // the OTHER way, through the map scale.
        let (dx, dy) = minimap_pan_delta(40.0, 20.0, MINIMAP_SVG_W, scale, 1.0);
        approx(dx, -40.0 / scale);
        approx(dy, -20.0 / scale);
        assert!(dx < 0.0, "the scene follows the pointer the other way");

        // Drawn TWICE as wide ⇒ half the travel for the same pointer (the
        // `HkMinimap.scale` contract).
        let (wide_dx, wide_dy) = minimap_pan_delta(40.0, 20.0, MINIMAP_SVG_W * 2.0, scale, 1.0);
        approx(wide_dx, dx / 2.0);
        approx(wide_dy, dy / 2.0);

        // An unmeasurable card falls back to 1 unit per drawn pixel.
        let (fallback, _) = minimap_pan_delta(1.0, 0.0, 0.0, scale, 1.0);
        approx(fallback, -1.0 / scale);

        // The camera's own zoom multiplies the pan (Vue: `* props.zoom`).
        let (zoomed, _) = minimap_pan_delta(40.0, 0.0, MINIMAP_SVG_W, scale, 2.0);
        approx(zoomed, dx * 2.0);

        // A zero scale never divides.
        assert_eq!(
            minimap_pan_delta(40.0, 20.0, MINIMAP_SVG_W, 0.0, 1.0),
            (0.0, 0.0)
        );
    }

    #[test]
    fn minimap_zoom_ladder_clamps_and_no_ops_at_the_bounds() {
        // ±5% from 100 inside [50, 200].
        assert_eq!(minimap_step_zoom(100.0, 1, 5.0, 50.0, 200.0), Some(105.0));
        assert_eq!(minimap_step_zoom(100.0, -1, 5.0, 50.0, 200.0), Some(95.0));
        // Clamped at both ends.
        assert_eq!(minimap_step_zoom(198.0, 1, 5.0, 50.0, 200.0), Some(200.0));
        assert_eq!(minimap_step_zoom(52.0, -1, 5.0, 50.0, 200.0), Some(50.0));
        // At the bounds the clamped target does not move ⇒ NO emit (Vue
        // returns before `emit`).
        assert_eq!(minimap_step_zoom(200.0, 1, 5.0, 50.0, 200.0), None);
        assert_eq!(minimap_step_zoom(50.0, -1, 5.0, 50.0, 200.0), None);
        // A zero direction is a no-op.
        assert_eq!(minimap_step_zoom(100.0, 0, 5.0, 50.0, 200.0), None);

        // The endpoint guards carry the 1e-9 slack.
        assert!(minimap_can_step_in(true, 199.999, 200.0));
        assert!(!minimap_can_step_in(true, 200.0, 200.0));
        assert!(!minimap_can_step_in(false, 100.0, 200.0));
        assert!(minimap_can_step_out(true, 50.001, 50.0));
        assert!(!minimap_can_step_out(true, 50.0, 50.0));
        assert!(!minimap_can_step_out(false, 100.0, 50.0));

        // The disabled mapping: the step buttons follow the guards, the rest
        // are never disabled.
        assert!(minimap_bar_item_disabled(
            MinimapBarItem::StepIn,
            true,
            true,
            200.0,
            50.0,
            200.0
        ));
        assert!(minimap_bar_item_disabled(
            MinimapBarItem::StepOut,
            true,
            true,
            50.0,
            50.0,
            200.0
        ));
        assert!(!minimap_bar_item_disabled(
            MinimapBarItem::Reset,
            false,
            false,
            50.0,
            50.0,
            200.0
        ));
        assert!(!minimap_bar_item_disabled(
            MinimapBarItem::Label,
            false,
            false,
            50.0,
            50.0,
            200.0
        ));
    }

    #[test]
    fn minimap_render_gates_match_the_vue_computeds() {
        // `boxes.length === 0 && !imageSrc && !toolbarOnly` ⇒ nothing.
        assert!(!minimap_visible(false, false, false));
        assert!(minimap_visible(true, false, false));
        assert!(minimap_visible(false, true, false));
        assert!(minimap_visible(false, false, true));
        assert_eq!(
            Minimap(MinimapProps::default()).render_to_html(),
            "",
            "an empty map renders nothing at all"
        );
    }

    #[test]
    fn minimap_numbers_and_percents_follow_js_spelling() {
        assert_eq!(minimap_number(40.0), "40");
        assert_eq!(minimap_number(0.0), "0");
        assert_eq!(minimap_number(-0.0), "0");
        assert_eq!(minimap_number(53.333333), "53.33");
        assert_eq!(minimap_number(-2.5), "-2.5");
        assert_eq!(minimap_number(f64::NAN), "0");
        // Vue interpolates `{zoomPercent}%` — JS spells 100 as "100".
        assert_eq!(minimap_format_percent(100.0), "100%");
        assert_eq!(minimap_format_percent(125.5), "125.5%");
        assert_eq!(minimap_format_percent(-0.0), "0%");
    }

    #[test]
    fn minimap_map_markup_carries_the_vue_paint_order_and_escapes_input() {
        let projection = minimap_projection(MINIMAP_DEFAULT_CONTENT_BOUNDS, 800.0, 600.0);
        let viewport = minimap_viewport_rect(&projection, 1.0, 0.0, 0.0, 800.0, 600.0);
        let boxes = vec![boxed("b1")];
        let markup = minimap_map_markup(
            &projection,
            &MinimapMapRequest {
                boxes: &boxes,
                hub: Some(MinimapPoint { x: 600.0, y: 400.0 }),
                viewport,
                image: Some(("/shot.png", MINIMAP_DEFAULT_CONTENT_BOUNDS)),
            },
        );

        // The viewBox and the class Vue puts on the map svg.
        assert!(
            markup.starts_with(
                r#"<svg viewBox="0 0 160 110" width="160" height="110" class="hk-minimap-svg">"#
            ),
            "{markup}"
        );
        // Paint order: image → box → hub → viewport rect.
        let image = markup.find("<image ").expect("image");
        let box_rect = markup.find(r#"<rect x="40"#).expect("box rect");
        let hub = markup.find("<circle ").expect("hub circle");
        let window = markup.find("stroke-dasharray").expect("viewport rect");
        assert!(
            image < box_rect && box_rect < hub && hub < window,
            "{markup}"
        );
        assert!(markup.ends_with("</svg>"), "{markup}");
        // The box rect: 100x80 world units at 1/15 scale, dashed corners.
        assert!(
            markup.contains(r##"width="6.67" height="5.33" rx="2" fill="#e0533d""##),
            "{markup}"
        );
        assert!(
            markup.contains(r#"style="fill:#e0533d;stroke:#e0533d""#),
            "{markup}"
        );
        assert!(markup.contains(r#"opacity="0.28""#), "{markup}");
        // The hub circle rides `--color-primary`.
        assert!(
            markup.contains(r#"r="3" fill="rgb(var(--color-primary))""#),
            "{markup}"
        );
        // The viewport rect is the dashed primary outline Vue draws.
        assert!(
            markup.contains(r#"stroke-width="1" stroke-dasharray="3 2""#),
            "{markup}"
        );

        // Consumer strings are attribute-escaped, never interpolated raw.
        let hostile = vec![MinimapBox {
            id: "x".to_string(),
            bounds: MINIMAP_DEFAULT_CONTENT_BOUNDS,
            color: r#"" onload="alert(1)"#.to_string(),
        }];
        let escaped = minimap_map_markup(
            &projection,
            &MinimapMapRequest {
                boxes: &hostile,
                hub: None,
                viewport,
                image: Some((r#"/a"b.png"#, MINIMAP_DEFAULT_CONTENT_BOUNDS)),
            },
        );
        assert!(!escaped.contains(r#"" onload=""#), "{escaped}");
        assert!(escaped.contains("&quot;"), "{escaped}");
        assert!(!escaped.contains(r#"/a"b.png"#), "{escaped}");
        assert_eq!(
            minimap_escape_attr("a&b<c>d\"e'f"),
            "a&amp;b&lt;c&gt;d&quot;e&#39;f"
        );
    }

    #[test]
    fn minimap_gesture_registries_are_surface_scoped() {
        // Arming without a handle (non-DOM build) arms nothing.
        minimap_drag_begin(None, 10, 10);
        assert!(!minimap_is_dragging());
        assert!(minimap_drag_delta(Some(7), 20, 20).is_none());

        // Only the pressed surface reports deltas, and it re-anchors.
        minimap_drag_begin(Some(7), 100, 100);
        assert!(minimap_is_dragging());
        assert_eq!(minimap_drag_delta(Some(7), 140, 120), Some((40, 20)));
        assert_eq!(minimap_drag_delta(Some(7), 150, 130), Some((10, 10)));
        assert_eq!(minimap_drag_delta(Some(8), 999, 999), None);
        minimap_drag_end();
        assert!(!minimap_is_dragging());
        assert!(minimap_drag_delta(Some(7), 200, 200).is_none());

        // The chrome mark is consumed exactly once (the card's test).
        assert!(!minimap_take_chrome_press());
        minimap_mark_chrome_press();
        assert!(minimap_take_chrome_press());
        assert!(!minimap_take_chrome_press());
    }

    #[test]
    fn minimap_renders_the_vue_dom_contract() {
        let html = Minimap(MinimapProps {
            boxes: vec![boxed("b1")],
            zoom_percent: 125.0,
            show_reset: true,
            collapsible: true,
            ..Default::default()
        })
        .render_to_html();

        // The card, its two presence hooks, and the map behind a
        // display:contents host.
        assert!(html.contains(r#"class="hk-minimap""#), "{html}");
        assert!(!html.contains("data-toolbar-only"), "{html}");
        assert!(html.contains(r#"data-collapsible="""#), "{html}");
        assert!(html.contains(r#"style="display:contents""#), "{html}");
        assert!(html.contains(r#"class="hk-minimap-svg""#), "{html}");

        // The zoom bar, in Vue's order, with the percent label as a BUTTON.
        let bar = html.find(r#"class="hk-mm-zoom-bar""#).expect("zoom bar");
        let out = html.find(r#"aria-label="Zoom out""#).expect("zoom out");
        let label = html.find(r#"class="hk-mm-zoom-label""#).expect("label");
        let into = html.find(r#"aria-label="Zoom in""#).expect("zoom in");
        let reset = html.find(r#"aria-label="Reset zoom""#).expect("reset");
        let collapse = html.find(r#"aria-label="Hide minimap""#).expect("collapse");
        assert!(
            bar < out && out < label && label < into && into < reset && reset < collapse,
            "Vue's bar order is bar → out → label → in → reset → collapse: {html}"
        );
        assert!(
            html.contains(">125%<"),
            "the label shows the percent: {html}"
        );
        assert!(html.contains(r#"aria-haspopup="dialog""#), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        assert!(html.contains(r#"title="Zoom level""#), "{html}");
        // Closed pop ⇒ no slider and no captions.
        assert!(!html.contains("hk-mm-zoom-pop"), "{html}");
        assert!(!html.contains("hk-slider"), "{html}");
        assert!(html.contains("hk-mm-collapse-btn"), "{html}");
    }

    #[test]
    fn minimap_renders_the_slider_pop_and_the_toolbar_only_form() {
        let open = Minimap(MinimapProps {
            boxes: vec![boxed("b1")],
            slider_open: true,
            zoom_percent: 100.0,
            ..Default::default()
        })
        .render_to_html();
        // The pop, its mirrored slider (size sm) and the two captions.
        assert!(open.contains(r#"class="hk-mm-zoom-pop""#), "{open}");
        assert!(open.contains(r#"class="hk-slider""#), "{open}");
        assert!(open.contains(r#"data-size="sm""#), "{open}");
        assert!(open.contains(r#"aria-expanded="true""#), "{open}");
        assert!(
            open.contains(r#"class="hk-mm-zoom-pop-scale""#)
                && open.contains(r#"aria-hidden="true""#),
            "{open}"
        );
        assert!(open.contains(">50%<") && open.contains(">200%<"), "{open}");
        assert!(!open.contains("hk-mm-image"), "no image prop: {open}");

        // Toolbar-only: no map at all, the bar IS the card.
        let toolbar = Minimap(MinimapProps {
            toolbar_only: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(toolbar.contains("data-toolbar-only"), "{toolbar}");
        assert!(toolbar.contains(r#"class="hk-mm-zoom-bar""#), "{toolbar}");
        assert!(!toolbar.contains("hk-minimap-svg"), "{toolbar}");
    }

    #[test]
    fn minimap_renders_the_collapsed_affordance() {
        let html = Minimap(MinimapProps {
            boxes: vec![boxed("b1")],
            collapsed: true,
            collapsible: true,
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains(r#"class="hk-minimap hk-minimap--collapsed""#),
            "{html}"
        );
        assert!(html.contains(r#"type="button""#), "{html}");
        assert!(html.contains(r#"aria-label="Show minimap""#), "{html}");
        assert!(html.contains(r#"title="Show minimap""#), "{html}");
        assert!(html.contains("lucide-map"), "{html}");
        assert!(
            html.contains(r#"width="16""#),
            "the map glyph is 16px: {html}"
        );
        // Folded: no map, no zoom bar, and no drag surface at all.
        assert!(!html.contains("hk-minimap-svg"), "{html}");
        assert!(!html.contains("hk-mm-zoom-bar"), "{html}");
        assert!(
            !html.contains("onpointerdown") && !html.contains("data-dragging"),
            "{html}"
        );
    }

    #[test]
    fn minimap_styles_come_from_the_canonical_vue_sheet() {
        let css = MinimapComponent::styles();
        for class in [
            ".hk-minimap",
            ".hk-minimap-svg",
            ".hk-mm-zoom-bar",
            ".hk-mm-zoom-btn",
            ".hk-mm-zoom-label",
            ".hk-mm-zoom-pop",
            ".hk-mm-zoom-pop-scale",
            ".hk-mm-collapse-btn",
            ".hk-minimap--collapsed",
            "[data-dragging]",
            "[data-toolbar-only]",
        ] {
            assert!(
                css.contains(class),
                "minimap css must carry the vue selector {class:?}"
            );
        }
        // `hk-mm-zoom-reset-btn` is EMITTED by the render but the canonical
        // sheet styles the reset button through `.hk-mm-zoom-btn` alone (Vue
        // has no rule for it) — asserting it here would invent a selector.
        assert!(!css.contains(".hk-mm-zoom-reset-btn"), "{css}");
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored minimap sheet"
        );
        assert_eq!(MinimapComponent::name(), "minimap");
    }
}
