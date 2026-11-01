// hi-components/src/scene/node_canvas.rs
// NodeCanvas — mirror of the canonical Vue `HkNodeCanvas`: the base view for a
// pannable, zoomable node surface (industrial topology, media pipeline, topic
// map, ladder diagram — all the same shape: a CAMERA over a piece of content).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkNodeCanvas.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-node-canvas*` class name is literal and
// identical in both forms.
//
// DOM contract (mirrors the Vue render output):
//
//   div.hk-node-canvas[.hk-node-canvas--print]
//          [data-pannable] [aria-label]
//          [style="touch-action:none"][;width:Npx;height:Npx]   (print paper)
//     canvas.hk-node-canvas-canvas   [id]     ← the HOST CANVAS SLOT
//          style="position:absolute;inset:0;pointer-events:none"
//     span[style="display:contents"]           ← the SVG rule's host (L49)
//       svg.hk-node-canvas-edges
//              style="position:absolute;inset:0;pointer-events:none;overflow:visible"
//         g[transform="translate(X Y) scale(K)"]
//           g.hk-node-canvas-edge[.is-hovered][.is-selected][.is-dimmed]
//                  data-edge-id data-edge-type
//             path.hk-node-canvas-edge-halo          (interactive edges only)
//             path                                   (the ink, one per stroke)
//             text                                    (the label, if any)
//           path.hk-node-canvas-edge-hit                 (interactive only)
//                  data-edge-id  style="pointer-events:stroke"
//     div.hk-node-canvas-layer
//              style="transform:translate(Xpx, Ypx) scale(K)"
//       <default slot>                        (the host draws in WORLD units)
//     div.hk-node-canvas-overlay
//       <overlay slot>                        (SCREEN coordinates, unscaled)
//     div.hk-node-canvas-minimap[data-placement="bottom-right|…"]
//       <minimap slot>
//
// The camera is what this component owns, and it owns it once: how a wheel tick
// becomes a zoom step on a fixed grid, how a drag pans, how `fit()` frames the
// content, how a pinch zooms about its midpoint, how a screen point maps back
// into content coordinates, and how far the content hull may be pushed before
// the drag is refused. Everything else — node look, node data, node layout — is
// the host's, drawn through the default slot.
//
// Behaviour deltas vs Vue (documented, one per deviation):
//   * NO MEASUREMENT API. Vue measures the root with a `ResizeObserver` and
//     catches it on the first paint; the mirror cannot measure, so the viewport
//     is the `width`/`height` pair and the ROOT BOX ORIGIN
//     ([`NodeCanvasProps::origin`]) is a prop too — `getBoundingClientRect()` is
//     what Vue subtracts before a wheel zoom or a pinch.
//   * THE CAMERA IS A CONTROLLED PROP. Vue keeps `inner` when no `camera` prop is
//     given and mirrors a controlled host's write-back through a 64-slot pending
//     request queue with a 250 ms grace window (`REQUEST_GRACE_MS`,
//     `MAX_PENDING_REQUESTS`) because a store behind an RPC queue echoes late.
//     A mirror with no signal state cannot hold a queue, so the host owns the
//     camera outright: [`NodeCanvasProps::camera`] is the truth,
//     [`NodeCanvasProps::inner_camera`] is Vue's internal seed, every gesture
//     invokes [`NodeCanvasProps::on_camera_change`] with an ALREADY-NORMALISED,
//     ALREADY-CLAMPED camera (exactly what Vue emits), and the pending-request
//     machinery collapses into one rule the host can apply itself:
//     [`NODE_CANVAS_REQUEST_GRACE_MS`] + the fact that every emitted camera is
//     pre-clamped. `fit()` is [`node_canvas_fit_camera`]; the "one request
//     stands" latch is unnecessary when the host, not a queue, writes the value.
//   * THE EDGE LAYER IS INJECTED MARKUP. tairitsu's element tree has no
//     SVG-namespace creation path, so — the crate-wide SVG rule (L49) — the whole
//     `<svg>` goes through `dangerous_inner_html` on a `display:contents` host,
//     escaped by [`node_canvas_escape_html`]. The consequence is documented and
//     deliberate: an injected subtree carries no vdom event binding, so Vue's
//     `edge-hover` / `edge-click` / `edge-contextmenu` protocol is HOST-SIDE
//     here. The markup exposes `data-edge-id` / `data-edge-type` on every ink
//     and hit stroke, both the hover and the selection are CONTROLLED props
//     ([`NodeCanvasProps::hovered_edge_id`] / `selected_edge_id`), and the
//     interaction rules survive as pure helpers — the hover/dim class table
//     ([`node_canvas_edge_classes`]), the fat-hit width
//     ([`node_canvas_edge_hit_width`]) and the touch long-press window
//     ([`NODE_CANVAS_EDGE_HOLD_MS`] / [`node_canvas_edge_hold_survives`] /
//     [`node_canvas_suppresses_native_contextmenu`]).
//   * NO Canvas2D PAINTER LOOP / NO `onFrame`. Vue registers painters and runs
//     one rAF loop that transforms the 2D context into world coordinates. The
//     mirror keeps the `<canvas class="hk-node-canvas-canvas">` SLOT (the host
//     acquires the context) but owns no loop: `dt`, `lod` and the camera a
//     painter would receive are all pure here ([`node_canvas_lod_level`],
//     [`node_canvas_layer_transform`], [`node_canvas_world_to_screen`]), so a
//     host paints from its own clock.
//   * `exportSVG()` / `exportPNG()` ARE RETIRED: they build DOM nodes, which a
//     WASI host cannot. The vector payload is already in the DOM as injected
//     markup, and [`NodeCanvasProps::print_mode`] + `print_paper` still pin the
//     paper box through [`node_canvas_paper_size`].
//   * POINTER-CAPTURE BOOKKEEPING BECOMES THE COMPONENT'S ONLY STATE. Vue keeps
//     `panning` / `activePointers` / `pinchSnapshot` / `movedByHand` in closures
//     and listens on `window` for the release. The mirror has no signals, no
//     `window`, and no pointer capture, so the same machine lives in a
//     module-level `thread_local` registry keyed by
//     [`NodeCanvasProps::instance_key`] — [`node_canvas_begin_pointer`],
//     [`node_canvas_move_pointer`], [`node_canvas_end_pointer`],
//     [`node_canvas_blur`] — with Vue's `PAN_SLOP` still gating the first move.
//     A release that lands outside the surface is the host's to report (it has
//     the window); [`node_canvas_blur`] is the escape hatch Vue already has.
//   * THE `data-hk-canvas-no-pan` / `data-hk-canvas-pan` / overlay / minimap
//     press exclusions are DOM ancestry tests Vue can run (`closest`). A mirror
//     cannot, so [`NodeCanvasProps::pannable`] is the only gate and the host
//     suppresses a pan by not forwarding the pointer at all — the same opt-out
//     Vue documents, expressed at the boundary it now lives on.
//   * `user-select` on the edge hit strokes is the SHEET's job in both forms
//     (`.hk-node-canvas-edge-hit`); nothing extra is emitted.
//
// Replaces nothing: the family had no canvas base before this mirror.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamp chains, index loops and inline tuple types keep the
// port auditable against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::manual_clamp)]
#![allow(clippy::manual_range_contains)]
#![allow(clippy::needless_range_loop)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
use std::cell::RefCell;
use std::collections::HashMap;

use tairitsu_vdom::{PointerEvent, WheelEvent};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct NodeCanvasComponent;

// ── the camera defaults (Vue: NODE_CANVAS_DEFAULTS) ──────────────────────

/// One wheel/trackpad step multiplies zoom by this factor.
pub const NODE_CANVAS_ZOOM_FACTOR: f64 = 1.05;

/// The zoom band.
pub const NODE_CANVAS_MIN_ZOOM: f64 = 0.2;
pub const NODE_CANVAS_MAX_ZOOM: f64 = 4.0;

/// Zoom snaps to this grid so a wheel tick lands on a reproducible step.
pub const NODE_CANVAS_ZOOM_GRID_STEP: f64 = 0.05;

/// Padding (px) left around the content when fitting.
pub const NODE_CANVAS_FIT_PADDING: f64 = 40.0;

/// Largest zoom `fit` will choose, so a tiny graph is not blown up.
pub const NODE_CANVAS_FIT_CAP: f64 = 1.25;

/// How far a pointer may travel before a press stops being a tap.
pub const NODE_CANVAS_PAN_SLOP: f64 = 6.0;

/// How long a request made of a controlled host stays in flight before the host
/// is presumed not to have applied it (kept for parity — see the header).
pub const NODE_CANVAS_REQUEST_GRACE_MS: f64 = 250.0;

/// How many unanswered requests Vue remembers.
pub const NODE_CANVAS_MAX_PENDING_REQUESTS: usize = 64;

/// How far past the content hull the camera may push it, as a fraction of the
/// viewport per axis (0.5 = half a viewport).
pub const NODE_CANVAS_BOUNDS_MARGIN: f64 = 0.5;

/// How far an orthogonal stub leaves its anchor along the side normal.
pub const NODE_CANVAS_ORTHO_STUB: f64 = 24.0;

/// The bezier control-point extension floor, in world units.
pub const NODE_CANVAS_BEZIER_EXTENT_MIN: f64 = 40.0;

/// The bezier control-point extension, as a fraction of the anchor axis span.
pub const NODE_CANVAS_BEZIER_EXTENT_RATIO: f64 = 0.4;

/// An edge's default stroke width, in world units.
pub const NODE_CANVAS_EDGE_WIDTH: f64 = 1.5;

/// The invisible hit stroke is never thinner than this multiple of the ink…
pub const NODE_CANVAS_EDGE_HIT_RATIO: f64 = 2.5;

/// …and never thinner than this many SCREEN px (`10 / k` world units).
pub const NODE_CANVAS_EDGE_HIT_SCREEN_PX: f64 = 10.0;

/// The floor `k` may take inside the hit-width division.
pub const NODE_CANVAS_EDGE_HIT_MIN_ZOOM: f64 = 0.01;

/// Touch long-press on an edge's hit stroke: hold budget and travel slop.
pub const NODE_CANVAS_EDGE_HOLD_MS: f64 = 480.0;
pub const NODE_CANVAS_EDGE_HOLD_SLOP: f64 = 8.0;

/// How long after a synthesized long-press a native `contextmenu` is still the
/// same gesture, and how near the press point it must land.
pub const NODE_CANVAS_EDGE_SUPPRESS_MS: f64 = 400.0;
pub const NODE_CANVAS_EDGE_SUPPRESS_RADIUS: f64 = 32.0;

/// Vue's `LOD_DEFAULTS`: at or above `medium` full detail, at or above `low`
/// outlines + labels, below that outlines only.
pub const NODE_CANVAS_LOD_MEDIUM: f64 = 0.45;
pub const NODE_CANVAS_LOD_LOW: f64 = 0.18;

/// Paper dimensions in CSS pixels at 96 DPI (Vue: `PAPER_SIZES`).
pub const NODE_CANVAS_PAPER_A4_LANDSCAPE: (f64, f64) = (1122.5, 793.7);
pub const NODE_CANVAS_PAPER_A3_LANDSCAPE: (f64, f64) = (1587.4, 1122.5);

/// Vue's `clamp`: `Math.min(high, Math.max(low, value))`. Deliberately not
/// `f64::clamp`, which panics on a reversed band while Vue's tolerates one.
fn node_canvas_clamp(value: f64, low: f64, high: f64) -> f64 {
    high.min(low.max(value))
}

/// Vue's `Number(x.toFixed(6))`: the binary dust of `6 * 0.05` (0.30000000000000004)
/// must not survive into a camera.
fn node_canvas_round6(value: f64) -> f64 {
    if !value.is_finite() {
        return value;
    }
    (value * 1_000_000.0).round() / 1_000_000.0
}

/// A number as Vue's template interpolation would spell it (`String(n)`).
pub fn node_canvas_num(value: f64) -> String {
    format!("{value}")
}

// ── the camera (pure) ────────────────────────────────────────────────────

/// A camera: zoom factor plus the translation of the content origin.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct NodeCanvasCamera {
    /// Zoom factor (1 = 1:1).
    pub k: f64,
    /// Translation of the content origin, in screen pixels.
    pub x: f64,
    pub y: f64,
}

impl Default for NodeCanvasCamera {
    fn default() -> Self {
        Self {
            k: 1.0,
            x: 0.0,
            y: 0.0,
        }
    }
}

/// A rectangle in content (world) coordinates.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct NodeCanvasBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// A point — content (world) or viewport (screen) units, whichever the helper
/// documents.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct NodeCanvasPoint {
    pub x: f64,
    pub y: f64,
}

/// The measured viewport (Vue: the `viewport` ref the ResizeObserver writes).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct NodeCanvasViewport {
    pub width: f64,
    pub height: f64,
}

/// The zoom policy bundle: Vue reads these four props on every gesture.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct NodeCanvasZoomPolicy {
    pub min_zoom: f64,
    pub max_zoom: f64,
    pub zoom_factor: f64,
    pub zoom_grid_step: f64,
}

impl Default for NodeCanvasZoomPolicy {
    fn default() -> Self {
        Self {
            min_zoom: NODE_CANVAS_MIN_ZOOM,
            max_zoom: NODE_CANVAS_MAX_ZOOM,
            zoom_factor: NODE_CANVAS_ZOOM_FACTOR,
            zoom_grid_step: NODE_CANVAS_ZOOM_GRID_STEP,
        }
    }
}

impl NodeCanvasZoomPolicy {
    /// Vue's `normalizeZoom`: snap onto the grid, then hold inside the band.
    pub fn normalize(self, k: f64) -> f64 {
        if !k.is_finite() {
            return k;
        }
        let step = self.zoom_grid_step;
        let snapped = if step > 0.0 {
            (k / step).round() * step
        } else {
            k
        };
        node_canvas_clamp(node_canvas_round6(snapped), self.min_zoom, self.max_zoom)
    }
}

/// Whether two cameras describe the same view (Vue: `sameCamera`).
pub fn node_canvas_same_camera(a: NodeCanvasCamera, b: NodeCanvasCamera) -> bool {
    a.k == b.k && a.x == b.x && a.y == b.y
}

/// Content coordinates of a point given in viewport pixels.
pub fn node_canvas_screen_to_world(
    camera: NodeCanvasCamera,
    point: NodeCanvasPoint,
) -> NodeCanvasPoint {
    if !camera.k.is_finite() || camera.k == 0.0 {
        return NodeCanvasPoint::default();
    }
    NodeCanvasPoint {
        x: (point.x - camera.x) / camera.k,
        y: (point.y - camera.y) / camera.k,
    }
}

/// Viewport pixels of a point given in content coordinates.
pub fn node_canvas_world_to_screen(
    camera: NodeCanvasCamera,
    point: NodeCanvasPoint,
) -> NodeCanvasPoint {
    NodeCanvasPoint {
        x: point.x * camera.k + camera.x,
        y: point.y * camera.k + camera.y,
    }
}

/// The transformed layer's inline style — `transform-origin: 0 0` in the sheet
/// is what makes the camera maths (`world * k + offset`) agree with the paint.
pub fn node_canvas_layer_transform(camera: NodeCanvasCamera) -> String {
    format!(
        "transform:translate({}px, {}px) scale({})",
        node_canvas_num(camera.x),
        node_canvas_num(camera.y),
        node_canvas_num(camera.k)
    )
}

/// The SVG edge group's `transform` attribute (px-less, space separated —
/// Vue's `translate(${x} ${y}) scale(${k})`).
pub fn node_canvas_svg_group_transform(camera: NodeCanvasCamera) -> String {
    format!(
        "translate({} {}) scale({})",
        node_canvas_num(camera.x),
        node_canvas_num(camera.y),
        node_canvas_num(camera.k)
    )
}

// ── zoom (pure) ──────────────────────────────────────────────────────────

/// Vue's `zoomAt`: keep the world point under `at` stationary. `None` means the
/// camera was refused (a non-finite/zero scale, or the same scale — Vue writes
/// nothing in exactly those cases).
pub fn node_canvas_zoom_at(
    camera: NodeCanvasCamera,
    next_k: f64,
    at: NodeCanvasPoint,
    policy: NodeCanvasZoomPolicy,
) -> Option<NodeCanvasCamera> {
    let k = policy.normalize(next_k);
    if !k.is_finite() || k <= 0.0 || k == camera.k {
        return None;
    }
    let scale = k / camera.k;
    Some(NodeCanvasCamera {
        k,
        x: at.x - (at.x - camera.x) * scale,
        y: at.y - (at.y - camera.y) * scale,
    })
}

/// Vue's `zoomBy`: one wheel tick. `direction` is +1 (in) or -1 (out).
/// Below `k = 0.5` a 1.05 step is smaller than half a grid step, so snapping
/// would round it straight back and the wheel would do nothing — Vue promotes
/// the step to a whole grid rung there, and so does this.
pub fn node_canvas_zoom_by(
    camera: NodeCanvasCamera,
    direction: i32,
    at: NodeCanvasPoint,
    policy: NodeCanvasZoomPolicy,
) -> Option<NodeCanvasCamera> {
    let sign = if direction >= 0 { 1.0 } else { -1.0 };
    let current = camera.k;
    let scaled = if sign > 0.0 {
        current * policy.zoom_factor
    } else {
        current / policy.zoom_factor
    };
    let step = policy.zoom_grid_step;
    let next = if step > 0.0 && (scaled - current).abs() < step {
        current + sign * step
    } else {
        scaled
    };
    node_canvas_zoom_at(camera, next, at, policy)
}

/// The viewport centre, Vue's fallback anchor when it has no root rect.
pub fn node_canvas_viewport_centre(viewport: NodeCanvasViewport) -> NodeCanvasPoint {
    NodeCanvasPoint {
        x: viewport.width / 2.0,
        y: viewport.height / 2.0,
    }
}

/// Vue's wheel anchor: the pointer in viewport pixels, or `None` when the root
/// box was not measured (Vue then zooms about the centre).
pub fn node_canvas_pointer_at(
    origin: Option<NodeCanvasPoint>,
    client_x: f64,
    client_y: f64,
) -> Option<NodeCanvasPoint> {
    origin.map(|origin| NodeCanvasPoint {
        x: client_x - origin.x,
        y: client_y - origin.y,
    })
}

/// Vue's `pointerScale` division: a canvas inside a CSS `zoom`/`scale()`
/// container reports unscaled page coordinates, so pinch divides them out.
/// A zero or non-finite scale falls back to 1.
pub fn node_canvas_pointer_scale(pointer_scale: (f64, f64)) -> (f64, f64) {
    let sx = if pointer_scale.0.is_finite() && pointer_scale.0 != 0.0 {
        pointer_scale.0
    } else {
        1.0
    };
    let sy = if pointer_scale.1.is_finite() && pointer_scale.1 != 0.0 {
        pointer_scale.1
    } else {
        1.0
    };
    (sx, sy)
}

/// The pinch gesture's frozen start (Vue: `pinchSnapshot`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct NodeCanvasPinch {
    pub start_dist: f64,
    pub start_zoom: f64,
    pub mid_x: f64,
    pub mid_y: f64,
}

/// Vue's `trackPointer`: two live pointers freeze the start distance, the start
/// zoom and the midpoint.
pub fn node_canvas_pinch_snapshot(
    first: NodeCanvasPoint,
    second: NodeCanvasPoint,
    start_zoom: f64,
) -> NodeCanvasPinch {
    NodeCanvasPinch {
        start_dist: (second.x - first.x).hypot(second.y - first.y),
        start_zoom,
        mid_x: (first.x + second.x) / 2.0,
        mid_y: (first.y + second.y) / 2.0,
    }
}

/// Vue's `updatePinch`: zoom by the distance ratio, anchored at the pinch
/// midpoint. `origin` is the root box's client origin and `pointer_scale` the
/// DPI provider (Vue divides the midpoint by it).
pub fn node_canvas_pinch_camera(
    camera: NodeCanvasCamera,
    pinch: NodeCanvasPinch,
    distance: f64,
    origin: Option<NodeCanvasPoint>,
    pointer_scale: (f64, f64),
    policy: NodeCanvasZoomPolicy,
) -> Option<NodeCanvasCamera> {
    if pinch.start_dist < 1.0 {
        return None;
    }
    let ratio = distance / pinch.start_dist;
    let k = policy.normalize(pinch.start_zoom * ratio);
    if !k.is_finite() || k <= 0.0 || camera.k == 0.0 {
        return None;
    }
    let (sx, sy) = node_canvas_pointer_scale(pointer_scale);
    let origin = origin?;
    let mid_x = (pinch.mid_x - origin.x) / sx;
    let mid_y = (pinch.mid_y - origin.y) / sy;
    Some(NodeCanvasCamera {
        k,
        x: mid_x - ((mid_x - camera.x) * k) / camera.k,
        y: mid_y - ((mid_y - camera.y) * k) / camera.k,
    })
}

// ── the bounds clamp (pure) ──────────────────────────────────────────────

/// Clamp a camera so the content cannot be dragged out of reach: the viewport's
/// world window must keep intersecting the content hull expanded by
/// `margin` viewport sizes per axis. Degenerate inputs pass through unchanged —
/// a clamped camera is only ever returned FINITE, because the browser drops the
/// whole transform otherwise.
pub fn node_canvas_clamp_camera_to_bounds(
    camera: NodeCanvasCamera,
    bounds: Option<NodeCanvasBounds>,
    viewport: NodeCanvasViewport,
    margin: f64,
) -> NodeCanvasCamera {
    let bounds = match bounds {
        Some(bounds) => bounds,
        None => return camera,
    };
    if !(bounds.width > 0.0)
        || !(bounds.height > 0.0)
        || !bounds.x.is_finite()
        || !bounds.y.is_finite()
        || !(viewport.width > 0.0)
        || !(viewport.height > 0.0)
    {
        return camera;
    }
    let k = camera.k;
    if !k.is_finite() || k <= 0.0 || !camera.x.is_finite() || !camera.y.is_finite() {
        return camera;
    }
    // The viewport fraction cancels the zoom: the margin is a SCREEN distance
    // (half a viewport) at any k.
    let x_low = -k * (bounds.x + bounds.width) - margin * viewport.width;
    let x_high = viewport.width - k * bounds.x + margin * viewport.width;
    let y_low = -k * (bounds.y + bounds.height) - margin * viewport.height;
    let y_high = viewport.height - k * bounds.y + margin * viewport.height;
    if !(x_low <= x_high) || !(y_low <= y_high) {
        return camera;
    }
    if !x_low.is_finite() || !x_high.is_finite() || !y_low.is_finite() || !y_high.is_finite() {
        return camera;
    }
    NodeCanvasCamera {
        k,
        x: x_high.min(x_low.max(camera.x)),
        y: y_high.min(y_low.max(camera.y)),
    }
}

// ── fit (pure) ───────────────────────────────────────────────────────────

/// Vue's `computeFit`: the camera that frames `bounds` inside the viewport.
///
/// The order matters and is preserved verbatim: snap FIRST (the translation has
/// to be derived from the k that is actually rendered), snap DOWN (rounding up
/// would squeeze the content past the padding budget), promote a floor of 0 back
/// to the un-quantised ideal (a graph too large for one grid step), and round the
/// product the way `normalizeZoom` would — otherwise the first gesture after a
/// fit jumps a hair.
pub fn node_canvas_fit_camera(
    bounds: Option<NodeCanvasBounds>,
    viewport: NodeCanvasViewport,
    policy: NodeCanvasZoomPolicy,
    fit_padding: f64,
    fit_cap: f64,
    fallback: NodeCanvasCamera,
) -> NodeCanvasCamera {
    let bounds = match bounds {
        Some(bounds) => bounds,
        None => return fallback,
    };
    let (width, height) = (viewport.width, viewport.height);
    if !(bounds.width > 0.0)
        || !(bounds.height > 0.0)
        || !bounds.x.is_finite()
        || !bounds.y.is_finite()
        || !bounds.width.is_finite()
        || !bounds.height.is_finite()
        || !(width > 0.0)
        || !(height > 0.0)
    {
        return fallback;
    }
    let pad = fit_padding;
    let raw = node_canvas_clamp(
        ((width - pad * 2.0) / bounds.width).min((height - pad * 2.0) / bounds.height),
        policy.min_zoom,
        policy.max_zoom.min(fit_cap),
    );
    let step = policy.zoom_grid_step;
    let floor_value = if step > 0.0 {
        (raw / step + 1e-9).floor() * step
    } else {
        raw
    };
    let floored = if floor_value <= 0.0 { raw } else { floor_value };
    let k = node_canvas_clamp(
        node_canvas_round6(floored),
        policy.min_zoom,
        policy.max_zoom,
    );
    if !k.is_finite() || k <= 0.0 {
        return fallback;
    }
    let x = (width - bounds.width * k) / 2.0 - bounds.x * k;
    let y = (height - bounds.height * k) / 2.0 - bounds.y * k;
    if !x.is_finite() || !y.is_finite() {
        return fallback;
    }
    NodeCanvasCamera { k, x, y }
}

/// Vue's `autoFit` gate: only the component's OWN camera, and only until the
/// camera has been moved by hand (a gesture, or an imperative call). A late
/// `contentBounds` must never throw the user's view away.
pub fn node_canvas_should_auto_fit(
    fit_on_load: bool,
    moved_by_hand: bool,
    has_controlled_camera: bool,
    fit_controlled: bool,
) -> bool {
    fit_on_load && !moved_by_hand && (!has_controlled_camera || fit_controlled)
}

// ── tween (pure) ─────────────────────────────────────────────────────────

/// One frame of Vue's `tweenCamera` (ease-out cubic over the duration).
pub fn node_canvas_tween_camera(
    start: NodeCanvasCamera,
    target: NodeCanvasCamera,
    progress: f64,
) -> NodeCanvasCamera {
    let t = if progress.is_finite() {
        progress.max(0.0).min(1.0)
    } else {
        1.0
    };
    let eased = 1.0 - (1.0 - t).powi(3);
    NodeCanvasCamera {
        k: start.k + (target.k - start.k) * eased,
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
    }
}

/// Vue tweens over `tweenMs`, or snaps when it is 0 / when reduced motion is
/// respected and active.
pub fn node_canvas_should_tween(
    tween_ms: f64,
    respect_reduced_motion: bool,
    reduced_motion: bool,
) -> bool {
    if !(tween_ms > 0.0) {
        return false;
    }
    !(respect_reduced_motion && reduced_motion)
}

// ── level of detail (pure) ───────────────────────────────────────────────

/// Level of detail, derived from the camera zoom factor.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum LodLevel {
    /// Full detail.
    #[default]
    High,
    /// Outlines + labels.
    Medium,
    /// Outlines only.
    Low,
}

impl LodLevel {
    /// The name Vue publishes to hosts (`"high" | "medium" | "low"`).
    pub fn as_str(self) -> &'static str {
        match self {
            LodLevel::High => "high",
            LodLevel::Medium => "medium",
            LodLevel::Low => "low",
        }
    }
}

/// Vue's `LodThresholds`.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct LodThresholds {
    pub medium: f64,
    pub low: f64,
}

impl Default for LodThresholds {
    fn default() -> Self {
        Self {
            medium: NODE_CANVAS_LOD_MEDIUM,
            low: NODE_CANVAS_LOD_LOW,
        }
    }
}

/// Vue's `computeLod`.
pub fn node_canvas_lod_level(k: f64, thresholds: LodThresholds) -> LodLevel {
    if k >= thresholds.medium {
        LodLevel::High
    } else if k >= thresholds.low {
        LodLevel::Medium
    } else {
        LodLevel::Low
    }
}

// ── edges (pure) ─────────────────────────────────────────────────────────

/// How an edge is routed from source to target.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum EdgeRouting {
    /// Cubic bezier whose control points leave along the anchor side normals.
    #[default]
    Bezier,
    /// Manhattan elbow (horizontal → vertical → horizontal, or a vertical run
    /// with stubs when a vertical side is involved).
    Orthogonal,
    /// A single straight line.
    Direct,
}

impl EdgeRouting {
    /// The routing name Vue keeps in the prop (`"bezier" | "orthogonal" |
    /// "direct"`).
    pub fn as_str(self) -> &'static str {
        match self {
            EdgeRouting::Bezier => "bezier",
            EdgeRouting::Orthogonal => "orthogonal",
            EdgeRouting::Direct => "direct",
        }
    }
}

/// The side of a node an edge anchor sits on (compass short-hand).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum EdgeSide {
    N,
    S,
    E,
    W,
}

impl EdgeSide {
    /// The class-free short name Vue's data model carries.
    pub fn as_str(self) -> &'static str {
        match self {
            EdgeSide::N => "N",
            EdgeSide::S => "S",
            EdgeSide::E => "E",
            EdgeSide::W => "W",
        }
    }

    /// The outward normal of the side.
    pub fn normal(self) -> (f64, f64) {
        match self {
            EdgeSide::N => (0.0, -1.0),
            EdgeSide::S => (0.0, 1.0),
            EdgeSide::E => (1.0, 0.0),
            EdgeSide::W => (-1.0, 0.0),
        }
    }

    /// Whether the side is vertical (the routing's "flow axis" is Y).
    pub fn is_vertical(self) -> bool {
        matches!(self, EdgeSide::N | EdgeSide::S)
    }
}

/// The entry side opposite an exit side (an `E` exit pairs with a `W` entry).
pub fn node_canvas_opposite_side(side: EdgeSide) -> EdgeSide {
    match side {
        EdgeSide::N => EdgeSide::S,
        EdgeSide::S => EdgeSide::N,
        EdgeSide::E => EdgeSide::W,
        EdgeSide::W => EdgeSide::E,
    }
}

/// Point `d` world units from `p` along a side's outward normal.
pub fn node_canvas_side_offset(point: NodeCanvasPoint, side: EdgeSide, d: f64) -> NodeCanvasPoint {
    let (nx, ny) = side.normal();
    NodeCanvasPoint {
        x: point.x + nx * d,
        y: point.y + ny * d,
    }
}

/// One explicit subpath of an edge's visible geometry (a bundled bus: thin
/// stubs + one thick trunk). The path data MUST start with an absolute `M` —
/// subpaths are concatenated into ONE element for hit testing.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct EdgeSubpath {
    /// SVG path data, in world coordinates.
    pub d: String,
    /// Stroke width in world units (defaults to the edge's `width`).
    pub width: Option<f64>,
    /// Dashed override (defaults to the edge's `dashed`).
    pub dashed: Option<bool>,
}

/// An edge between two points (or two nodes, resolved by the host).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct NodeCanvasEdge {
    pub id: String,
    /// Source point in world coordinates.
    pub from: NodeCanvasPoint,
    /// Target point in world coordinates.
    pub to: NodeCanvasPoint,
    /// Semantic type — views use it for styling (Vue: `type`).
    pub kind: Option<String>,
    /// Label rendered at the edge midpoint.
    pub label: Option<String>,
    /// Per-edge routing override.
    pub routing: Option<EdgeRouting>,
    /// Stroke color (a CSS color value or a CSS variable name).
    pub color: Option<String>,
    /// Stroke width in world units.
    pub width: Option<f64>,
    /// Dashed line.
    pub dashed: Option<bool>,
    /// Side of the source the edge leaves from.
    pub from_side: Option<EdgeSide>,
    /// Side of the target the edge arrives on.
    pub to_side: Option<EdgeSide>,
    /// Explicit visible geometry override.
    pub subpaths: Option<Vec<EdgeSubpath>>,
}

/// One resolved stroke of an edge's visible geometry.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct NodeCanvasStroke {
    /// SVG path data.
    pub d: String,
    /// Stroke width in world units.
    pub width: f64,
    /// Dashed.
    pub dashed: bool,
}

/// An edge resolved for painting: its visible strokes, the label anchor and the
/// id/type the markup carries.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct NodeCanvasEdgeRender {
    pub id: String,
    pub kind: Option<String>,
    pub label: Option<String>,
    pub color: Option<String>,
    pub strokes: Vec<NodeCanvasStroke>,
    /// The label anchor (the midpoint `x`, `y - 6`).
    pub mid: NodeCanvasPoint,
}

/// The invisible hit stroke of an edge.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct NodeCanvasEdgeHit {
    pub id: String,
    /// Every visible stroke's geometry, concatenated (one element means no
    /// enter/leave chatter when the pointer crosses a subpath boundary).
    pub d: String,
    pub width: f64,
}

/// Vue's `sideExtent`: the control-point extension along the flow axis.
fn node_canvas_side_extent(from: NodeCanvasPoint, to: NodeCanvasPoint, side: EdgeSide) -> f64 {
    let span = if side.is_vertical() {
        (to.y - from.y).abs()
    } else {
        (to.x - from.x).abs()
    };
    (span * NODE_CANVAS_BEZIER_EXTENT_RATIO).max(NODE_CANVAS_BEZIER_EXTENT_MIN)
}

fn node_canvas_bezier_path(
    from: NodeCanvasPoint,
    to: NodeCanvasPoint,
    from_side: Option<EdgeSide>,
    to_side: Option<EdgeSide>,
) -> String {
    let fs = from_side.unwrap_or(EdgeSide::E);
    let ts = to_side.unwrap_or(node_canvas_opposite_side(fs));
    let d = node_canvas_side_extent(from, to, fs);
    let cp1 = node_canvas_side_offset(from, fs, d);
    let cp2 = node_canvas_side_offset(to, ts, d);
    format!(
        "M {} {} C {} {}, {} {}, {} {}",
        node_canvas_num(from.x),
        node_canvas_num(from.y),
        node_canvas_num(cp1.x),
        node_canvas_num(cp1.y),
        node_canvas_num(cp2.x),
        node_canvas_num(cp2.y),
        node_canvas_num(to.x),
        node_canvas_num(to.y)
    )
}

fn node_canvas_orthogonal_path(
    from: NodeCanvasPoint,
    to: NodeCanvasPoint,
    from_side: Option<EdgeSide>,
    to_side: Option<EdgeSide>,
) -> String {
    let vertical_first = from_side.map(EdgeSide::is_vertical).unwrap_or(false)
        || to_side.map(EdgeSide::is_vertical).unwrap_or(false);
    if !vertical_first {
        let mid_x = (from.x + to.x) / 2.0;
        return format!(
            "M {} {} L {} {} L {} {} L {} {}",
            node_canvas_num(from.x),
            node_canvas_num(from.y),
            node_canvas_num(mid_x),
            node_canvas_num(from.y),
            node_canvas_num(mid_x),
            node_canvas_num(to.y),
            node_canvas_num(to.x),
            node_canvas_num(to.y)
        );
    }
    let a = match from_side {
        Some(side) => node_canvas_side_offset(from, side, NODE_CANVAS_ORTHO_STUB),
        None => from,
    };
    let b = match to_side {
        Some(side) => node_canvas_side_offset(to, side, NODE_CANVAS_ORTHO_STUB),
        None => to,
    };
    let mid_y = (a.y + b.y) / 2.0;
    let mut parts: Vec<String> = vec![format!(
        "M {} {}",
        node_canvas_num(from.x),
        node_canvas_num(from.y)
    )];
    if from_side.is_some() {
        parts.push(format!(
            "L {} {}",
            node_canvas_num(a.x),
            node_canvas_num(a.y)
        ));
    }
    parts.push(format!(
        "L {} {}",
        node_canvas_num(a.x),
        node_canvas_num(mid_y)
    ));
    parts.push(format!(
        "L {} {}",
        node_canvas_num(b.x),
        node_canvas_num(mid_y)
    ));
    if to_side.is_some() {
        parts.push(format!(
            "L {} {}",
            node_canvas_num(b.x),
            node_canvas_num(b.y)
        ));
    }
    parts.push(format!(
        "L {} {}",
        node_canvas_num(to.x),
        node_canvas_num(to.y)
    ));
    parts.join(" ")
}

/// Vue's `edgePath`: an explicit subpath override wins over any routing.
pub fn node_canvas_edge_path(edge: &NodeCanvasEdge, routing: EdgeRouting) -> String {
    if let Some(subpaths) = edge.subpaths.as_ref() {
        if let Some(first) = subpaths.first() {
            return first.d.clone();
        }
    }
    match routing {
        EdgeRouting::Direct => format!(
            "M {} {} L {} {}",
            node_canvas_num(edge.from.x),
            node_canvas_num(edge.from.y),
            node_canvas_num(edge.to.x),
            node_canvas_num(edge.to.y)
        ),
        EdgeRouting::Orthogonal => {
            node_canvas_orthogonal_path(edge.from, edge.to, edge.from_side, edge.to_side)
        }
        EdgeRouting::Bezier => {
            node_canvas_bezier_path(edge.from, edge.to, edge.from_side, edge.to_side)
        }
    }
}

/// Vue's `edgeRenderList` entry: the visible strokes (subpath overrides may
/// carry several), each with its own width/dash fallback ladder.
pub fn node_canvas_edge_strokes(
    edge: &NodeCanvasEdge,
    routing: EdgeRouting,
) -> Vec<NodeCanvasStroke> {
    if let Some(subpaths) = edge.subpaths.as_ref() {
        if !subpaths.is_empty() {
            return subpaths
                .iter()
                .map(|sub| NodeCanvasStroke {
                    d: sub.d.clone(),
                    width: sub.width.or(edge.width).unwrap_or(NODE_CANVAS_EDGE_WIDTH),
                    dashed: sub.dashed.or(edge.dashed).unwrap_or(false),
                })
                .collect();
        }
    }
    vec![NodeCanvasStroke {
        d: node_canvas_edge_path(edge, routing),
        width: edge.width.unwrap_or(NODE_CANVAS_EDGE_WIDTH),
        dashed: edge.dashed.unwrap_or(false),
    }]
}

/// Vue's `edgeMidpoint` (the label anchor). Both routings answer the same
/// arithmetic; the routing is kept so a host's subclass can diverge safely.
pub fn node_canvas_edge_midpoint(edge: &NodeCanvasEdge, routing: EdgeRouting) -> NodeCanvasPoint {
    match routing {
        EdgeRouting::Orthogonal => {
            let mid_x = (edge.from.x + edge.to.x) / 2.0;
            NodeCanvasPoint {
                x: mid_x,
                y: (edge.from.y + edge.to.y) / 2.0,
            }
        }
        _ => NodeCanvasPoint {
            x: (edge.from.x + edge.to.x) / 2.0,
            y: (edge.from.y + edge.to.y) / 2.0,
        },
    }
}

/// Vue's `edgeHitWidth`: never thinner than 2.5× the ink, and never thinner
/// than ~10 SCREEN px once the camera zooms out (the SVG layer is inside the
/// camera transform, so world widths shrink on screen).
pub fn node_canvas_edge_hit_width(width: Option<f64>, k: f64) -> f64 {
    let ink = width.unwrap_or(NODE_CANVAS_EDGE_WIDTH);
    (ink * NODE_CANVAS_EDGE_HIT_RATIO)
        .max(NODE_CANVAS_EDGE_HIT_SCREEN_PX / k.max(NODE_CANVAS_EDGE_HIT_MIN_ZOOM))
}

/// Vue's `edgeHitList` entry: one fat hit path per edge, the concatenation of
/// its visible subpath geometries.
pub fn node_canvas_edge_hit(
    edge: &NodeCanvasEdge,
    routing: EdgeRouting,
    k: f64,
) -> NodeCanvasEdgeHit {
    let strokes = node_canvas_edge_strokes(edge, routing);
    let width = strokes
        .iter()
        .map(|stroke| node_canvas_edge_hit_width(Some(stroke.width), k))
        .fold(f64::NEG_INFINITY, f64::max);
    NodeCanvasEdgeHit {
        id: edge.id.clone(),
        d: strokes
            .iter()
            .map(|stroke| stroke.d.as_str())
            .collect::<Vec<&str>>()
            .join(" "),
        width: if width.is_finite() {
            width
        } else {
            NODE_CANVAS_EDGE_WIDTH
        },
    }
}

/// The whole edge page: the paint list, then (when the layer is interactive)
/// the hit list.
pub fn node_canvas_edge_page(
    edges: &[NodeCanvasEdge],
    routing: EdgeRouting,
    interactive: bool,
    k: f64,
) -> (Vec<NodeCanvasEdgeRender>, Vec<NodeCanvasEdgeHit>) {
    let renders: Vec<NodeCanvasEdgeRender> = edges
        .iter()
        .map(|edge| {
            let effective = edge.routing.unwrap_or(routing);
            NodeCanvasEdgeRender {
                id: edge.id.clone(),
                kind: edge.kind.clone(),
                label: edge.label.clone(),
                color: edge.color.clone(),
                strokes: node_canvas_edge_strokes(edge, effective),
                mid: node_canvas_edge_midpoint(edge, effective),
            }
        })
        .collect();
    let hits = if interactive {
        edges
            .iter()
            .map(|edge| node_canvas_edge_hit(edge, edge.routing.unwrap_or(routing), k))
            .collect()
    } else {
        Vec::new()
    };
    (renders, hits)
}

/// Whether an edge is the hovered one.
pub fn node_canvas_edge_is_hovered(hovered_edge_id: Option<&str>, edge_id: &str) -> bool {
    matches!(hovered_edge_id, Some(id) if id == edge_id)
}

/// Whether an edge is the host's selected one.
pub fn node_canvas_edge_is_selected(selected_edge_id: Option<&str>, edge_id: &str) -> bool {
    matches!(selected_edge_id, Some(id) if id == edge_id)
}

/// Whether an edge is dimmed by the "which line am I on" reading aid: dimming is
/// on, SOMETHING is hovered, and this edge is neither hovered nor selected.
pub fn node_canvas_edge_is_dimmed(
    hover_dimming: bool,
    hovered_edge_id: Option<&str>,
    selected_edge_id: Option<&str>,
    edge_id: &str,
) -> bool {
    hover_dimming
        && hovered_edge_id.is_some()
        && !node_canvas_edge_is_hovered(hovered_edge_id, edge_id)
        && !node_canvas_edge_is_selected(selected_edge_id, edge_id)
}

/// The `hk-node-canvas-edge` class table, in Vue's object order: the base class,
/// then `is-hovered`, `is-selected`, `is-dimmed`.
pub fn node_canvas_edge_classes(hovered: bool, selected: bool, dimmed: bool) -> String {
    let mut classes = String::from("hk-node-canvas-edge");
    if hovered {
        classes.push_str(" is-hovered");
    }
    if selected {
        classes.push_str(" is-selected");
    }
    if dimmed {
        classes.push_str(" is-dimmed");
    }
    classes
}

/// Whether a touch long-press is still a hold: travel beyond the slop turns it
/// into a gesture.
pub fn node_canvas_edge_hold_survives(distance: f64) -> bool {
    distance <= NODE_CANVAS_EDGE_HOLD_SLOP
}

/// Whether a native `contextmenu` is the one our own long-press just replaced:
/// same gesture (inside the window) and same spot (platform-synthesized events
/// fire at the press coordinates, so proximity separates them from a real
/// right-click elsewhere). `opened_at`/`now` are millisecond stamps.
pub fn node_canvas_suppresses_native_contextmenu(
    opened_at: f64,
    now: f64,
    press_x: f64,
    press_y: f64,
    event_x: f64,
    event_y: f64,
) -> bool {
    if (now - opened_at) >= NODE_CANVAS_EDGE_SUPPRESS_MS {
        return false;
    }
    (event_x - press_x).abs() + (event_y - press_y).abs() <= NODE_CANVAS_EDGE_SUPPRESS_RADIUS
}

// ── print (pure) ─────────────────────────────────────────────────────────

/// Print paper presets (Vue: `PrintPaper`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PrintPaper {
    A4Landscape,
    A3Landscape,
    /// The viewport's own box.
    #[default]
    Auto,
}

impl PrintPaper {
    /// The prop value Vue keeps (`"a4-landscape" | "a3-landscape" | "auto"`).
    pub fn as_str(self) -> &'static str {
        match self {
            PrintPaper::A4Landscape => "a4-landscape",
            PrintPaper::A3Landscape => "a3-landscape",
            PrintPaper::Auto => "auto",
        }
    }

    /// The paper box in CSS px at 96 DPI, or `None` for `auto`.
    pub fn size(self) -> Option<(f64, f64)> {
        match self {
            PrintPaper::A4Landscape => Some(NODE_CANVAS_PAPER_A4_LANDSCAPE),
            PrintPaper::A3Landscape => Some(NODE_CANVAS_PAPER_A3_LANDSCAPE),
            PrintPaper::Auto => None,
        }
    }
}

/// The minimap corner (Vue: `MinimapPlacement`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MinimapPlacement {
    #[default]
    BottomRight,
    BottomLeft,
    TopRight,
    TopLeft,
}

impl MinimapPlacement {
    /// The `data-placement` value the sheet's corner rules match.
    pub fn as_str(self) -> &'static str {
        match self {
            MinimapPlacement::BottomRight => "bottom-right",
            MinimapPlacement::BottomLeft => "bottom-left",
            MinimapPlacement::TopRight => "top-right",
            MinimapPlacement::TopLeft => "top-left",
        }
    }
}

// ── the gesture machine (the component's only state) ─────────────────────

#[derive(Clone, Copy, PartialEq, Debug)]
struct NodeCanvasPan {
    pointer_id: i32,
    x: f64,
    y: f64,
    start_x: f64,
    start_y: f64,
    captured: bool,
}

#[derive(Clone, Default)]
struct NodeCanvasInstance {
    pan: Option<NodeCanvasPan>,
    pointers: Vec<(i32, f64, f64)>,
    pinch: Option<NodeCanvasPinch>,
    moved_by_hand: bool,
}

/// What one pointer move resolved to.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum NodeCanvasPointerMove {
    /// Nothing to do (no gesture, another pointer's move, or still inside the
    /// slop).
    Idle,
    /// A pan: translate the camera by `(dx, dy)`.
    Pan { dx: f64, dy: f64 },
    /// A pinch: zoom about the frozen midpoint by `distance / start_dist`.
    Pinch {
        distance: f64,
        pinch: NodeCanvasPinch,
    },
}

thread_local! {
    /// Per-instance gesture state (Vue keeps it in closures; see the header).
    static NODE_CANVAS_INSTANCES: RefCell<HashMap<String, NodeCanvasInstance>> =
        RefCell::new(HashMap::new());
}

fn node_canvas_with_instance<R>(key: &str, f: impl FnOnce(&mut NodeCanvasInstance) -> R) -> R {
    NODE_CANVAS_INSTANCES.with(|instances| {
        let mut instances = instances.borrow_mut();
        let instance = instances.entry(key.to_string()).or_default();
        f(instance)
    })
}

/// Vue's `trackPointer` + `onPointerDown`: register the pointer, freeze the
/// pinch snapshot when a SECOND pointer lands, and arm a pan when the first one
/// did. Returns `true` when a pinch is live (Vue cancels the single-pointer pan
/// in exactly that case).
pub fn node_canvas_begin_pointer(
    key: &str,
    pointer_id: i32,
    x: f64,
    y: f64,
    camera_k: f64,
    pinchable: bool,
    print_mode: bool,
) -> bool {
    node_canvas_with_instance(key, |instance| {
        instance.pointers.retain(|(id, _, _)| *id != pointer_id);
        instance.pointers.push((pointer_id, x, y));
        if pinchable && !print_mode && instance.pointers.len() == 2 && instance.pinch.is_none() {
            let first = instance.pointers[0];
            let second = instance.pointers[1];
            instance.pinch = Some(node_canvas_pinch_snapshot(
                NodeCanvasPoint {
                    x: first.1,
                    y: first.2,
                },
                NodeCanvasPoint {
                    x: second.1,
                    y: second.2,
                },
                camera_k,
            ));
        }
        let pinch_live = instance.pinch.is_some();
        if pinch_live {
            instance.pan = None;
        } else {
            instance.pan = Some(NodeCanvasPan {
                pointer_id,
                x,
                y,
                start_x: x,
                start_y: y,
                captured: false,
            });
        }
        pinch_live
    })
}

/// Vue's `onPointerMove`: update the tracked pointer, then route to the pinch or
/// the pan. The pan is only CAPTURED past the slop, and the first captured move
/// applies the whole delta from the press point at once (Vue updates `panning.x`
/// only after the capture).
pub fn node_canvas_move_pointer(
    key: &str,
    pointer_id: i32,
    x: f64,
    y: f64,
) -> NodeCanvasPointerMove {
    node_canvas_with_instance(key, |instance| {
        if let Some(entry) = instance
            .pointers
            .iter_mut()
            .find(|(id, _, _)| *id == pointer_id)
        {
            entry.1 = x;
            entry.2 = y;
        }
        if instance.pinch.is_some() {
            if instance.pointers.len() < 2 {
                return NodeCanvasPointerMove::Idle;
            }
            let first = instance.pointers[0];
            let second = instance.pointers[1];
            let distance = (second.1 - first.1).hypot(second.2 - first.2);
            return NodeCanvasPointerMove::Pinch {
                distance,
                pinch: instance.pinch.unwrap_or(NodeCanvasPinch {
                    start_dist: 0.0,
                    start_zoom: 1.0,
                    mid_x: 0.0,
                    mid_y: 0.0,
                }),
            };
        }
        let pan = match instance.pan {
            Some(pan) => pan,
            None => return NodeCanvasPointerMove::Idle,
        };
        if pan.pointer_id != pointer_id {
            return NodeCanvasPointerMove::Idle;
        }
        if !pan.captured {
            let travelled = (x - pan.start_x).hypot(y - pan.start_y);
            if travelled < NODE_CANVAS_PAN_SLOP {
                return NodeCanvasPointerMove::Idle;
            }
            let dx = x - pan.x;
            let dy = y - pan.y;
            instance.pan = Some(NodeCanvasPan {
                pointer_id,
                x,
                y,
                start_x: pan.start_x,
                start_y: pan.start_y,
                captured: true,
            });
            instance.moved_by_hand = true;
            return NodeCanvasPointerMove::Pan { dx, dy };
        }
        let dx = x - pan.x;
        let dy = y - pan.y;
        instance.pan = Some(NodeCanvasPan { x, y, ..pan });
        instance.moved_by_hand = true;
        NodeCanvasPointerMove::Pan { dx, dy }
    })
}

/// Vue's `endPan` + `endPointerTracking`. Returns the captured pointer id when a
/// captured pan just ended (what Vue releases capture for).
pub fn node_canvas_end_pointer(key: &str, pointer_id: i32) -> Option<i32> {
    node_canvas_with_instance(key, |instance| {
        instance.pointers.retain(|(id, _, _)| *id != pointer_id);
        if instance.pointers.len() < 2 {
            instance.pinch = None;
        }
        if instance.pinch.is_some() {
            return None;
        }
        let pan = instance.pan?;
        if pan.pointer_id != pointer_id {
            return None;
        }
        instance.pan = None;
        if pan.captured { Some(pointer_id) } else { None }
    })
}

/// Vue's `loseFocus`: whatever was being dragged is over, and the pinch state is
/// cleared — a stale snapshot would permanently suppress the pan.
pub fn node_canvas_blur(key: &str) {
    node_canvas_with_instance(key, |instance| {
        instance.pointers.clear();
        instance.pinch = None;
        instance.pan = None;
    });
}

/// Whether the user has taken the view over (Vue: `movedByHand`).
pub fn node_canvas_moved_by_hand(key: &str) -> bool {
    node_canvas_with_instance(key, |instance| instance.moved_by_hand)
}

/// Record that a non-automatic camera move happened (a gesture, or an imperative
/// `setCamera`).
pub fn node_canvas_mark_moved_by_hand(key: &str) {
    node_canvas_with_instance(key, |instance| instance.moved_by_hand = true);
}

// ── markup escaping + the injected edge layer ────────────────────────────

/// Escape text for safe inclusion in the injected SVG (element content and
/// double-quoted attribute values alike).
pub fn node_canvas_escape_html(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

fn node_canvas_stroke_markup(stroke: &NodeCanvasStroke, ink: &str, class: Option<&str>) -> String {
    let class_attr = match class {
        Some(class) => format!(" class=\"{class}\""),
        None => String::new(),
    };
    let dash = if stroke.dashed {
        " stroke-dasharray=\"6 4\""
    } else {
        ""
    };
    let ink = node_canvas_escape_html(ink);
    format!(
        "<path{class_attr} d=\"{}\" fill=\"none\" stroke=\"{ink}\" style=\"stroke:{ink}\" \
         stroke-width=\"{}\"{dash} />",
        node_canvas_escape_html(&stroke.d),
        node_canvas_num(stroke.width)
    )
}

/// The whole `<svg>` edge layer as markup, ready for `dangerous_inner_html`. The
/// caller mounts it on a `display:contents` host (the crate-wide SVG rule, L49).
pub fn node_canvas_edges_markup(
    edges: &[NodeCanvasEdge],
    routing: EdgeRouting,
    interactive: bool,
    hover_dimming: bool,
    hovered_edge_id: Option<&str>,
    selected_edge_id: Option<&str>,
    camera: NodeCanvasCamera,
) -> String {
    let (renders, hits) = node_canvas_edge_page(edges, routing, interactive, camera.k);
    let mut out = String::from(
        "<svg class=\"hk-node-canvas-edges\" style=\"position:absolute;inset:0;pointer-events:none;\
         overflow:visible\">",
    );
    out.push_str(&format!(
        "<g transform=\"{}\">",
        node_canvas_svg_group_transform(camera)
    ));
    for render in &renders {
        let hovered = node_canvas_edge_is_hovered(hovered_edge_id, &render.id);
        let selected = node_canvas_edge_is_selected(selected_edge_id, &render.id);
        let dimmed = node_canvas_edge_is_dimmed(
            hover_dimming,
            hovered_edge_id,
            selected_edge_id,
            &render.id,
        );
        let classes = node_canvas_edge_classes(hovered, selected, dimmed);
        let kind_attr = match render.kind.as_deref() {
            Some(kind) => format!(" data-edge-type=\"{}\"", node_canvas_escape_html(kind)),
            None => String::new(),
        };
        out.push_str(&format!(
            "<g class=\"{classes}\" data-edge-id=\"{}\"{kind_attr}>",
            node_canvas_escape_html(&render.id)
        ));
        let ink = render
            .color
            .as_deref()
            .unwrap_or("var(--hk-border-3, #555)");
        if interactive {
            for stroke in &render.strokes {
                let halo = NodeCanvasStroke {
                    d: stroke.d.clone(),
                    width: stroke.width * 3.0,
                    dashed: stroke.dashed,
                };
                out.push_str(&node_canvas_stroke_markup(
                    &halo,
                    ink,
                    Some("hk-node-canvas-edge-halo"),
                ));
            }
        }
        for stroke in &render.strokes {
            out.push_str(&node_canvas_stroke_markup(stroke, ink, None));
        }
        if let Some(label) = render.label.as_deref() {
            out.push_str(&format!(
                "<text x=\"{}\" y=\"{}\" text-anchor=\"middle\" font-size=\"11\" \
                 fill=\"var(--hk-text-2, #aaa)\" style=\"fill:var(--hk-text-2, #aaa)\">{}</text>",
                node_canvas_num(render.mid.x),
                node_canvas_num(render.mid.y - 6.0),
                node_canvas_escape_html(label)
            ));
        }
        out.push_str("</g>");
    }
    for hit in &hits {
        out.push_str(&format!(
            "<path class=\"hk-node-canvas-edge-hit\" data-edge-id=\"{}\" d=\"{}\" fill=\"none\" \
             stroke=\"transparent\" stroke-width=\"{}\" style=\"pointer-events:stroke\" />",
            node_canvas_escape_html(&hit.id),
            node_canvas_escape_html(&hit.d),
            node_canvas_num(hit.width)
        ));
    }
    out.push_str("</g></svg>");
    out
}

// ── class names (the DOM contract, pinned by the tests) ──────────────────

/// The root's class list: `hk-node-canvas`, plus the print modifier.
pub fn node_canvas_root_classes(print_mode: bool) -> String {
    if print_mode {
        "hk-node-canvas hk-node-canvas--print".to_string()
    } else {
        "hk-node-canvas".to_string()
    }
}

/// The root's inline style: only a surface that consumes a gesture may take
/// touch scrolling away from the page, and print mode never does.
pub fn node_canvas_root_style(print_mode: bool, pannable: bool, zoomable: bool) -> Option<String> {
    if print_mode {
        return None;
    }
    if pannable || zoomable {
        Some("touch-action:none".to_string())
    } else {
        None
    }
}

/// `data-pannable` is present (as an empty attribute) only on a pannable,
/// non-print surface — the sheet keys its grab cursor off it.
pub fn node_canvas_pannable_attr(print_mode: bool, pannable: bool) -> Option<&'static str> {
    if !print_mode && pannable {
        Some("")
    } else {
        None
    }
}

/// The print paper's box style, appended to the root's own.
pub fn node_canvas_paper_style(print_mode: bool, paper: PrintPaper) -> Option<String> {
    if !print_mode {
        return None;
    }
    let (width, height) = paper.size()?;
    Some(format!(
        "width:{}px;height:{}px",
        node_canvas_num(width),
        node_canvas_num(height)
    ))
}

// ── props ────────────────────────────────────────────────────────────────

#[define_props]
pub struct NodeCanvasProps {
    /// The controlled camera (Vue: `camera`, `v-model:camera`).
    pub camera: Option<NodeCanvasCamera>,

    /// Vue's internal seed camera (used only when `camera` is absent — Vue's
    /// `inner` ref, which `fitOnLoad` frames).
    pub inner_camera: Option<NodeCanvasCamera>,

    /// The content hull, in world units — what `fit` frames and what the bounds
    /// clamp refuses to strand.
    pub content_bounds: Option<NodeCanvasBounds>,

    /// The measured viewport in CSS px (Vue: the `ResizeObserver`).
    #[default(0.0)]
    pub width: f64,

    #[default(0.0)]
    pub height: f64,

    /// The root box's client-space origin, subtracted from a pointer position
    /// before a wheel zoom or a pinch (Vue: `getBoundingClientRect()`).
    pub origin: Option<NodeCanvasPoint>,

    /// Smallest zoom the camera will settle on.
    #[default(NODE_CANVAS_MIN_ZOOM)]
    pub min_zoom: f64,

    /// Largest zoom the camera will settle on.
    #[default(NODE_CANVAS_MAX_ZOOM)]
    pub max_zoom: f64,

    /// One wheel/trackpad step multiplies zoom by this factor.
    #[default(NODE_CANVAS_ZOOM_FACTOR)]
    pub zoom_factor: f64,

    /// Zoom is snapped to this grid (0 disables snapping).
    #[default(NODE_CANVAS_ZOOM_GRID_STEP)]
    pub zoom_grid_step: f64,

    /// Padding (px) left around the content when fitting.
    #[default(NODE_CANVAS_FIT_PADDING)]
    pub fit_padding: f64,

    /// Largest zoom `fit` will choose.
    #[default(NODE_CANVAS_FIT_CAP)]
    pub fit_cap: f64,

    /// Frame the content immediately instead of starting at 1:1.
    #[default(true)]
    pub fit_on_load: bool,

    /// Also frame a host-supplied `camera` (Vue: `fitControlled`).
    #[default(false)]
    pub fit_controlled: bool,

    /// Whether dragging pans the camera.
    #[default(true)]
    pub pannable: bool,

    /// Whether the wheel zooms.
    #[default(true)]
    pub zoomable: bool,

    /// Keep the content within reach (the bounds clamp).
    #[default(true)]
    pub clamp_to_bounds: bool,

    /// Mount the minimap in the corner (Vue: `minimap`).
    #[default(true)]
    pub minimap: bool,

    /// Which corner the minimap takes.
    #[default(MinimapPlacement::BottomRight)]
    pub minimap_placement: MinimapPlacement,

    /// The surface's accessible name.
    pub aria_label: Option<String>,

    /// Edges to render between nodes.
    pub edges: Vec<NodeCanvasEdge>,

    /// Default routing strategy for edges (each edge may override it).
    #[default(EdgeRouting::Bezier)]
    pub edge_routing: EdgeRouting,

    /// Make the edge layer interactive: halo ink, the hover/dim class table and
    /// the fat hit strokes.
    #[default(false)]
    pub interactive_edges: bool,

    /// The edge id that stays highlighted regardless of hover — the host's
    /// selection.
    pub selected_edge_id: Option<String>,

    /// Dim the edges that are neither hovered nor selected while one IS hovered.
    #[default(true)]
    pub hover_dimming: bool,

    /// Zoom thresholds for level of detail.
    #[default(LodThresholds::default())]
    pub lod_thresholds: LodThresholds,

    /// Print mode: no gestures, a fixed paper box.
    #[default(false)]
    pub print_mode: bool,

    /// Paper size for print mode (`auto` follows the viewport).
    #[default(PrintPaper::Auto)]
    pub print_paper: PrintPaper,

    /// Camera tween duration in ms (0 disables tweening).
    #[default(0.0)]
    pub tween_ms: f64,

    /// Two-finger pinch-to-zoom on touch devices.
    #[default(true)]
    pub pinchable: bool,

    /// Snap tweens when reduced motion is active.
    #[default(true)]
    pub respect_reduced_motion: bool,

    /// Whether reduced motion is active (Vue: a `matchMedia` computed).
    #[default(false)]
    pub reduced_motion: bool,

    /// DPI scale provider: maps pointer coordinates to drawn coordinates for a
    /// canvas inside a CSS `zoom`/`transform: scale()` container.
    #[default((1.0, 1.0))]
    pub pointer_scale: (f64, f64),

    /// The controlled hovered edge id (Vue's `hoveredEdgeId` ref — see the
    /// header for why it cannot be the component's).
    pub hovered_edge_id: Option<String>,

    /// The gesture registry key (Vue's per-mount closures). Distinct keys keep
    /// two canvases from sharing one pan.
    #[default]
    pub instance_key: String,

    /// The canvas element's DOM id, so the host can acquire the 2D context.
    pub canvas_id: Option<String>,

    /// Default slot: the host draws node content in WORLD coordinates.
    pub children: Element,

    /// Overlay slot: screen-coordinate chrome (inspectors, rails, HUD).
    pub overlay: Element,

    /// Minimap slot: the component owns where the map sits, the host owns what
    /// it shows.
    pub minimap_slot: Element,

    /// A gesture (or an imperative camera move) resolved to a new camera. Every
    /// payload is already normalised and clamped — exactly what Vue's
    /// `update:camera` carries.
    pub on_camera_change: Option<EventHandler<NodeCanvasCamera>>,
}

/// The effective camera: the controlled prop, then Vue's `inner` seed, then the
/// identity.
pub fn node_canvas_resolved_camera(props: &NodeCanvasProps) -> NodeCanvasCamera {
    props.camera.or(props.inner_camera).unwrap_or_default()
}

/// The prop bundle the pure camera helpers need.
pub fn node_canvas_zoom_policy(props: &NodeCanvasProps) -> NodeCanvasZoomPolicy {
    NodeCanvasZoomPolicy {
        min_zoom: props.min_zoom,
        max_zoom: props.max_zoom,
        zoom_factor: props.zoom_factor,
        zoom_grid_step: props.zoom_grid_step,
    }
}

/// The settle policy EVERY camera write funnels through (Vue: `setCamera` —
/// normalise, refuse a non-finite pose, clamp to the content hull). A drag, a
/// wheel tick, a pinch, a tween and an imperative call all stop at the same
/// edge, which is why the bounds clamp holds for every one of them. `Copy`, so a
/// gesture closure can own it.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct NodeCanvasSettle {
    pub policy: NodeCanvasZoomPolicy,
    pub clamp_to_bounds: bool,
    pub bounds: Option<NodeCanvasBounds>,
    pub viewport: NodeCanvasViewport,
}

impl NodeCanvasSettle {
    /// `None` = refused (Vue writes nothing in exactly those cases).
    pub fn settle(self, next: NodeCanvasCamera) -> Option<NodeCanvasCamera> {
        let k = self.policy.normalize(next.k);
        if !k.is_finite() || k <= 0.0 || !next.x.is_finite() || !next.y.is_finite() {
            return None;
        }
        let camera = NodeCanvasCamera {
            k,
            x: next.x,
            y: next.y,
        };
        Some(if self.clamp_to_bounds {
            node_canvas_clamp_camera_to_bounds(
                camera,
                self.bounds,
                self.viewport,
                NODE_CANVAS_BOUNDS_MARGIN,
            )
        } else {
            camera
        })
    }
}

/// The settle policy a set of props describes.
pub fn node_canvas_settle(props: &NodeCanvasProps) -> NodeCanvasSettle {
    NodeCanvasSettle {
        policy: node_canvas_zoom_policy(props),
        clamp_to_bounds: props.clamp_to_bounds,
        bounds: props.content_bounds,
        viewport: NodeCanvasViewport {
            width: props.width,
            height: props.height,
        },
    }
}

/// Vue's `setCamera`: normalise, refuse a non-finite pose, clamp to the content
/// hull. `None` = refused (Vue writes nothing in exactly those cases).
pub fn node_canvas_settle_camera(
    props: &NodeCanvasProps,
    next: NodeCanvasCamera,
) -> Option<NodeCanvasCamera> {
    node_canvas_settle(props).settle(next)
}

// ── render assembly (no geometry below this line) ────────────────────────

#[component]
pub fn NodeCanvas(props: NodeCanvasProps) -> Element {
    let camera = node_canvas_resolved_camera(&props);
    let policy = node_canvas_zoom_policy(&props);
    let viewport = NodeCanvasViewport {
        width: props.width,
        height: props.height,
    };
    let print_mode = props.print_mode;
    let instance_key = props.instance_key.clone();

    let edges_markup = if props.edges.is_empty() {
        None
    } else {
        Some(node_canvas_edges_markup(
            &props.edges,
            props.edge_routing,
            props.interactive_edges,
            props.hover_dimming,
            props.hovered_edge_id.as_deref(),
            props.selected_edge_id.as_deref(),
            camera,
        ))
    };

    let on_camera_change = props.on_camera_change.clone();
    let settle = node_canvas_settle(&props);
    let wheel = {
        let key = instance_key.clone();
        let on_camera_change = on_camera_change.clone();
        let origin = props.origin;
        let zoomable = props.zoomable;
        move |event: WheelEvent| {
            if !zoomable {
                return;
            }
            event.prevent_default();
            let client_x = f64::from(event.client_x);
            let client_y = f64::from(event.client_y);
            // A wheel event's deltaY is device-dependent; only the sign matters,
            // and the grid keeps the result reproducible.
            let direction = if event.delta_y < 0.0 { 1 } else { -1 };
            let at = node_canvas_pointer_at(origin, client_x, client_y)
                .unwrap_or_else(|| node_canvas_viewport_centre(viewport));
            // Every write settles: normalise, then clamp to the content hull.
            if let Some(next) = node_canvas_zoom_by(camera, direction, at, policy)
                .and_then(|next| settle.settle(next))
            {
                // A gesture is a non-automatic move: the automatic framing stops.
                node_canvas_mark_moved_by_hand(&key);
                if let Some(handler) = on_camera_change.as_ref() {
                    handler.call(next);
                }
            }
        }
    };
    let pointer_down = {
        let key = instance_key.clone();
        let pannable = props.pannable;
        let pinchable = props.pinchable;
        move |event: PointerEvent| {
            // Only the primary (left) button pans; a pinch needs no button gate
            // beyond the pointer count.
            if !pannable || event.button != 0 {
                return;
            }
            node_canvas_begin_pointer(
                &key,
                event.pointer_id,
                f64::from(event.client_x),
                f64::from(event.client_y),
                camera.k,
                pinchable,
                print_mode,
            );
        }
    };
    let pointer_move = {
        let key = instance_key.clone();
        let on_camera_change = on_camera_change.clone();
        let origin = props.origin;
        let pointer_scale = props.pointer_scale;
        move |event: PointerEvent| {
            let x = f64::from(event.client_x);
            let y = f64::from(event.client_y);
            match node_canvas_move_pointer(&key, event.pointer_id, x, y) {
                NodeCanvasPointerMove::Idle => {}
                NodeCanvasPointerMove::Pan { dx, dy } => {
                    let next = NodeCanvasCamera {
                        k: camera.k,
                        x: camera.x + dx,
                        y: camera.y + dy,
                    };
                    if let Some(next) = settle.settle(next) {
                        if let Some(handler) = on_camera_change.as_ref() {
                            handler.call(next);
                        }
                    }
                }
                NodeCanvasPointerMove::Pinch { distance, pinch } => {
                    if let Some(next) = node_canvas_pinch_camera(
                        camera,
                        pinch,
                        distance,
                        origin,
                        pointer_scale,
                        policy,
                    )
                    .and_then(|next| settle.settle(next))
                    {
                        if let Some(handler) = on_camera_change.as_ref() {
                            handler.call(next);
                        }
                    }
                }
            }
        }
    };
    let pointer_up = {
        let key = instance_key.clone();
        move |event: PointerEvent| {
            node_canvas_end_pointer(&key, event.pointer_id);
        }
    };

    let root_classes = node_canvas_root_classes(print_mode);
    let mut root = VElement::new("div").class(root_classes);
    let mut style_parts: Vec<String> = Vec::new();
    if let Some(touch) = node_canvas_root_style(print_mode, props.pannable, props.zoomable) {
        style_parts.push(touch);
    }
    if let Some(paper) = node_canvas_paper_style(print_mode, props.print_paper) {
        style_parts.push(paper);
    }
    if !style_parts.is_empty() {
        root = root.style(style_parts.join(";"));
    }
    if let Some(flag) = node_canvas_pannable_attr(print_mode, props.pannable) {
        root = root.attr("data-pannable", flag);
    }
    if let Some(label) = props.aria_label.clone() {
        root = root.attr("aria-label", label);
    }
    if !print_mode {
        root = root
            .on_wheel(wheel)
            .on_pointerdown(pointer_down)
            .on_pointermove(pointer_move)
            .on_pointerup(pointer_up);
    }

    // The Canvas2D painter layer: a SLOT here — the host acquires the context
    // and paints on its own clock (see the header).
    let mut canvas = VElement::new("canvas")
        .class("hk-node-canvas-canvas")
        .style("position:absolute;inset:0;pointer-events:none");
    if let Some(id) = props.canvas_id.clone() {
        canvas = canvas.attr("id", id);
    }
    root = root.child(VNode::Element(Box::new(canvas)));

    if let Some(markup) = edges_markup {
        // The crate-wide SVG rule (L49): injected markup on a `display:contents`
        // host
        // (an `rsx!` `svg {}` child would be an HTML element, and the host must
        // not add a box).
        root = root.child(rsx! {
            span {
                style: "display:contents",
                dangerous_inner_html: markup,
            }
        });
    }

    root = root.child(VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-node-canvas-layer")
            .style(node_canvas_layer_transform(camera))
            .child(props.children),
    )));

    root = root.child(VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-node-canvas-overlay")
            .child(props.overlay),
    )));

    if !print_mode && props.minimap {
        root = root.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-node-canvas-minimap")
                .attr("data-placement", props.minimap_placement.as_str())
                .child(props.minimap_slot),
        )));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for NodeCanvasComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkNodeCanvas.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "node-canvas"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    fn policy() -> NodeCanvasZoomPolicy {
        NodeCanvasZoomPolicy::default()
    }

    fn viewport() -> NodeCanvasViewport {
        NodeCanvasViewport {
            width: 800.0,
            height: 600.0,
        }
    }

    fn point(x: f64, y: f64) -> NodeCanvasPoint {
        NodeCanvasPoint { x, y }
    }

    // ── props defaults ────────────────────────────────────────────────

    #[test]
    fn node_canvas_defaults_match_the_vue_props() {
        let props = NodeCanvasProps::default();
        assert_eq!(props.camera, None);
        assert_eq!(props.inner_camera, None);
        assert_eq!(props.content_bounds, None);
        assert_eq!(props.width, 0.0);
        assert_eq!(props.height, 0.0);
        assert_eq!(props.origin, None);
        assert_eq!(props.min_zoom, 0.2);
        assert_eq!(props.max_zoom, 4.0);
        assert_eq!(props.zoom_factor, 1.05);
        assert_eq!(props.zoom_grid_step, 0.05);
        assert_eq!(props.fit_padding, 40.0);
        assert_eq!(props.fit_cap, 1.25);
        assert!(props.fit_on_load);
        assert!(!props.fit_controlled);
        assert!(props.pannable);
        assert!(props.zoomable);
        assert!(props.clamp_to_bounds);
        assert!(props.minimap);
        assert_eq!(props.minimap_placement, MinimapPlacement::BottomRight);
        assert_eq!(props.aria_label, None);
        assert!(props.edges.is_empty());
        assert_eq!(props.edge_routing, EdgeRouting::Bezier);
        assert!(!props.interactive_edges);
        assert_eq!(props.selected_edge_id, None);
        assert!(props.hover_dimming);
        assert_eq!(
            props.lod_thresholds,
            LodThresholds {
                medium: 0.45,
                low: 0.18
            }
        );
        assert!(!props.print_mode);
        assert_eq!(props.print_paper, PrintPaper::Auto);
        assert_eq!(props.tween_ms, 0.0);
        assert!(props.pinchable);
        assert!(props.respect_reduced_motion);
        assert!(!props.reduced_motion);
        assert_eq!(props.pointer_scale, (1.0, 1.0));
        assert_eq!(props.hovered_edge_id, None);
        assert_eq!(props.instance_key, "");
        assert_eq!(props.canvas_id, None);
        assert!(props.on_camera_change.is_none());
        // The identity camera is Vue's fallback when neither prop is set.
        assert_eq!(
            node_canvas_resolved_camera(&props),
            NodeCanvasCamera::default()
        );
    }

    // ── class names ───────────────────────────────────────────────────

    #[test]
    fn node_canvas_class_names_match_the_vue_sheet() {
        assert_eq!(node_canvas_root_classes(false), "hk-node-canvas");
        assert_eq!(
            node_canvas_root_classes(true),
            "hk-node-canvas hk-node-canvas--print"
        );
        assert_eq!(
            node_canvas_edge_classes(false, false, false),
            "hk-node-canvas-edge"
        );
        assert_eq!(
            node_canvas_edge_classes(true, false, false),
            "hk-node-canvas-edge is-hovered"
        );
        assert_eq!(
            node_canvas_edge_classes(false, true, false),
            "hk-node-canvas-edge is-selected"
        );
        assert_eq!(
            node_canvas_edge_classes(false, false, true),
            "hk-node-canvas-edge is-dimmed"
        );
        assert_eq!(
            node_canvas_edge_classes(true, true, false),
            "hk-node-canvas-edge is-hovered is-selected"
        );
        // Placement values are the sheet's `[data-placement]` matches.
        for (placement, value) in [
            (MinimapPlacement::BottomRight, "bottom-right"),
            (MinimapPlacement::BottomLeft, "bottom-left"),
            (MinimapPlacement::TopRight, "top-right"),
            (MinimapPlacement::TopLeft, "top-left"),
        ] {
            assert_eq!(placement.as_str(), value);
        }
        // The routing / side / paper / lod names hosts see.
        assert_eq!(EdgeRouting::Bezier.as_str(), "bezier");
        assert_eq!(EdgeRouting::Orthogonal.as_str(), "orthogonal");
        assert_eq!(EdgeRouting::Direct.as_str(), "direct");
        assert_eq!(EdgeSide::N.as_str(), "N");
        assert_eq!(PrintPaper::A4Landscape.as_str(), "a4-landscape");
        assert_eq!(PrintPaper::Auto.as_str(), "auto");
        assert_eq!(LodLevel::High.as_str(), "high");
        assert_eq!(LodLevel::Low.as_str(), "low");
    }

    // ── zoom (pure) ───────────────────────────────────────────────────

    #[test]
    fn node_canvas_normalize_zoom_snaps_the_grid_then_clamps() {
        assert!(close(policy().normalize(1.0), 1.0));
        // 1.03 is inside the band but off the 0.05 grid.
        assert!(close(policy().normalize(1.03), 1.05));
        assert!(close(policy().normalize(1.02), 1.0));
        // The band wins over the grid.
        assert!(close(policy().normalize(0.01), 0.2));
        assert!(close(policy().normalize(99.0), 4.0));
        // A zero grid disables snapping.
        let unsnapped = NodeCanvasZoomPolicy {
            zoom_grid_step: 0.0,
            ..policy()
        };
        assert!(close(unsnapped.normalize(1.03), 1.03));
        // The 6 * 0.05 binary dust is rounded away (0.30000000000000004 → 0.3).
        assert_eq!(format!("{}", policy().normalize(0.3)), "0.3");
    }

    #[test]
    fn node_canvas_zoom_at_keeps_the_world_point_under_the_anchor() {
        let camera = NodeCanvasCamera {
            k: 1.0,
            x: 40.0,
            y: -20.0,
        };
        let at = point(300.0, 200.0);
        let world_before = node_canvas_screen_to_world(camera, at);
        let next = node_canvas_zoom_at(camera, 2.0, at, policy()).expect("zoom in");
        let world_after = node_canvas_screen_to_world(next, at);
        assert!(close(world_before.x, world_after.x));
        assert!(close(world_before.y, world_after.y));
        assert!(next.k > camera.k);
        // The same scale is refused (Vue writes nothing).
        assert_eq!(node_canvas_zoom_at(camera, 1.0, at, policy()), None);
        assert_eq!(node_canvas_zoom_at(camera, f64::NAN, at, policy()), None);
        // screenToWorld / worldToScreen round-trip.
        let screen = node_canvas_world_to_screen(camera, world_before);
        assert!(close(screen.x, at.x) && close(screen.y, at.y));
    }

    #[test]
    fn node_canvas_zoom_by_steps_the_wheel_on_the_grid() {
        let camera = NodeCanvasCamera {
            k: 1.0,
            x: 0.0,
            y: 0.0,
        };
        let at = point(400.0, 300.0);
        let zoomed_in = node_canvas_zoom_by(camera, 1, at, policy()).expect("wheel in");
        assert!(close(zoomed_in.k, 1.05));
        let zoomed_out = node_canvas_zoom_by(camera, -1, at, policy()).expect("wheel out");
        assert!(close(zoomed_out.k, 0.95));
        // Below k = 0.5 a 1.05 step is thinner than half a grid step: Vue
        // promotes it to a whole rung so the wheel still does something.
        let tiny = NodeCanvasCamera {
            k: 0.2,
            x: 0.0,
            y: 0.0,
        };
        let stepped = node_canvas_zoom_by(tiny, 1, at, policy()).expect("promoted step");
        assert!(close(stepped.k, 0.25));
        // The band still holds the result.
        let top = NodeCanvasCamera {
            k: 4.0,
            x: 0.0,
            y: 0.0,
        };
        assert_eq!(node_canvas_zoom_by(top, 1, at, policy()), None);
    }

    // ── fit + clamp (pure) ────────────────────────────────────────────

    #[test]
    fn node_canvas_fit_camera_centres_and_snaps_down() {
        let bounds = NodeCanvasBounds {
            x: 0.0,
            y: 0.0,
            width: 400.0,
            height: 200.0,
        };
        let fitted = node_canvas_fit_camera(
            Some(bounds),
            viewport(),
            policy(),
            40.0,
            1.25,
            NodeCanvasCamera::default(),
        );
        // Both axes fit: (800-80)/400 = 1.8, (600-80)/200 = 2.6 → 1.8, floored
        // onto the 0.05 grid, then held under fitCap 1.25.
        assert!(close(fitted.k, 1.25), "k = {}", fitted.k);
        // The content is centred: its midpoint maps to the viewport midpoint.
        let mid = node_canvas_world_to_screen(fitted, point(200.0, 100.0));
        assert!(close(mid.x, 400.0) && close(mid.y, 300.0));
        // Snap DOWN: rounding up would squeeze the content past the padding.
        let small = NodeCanvasBounds {
            x: 0.0,
            y: 0.0,
            width: 700.0,
            height: 300.0,
        };
        let fitted = node_canvas_fit_camera(
            Some(small),
            viewport(),
            policy(),
            40.0,
            4.0,
            NodeCanvasCamera::default(),
        );
        // (800-80)/700 = 1.028… → floored to 1.0 on the 0.05 grid.
        assert!(close(fitted.k, 1.0), "k = {}", fitted.k);
        // A non-zero origin is honoured.
        let offset = NodeCanvasBounds {
            x: 100.0,
            y: -50.0,
            width: 400.0,
            height: 200.0,
        };
        let fitted = node_canvas_fit_camera(
            Some(offset),
            viewport(),
            policy(),
            40.0,
            1.25,
            NodeCanvasCamera::default(),
        );
        let mid = node_canvas_world_to_screen(fitted, point(300.0, 50.0));
        assert!(close(mid.x, 400.0) && close(mid.y, 300.0));
    }

    #[test]
    fn node_canvas_fit_camera_passes_degenerate_inputs_through() {
        let fallback = NodeCanvasCamera {
            k: 2.0,
            x: 11.0,
            y: 12.0,
        };
        let degenerate = [
            None,
            Some(NodeCanvasBounds {
                x: 0.0,
                y: 0.0,
                width: 0.0,
                height: 10.0,
            }),
            Some(NodeCanvasBounds {
                x: 0.0,
                y: 0.0,
                width: 10.0,
                height: 0.0,
            }),
            Some(NodeCanvasBounds {
                x: f64::NAN,
                y: 0.0,
                width: 10.0,
                height: 10.0,
            }),
        ];
        for bounds in degenerate {
            assert_eq!(
                node_canvas_fit_camera(bounds, viewport(), policy(), 40.0, 1.25, fallback),
                fallback
            );
        }
        // An unmeasured viewport cannot be framed into.
        assert_eq!(
            node_canvas_fit_camera(
                Some(NodeCanvasBounds {
                    x: 0.0,
                    y: 0.0,
                    width: 10.0,
                    height: 10.0,
                }),
                NodeCanvasViewport {
                    width: 0.0,
                    height: 0.0,
                },
                policy(),
                40.0,
                1.25,
                fallback,
            ),
            fallback
        );
    }

    #[test]
    fn node_canvas_clamp_camera_to_bounds_keeps_the_hull_reachable() {
        let bounds = NodeCanvasBounds {
            x: 0.0,
            y: 0.0,
            width: 400.0,
            height: 300.0,
        };
        let viewport = viewport();
        let inside = NodeCanvasCamera {
            k: 1.0,
            x: 100.0,
            y: 100.0,
        };
        assert_eq!(
            node_canvas_clamp_camera_to_bounds(inside, Some(bounds), viewport, 0.5),
            inside
        );
        // Dragged far right: the hull's left edge may sit half a viewport past
        // the viewport's left edge, no farther.
        let far = NodeCanvasCamera {
            k: 1.0,
            x: 100_000.0,
            y: 0.0,
        };
        let clamped = node_canvas_clamp_camera_to_bounds(far, Some(bounds), viewport, 0.5);
        let x_high = viewport.width - bounds.x + 0.5 * viewport.width;
        assert!(close(clamped.x, x_high), "x = {}", clamped.x);
        assert!(close(clamped.y, 0.0));
        // The margin is a SCREEN distance: doubling k does not double it.
        let zoomed = NodeCanvasCamera {
            k: 2.0,
            x: 100_000.0,
            y: 0.0,
        };
        let clamped_zoomed =
            node_canvas_clamp_camera_to_bounds(zoomed, Some(bounds), viewport, 0.5);
        assert!(close(
            clamped_zoomed.x,
            viewport.width - 2.0 * bounds.x + 0.5 * viewport.width
        ));
        // No bounds / no viewport / a broken camera pass straight through.
        assert_eq!(
            node_canvas_clamp_camera_to_bounds(far, None, viewport, 0.5),
            far
        );
        assert_eq!(
            node_canvas_clamp_camera_to_bounds(
                far,
                Some(bounds),
                NodeCanvasViewport {
                    width: 0.0,
                    height: 0.0
                },
                0.5
            ),
            far
        );
        let broken = NodeCanvasCamera {
            k: 0.0,
            x: 0.0,
            y: 0.0,
        };
        assert_eq!(
            node_canvas_clamp_camera_to_bounds(broken, Some(bounds), viewport, 0.5),
            broken
        );
    }

    #[test]
    fn node_canvas_settle_normalises_refuses_and_clamps_every_write() {
        let props = NodeCanvasProps {
            width: 800.0,
            height: 600.0,
            content_bounds: Some(NodeCanvasBounds {
                x: 0.0,
                y: 0.0,
                width: 400.0,
                height: 300.0,
            }),
            ..Default::default()
        };
        // The zoom is snapped onto the grid on the way in.
        let settled = node_canvas_settle_camera(
            &props,
            NodeCanvasCamera {
                k: 1.03,
                x: 100.0,
                y: 100.0,
            },
        )
        .expect("settled");
        assert!(close(settled.k, 1.05), "k = {}", settled.k);
        // A zero scale is pulled UP to minZoom rather than refused (Vue's
        // `normalizeZoom` clamps before the finiteness guard ever sees it).
        let zero = node_canvas_settle_camera(
            &props,
            NodeCanvasCamera {
                k: 0.0,
                x: 0.0,
                y: 0.0,
            },
        )
        .expect("clamped up");
        assert!(close(zero.k, NODE_CANVAS_MIN_ZOOM));
        // A non-finite scale or translation is refused outright.
        for broken in [
            NodeCanvasCamera {
                k: f64::NAN,
                x: 0.0,
                y: 0.0,
            },
            NodeCanvasCamera {
                k: f64::INFINITY,
                x: 0.0,
                y: 0.0,
            },
            NodeCanvasCamera {
                k: 1.0,
                x: f64::INFINITY,
                y: 0.0,
            },
        ] {
            assert_eq!(node_canvas_settle_camera(&props, broken), None);
        }
        // The hull clamp is applied on the same write.
        let dragged = node_canvas_settle_camera(
            &props,
            NodeCanvasCamera {
                k: 1.0,
                x: 100_000.0,
                y: 0.0,
            },
        )
        .expect("settled");
        assert!(close(dragged.x, 1200.0), "x = {}", dragged.x);
        // Opting out of the clamp leaves the translation alone.
        let unclamped = NodeCanvasProps {
            clamp_to_bounds: false,
            ..props
        };
        let dragged = node_canvas_settle_camera(
            &unclamped,
            NodeCanvasCamera {
                k: 1.0,
                x: 100_000.0,
                y: 0.0,
            },
        )
        .expect("settled");
        assert!(close(dragged.x, 100_000.0));
    }

    #[test]
    fn node_canvas_auto_fit_and_tween_gates_match_vue() {
        assert!(node_canvas_should_auto_fit(true, false, false, false));
        // Once moved by hand — or for a controlled host that did not opt in —
        // the automatic framing stops for good.
        assert!(!node_canvas_should_auto_fit(true, true, false, false));
        assert!(!node_canvas_should_auto_fit(true, false, true, false));
        assert!(node_canvas_should_auto_fit(true, false, true, true));
        assert!(!node_canvas_should_auto_fit(false, false, false, false));
        assert!(node_canvas_should_tween(300.0, true, false));
        assert!(!node_canvas_should_tween(300.0, true, true));
        // Reduced motion is only respected while the prop says so.
        assert!(node_canvas_should_tween(300.0, false, true));
        assert!(!node_canvas_should_tween(0.0, false, false));
        let start = NodeCanvasCamera {
            k: 1.0,
            x: 0.0,
            y: 0.0,
        };
        let target = NodeCanvasCamera {
            k: 2.0,
            x: 100.0,
            y: -100.0,
        };
        assert_eq!(node_canvas_tween_camera(start, target, 0.0), start);
        let end = node_canvas_tween_camera(start, target, 1.0);
        assert!(close(end.k, 2.0) && close(end.x, 100.0) && close(end.y, -100.0));
        let mid = node_canvas_tween_camera(start, target, 0.5);
        // Ease-out cubic: 0.5 → 0.875 of the way.
        assert!(close(mid.k, 1.875));
    }

    #[test]
    fn node_canvas_pinch_zooms_about_the_midpoint() {
        let camera = NodeCanvasCamera {
            k: 1.0,
            x: 0.0,
            y: 0.0,
        };
        let snapshot = node_canvas_pinch_snapshot(point(100.0, 100.0), point(300.0, 100.0), 1.0);
        assert!(close(snapshot.start_dist, 200.0));
        assert!(close(snapshot.mid_x, 200.0));
        assert!(close(snapshot.mid_y, 100.0));
        let origin = Some(point(0.0, 0.0));
        let next = node_canvas_pinch_camera(camera, snapshot, 400.0, origin, (1.0, 1.0), policy())
            .expect("pinch");
        // The ratio doubles the zoom; the midpoint stays put.
        assert!(close(next.k, 2.0), "k = {}", next.k);
        let mid_before = node_canvas_screen_to_world(camera, point(200.0, 100.0));
        let mid_after = node_canvas_screen_to_world(next, point(200.0, 100.0));
        assert!(close(mid_before.x, mid_after.x));
        // A degenerate start distance, a missing origin and a 0 pointer scale
        // are all refused / repaired rather than propagated.
        let flat = NodeCanvasPinch {
            start_dist: 0.0,
            ..snapshot
        };
        assert_eq!(
            node_canvas_pinch_camera(camera, flat, 400.0, origin, (1.0, 1.0), policy()),
            None
        );
        assert_eq!(
            node_canvas_pinch_camera(camera, snapshot, 400.0, None, (1.0, 1.0), policy()),
            None
        );
        assert_eq!(node_canvas_pointer_scale((0.0, f64::NAN)), (1.0, 1.0));
        assert_eq!(node_canvas_pointer_scale((2.0, 0.5)), (2.0, 0.5));
    }

    // ── edges (pure) ──────────────────────────────────────────────────

    #[test]
    fn node_canvas_edge_path_routes_bezier_orthogonal_and_direct() {
        let edge = NodeCanvasEdge {
            id: "a".to_string(),
            from: point(0.0, 0.0),
            to: point(100.0, 60.0),
            ..Default::default()
        };
        // Unsided bezier: the control points leave east and arrive west, 40%
        // of the horizontal span (floored at 40).
        assert_eq!(
            node_canvas_edge_path(&edge, EdgeRouting::Bezier),
            "M 0 0 C 40 0, 60 60, 100 60"
        );
        assert_eq!(
            node_canvas_edge_path(&edge, EdgeRouting::Direct),
            "M 0 0 L 100 60"
        );
        // Unsided orthogonal: the classic horizontal → vertical → horizontal.
        assert_eq!(
            node_canvas_edge_path(&edge, EdgeRouting::Orthogonal),
            "M 0 0 L 50 0 L 50 60 L 100 60"
        );
        // A vertical exit drops out of the anchor first (ORTHO_STUB = 24).
        let dropping = NodeCanvasEdge {
            from_side: Some(EdgeSide::S),
            to_side: Some(EdgeSide::N),
            ..edge.clone()
        };
        assert_eq!(
            node_canvas_edge_path(&dropping, EdgeRouting::Orthogonal),
            "M 0 0 L 0 24 L 0 30 L 100 30 L 100 36 L 100 60"
        );
        // An explicit subpath override wins over any routing.
        let bundled = NodeCanvasEdge {
            subpaths: Some(vec![EdgeSubpath {
                d: "M 1 1 L 2 2".to_string(),
                ..Default::default()
            }]),
            ..edge
        };
        assert_eq!(
            node_canvas_edge_path(&bundled, EdgeRouting::Bezier),
            "M 1 1 L 2 2"
        );
    }

    #[test]
    fn node_canvas_side_helpers_are_the_compass_normals() {
        assert_eq!(node_canvas_opposite_side(EdgeSide::N), EdgeSide::S);
        assert_eq!(node_canvas_opposite_side(EdgeSide::S), EdgeSide::N);
        assert_eq!(node_canvas_opposite_side(EdgeSide::E), EdgeSide::W);
        assert_eq!(node_canvas_opposite_side(EdgeSide::W), EdgeSide::E);
        // A vertical side drops DOWN / lifts UP; an east side runs right.
        assert_eq!(
            node_canvas_side_offset(point(10.0, 10.0), EdgeSide::N, 5.0),
            point(10.0, 5.0)
        );
        assert_eq!(
            node_canvas_side_offset(point(10.0, 10.0), EdgeSide::S, 5.0),
            point(10.0, 15.0)
        );
        assert_eq!(
            node_canvas_side_offset(point(10.0, 10.0), EdgeSide::E, 5.0),
            point(15.0, 10.0)
        );
        assert_eq!(
            node_canvas_side_offset(point(10.0, 10.0), EdgeSide::W, 5.0),
            point(5.0, 10.0)
        );
        assert!(EdgeSide::N.is_vertical() && EdgeSide::S.is_vertical());
        assert!(!EdgeSide::E.is_vertical());
    }

    #[test]
    fn node_canvas_edge_hit_width_never_falls_under_ten_screen_px() {
        // At 1:1 the ink times 2.5 wins for a 1.5-wide stroke (3.75 vs 10).
        assert!(close(node_canvas_edge_hit_width(None, 1.0), 10.0));
        // Zoomed in, the screen floor stops binding and the ratio takes over.
        assert!(close(node_canvas_edge_hit_width(None, 4.0), 3.75));
        // Zoomed out, the world width grows so the screen width stays 10 px.
        assert!(close(node_canvas_edge_hit_width(None, 0.5), 20.0));
        // The k floor keeps the division finite.
        assert!(close(node_canvas_edge_hit_width(None, 0.0), 1000.0));
        assert!(close(node_canvas_edge_hit_width(Some(8.0), 2.0), 20.0));
    }

    #[test]
    fn node_canvas_edge_page_resolves_strokes_labels_and_hits() {
        let edges = vec![
            NodeCanvasEdge {
                id: "e1".to_string(),
                from: point(0.0, 0.0),
                to: point(100.0, 100.0),
                kind: Some("link".to_string()),
                label: Some("trunk".to_string()),
                color: Some("#ff0000".to_string()),
                width: Some(2.0),
                dashed: Some(true),
                ..Default::default()
            },
            NodeCanvasEdge {
                id: "e2".to_string(),
                from: point(0.0, 50.0),
                to: point(100.0, 50.0),
                routing: Some(EdgeRouting::Direct),
                subpaths: Some(vec![
                    EdgeSubpath {
                        d: "M 0 0 L 10 0".to_string(),
                        width: Some(4.0),
                        dashed: Some(false),
                    },
                    EdgeSubpath {
                        d: "M 0 10 L 10 10".to_string(),
                        ..Default::default()
                    },
                ]),
                ..Default::default()
            },
        ];
        let (renders, hits) = node_canvas_edge_page(&edges, EdgeRouting::Bezier, true, 1.0);
        assert_eq!(renders.len(), 2);
        assert_eq!(renders[0].strokes.len(), 1);
        assert!(renders[0].strokes[0].dashed);
        assert!(close(renders[0].strokes[0].width, 2.0));
        // The label rides the midpoint.
        assert!(close(renders[0].mid.x, 50.0) && close(renders[0].mid.y, 50.0));
        // The bundle carries both subpaths, and its own width falls back to the
        // edge's 1.5 on the second one.
        assert_eq!(renders[1].strokes.len(), 2);
        assert!(close(renders[1].strokes[0].width, 4.0));
        assert!(close(renders[1].strokes[1].width, NODE_CANVAS_EDGE_WIDTH));
        assert_eq!(hits.len(), 2);
        // The hit path concatenates the visible geometry (one element, no
        // enter/leave chatter across subpath boundaries).
        assert_eq!(hits[1].d, "M 0 0 L 10 0 M 0 10 L 10 10");
        // The widest stroke sets the hit width.
        assert!(close(hits[1].width, 10.0));
        // A non-interactive layer carries no hit strokes at all.
        let (_, none) = node_canvas_edge_page(&edges, EdgeRouting::Bezier, false, 1.0);
        assert!(none.is_empty());
    }

    #[test]
    fn node_canvas_edge_classes_follow_the_hover_and_selection_rules() {
        // Nothing hovered: nothing dims, even with hoverDimming on.
        assert!(!node_canvas_edge_is_dimmed(true, None, None, "e1"));
        // Hovered edge is not dimmed; the others are.
        assert!(node_canvas_edge_is_dimmed(true, Some("e1"), None, "e2"));
        assert!(!node_canvas_edge_is_dimmed(true, Some("e1"), None, "e1"));
        // The selection survives the hover dim.
        assert!(!node_canvas_edge_is_dimmed(
            true,
            Some("e1"),
            Some("e2"),
            "e2"
        ));
        // Dimming off: nothing dims.
        assert!(!node_canvas_edge_is_dimmed(false, Some("e1"), None, "e2"));
        assert!(node_canvas_edge_is_hovered(Some("e1"), "e1"));
        assert!(!node_canvas_edge_is_hovered(None, "e1"));
        assert!(node_canvas_edge_is_selected(Some("e1"), "e1"));
        assert!(!node_canvas_edge_is_selected(Some(""), "e1"));
    }

    #[test]
    fn node_canvas_edge_hold_and_contextmenu_window_match_vue() {
        // Travel inside the slop keeps the hold; past it the gesture wins.
        assert!(node_canvas_edge_hold_survives(8.0));
        assert!(!node_canvas_edge_hold_survives(8.1));
        // A platform-synthesized contextmenu lands on the press point inside
        // the window and is suppressed…
        assert!(node_canvas_suppresses_native_contextmenu(
            1000.0, 1100.0, 50.0, 50.0, 60.0, 55.0
        ));
        // …a real right-click elsewhere is a NEW gesture and must pass.
        assert!(!node_canvas_suppresses_native_contextmenu(
            1000.0, 1100.0, 50.0, 50.0, 200.0, 200.0
        ));
        // …and the window itself expires.
        assert!(!node_canvas_suppresses_native_contextmenu(
            1000.0, 1400.0, 50.0, 50.0, 50.0, 50.0
        ));
    }

    #[test]
    fn node_canvas_transforms_and_print_geometry_match_the_sheet() {
        let camera = NodeCanvasCamera {
            k: 1.5,
            x: -12.5,
            y: 40.0,
        };
        assert_eq!(
            node_canvas_layer_transform(camera),
            "transform:translate(-12.5px, 40px) scale(1.5)"
        );
        assert_eq!(
            node_canvas_svg_group_transform(camera),
            "translate(-12.5 40) scale(1.5)"
        );
        assert_eq!(
            node_canvas_root_style(false, true, false),
            Some("touch-action:none".to_string())
        );
        assert_eq!(node_canvas_root_style(false, false, false), None);
        // Print mode never takes the page's scrolling.
        assert_eq!(node_canvas_root_style(true, true, true), None);
        assert_eq!(node_canvas_pannable_attr(false, true), Some(""));
        assert_eq!(node_canvas_pannable_attr(false, false), None);
        assert_eq!(node_canvas_pannable_attr(true, true), None);
        assert_eq!(
            node_canvas_paper_style(true, PrintPaper::A4Landscape),
            Some("width:1122.5px;height:793.7px".to_string())
        );
        assert_eq!(node_canvas_paper_style(true, PrintPaper::Auto), None);
        // The paper box only applies in print mode.
        assert_eq!(
            node_canvas_paper_style(false, PrintPaper::A3Landscape),
            None
        );
        assert_eq!(
            node_canvas_paper_style(true, PrintPaper::A3Landscape),
            Some("width:1587.4px;height:1122.5px".to_string())
        );
    }

    #[test]
    fn node_canvas_lod_follows_the_thresholds() {
        let thresholds = LodThresholds::default();
        assert_eq!(node_canvas_lod_level(1.0, thresholds), LodLevel::High);
        assert_eq!(node_canvas_lod_level(0.45, thresholds), LodLevel::High);
        assert_eq!(node_canvas_lod_level(0.44, thresholds), LodLevel::Medium);
        assert_eq!(node_canvas_lod_level(0.18, thresholds), LodLevel::Medium);
        assert_eq!(node_canvas_lod_level(0.17, thresholds), LodLevel::Low);
        assert_eq!(node_canvas_lod_level(0.0, thresholds), LodLevel::Low);
        let custom = LodThresholds {
            medium: 2.0,
            low: 1.0,
        };
        assert_eq!(node_canvas_lod_level(0.45, custom), LodLevel::Low);
    }

    // ── the gesture machine ───────────────────────────────────────────

    #[test]
    fn node_canvas_pan_machine_waits_for_the_slop() {
        let key = "canvas-pan";
        node_canvas_blur(key);
        assert!(!node_canvas_begin_pointer(
            key, 1, 100.0, 100.0, 1.0, true, false
        ));
        // Inside the slop: still a tap, nothing moves.
        assert_eq!(
            node_canvas_move_pointer(key, 1, 103.0, 102.0),
            NodeCanvasPointerMove::Idle
        );
        // Past the slop the whole delta from the PRESS point lands at once
        // (Vue only starts updating its cursor after the capture).
        assert_eq!(
            node_canvas_move_pointer(key, 1, 110.0, 100.0),
            NodeCanvasPointerMove::Pan { dx: 10.0, dy: 0.0 }
        );
        // Then it is incremental.
        assert_eq!(
            node_canvas_move_pointer(key, 1, 115.0, 104.0),
            NodeCanvasPointerMove::Pan { dx: 5.0, dy: 4.0 }
        );
        assert!(node_canvas_moved_by_hand(key));
        // Another pointer's move is not this gesture's.
        assert_eq!(
            node_canvas_move_pointer(key, 9, 0.0, 0.0),
            NodeCanvasPointerMove::Idle
        );
        assert_eq!(node_canvas_end_pointer(key, 1), Some(1));
        // The gesture is over: further moves do nothing.
        assert_eq!(
            node_canvas_move_pointer(key, 1, 200.0, 200.0),
            NodeCanvasPointerMove::Idle
        );
        node_canvas_blur(key);
    }

    #[test]
    fn node_canvas_two_pointers_freeze_a_pinch_and_cancel_the_pan() {
        let key = "canvas-pinch";
        node_canvas_blur(key);
        assert!(!node_canvas_begin_pointer(
            key, 1, 100.0, 100.0, 1.0, true, false
        ));
        // The second pointer freezes the snapshot and cancels the pan.
        assert!(node_canvas_begin_pointer(
            key, 2, 300.0, 100.0, 1.0, true, false
        ));
        match node_canvas_move_pointer(key, 2, 500.0, 100.0) {
            NodeCanvasPointerMove::Pinch { distance, pinch } => {
                assert!(close(distance, 400.0));
                assert!(close(pinch.start_dist, 200.0));
                assert!(close(pinch.mid_x, 200.0));
            }
            other => panic!("expected a pinch, got {other:?}"),
        }
        // Lifting one finger clears the pinch; a blur clears everything.
        node_canvas_end_pointer(key, 2);
        assert_eq!(
            node_canvas_move_pointer(key, 1, 400.0, 100.0),
            NodeCanvasPointerMove::Idle
        );
        node_canvas_blur(key);
        // A print surface never pinches.
        assert!(!node_canvas_begin_pointer(
            key, 1, 0.0, 0.0, 1.0, true, true
        ));
        assert!(!node_canvas_begin_pointer(
            key, 2, 10.0, 0.0, 1.0, true, true
        ));
        node_canvas_blur(key);
    }

    // ── escaping + injected markup ────────────────────────────────────

    #[test]
    fn node_canvas_escape_html_defuses_every_injection_point() {
        assert_eq!(
            node_canvas_escape_html("<script>alert(\"x\")</script>"),
            "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
        );
        assert_eq!(node_canvas_escape_html("a & b"), "a &amp; b");
        assert_eq!(node_canvas_escape_html("it's"), "it&#39;s");
        assert_eq!(node_canvas_escape_html("plain"), "plain");
    }

    #[test]
    fn node_canvas_edges_markup_carries_the_layer_escaped() {
        let edges = vec![NodeCanvasEdge {
            id: "e\"1".to_string(),
            from: point(0.0, 0.0),
            to: point(100.0, 0.0),
            kind: Some("link".to_string()),
            label: Some("<bus>".to_string()),
            color: Some("#123456".to_string()),
            ..Default::default()
        }];
        let markup = node_canvas_edges_markup(
            &edges,
            EdgeRouting::Bezier,
            true,
            true,
            Some("e\"1"),
            None,
            NodeCanvasCamera {
                k: 2.0,
                x: 10.0,
                y: 20.0,
            },
        );
        for needle in [
            "<svg class=\"hk-node-canvas-edges\"",
            "transform=\"translate(10 20) scale(2)\"",
            "class=\"hk-node-canvas-edge is-hovered\"",
            "data-edge-id=\"e&quot;1\"",
            "data-edge-type=\"link\"",
            "class=\"hk-node-canvas-edge-halo\"",
            "stroke=\"#123456\"",
            "&lt;bus&gt;",
            "class=\"hk-node-canvas-edge-hit\"",
            "style=\"pointer-events:stroke\"",
        ] {
            assert!(markup.contains(needle), "missing {needle}: {markup}");
        }
        // The raw injection never survives.
        assert!(!markup.contains("<bus>"), "{markup}");
        assert!(!markup.contains("e\"1\""), "{markup}");
        // A non-interactive layer paints no halo and no hit stroke.
        let painted = node_canvas_edges_markup(
            &edges,
            EdgeRouting::Bezier,
            false,
            true,
            None,
            None,
            NodeCanvasCamera::default(),
        );
        assert!(!painted.contains("edge-halo"), "{painted}");
        assert!(!painted.contains("edge-hit"), "{painted}");
    }

    // ── DOM contract ─────────────────────────────────────────────────

    #[test]
    fn node_canvas_renders_the_camera_layers_and_slots() {
        let html = NodeCanvas(NodeCanvasProps {
            camera: Some(NodeCanvasCamera {
                k: 2.0,
                x: 10.0,
                y: 20.0,
            }),
            width: 800.0,
            height: 600.0,
            aria_label: Some("Topology".to_string()),
            canvas_id: Some("graph-canvas".to_string()),
            edges: vec![NodeCanvasEdge {
                id: "e1".to_string(),
                from: point(0.0, 0.0),
                to: point(10.0, 10.0),
                ..Default::default()
            }],
            children: rsx! {
                div { class: "host-node", "node" }
            },
            overlay: rsx! {
                div { class: "host-hud", "hud" }
            },
            minimap_slot: rsx! {
                div { class: "host-minimap", "map" }
            },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-node-canvas\"",
            "data-pannable=\"\"",
            "aria-label=\"Topology\"",
            "touch-action:none",
            "id=\"graph-canvas\"",
            "hk-node-canvas-canvas",
            "style=\"display:contents\"",
            "hk-node-canvas-edges",
            "hk-node-canvas-layer",
            "transform:translate(10px, 20px) scale(2)",
            "host-node",
            "hk-node-canvas-overlay",
            "host-hud",
            "hk-node-canvas-minimap",
            "data-placement=\"bottom-right\"",
            "host-minimap",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // No edges → no injected SVG host at all.
        let bare = NodeCanvas(NodeCanvasProps::default()).render_to_html();
        assert!(!bare.contains("hk-node-canvas-edges"), "{bare}");
        // The overlay layer is always present (Vue always renders it).
        assert!(bare.contains("hk-node-canvas-overlay"), "{bare}");
    }

    #[test]
    fn node_canvas_print_mode_takes_the_paper_box_and_drops_the_chrome() {
        let html = NodeCanvas(NodeCanvasProps {
            print_mode: true,
            print_paper: PrintPaper::A4Landscape,
            minimap: true,
            ..Default::default()
        })
        .render_to_html();
        for needle in ["hk-node-canvas--print", "width:1122.5px;height:793.7px"] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Print mode carries no pannable hook, no touch-action and no minimap.
        assert!(!html.contains("data-pannable"), "{html}");
        assert!(!html.contains("touch-action"), "{html}");
        assert!(!html.contains("hk-node-canvas-minimap"), "{html}");
    }

    #[test]
    fn node_canvas_styles_come_from_the_canonical_vue_sheet() {
        let css = NodeCanvasComponent::styles();
        for class in [
            ".hk-node-canvas",
            ".hk-node-canvas-layer",
            ".hk-node-canvas-overlay",
            ".hk-node-canvas-minimap",
            ".hk-node-canvas-edge",
            ".hk-node-canvas-edge-halo",
            ".hk-node-canvas-edge-hit",
        ] {
            assert!(css.contains(class), "node canvas css must carry {class}");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored node canvas sheet"
        );
        assert_eq!(NodeCanvasComponent::name(), "node-canvas");
    }
}
