// hi-components/src/scene/board.rs
// Board — mirror of the canonical Vue `HkBoard`: the shared node-and-edge
// surface every graph-like page builds on (world camera + engineering grid +
// WORLD-positioned node shells + SVG edge routing through optional junction
// nodes).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkBoard.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-board*` / `.hk-board-edge` class names
// are literal and identical in both forms. DOM contract (mirrors the Vue
// render output one-to-one):
//
//   div.hk-board [host class]                       (the viewport / gesture host)
//     div.hk-board-grid                             (style: display:none | dot grid)
//     div.hk-board-world                            (style: transform/width/height)
//       span[style="display:contents"]              (the SVG namespace host, L49)
//         <svg class="hk-board-edges" width height>
//           <path class="hk-board-edge" d stroke style="stroke:{ink}"
//                 stroke-width [stroke-dasharray="6 5"] fill="none"
//                 stroke-linecap="round"/>
//       div.hk-board-node  (one per VISIBLE node, `nodes` order)
//            [.hk-board-node--draggable] [.hk-board-node--{kind}]
//            (style: left/top/width/height in world px)
//         {the node slot}  |  div.hk-board-node-shell {label}
//         div.hk-board-node-actions?           (only when the node has actions)
//     div.hk-board-minimap?                    (the corner dock)
//
// This is the graph board, NOT a kanban: the lane/card drop model the wave
// brief attributed to it lives in `HkKanban` (`scene/kanban.rs`), and the
// blank mount host in `HkBlankCanvas` (`scene/blank_canvas.rs`). The Vue
// files these three mirror are `HkBoard.tsx` / `HkKanban.tsx` /
// `HkBlankCanvas.tsx`; the DOM contract above is taken from the first.
//
// Camera: a board lives in a fixed WORLD space and the camera maps
// world -> screen (`screen = world·k + (x, y)`, `transform-origin: 0 0`). Vue
// owns that state in `useBoardCamera` (refs + rAF tweens + ResizeObserver +
// pointer capture). None of that can live in a tairitsu component
// (`use_signal` / `use_state` are broken on 0.5.22, ledger L48) and the vnode
// layer owns no DOM node to measure, so the mirror is CONTROLLED and ships the
// whole decision surface as PURE functions:
//
//   * ladder:    [`board_clamp_k`], [`board_level_of`], [`board_k_of`],
//                [`quantize_board_k`], [`board_step_rung`];
//   * mapping:   [`board_to_screen`], [`board_to_world`], [`board_zoom_at`];
//   * framing:   [`board_clamp_pan`], [`board_fit`], [`board_tween_cam`],
//                [`board_ease_out_cubic`], [`board_tween_progress`];
//   * composable rules: [`board_clamp_camera`], [`board_wheel_step_k`],
//                [`board_zoom_to_percent_k`], [`board_fit_k_floor`];
//   * content:   [`board_bbox`], [`board_content_bounds`];
//   * gestures:  [`board_drag_position`], [`board_drag_moved`],
//                [`board_press_is_click`] (Vue's 3px slop math);
//   * edges:     [`board_fan_ordinals`], [`board_anchor`], [`board_edge_path`],
//                [`board_via_path`], [`board_edge_paths`];
//   * layers:    [`board_world_style`], [`board_grid_style`],
//                [`board_node_classes`], [`board_node_style`], [`board_edges_svg`].
//
// Deltas vs Vue (documented, not accidental):
//   * The camera (`camera`), the measured viewport (`viewport`) and the
//     minimap's inputs are CONTROLLED props instead of composable refs. Vue's
//     `viewportChange` emit has no mirror-side source (the host IS the camera
//     owner), so it is not a prop — the pure functions above are its sink.
//     `animated` / `fitCap` / `minK` / `maxK` keep their Vue meanings and are
//     consumed by [`board_clamp_camera`] / [`board_fit`] / the percent and
//     step helpers, exactly where `useBoardCamera` reads them.
//   * Gestures need element geometry (`getBoundingClientRect`, `pointer
//     capture`, `ResizeObserver`, `drawnScale`), which a vnode mirror cannot
//     read. The mirror therefore forwards the RAW events — the same contract
//     `display/image_viewer.rs` uses — through `on_pointer_down` /
//     `on_pointer_move` / `on_pointer_up` / `on_pointer_cancel` / `on_wheel`
//     (gated by `interactive` exactly like Vue's handlers) and, per node,
//     `on_node_pointer_down` with the node's world rect plus the raw pointer.
//     Vue's `pxScale()` (the ancestor CSS-scale correction) is host business:
//     feed it into [`board_drag_position`]'s `px_scale`, which is the same
//     `k * pxScale()` product Vue uses.
//   * `nodeClick`: Vue derives it on the ROOT pointerup from a tracked press
//     plus a 3px slop (`board_press_is_click` is that predicate). The mirror
//     fires `on_node_click` from the node box's own `click` event, i.e. the
//     browser's slop, because the pointer-press bookkeeping is host state in
//     a controlled component. The payload ([`BoardNodeRef`]) is the identity
//     Vue hands out (`emit("nodeClick", node)`).
//   * `nodeMove`: Vue mutates the node IN PLACE during the drag and emits the
//     live reference. The mirror has no drag state, so the host runs
//     [`board_drag_position`] / [`board_drag_moved`] over the press payload
//     and writes the result back through its own `nodes` prop.
//   * The scoped slots become per-node values: `slots.node({ node })` ->
//     [`BoardNode::content`] and `slots.nodeActions({ node })` ->
//     [`BoardNode::actions`] (a node without content falls back to Vue's
//     `hk-board-node-shell` label, and a node without actions renders no
//     dock).
//   * The edges layer is authored as MARKUP and mounted through
//     `dangerous_inner_html` on a `display:contents` host: rsx `svg {}` maps
//     to `document.createElement` (HTML namespace) in this host stack, so an
//     element tree would never paint (ledger L49, same shape as
//     `display/qr_code.rs`). Every interpolated caller string is escaped
//     first ([`board_edges_svg`]), and the host adds no box, so the absolutely
//     positioned `.hk-board-edges` still resolves against `.hk-board-world`.
//   * `HkMinimap` is not part of this file: the `.hk-board-minimap` dock
//     renders with the optional `minimap_content` vnode (the mirrored
//     `HkMinimap` is `scene/minimap.rs`). [`board_zoom_percent`],
//     [`board_can_zoom_in`] and [`board_can_zoom_out`] are the three values
//     Vue computes for it from the same camera.
//   * `wheel` is bound as a regular handler (Vue adds it imperatively only to
//     mark the listener non-passive); `preventDefault()` is still called, so
//     an interactive board keeps the page from scrolling under the gesture.
//   * `viewport` / `minK` / `maxK` / `fitCap` / `animated` / `fitOnMount`
//     reach NO DOM attribute — in Vue they only steer the camera. They are
//     carried as props so a host reading [`BoardProps`] sees the whole
//     configuration surface the Vue component declares, and every function
//     that consumes them ([`board_clamp_camera`], [`board_fit`],
//     [`board_zoom_to_percent_k`], [`board_tween_cam`]) takes them
//     explicitly, which is where `useBoardCamera` reads the same values.
//   * `quantizeBoardStep` (the pinch helper) is NOT mirrored: `HkBoard` never
//     calls it — its pinch path re-anchors with [`board_zoom_at`] and settles
//     through [`quantize_board_k`], which is what a host reproducing the
//     gesture needs.
//   * [`board_num`] prints the decimal form JavaScript's template literals use
//     for the magnitudes a board emits; JS switches to exponent notation
//     outside 1e-7..1e21, which a camera/viewport style never reaches.
//
// No literal UI text is rendered (node labels and every other string arrive
// through props/slots), so this component introduces NO `hikari_i18n::t` key.

use std::collections::HashMap;

use tairitsu_vdom::{PointerEvent, WheelEvent};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct BoardComponent;

// ── class names (the sheet's vocabulary, pinned) ────────────────────────────

/// The viewport / gesture host.
pub const BOARD_CLASS: &str = "hk-board";
/// The world-anchored dot grid layer.
pub const BOARD_GRID_CLASS: &str = "hk-board-grid";
/// The camera-transformed world layer.
pub const BOARD_WORLD_CLASS: &str = "hk-board-world";
/// The edges SVG layer (always positioned against the world layer).
pub const BOARD_EDGES_CLASS: &str = "hk-board-edges";
/// One routed edge path.
pub const BOARD_EDGE_CLASS: &str = "hk-board-edge";
/// One node shell box.
pub const BOARD_NODE_CLASS: &str = "hk-board-node";
/// The `draggable` node modifier.
pub const BOARD_NODE_DRAGGABLE_CLASS: &str = "hk-board-node--draggable";
/// The per-node action dock (the `nodeActions` slot receiver).
pub const BOARD_NODE_ACTIONS_CLASS: &str = "hk-board-node-actions";
/// The default node shell Vue renders when the `node` slot is omitted.
pub const BOARD_NODE_SHELL_CLASS: &str = "hk-board-node-shell";
/// The minimap dock pinned to the bottom-inline-end corner.
pub const BOARD_MINIMAP_CLASS: &str = "hk-board-minimap";

// ── constants (mirrors of `utils/boardCamera.ts` + `HkBoard.tsx`) ───────────

/// One zoom step: ±5% geometric (`BOARD_ZOOM_FACTOR`).
pub const BOARD_ZOOM_FACTOR: f64 = 1.05;
/// The interaction ladder's lower bound (`BOARD_K_MIN`).
pub const BOARD_K_MIN: f64 = 0.2;
/// The interaction ladder's upper bound (`BOARD_K_MAX`).
pub const BOARD_K_MAX: f64 = 4.0;
/// `fit()` never zooms in past this (`BOARD_FIT_CAP`).
pub const BOARD_FIT_CAP: f64 = 1.25;
/// Padding around the bbox used by `fit()`, world px (`BOARD_FIT_PAD`).
pub const BOARD_FIT_PAD: f64 = 40.0;
/// The motion budget of one animated camera settle (`BOARD_ANIM_MS`).
pub const BOARD_ANIM_MS: f64 = 170.0;
/// The margin `content` adds around the node bbox (HkBoard's `content`).
pub const BOARD_CONTENT_MARGIN: f64 = 20.0;
/// Vue's `gridSize` default.
pub const BOARD_DEFAULT_GRID_SIZE: f64 = 24.0;
/// Vue's `minK` default.
pub const BOARD_DEFAULT_MIN_K: f64 = BOARD_K_MIN;
/// Vue's `maxK` default.
pub const BOARD_DEFAULT_MAX_K: f64 = BOARD_K_MAX;
/// Vue's `viewportSize` initial ref (`{ w: 800, h: 600 }`).
pub const BOARD_DEFAULT_VIEWPORT_W: f64 = 800.0;
pub const BOARD_DEFAULT_VIEWPORT_H: f64 = 600.0;
/// Vue's per-edge default stroke width (`e.width ?? 1.5`).
pub const BOARD_DEFAULT_EDGE_WIDTH: f64 = 1.5;
/// Vue's `DEFAULT_INK` — `rgb(var(--color-primary) / 38%)`.
pub const BOARD_DEFAULT_INK: &str = "rgb(var(--color-primary) / 38%)";
/// The dash pattern Vue emits for a dashed edge (`stroke-dasharray`).
pub const BOARD_EDGE_DASH: &str = "6 5";
/// Vue's pointer slop: a press that moved less than this (Manhattan) is a
/// click, and a node drag that moved more than this counts as a drag.
pub const BOARD_POINTER_SLOP: f64 = 3.0;
/// The dot-grid ink (`radial-gradient(rgb(var(--color-text) / 12%) 1px, …)`).
pub const BOARD_GRID_INK: &str =
    "radial-gradient(rgb(var(--color-text) / 12%) 1px, transparent 1px)";

// ── geometry types (mirrors of the `utils/boardCamera.ts` interfaces) ──────

/// A world or screen point.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct BoardPoint {
    pub x: f64,
    pub y: f64,
}

impl BoardPoint {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

/// An axis-aligned rect in world units.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct BoardRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl BoardRect {
    pub fn new(x: f64, y: f64, w: f64, h: f64) -> Self {
        Self { x, y, w, h }
    }

    /// The rect's center — the point both edge anchors are solved against.
    pub fn center(self) -> BoardPoint {
        BoardPoint::new(self.x + self.w / 2.0, self.y + self.h / 2.0)
    }
}

/// The world -> screen camera: `screen = world·k + (x, y)`.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct BoardCamera {
    pub x: f64,
    pub y: f64,
    pub k: f64,
}

impl Default for BoardCamera {
    /// Vue's `ref({ x: 0, y: 0, k: 1 })` start.
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            k: 1.0,
        }
    }
}

impl BoardCamera {
    pub fn new(x: f64, y: f64, k: f64) -> Self {
        Self { x, y, k }
    }
}

/// The measured viewport box.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct BoardViewport {
    pub w: f64,
    pub h: f64,
}

impl Default for BoardViewport {
    /// Vue's `ref({ w: 800, h: 600 })` start.
    fn default() -> Self {
        Self {
            w: BOARD_DEFAULT_VIEWPORT_W,
            h: BOARD_DEFAULT_VIEWPORT_H,
        }
    }
}

impl BoardViewport {
    pub fn new(w: f64, h: f64) -> Self {
        Self { w, h }
    }
}

/// Where on a node border an edge attaches (Vue `BoardAnchorMode`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum BoardAnchorMode {
    /// The border point the center -> center ray exits through.
    #[default]
    Center,
    /// The border point closest to the other end.
    Nearest,
    /// Top-border midpoint (vertical drops).
    Top,
    /// The top-left corner.
    TopLeft,
    /// 天女散花: spread the exit points across the border.
    Fan,
}

/// How the two anchors join (Vue `BoardEdgeStyle`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum BoardEdgeStyle {
    Straight,
    Bezier,
    /// Strict elbow (H-V-H), Vue's default.
    #[default]
    Orthogonal,
    /// Vertical-first elbow (V-H).
    Spine,
}

impl BoardEdgeStyle {
    /// Vue's `e.style ?? "orthogonal"` default, resolved onto the wire name
    /// (kept for hosts that serialise board state).
    pub fn name(self) -> &'static str {
        match self {
            BoardEdgeStyle::Straight => "straight",
            BoardEdgeStyle::Bezier => "bezier",
            BoardEdgeStyle::Orthogonal => "orthogonal",
            BoardEdgeStyle::Spine => "spine",
        }
    }
}

// ── pure number helpers ────────────────────────────────────────────────────

/// JavaScript's `Math.round`: halfway cases go toward +Infinity
/// (`f64::round` would send them away from zero, so -0.5 must read 0).
fn js_round(value: f64) -> f64 {
    (value + 0.5).floor()
}

/// JavaScript's decimal print for the values a board emits. `-0` prints `0`
/// (Rust would print `-0`) and a non-finite value prints `0`, because no
/// camera/layout property may become `NaNpx`.
pub fn board_num(value: f64) -> String {
    if !value.is_finite() || value == 0.0 {
        return "0".to_string();
    }
    format!("{value}")
}

/// [`board_num`] with a `px` unit — the inline-style form Vue's template
/// literals produce.
pub fn board_px(value: f64) -> String {
    format!("{}px", board_num(value))
}

/// One decimal place, the rounding every emitted path coordinate uses
/// (`Math.round(n * 10) / 10`).
pub fn board_r1(value: f64) -> f64 {
    js_round(value * 10.0) / 10.0
}

// ── pure camera math ──────────────────────────────────────────────────────

/// `boardClampK` with the composable's bounds: `min(maxK, max(minK, k))`.
pub fn board_clamp_k(k: f64, min_k: f64, max_k: f64) -> f64 {
    min_k.max(k).min(max_k)
}

/// The geometric ladder level of a zoom (`log(k) / log(1.05)`).
pub fn board_level_of(k: f64) -> f64 {
    k.ln() / BOARD_ZOOM_FACTOR.ln()
}

/// The zoom of a ladder level (`1.05^level`).
pub fn board_k_of(level: f64) -> f64 {
    BOARD_ZOOM_FACTOR.powf(level)
}

/// Clamp a raw zoom into the legal ladder and snap it onto a 5% rung. The two
/// ends short-circuit so a clamped zoom stays EXACTLY on its bound instead of
/// drifting by a powf epsilon.
pub fn quantize_board_k(k: f64) -> f64 {
    let clamped = board_clamp_k(k, BOARD_K_MIN, BOARD_K_MAX);
    if clamped <= BOARD_K_MIN {
        return BOARD_K_MIN;
    }
    if clamped >= BOARD_K_MAX {
        return BOARD_K_MAX;
    }
    board_k_of(js_round(board_level_of(clamped)))
}

/// One fixed-step zoom target (the minimap +/- button: linear ±5% on a
/// geometric ladder) resolved to a rung IN THE STEP'S DIRECTION: a target that
/// rounds back onto the current rung is pushed one rung further, so the press
/// always does something (Vue's `boardStepRung`).
pub fn board_step_rung(current_k: f64, target_k: f64) -> f64 {
    let clamped = board_clamp_k(target_k, BOARD_K_MIN, BOARD_K_MAX);
    let rung = quantize_board_k(clamped);
    let current_level = js_round(board_level_of(board_clamp_k(
        current_k,
        BOARD_K_MIN,
        BOARD_K_MAX,
    )));
    let rung_level = js_round(board_level_of(rung));
    if rung_level != current_level {
        return rung;
    }
    let dir = if clamped >= current_k { 1.0 } else { -1.0 };
    board_clamp_k(board_k_of(current_level + dir), BOARD_K_MIN, BOARD_K_MAX)
}

/// World -> screen at the given camera.
pub fn board_to_screen(camera: BoardCamera, world: BoardPoint) -> BoardPoint {
    BoardPoint::new(world.x * camera.k + camera.x, world.y * camera.k + camera.y)
}

/// Screen -> world at the given camera.
pub fn board_to_world(camera: BoardCamera, screen: BoardPoint) -> BoardPoint {
    BoardPoint::new(
        (screen.x - camera.x) / camera.k,
        (screen.y - camera.y) / camera.k,
    )
}

/// Zoom to `target_k` while keeping the world point under `anchor` visually
/// fixed. The result is NOT rung-quantized (Vue quantizes before calling it);
/// the bound clamp uses the LADDER constants, exactly like Vue's
/// `boardZoomAt` — the prop bounds are applied afterwards by
/// [`board_clamp_camera`].
pub fn board_zoom_at(camera: BoardCamera, target_k: f64, anchor: BoardPoint) -> BoardCamera {
    let k = board_clamp_k(target_k, BOARD_K_MIN, BOARD_K_MAX);
    let world = board_to_world(camera, anchor);
    BoardCamera::new(anchor.x - world.x * k, anchor.y - world.y * k, k)
}

/// Clamp the pan so the content bbox can never be dragged fully out of view:
/// content larger than the viewport keeps half a viewport of slack on each
/// side, content smaller than the viewport re-centers (`boardClampPan`).
pub fn board_clamp_pan(
    camera: BoardCamera,
    content: BoardRect,
    viewport: BoardViewport,
) -> BoardCamera {
    board_clamp_pan_with_slack(camera, content, viewport, 0.5)
}

/// [`board_clamp_pan`] with an explicit slack fraction (Vue's `slack` arg).
pub fn board_clamp_pan_with_slack(
    camera: BoardCamera,
    content: BoardRect,
    viewport: BoardViewport,
    slack: f64,
) -> BoardCamera {
    let axis = |pan: f64, view: f64, size: f64| -> f64 {
        let drawn = size * camera.k;
        if drawn <= view {
            return (view - drawn) / 2.0;
        }
        let slack_px = view * slack;
        pan.max(view - drawn - slack_px).min(slack_px)
    };
    BoardCamera::new(
        axis(camera.x, viewport.w, content.w),
        axis(camera.y, viewport.h, content.h),
        camera.k,
    )
}

/// The composable's `clampCam`: the k clamp (with the fit-time `k_floor`
/// standing in for `minK`, so a fitted framing below the interaction minimum
/// survives — the floor starts at `min_k` and only [`board_fit_k_floor`] ever
/// lowers it) followed by the pan clamp.
pub fn board_clamp_camera(
    camera: BoardCamera,
    content: BoardRect,
    viewport: BoardViewport,
    max_k: f64,
    k_floor: f64,
) -> BoardCamera {
    let k = k_floor.max(camera.k).min(max_k);
    board_clamp_pan(BoardCamera::new(camera.x, camera.y, k), content, viewport)
}

/// The floor a fit installs: `Math.min(minK, target.k)` — a fitted framing may
/// park BELOW the interaction minimum, and the next clamp must not undo it.
pub fn board_fit_k_floor(fit_k: f64, min_k: f64) -> f64 {
    min_k.min(fit_k)
}

/// Fit the whole content bbox into the viewport (centered, padded). A wide
/// board shrinks as far as needed; a tiny board never blows up past `cap`
/// (`boardFit`).
pub fn board_fit(content: BoardRect, viewport: BoardViewport, pad: f64, cap: f64) -> BoardCamera {
    let kw = if content.w > 0.0 {
        (viewport.w - pad * 2.0) / content.w
    } else {
        cap
    };
    let kh = if content.h > 0.0 {
        (viewport.h - pad * 2.0) / content.h
    } else {
        cap
    };
    let k = cap.min(kw.min(kh));
    BoardCamera::new(
        (viewport.w - content.w * k) / 2.0 - content.x * k,
        (viewport.h - content.h * k) / 2.0 - content.y * k,
        k,
    )
}

/// Vue's `boardEaseOutCubic`, with the [0, 1] clamp `boardTweenCam` applies
/// first (`boardEaseOutCubic` itself assumes a clamped t).
pub fn board_ease_out_cubic(t: f64) -> f64 {
    let t = if t.is_finite() {
        t.clamp(0.0, 1.0)
    } else if t.is_nan() {
        0.0
    } else {
        1.0
    };
    1.0 - (1.0 - t).powi(3)
}

/// Interpolate two cameras for an animated settle: pan lerps linearly while k
/// interpolates GEOMETRICALLY (log space), so a tween between two ladder rungs
/// passes through the intermediate rungs instead of linear noise.
pub fn board_tween_cam(from: BoardCamera, to: BoardCamera, t: f64) -> BoardCamera {
    let e = board_ease_out_cubic(t);
    let k = if from.k > 0.0 && to.k > 0.0 {
        from.k * (to.k / from.k).powf(e)
    } else {
        to.k
    };
    BoardCamera::new(
        from.x + (to.x - from.x) * e,
        from.y + (to.y - from.y) * e,
        k,
    )
}

/// The tween's normalised progress at `elapsed_ms` (`min(1, elapsed / 170)`).
/// A non-finite elapsed reads as finished rather than unbounded.
pub fn board_tween_progress(elapsed_ms: f64) -> f64 {
    if !elapsed_ms.is_finite() {
        return 1.0;
    }
    (elapsed_ms / BOARD_ANIM_MS).clamp(0.0, 1.0)
}

/// The composable's wheel step: one notch quantizes `k · 1.05` (in) or
/// `k / 1.05` (out) onto the ladder.
pub fn board_wheel_step_k(current_k: f64, zoom_in: bool) -> f64 {
    let factor = if zoom_in {
        BOARD_ZOOM_FACTOR
    } else {
        1.0 / BOARD_ZOOM_FACTOR
    };
    quantize_board_k(current_k * factor)
}

/// The composable's `zoomToPercent` k (before [`board_zoom_at`] re-anchors it):
/// `min(maxK, max(minK, percent / 100))`, with the percent itself quantized by
/// the caller when it came from the slider.
pub fn board_zoom_to_percent_k(percent: f64, min_k: f64, max_k: f64) -> f64 {
    min_k.max(percent / 100.0).min(max_k)
}

/// `Math.round(k * 100)` — the zoom percentage the minimap shows.
pub fn board_zoom_percent(k: f64) -> f64 {
    js_round(k * 100.0)
}

/// The minimap's "can still zoom in" flag (`camera.k < maxK`).
pub fn board_can_zoom_in(k: f64, max_k: f64) -> bool {
    k < max_k
}

/// The minimap's "can still zoom out" flag (`camera.k > minK`).
pub fn board_can_zoom_out(k: f64, min_k: f64) -> bool {
    k > min_k
}

// ── node-drag math (Vue's `onPointerMove` node branch) ────────────────────

/// The world position a dragged node lands on: the pointer delta comes down
/// through the ancestor scale and the camera's own zoom
/// (`k = camera.k * pxScale()`), then rounds to whole world units — Vue:
/// `node.x = Math.round(ox + (clientX - sx) / k)`.
pub fn board_drag_position(
    start: BoardPoint,
    start_client: BoardPoint,
    client: BoardPoint,
    camera_k: f64,
    px_scale: f64,
) -> BoardPoint {
    let camera_k = if camera_k == 0.0 { 1.0 } else { camera_k };
    let scaled = camera_k * px_scale;
    let k = if scaled == 0.0 { 1.0 } else { scaled };
    let dx = (client.x - start_client.x) / k;
    let dy = (client.y - start_client.y) / k;
    BoardPoint::new(js_round(start.x + dx), js_round(start.y + dy))
}

/// Whether the press has travelled far enough to count as a drag — Vue:
/// `|Δx| + |Δy| > 3` (Manhattan, not Euclidean).
pub fn board_drag_moved(start_client: BoardPoint, client: BoardPoint) -> bool {
    (client.x - start_client.x).abs() + (client.y - start_client.y).abs() > BOARD_POINTER_SLOP
}

/// Whether a released press counts as a click (Vue's `onPointerUp` slop):
/// the same Manhattan distance, but `< 3` instead of `> 3`, so the boundary
/// itself is neither a drag nor a click.
pub fn board_press_is_click(start_client: BoardPoint, client: BoardPoint) -> bool {
    (client.x - start_client.x).abs() + (client.y - start_client.y).abs() < BOARD_POINTER_SLOP
}

// ── pure content bbox ─────────────────────────────────────────────────────

/// Union of the node rects, zero-size rects ignored (`boardBBox`). An empty
/// board reports Vue's 1200 x 800 placeholder bbox.
pub fn board_bbox(rects: &[BoardRect]) -> BoardRect {
    let mut min_x = f64::INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for rect in rects {
        if rect.w <= 0.0 || rect.h <= 0.0 {
            continue;
        }
        min_x = min_x.min(rect.x);
        min_y = min_y.min(rect.y);
        max_x = max_x.max(rect.x + rect.w);
        max_y = max_y.max(rect.y + rect.h);
    }
    if !min_x.is_finite() {
        return BoardRect::new(0.0, 0.0, 1200.0, 800.0);
    }
    BoardRect::new(min_x, min_y, max_x - min_x, max_y - min_y)
}

/// The board's `content` computed: the node bbox plus a
/// [`BOARD_CONTENT_MARGIN`] on every side (HkBoard's `x - 20, y - 20, w + 40,
/// h + 40`).
pub fn board_content_bounds(nodes: &[BoardNode]) -> BoardRect {
    let rects: Vec<BoardRect> = nodes
        .iter()
        .map(|node| BoardRect::new(node.x, node.y, node.w, node.h))
        .collect();
    let box_ = board_bbox(&rects);
    BoardRect::new(
        box_.x - BOARD_CONTENT_MARGIN,
        box_.y - BOARD_CONTENT_MARGIN,
        box_.w + BOARD_CONTENT_MARGIN * 2.0,
        box_.h + BOARD_CONTENT_MARGIN * 2.0,
    )
}

// ── pure edge geometry (mirrors of `utils/boardEdges.ts`) ─────────────────

/// One edge's fan slot (Vue: `{ index, count }`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct BoardFanOrdinal {
    pub index: usize,
    pub count: usize,
}

impl Default for BoardFanOrdinal {
    /// Vue's fallback for an edge missing from the map: `{ index: 0, count: 1 }`.
    fn default() -> Self {
        Self { index: 0, count: 1 }
    }
}

/// Every edge sharing a `from` node gets its `{ index, count }` slot in the
/// 天女散花 spread. Two passes — totals first, then positions — so `count` is
/// the FINAL total per node (a running count would collapse the whole fan onto
/// one anchor point). Edges from different nodes count independently.
pub fn board_fan_ordinals(edges: &[BoardEdge]) -> HashMap<String, BoardFanOrdinal> {
    let mut totals: HashMap<&str, usize> = HashMap::new();
    for edge in edges {
        *totals.entry(edge.from.as_str()).or_insert(0) += 1;
    }
    let mut seen: HashMap<&str, usize> = HashMap::new();
    let mut ordinals: HashMap<String, BoardFanOrdinal> = HashMap::new();
    for edge in edges {
        let index = *seen.get(edge.from.as_str()).unwrap_or(&0);
        seen.insert(edge.from.as_str(), index + 1);
        let count = *totals.get(edge.from.as_str()).unwrap_or(&1);
        ordinals.insert(edge.id.clone(), BoardFanOrdinal { index, count });
    }
    ordinals
}

/// The border point where the ray from `rect`'s center toward `to` exits.
fn board_center_exit(rect: BoardRect, to: BoardPoint) -> BoardPoint {
    let center = rect.center();
    let dx = to.x - center.x;
    let dy = to.y - center.y;
    if dx == 0.0 && dy == 0.0 {
        return BoardPoint::new(center.x, rect.y);
    }
    let hw = rect.w / 2.0;
    let hh = rect.h / 2.0;
    let sx = if dx != 0.0 {
        hw / dx.abs()
    } else {
        f64::INFINITY
    };
    let sy = if dy != 0.0 {
        hh / dy.abs()
    } else {
        f64::INFINITY
    };
    let s = sx.min(sy);
    BoardPoint::new(center.x + dx * s, center.y + dy * s)
}

/// The closest point of `rect`'s perimeter to `to`.
fn board_nearest_point(rect: BoardRect, to: BoardPoint) -> BoardPoint {
    let center = rect.center();
    let dx = to.x - center.x;
    let dy = to.y - center.y;
    if dx == 0.0 && dy == 0.0 {
        return BoardPoint::new(center.x, rect.y);
    }
    let hw = rect.w / 2.0;
    let hh = rect.h / 2.0;
    let sx = if dx != 0.0 {
        hw / dx.abs()
    } else {
        f64::INFINITY
    };
    let sy = if dy != 0.0 {
        hh / dy.abs()
    } else {
        f64::INFINITY
    };
    if sx < sy {
        return BoardPoint::new(
            center.x + dx.signum() * hw,
            to.y.min(rect.y + rect.h).max(rect.y),
        );
    }
    BoardPoint::new(
        to.x.min(rect.x + rect.w).max(rect.x),
        center.y + dy.signum() * hh,
    )
}

/// Resolve the anchor point on `rect` for an edge toward `to`. `index`/`count`
/// only matter for [`BoardAnchorMode::Fan`] (a no-op when `count <= 1`).
pub fn board_anchor(
    rect: BoardRect,
    mode: BoardAnchorMode,
    to: BoardPoint,
    index: usize,
    count: usize,
) -> BoardPoint {
    match mode {
        BoardAnchorMode::Top => BoardPoint::new(rect.x + rect.w / 2.0, rect.y),
        BoardAnchorMode::TopLeft => BoardPoint::new(rect.x, rect.y),
        BoardAnchorMode::Nearest => board_nearest_point(rect, to),
        BoardAnchorMode::Fan => {
            let base = board_center_exit(rect, to);
            if count <= 1 {
                return base;
            }
            let t = (index + 1) as f64 / (count + 1) as f64;
            let dx = to.x - (rect.x + rect.w / 2.0);
            let dy = to.y - (rect.y + rect.h / 2.0);
            if dy.abs() * rect.w >= dx.abs() * rect.h {
                let x = rect.x + rect.w * t;
                let y = if dy < 0.0 { rect.y } else { rect.y + rect.h };
                return BoardPoint::new(x, y);
            }
            let y = rect.y + rect.h * t;
            let x = if dx < 0.0 { rect.x } else { rect.x + rect.w };
            BoardPoint::new(x, y)
        }
        BoardAnchorMode::Center => board_center_exit(rect, to),
    }
}

/// The segment from `a` into `b` WITHOUT the leading `M`, so multi-leg paths
/// can chain tails end to end.
fn board_segment_tail(a: BoardPoint, b: BoardPoint, style: BoardEdgeStyle) -> String {
    match style {
        BoardEdgeStyle::Bezier => {
            let dx = (b.x - a.x) / 2.0;
            format!(
                "C {} {}, {} {}, {} {}",
                board_num(board_r1(a.x + dx)),
                board_num(board_r1(a.y)),
                board_num(board_r1(b.x - dx)),
                board_num(board_r1(b.y)),
                board_num(board_r1(b.x)),
                board_num(board_r1(b.y))
            )
        }
        BoardEdgeStyle::Orthogonal => {
            let mid_x = board_num(board_r1((a.x + b.x) / 2.0));
            format!(
                "H {mid_x} V {} H {}",
                board_num(board_r1(b.y)),
                board_num(board_r1(b.x))
            )
        }
        BoardEdgeStyle::Spine => {
            let mid_y = board_num(board_r1((a.y + b.y) / 2.0));
            format!(
                "V {mid_y} H {} V {}",
                board_num(board_r1(b.x)),
                board_num(board_r1(b.y))
            )
        }
        BoardEdgeStyle::Straight => format!(
            "L {} {}",
            board_num(board_r1(b.x)),
            board_num(board_r1(b.y))
        ),
    }
}

/// One edge between two anchor points — a world-space SVG `d` attribute.
pub fn board_edge_path(a: BoardPoint, b: BoardPoint, style: BoardEdgeStyle) -> String {
    format!(
        "M {} {} {}",
        board_num(board_r1(a.x)),
        board_num(board_r1(a.y)),
        board_segment_tail(a, b, style)
    )
}

/// One edge routed THROUGH via points (the centers of empty junction nodes):
/// orthogonal legs chain into clean right angles, straight legs into a
/// polyline, and bezier legs into one flowing curve with smooth midpoints.
pub fn board_via_path(
    a: BoardPoint,
    via: &[BoardPoint],
    b: BoardPoint,
    style: BoardEdgeStyle,
) -> String {
    let mut points: Vec<BoardPoint> = Vec::with_capacity(via.len() + 2);
    points.push(a);
    points.extend_from_slice(via);
    points.push(b);
    if points.len() < 2 {
        return String::new();
    }
    let mut d = format!(
        "M {} {}",
        board_num(board_r1(points[0].x)),
        board_num(board_r1(points[0].y))
    );
    if style == BoardEdgeStyle::Bezier && points.len() > 2 {
        for i in 1..points.len() {
            let prev = points[i - 1];
            let cur = points[i];
            let next = points[(i + 1).min(points.len() - 1)];
            let t1 = if i == 1 {
                prev
            } else {
                BoardPoint::new((prev.x + cur.x) / 2.0, (prev.y + cur.y) / 2.0)
            };
            let t2 = if i == points.len() - 1 {
                cur
            } else {
                BoardPoint::new((cur.x + next.x) / 2.0, (cur.y + next.y) / 2.0)
            };
            d.push_str(&format!(
                " C {} {}, {} {}, {} {}",
                board_num(board_r1(t1.x)),
                board_num(board_r1(t1.y)),
                board_num(board_r1(t2.x)),
                board_num(board_r1(t2.y)),
                board_num(board_r1(cur.x)),
                board_num(board_r1(cur.y))
            ));
        }
        return d;
    }
    for i in 1..points.len() {
        d.push(' ');
        d.push_str(&board_segment_tail(points[i - 1], points[i], style));
    }
    d
}

// ── board entities ────────────────────────────────────────────────────────

/// One node (Vue `BoardNodeInput`). `hidden` nodes are junction-only: they
/// paint NOTHING but still route edges, which is how a page bakes a
/// right-angle corner into its graph.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BoardNode {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    /// The default shell's text (Vue: `n.label ?? ""`).
    pub label: String,
    /// The `hk-board-node--{kind}` modifier (blank = no modifier).
    pub kind: String,
    pub hidden: bool,
    pub draggable: bool,
    /// The `node` slot content for THIS node (Vue: `slots.node({ node })`).
    pub content: Element,
    /// The `nodeActions` slot content for THIS node.
    pub actions: Element,
}

impl BoardNode {
    pub fn new(id: impl Into<String>, x: f64, y: f64, w: f64, h: f64) -> Self {
        Self {
            id: id.into(),
            x,
            y,
            w,
            h,
            ..Default::default()
        }
    }

    /// The node's world rect (what the anchor math consumes).
    pub fn rect(&self) -> BoardRect {
        BoardRect::new(self.x, self.y, self.w, self.h)
    }
}

/// One edge (Vue `BoardEdgeInput`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BoardEdge {
    pub id: String,
    pub from: String,
    pub to: String,
    /// Junction node ids the edge routes through (their centers).
    pub via: Vec<String>,
    pub style: BoardEdgeStyle,
    pub anchor_from: BoardAnchorMode,
    pub anchor_to: BoardAnchorMode,
    /// Stroke ink (Vue: `e.ink ?? DEFAULT_INK`; a blank string is NOT
    /// nullish, so it keeps its blank stroke).
    pub ink: Option<String>,
    pub dashed: bool,
    /// Stroke width (Vue: `e.width ?? 1.5`).
    pub width: Option<f64>,
}

impl BoardEdge {
    pub fn new(id: impl Into<String>, from: impl Into<String>, to: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            from: from.into(),
            to: to.into(),
            ..Default::default()
        }
    }
}

/// A resolved edge ready to paint (Vue's `edgePaths` entry).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BoardEdgePath {
    pub id: String,
    pub d: String,
    pub ink: String,
    pub dashed: bool,
    pub width: f64,
}

/// A node's identity + world rect — the `nodeClick` payload (Vue emits the
/// node object itself; the mirror hands over everything the host can key on
/// without borrowing the prop).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BoardNodeRef {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl BoardNodeRef {
    pub fn of(node: &BoardNode) -> Self {
        Self {
            id: node.id.clone(),
            x: node.x,
            y: node.y,
            w: node.w,
            h: node.h,
        }
    }
}

/// A node press — Vue's `onNodePointerDown(e, node)`: the node's world rect at
/// press time (so the host can run [`board_drag_position`]) plus the raw
/// pointer event.
#[derive(Clone, Debug)]
pub struct BoardNodePress {
    pub id: String,
    /// The node's world position when the press started (`dragState.ox/oy`).
    pub start: BoardPoint,
    pub w: f64,
    pub h: f64,
    pub pointer: PointerEvent,
}

impl BoardNodePress {
    /// The pointer's client position as a point (Vue: `e.clientX/clientY`).
    pub fn client(&self) -> BoardPoint {
        BoardPoint::new(self.pointer.client_x as f64, self.pointer.client_y as f64)
    }
}

/// Resolve every edge Vue would paint: the node rects feed both anchors, the
/// fan ordinals spread edges sharing a `from`, and `via` junction centers chain
/// the legs. Edges whose endpoints are missing are DROPPED (Vue:
/// `if (!from || !to) continue`), including junctions that do not exist.
pub fn board_edge_paths(nodes: &[BoardNode], edges: &[BoardEdge]) -> Vec<BoardEdgePath> {
    let mut rects: HashMap<&str, BoardRect> = HashMap::new();
    for node in nodes {
        rects.insert(node.id.as_str(), node.rect());
    }
    let fan = board_fan_ordinals(edges);
    let mut out: Vec<BoardEdgePath> = Vec::with_capacity(edges.len());
    for edge in edges {
        let (Some(from), Some(to)) = (
            rects.get(edge.from.as_str()).copied(),
            rects.get(edge.to.as_str()).copied(),
        ) else {
            continue;
        };
        let to_center = to.center();
        let from_center = from.center();
        let ordinal = fan.get(&edge.id).copied().unwrap_or_default();
        let a = board_anchor(
            from,
            edge.anchor_from,
            to_center,
            ordinal.index,
            ordinal.count,
        );
        let b = board_anchor(
            to,
            edge.anchor_to,
            from_center,
            ordinal.index,
            ordinal.count,
        );
        let via: Vec<BoardPoint> = edge
            .via
            .iter()
            .filter_map(|id| rects.get(id.as_str()).copied())
            .map(|rect| rect.center())
            .collect();
        out.push(BoardEdgePath {
            id: edge.id.clone(),
            d: board_via_path(a, &via, b, edge.style),
            ink: edge
                .ink
                .clone()
                .unwrap_or_else(|| BOARD_DEFAULT_INK.to_string()),
            dashed: edge.dashed,
            width: edge.width.unwrap_or(BOARD_DEFAULT_EDGE_WIDTH),
        });
    }
    out
}

// ── pure layer serialisation (the DOM contract's exact strings) ───────────

/// The board root's class list (`hk-board` plus the host class appended last).
pub fn board_classes(class: &str) -> String {
    let mut classes = String::from(BOARD_CLASS);
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

/// The node's class list in Vue's order: base, `--draggable`, then `--{kind}`.
pub fn board_node_classes(node: &BoardNode) -> String {
    let mut classes = String::from(BOARD_NODE_CLASS);
    if node.draggable {
        classes.push(' ');
        classes.push_str(BOARD_NODE_DRAGGABLE_CLASS);
    }
    if let Some(kind) = board_node_kind_class(&node.kind) {
        classes.push(' ');
        classes.push_str(&kind);
    }
    classes
}

/// The `hk-board-node--{kind}` modifier, or `None` for a blank kind (Vue:
/// `n.kind ? ... : undefined`).
pub fn board_node_kind_class(kind: &str) -> Option<String> {
    if kind.is_empty() {
        None
    } else {
        Some(format!("{}--{}", BOARD_NODE_CLASS, kind))
    }
}

/// The node's inline style: its world rect, exactly Vue's
/// `left/top/width/height` template literal.
pub fn board_node_style(node: &BoardNode) -> String {
    format!(
        "left:{};top:{};width:{};height:{}",
        board_px(node.x),
        board_px(node.y),
        board_px(node.w),
        board_px(node.h)
    )
}

/// The world layer's inline style: the camera transform plus the content box
/// the SVG edges are sized from.
pub fn board_world_style(camera: BoardCamera, content: BoardRect) -> String {
    format!(
        "transform:translate({}, {}) scale({});width:{};height:{}",
        board_px(camera.x),
        board_px(camera.y),
        board_num(camera.k),
        board_px(content.w),
        board_px(content.h)
    )
}

/// The grid layer's inline style. The dot grid is WORLD-anchored: it scales
/// with the camera (`gridSize · k`) and its origin follows the pan, so it
/// doubles as an alignment aid. `grid: false` collapses the layer to
/// `display:none` (Vue keeps the element mounted).
pub fn board_grid_style(grid: bool, grid_size: f64, camera: BoardCamera) -> String {
    if !grid {
        return "display:none".to_string();
    }
    let step = grid_size * camera.k;
    format!(
        "background-image:{};background-size:{} {};background-position:{} {}",
        BOARD_GRID_INK,
        board_px(step),
        board_px(step),
        board_px(camera.x),
        board_px(camera.y)
    )
}

/// Escape a caller string for a quoted attribute inside the SVG markup;
/// `dangerous_inner_html` bypasses tairitsu's escaper, so the mirror owns it.
fn board_escape_markup(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
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

/// The edges layer as SVG markup (see the header note on L49). Attribute order
/// follows the Vue JSX so the markup reads like the source template; the
/// `style="stroke:{ink}"` twin of the presentation attribute is intentional
/// (Firefox drops `var()` inside a presentation attribute, so the ink rides
/// both channels — the same contract HkGaugeRing/HkProgressRing use).
pub fn board_edges_svg(edges: &[BoardEdgePath], content: BoardRect) -> String {
    let mut svg = String::new();
    svg.push_str(&format!(
        r#"<svg class="{}" width="{}" height="{}">"#,
        BOARD_EDGES_CLASS,
        board_num(content.w),
        board_num(content.h)
    ));
    for edge in edges {
        let ink = board_escape_markup(&edge.ink);
        let dash = if edge.dashed {
            format!(r#" stroke-dasharray="{}""#, BOARD_EDGE_DASH)
        } else {
            String::new()
        };
        svg.push_str(&format!(
            r#"<path class="{}" d="{}" stroke="{ink}" style="stroke:{ink}" stroke-width="{}"{dash} fill="none" stroke-linecap="round"/>"#,
            BOARD_EDGE_CLASS,
            board_escape_markup(&edge.d),
            board_num(edge.width)
        ));
    }
    svg.push_str("</svg>");
    svg
}

/// True when a slot carries nothing to render: the empty fragment,
/// `empty_vnode()`'s blank text, and fragments of those.
fn board_slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(board_slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

#[define_props]
pub struct BoardProps {
    /// The nodes, in paint order (Vue `nodes`).
    pub nodes: Vec<BoardNode>,

    /// The edges (Vue `edges`).
    pub edges: Vec<BoardEdge>,

    /// Wire wheel / pointer gestures (Vue `interactive`; node presses always
    /// reach the host, because Vue tracks them for clicks regardless).
    #[default(true)]
    pub interactive: bool,

    /// The engineering dot grid (Vue `grid`).
    #[default(true)]
    pub grid: bool,

    /// World units per grid step (Vue `gridSize`).
    #[default(BOARD_DEFAULT_GRID_SIZE)]
    pub grid_size: f64,

    /// The minimap dock (Vue `minimap`).
    #[default(true)]
    pub minimap: bool,

    /// The camera — CONTROLLED (Vue: `useBoardCamera`'s `camera` ref). Drive it
    /// with the pure functions above.
    #[default]
    pub camera: BoardCamera,

    /// The measured viewport box (Vue: `viewportSize`, fed by the
    /// ResizeObserver).
    #[default]
    pub viewport: BoardViewport,

    /// The ladder's floor (Vue `minK`).
    #[default(BOARD_DEFAULT_MIN_K)]
    pub min_k: f64,

    /// The ladder's ceiling (Vue `maxK`).
    #[default(BOARD_DEFAULT_MAX_K)]
    pub max_k: f64,

    /// Ceiling for the fit zoom (Vue `fitCap`; `None` keeps
    /// [`BOARD_FIT_CAP`]).
    pub fit_cap: Option<f64>,

    /// Animate camera settles (Vue `animated`; a reduced-motion host snaps
    /// instead, which is its call).
    #[default(true)]
    pub animated: bool,

    /// Fit the board on mount (Vue `fitOnMount`). The host runs the fit; the
    /// flag records the Vue contract it must honour.
    #[default(true)]
    pub fit_on_mount: bool,

    /// The rendered minimap (see the header note on the dock).
    pub minimap_content: Option<Element>,

    /// Extra class appended to the board root (Vue's attribute fallthrough).
    #[default]
    pub class: String,

    /// Wheel gesture (Vue: the imperative non-passive listener). Only fires
    /// while `interactive`.
    pub on_wheel: Option<EventHandler<WheelEvent>>,

    /// Viewport pointer press (Vue `onPointerDown`). Only while `interactive`.
    pub on_pointer_down: Option<EventHandler<PointerEvent>>,

    /// Viewport pointer move (Vue `onPointerMove`). Only while `interactive`.
    pub on_pointer_move: Option<EventHandler<PointerEvent>>,

    /// Viewport pointer release (Vue `onPointerUp`; Vue resolves a node click
    /// here — see [`board_press_is_click`]).
    pub on_pointer_up: Option<EventHandler<PointerEvent>>,

    /// Viewport pointer cancel (Vue `onPointerCancel`: an aborted gesture must
    /// never synthesise a click).
    pub on_pointer_cancel: Option<EventHandler<PointerEvent>>,

    /// A press that started on a node (Vue `onNodePointerDown`).
    pub on_node_pointer_down: Option<EventHandler<BoardNodePress>>,

    /// A node's click (Vue `nodeClick`; see the header delta on the slop).
    pub on_node_click: Option<EventHandler<BoardNodeRef>>,
}

#[component]
pub fn Board(props: BoardProps) -> Element {
    let camera = props.camera;
    let content = board_content_bounds(&props.nodes);

    let grid_layer = VElement::new("div")
        .class(BOARD_GRID_CLASS)
        .style(board_grid_style(props.grid, props.grid_size, camera));

    // The edges layer: markup under a `display:contents` host (L49).
    let edge_paths = board_edge_paths(&props.nodes, &props.edges);
    let edges_host = VElement::new("span")
        .style("display:contents")
        .dangerous_inner_html(board_edges_svg(&edge_paths, content));

    let mut world = VElement::new("div")
        .class(BOARD_WORLD_CLASS)
        .style(board_world_style(camera, content))
        .child(VNode::Element(Box::new(edges_host)));

    let mut node_nodes: Vec<VNode> = Vec::new();
    for node in props.nodes.iter().filter(|node| !node.hidden) {
        let mut el = VElement::new("div")
            .class(board_node_classes(node))
            .style(board_node_style(node))
            .key(&node.id);

        // Vue: `slots.node ? slots.node({node}) : <div class="…-shell">{label}</div>`.
        if !board_slot_is_empty(&node.content) {
            el = el.child(node.content.clone());
        } else {
            let shell = VElement::new("div")
                .class(BOARD_NODE_SHELL_CLASS)
                .child(VNode::Text(VText::new(&node.label)));
            el = el.child(VNode::Element(Box::new(shell)));
        }

        // Vue renders the action dock only when the slot exists.
        if !board_slot_is_empty(&node.actions) {
            let dock = VElement::new("div")
                .class(BOARD_NODE_ACTIONS_CLASS)
                .child(node.actions.clone());
            el = el.child(VNode::Element(Box::new(dock)));
        }

        // Vue: every node press is reported (draggable or not) so a read-only
        // board still clicks; `draggable` only decides who owns the gesture.
        let press_handler = props.on_node_pointer_down.clone();
        let press_id = node.id.clone();
        let press_start = BoardPoint::new(node.x, node.y);
        let press_w = node.w;
        let press_h = node.h;
        el = el.on_pointerdown(move |event: PointerEvent| {
            let Some(handler) = press_handler.as_ref() else {
                return;
            };
            handler.call(BoardNodePress {
                id: press_id.clone(),
                start: press_start,
                w: press_w,
                h: press_h,
                pointer: event,
            });
        });

        let click_handler = props.on_node_click.clone();
        let node_ref = BoardNodeRef::of(node);
        el = el.on_click(move |_event: MouseEvent| {
            if let Some(handler) = click_handler.as_ref() {
                handler.call(node_ref.clone());
            }
        });

        node_nodes.push(VNode::Element(Box::new(el)));
    }
    world = world.children(node_nodes);

    let interactive = props.interactive;
    let mut root = VElement::new("div").class(board_classes(&props.class));

    let wheel_handler = props.on_wheel.clone();
    root = root.on_wheel(move |event: WheelEvent| {
        if !interactive {
            return;
        }
        event.prevent_default();
        if let Some(handler) = wheel_handler.as_ref() {
            handler.call(event);
        }
    });

    let down_handler = props.on_pointer_down.clone();
    root = root.on_pointerdown(move |event: PointerEvent| {
        if !interactive {
            return;
        }
        if let Some(handler) = down_handler.as_ref() {
            handler.call(event);
        }
    });

    let move_handler = props.on_pointer_move.clone();
    root = root.on_pointermove(move |event: PointerEvent| {
        if !interactive {
            return;
        }
        if let Some(handler) = move_handler.as_ref() {
            handler.call(event);
        }
    });

    let up_handler = props.on_pointer_up.clone();
    root = root.on_pointerup(move |event: PointerEvent| {
        if let Some(handler) = up_handler.as_ref() {
            handler.call(event);
        }
    });

    // `VElement` has no `pointercancel` builder; the generic register hands us a
    // boxed event. The cancel payload is unused by the mirror's own logic, so the
    // host handler gets a default event (documented in the file header).
    let cancel_handler = props.on_pointer_cancel.clone();
    root = root.on_event("pointercancel", move |_event: Box<dyn EventData>| {
        if let Some(handler) = cancel_handler.as_ref() {
            handler.call(PointerEvent::default());
        }
    });

    root = root
        .child(VNode::Element(Box::new(grid_layer)))
        .child(VNode::Element(Box::new(world)));

    if props.minimap {
        let dock = VElement::new("div")
            .class(BOARD_MINIMAP_CLASS)
            .child(props.minimap_content.clone().unwrap_or_else(empty_vnode));
        root = root.child(VNode::Element(Box::new(dock)));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for BoardComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkBoard.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "board"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(id: &str, x: f64, y: f64, w: f64, h: f64) -> BoardNode {
        BoardNode::new(id, x, y, w, h)
    }

    #[test]
    fn board_defaults_match_the_vue_props() {
        let props = BoardProps::default();
        assert!(props.nodes.is_empty());
        assert!(props.edges.is_empty());
        // Vue's boolean props all default to true (`interactive`, `grid`,
        // `minimap`, `animated`, `fitOnMount`).
        assert!(props.interactive);
        assert!(props.grid);
        assert_eq!(props.grid_size, 24.0);
        assert!(props.minimap);
        assert!(props.animated);
        assert!(props.fit_on_mount);
        // The composable's camera starts at the identity.
        assert_eq!(props.camera, BoardCamera::new(0.0, 0.0, 1.0));
        assert_eq!(props.viewport, BoardViewport::new(800.0, 600.0));
        assert_eq!(props.min_k, 0.2);
        assert_eq!(props.max_k, 4.0);
        // `fitCap` is `undefined` in Vue.
        assert!(props.fit_cap.is_none());
        assert!(props.minimap_content.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_wheel.is_none());
        assert!(props.on_pointer_down.is_none());
        assert!(props.on_pointer_move.is_none());
        assert!(props.on_pointer_up.is_none());
        assert!(props.on_pointer_cancel.is_none());
        assert!(props.on_node_pointer_down.is_none());
        assert!(props.on_node_click.is_none());
        // A node defaults to a non-draggable, visible, unkinded box.
        let node = BoardNode::default();
        assert!(!node.hidden);
        assert!(!node.draggable);
        assert_eq!(node.kind, "");
        assert_eq!(node.label, "");
    }

    #[test]
    fn board_class_names_match_the_vue_sheet() {
        assert_eq!(board_classes(""), "hk-board");
        assert_eq!(board_classes("host"), "hk-board host");
        assert_eq!(
            [
                BOARD_CLASS,
                BOARD_GRID_CLASS,
                BOARD_WORLD_CLASS,
                BOARD_EDGES_CLASS,
                BOARD_EDGE_CLASS,
                BOARD_NODE_CLASS,
                BOARD_NODE_DRAGGABLE_CLASS,
                BOARD_NODE_ACTIONS_CLASS,
                BOARD_NODE_SHELL_CLASS,
                BOARD_MINIMAP_CLASS,
            ],
            [
                "hk-board",
                "hk-board-grid",
                "hk-board-world",
                "hk-board-edges",
                "hk-board-edge",
                "hk-board-node",
                "hk-board-node--draggable",
                "hk-board-node-actions",
                "hk-board-node-shell",
                "hk-board-minimap",
            ]
        );
    }

    #[test]
    fn board_zoom_ladder_matches_the_vue_ladder() {
        // The rungs sit on 1.05^n.
        assert!((board_k_of(0.0) - 1.0).abs() < 1e-12);
        assert!((board_k_of(1.0) - 1.05).abs() < 1e-12);
        assert!((board_level_of(1.05) - 1.0).abs() < 1e-12);
        // A zoom just off a rung snaps back onto it.
        assert!((quantize_board_k(1.02) - 1.0).abs() < 1e-12);
        assert!((quantize_board_k(1.06) - 1.05).abs() < 1e-12);
        // The two bounds are exactly the bounds, never a powf epsilon away.
        assert_eq!(quantize_board_k(0.01), BOARD_K_MIN);
        assert_eq!(quantize_board_k(99.0), BOARD_K_MAX);
        // One wheel notch quantizes k * 1.05 / k / 1.05.
        assert!((board_wheel_step_k(1.0, true) - 1.05).abs() < 1e-12);
        assert!((board_wheel_step_k(1.05, false) - 1.0).abs() < 1e-12);
        // The percent helper clamps to the PROP bounds.
        assert_eq!(board_zoom_to_percent_k(50.0, 0.2, 4.0), 0.5);
        assert_eq!(board_zoom_to_percent_k(500.0, 0.2, 4.0), 4.0);
        assert_eq!(board_zoom_to_percent_k(1.0, 0.2, 4.0), 0.2);
        assert_eq!(board_zoom_percent(1.05), 105.0);
        assert!(board_can_zoom_in(1.0, 4.0));
        assert!(!board_can_zoom_in(4.0, 4.0));
        assert!(board_can_zoom_out(1.0, 0.2));
        assert!(!board_can_zoom_out(0.2, 0.2));
    }

    #[test]
    fn board_step_rung_pushes_in_the_press_direction() {
        // A target that already resolves elsewhere is untouched.
        let target = board_step_rung(1.0, 1.05);
        assert!((target - 1.05).abs() < 1e-12);
        // From the last reachable rung below the cap a +5% target would round
        // straight back onto the current rung: the press is pushed one rung.
        let current = board_k_of(board_level_of(BOARD_K_MAX).floor() - 0.5);
        assert!(current < BOARD_K_MAX);
        let pushed = board_step_rung(current, current * 1.05);
        assert!(pushed > current, "{current} -> {pushed}");
        assert!(pushed <= BOARD_K_MAX);
        // At the ceiling the clamp wins (the push resolves back onto the cap) ...
        assert_eq!(
            board_step_rung(BOARD_K_MAX, BOARD_K_MAX * 1.05),
            BOARD_K_MAX
        );
        // ... and the floor keeps Vue's own boundary quirk: a zoom-OUT press
        // from the exact floor resolves its rung back onto the floor, which
        // reads as "not below the current level", so the one-rung push goes
        // IN. Faithful, and the reason this is a pinned assertion: a host that
        // special-cases the floor would drift from the Vue build.
        assert!(
            (board_step_rung(BOARD_K_MIN, BOARD_K_MIN / 1.05) - board_k_of(-32.0)).abs() < 1e-12
        );
    }

    #[test]
    fn board_zoom_at_pins_the_world_point_under_the_anchor() {
        let camera = BoardCamera::new(10.0, 20.0, 1.0);
        let anchor = BoardPoint::new(100.0, 100.0);
        let before = board_to_world(camera, anchor);
        let zoomed = board_zoom_at(camera, 2.0, anchor);
        let after = board_to_world(zoomed, anchor);
        assert!((zoomed.k - 2.0).abs() < 1e-12);
        assert!((before.x - after.x).abs() < 1e-9, "{before:?} {after:?}");
        assert!((before.y - after.y).abs() < 1e-9, "{before:?} {after:?}");
        // The clamp keeps a wild target inside the ladder.
        assert_eq!(board_zoom_at(camera, 0.0001, anchor).k, BOARD_K_MIN);
        // Screen <-> world round-trips.
        let screen = board_to_screen(camera, before);
        assert!((screen.x - anchor.x).abs() < 1e-9);
        assert!((screen.y - anchor.y).abs() < 1e-9);
    }

    #[test]
    fn board_clamp_pan_and_fit_match_the_vue_rules() {
        let viewport = BoardViewport::new(800.0, 600.0);
        let small = BoardRect::new(0.0, 0.0, 100.0, 100.0);
        // Content smaller than the viewport re-centers ...
        let centered = board_clamp_pan(BoardCamera::new(5000.0, -5000.0, 1.0), small, viewport);
        assert_eq!(centered.x, 350.0);
        assert_eq!(centered.y, 250.0);
        // ... content larger keeps half a viewport of slack on each side.
        let large = BoardRect::new(0.0, 0.0, 2000.0, 1600.0);
        let slack = board_clamp_pan(BoardCamera::new(99999.0, 99999.0, 1.0), large, viewport);
        assert_eq!(slack.x, 400.0);
        assert_eq!(slack.y, 300.0);
        let slack_lo = board_clamp_pan(BoardCamera::new(-99999.0, -99999.0, 1.0), large, viewport);
        assert_eq!(slack_lo.x, -1600.0);
        assert_eq!(slack_lo.y, -1300.0);

        // fit(): centered, padded, capped.
        let content = BoardRect::new(0.0, 0.0, 1000.0, 500.0);
        let fitted = board_fit(content, viewport, BOARD_FIT_PAD, BOARD_FIT_CAP);
        assert!((fitted.k - 0.72).abs() < 1e-12);
        assert!((fitted.x - 40.0).abs() < 1e-9);
        assert!((fitted.y - 120.0).abs() < 1e-9);
        // A tiny board never blows past the cap, and the cap can be raised.
        let tiny = BoardRect::new(0.0, 0.0, 10.0, 10.0);
        assert_eq!(
            board_fit(tiny, viewport, BOARD_FIT_PAD, BOARD_FIT_CAP).k,
            BOARD_FIT_CAP
        );
        assert_eq!(board_fit(tiny, viewport, BOARD_FIT_PAD, 3.0).k, 3.0);
        // A fitted framing below minK installs a lower floor so the next clamp
        // does not undo it.
        assert_eq!(board_fit_k_floor(0.1, 0.2), 0.1);
        assert_eq!(board_fit_k_floor(0.5, 0.2), 0.2);
        let floored = board_clamp_camera(
            BoardCamera::new(0.0, 0.0, 0.1),
            content,
            viewport,
            4.0,
            board_fit_k_floor(0.1, 0.2),
        );
        assert!((floored.k - 0.1).abs() < 1e-12);
        let clamped =
            board_clamp_camera(BoardCamera::new(0.0, 0.0, 9.0), content, viewport, 4.0, 0.2);
        assert_eq!(clamped.k, 4.0);
    }

    #[test]
    fn board_tween_and_progress_follow_the_animated_settle() {
        let from = BoardCamera::new(0.0, 0.0, 1.0);
        let to = BoardCamera::new(100.0, 200.0, 1.21);
        // t = 0 -> from, t = 1 -> to exactly.
        assert_eq!(board_tween_cam(from, to, 0.0), from);
        let end = board_tween_cam(from, to, 1.0);
        assert!((end.x - 100.0).abs() < 1e-9);
        assert!((end.y - 200.0).abs() < 1e-9);
        assert!((end.k - 1.21).abs() < 1e-9);
        // Vue eases first, then interpolates k geometrically:
        // e = easeOutCubic(t) = 1 - (1-t)^3; at t=0.5, e = 0.875, so
        // k = 1.0 * (1.21/1.0)^0.875, NOT the plain geometric mean.
        let mid = board_tween_cam(from, to, 0.5);
        let eased = 1.0 - (1.0f64 - 0.5).powi(3);
        let expected_k = 1.0 * (1.21f64 / 1.0).powf(eased);
        assert!((mid.k - expected_k).abs() < 1e-9, "{}", mid.k);
        assert!((mid.x - 100.0 * eased).abs() < 1e-9, "{}", mid.x);
        // The progress is capped at one motion budget.
        assert_eq!(board_tween_progress(0.0), 0.0);
        assert_eq!(board_tween_progress(BOARD_ANIM_MS / 2.0), 0.5);
        assert_eq!(board_tween_progress(BOARD_ANIM_MS), 1.0);
        assert_eq!(board_tween_progress(BOARD_ANIM_MS * 10.0), 1.0);
        assert_eq!(board_tween_progress(f64::NAN), 1.0);
        assert_eq!(board_tween_progress(-5.0), 0.0);
        // The ease is clamped and monotone.
        assert_eq!(board_ease_out_cubic(0.0), 0.0);
        assert_eq!(board_ease_out_cubic(1.0), 1.0);
        assert_eq!(board_ease_out_cubic(-1.0), 0.0);
        assert_eq!(board_ease_out_cubic(2.0), 1.0);
        assert!(board_ease_out_cubic(0.5) > 0.5);
    }

    #[test]
    fn board_drag_math_matches_the_pointer_branches() {
        let start = BoardPoint::new(100.0, 100.0);
        let press = BoardPoint::new(10.0, 10.0);
        // World delta = client delta / (k * pxScale).
        let moved = board_drag_position(start, press, BoardPoint::new(30.0, 30.0), 2.0, 1.0);
        assert_eq!(moved, BoardPoint::new(110.0, 110.0));
        // The ancestor CSS scale divides the delta a second time.
        let scaled = board_drag_position(start, press, BoardPoint::new(30.0, 30.0), 2.0, 2.0);
        assert_eq!(scaled, BoardPoint::new(105.0, 105.0));
        // A zero camera cannot divide by zero: it reads as k = 1.
        let degenerate = board_drag_position(start, press, BoardPoint::new(21.0, 10.0), 0.0, 1.0);
        assert_eq!(degenerate, BoardPoint::new(111.0, 100.0));
        // Vue's Manhattan slop: > 3 is a drag, < 3 is a click, exactly 3 is
        // neither (the two predicates are exclusive, not complementary).
        assert!(!board_drag_moved(press, BoardPoint::new(11.0, 12.0)));
        assert!(board_drag_moved(press, BoardPoint::new(12.0, 12.0)));
        assert!(board_press_is_click(press, BoardPoint::new(11.0, 11.0)));
        assert!(!board_press_is_click(press, BoardPoint::new(11.0, 12.0)));
        assert!(!board_press_is_click(press, BoardPoint::new(12.0, 12.0)));
    }

    #[test]
    fn board_bbox_and_content_bounds_add_the_vue_margin() {
        // Zero-size rects are ignored like Vue's `boardBBox`.
        let bbox = board_bbox(&[
            BoardRect::new(10.0, 20.0, 100.0, 50.0),
            BoardRect::new(-30.0, -10.0, 20.0, 0.0),
            BoardRect::new(200.0, 40.0, 50.0, 60.0),
        ]);
        assert_eq!(bbox, BoardRect::new(10.0, 20.0, 240.0, 80.0));
        // Nothing measurable: Vue's placeholder bbox.
        assert_eq!(
            board_bbox(&[BoardRect::new(0.0, 0.0, 0.0, 0.0)]),
            BoardRect::new(0.0, 0.0, 1200.0, 800.0)
        );
        // The board's `content` adds 20 world px on every side.
        let nodes = vec![node("a", 0.0, 0.0, 100.0, 50.0)];
        assert_eq!(
            board_content_bounds(&nodes),
            BoardRect::new(-20.0, -20.0, 140.0, 90.0)
        );
    }

    #[test]
    fn board_anchors_match_the_vue_modes() {
        let rect = BoardRect::new(0.0, 0.0, 100.0, 50.0);
        let right = BoardPoint::new(150.0, 25.0);
        // center: the border point the center -> center ray exits through.
        assert_eq!(
            board_anchor(rect, BoardAnchorMode::Center, right, 0, 1),
            BoardPoint::new(100.0, 25.0)
        );
        // top / top-left are literal border points.
        assert_eq!(
            board_anchor(rect, BoardAnchorMode::Top, right, 0, 1),
            BoardPoint::new(50.0, 0.0)
        );
        assert_eq!(
            board_anchor(rect, BoardAnchorMode::TopLeft, right, 0, 1),
            BoardPoint::new(0.0, 0.0)
        );
        // nearest clamps onto the facing border.
        assert_eq!(
            board_anchor(rect, BoardAnchorMode::Nearest, right, 0, 1),
            BoardPoint::new(100.0, 25.0)
        );
        // fan: an even spread across the exit border, no-op when count <= 1.
        assert_eq!(
            board_anchor(rect, BoardAnchorMode::Fan, right, 0, 1),
            board_anchor(rect, BoardAnchorMode::Center, right, 0, 1)
        );
        assert_eq!(
            board_anchor(rect, BoardAnchorMode::Fan, right, 0, 3),
            BoardPoint::new(100.0, 12.5)
        );
        assert_eq!(
            board_anchor(rect, BoardAnchorMode::Fan, right, 2, 3),
            BoardPoint::new(100.0, 37.5)
        );
        // A vertical fan spreads along the top/bottom border.
        let above = BoardPoint::new(50.0, -100.0);
        assert_eq!(
            board_anchor(rect, BoardAnchorMode::Fan, above, 1, 3),
            BoardPoint::new(50.0, 0.0)
        );
    }

    #[test]
    fn board_paths_match_the_vue_route_styles() {
        let a = BoardPoint::new(0.0, 0.0);
        let b = BoardPoint::new(10.0, 20.0);
        assert_eq!(
            board_edge_path(a, b, BoardEdgeStyle::Straight),
            "M 0 0 L 10 20"
        );
        assert_eq!(
            board_edge_path(a, b, BoardEdgeStyle::Orthogonal),
            "M 0 0 H 5 V 20 H 10"
        );
        assert_eq!(
            board_edge_path(a, b, BoardEdgeStyle::Spine),
            "M 0 0 V 10 H 10 V 20"
        );
        assert_eq!(
            board_edge_path(a, BoardPoint::new(10.0, 0.0), BoardEdgeStyle::Bezier),
            "M 0 0 C 5 0, 5 0, 10 0"
        );
        // Via points chain the same legs end to end (one elbow per leg).
        assert_eq!(
            board_via_path(
                a,
                &[BoardPoint::new(10.0, 0.0)],
                BoardPoint::new(20.0, 20.0),
                BoardEdgeStyle::Orthogonal
            ),
            "M 0 0 H 5 V 0 H 10 H 15 V 20 H 20"
        );
        // A bezier via is one flowing curve, not two segments.
        let curve = board_via_path(
            a,
            &[BoardPoint::new(10.0, 0.0)],
            BoardPoint::new(20.0, 20.0),
            BoardEdgeStyle::Bezier,
        );
        assert_eq!(curve.matches('C').count(), 2, "{curve}");
        assert!(curve.starts_with("M 0 0 "), "{curve}");
    }

    #[test]
    fn board_fan_ordinals_count_each_source_node() {
        let edges = vec![
            BoardEdge::new("e1", "a", "b"),
            BoardEdge::new("e2", "a", "c"),
            BoardEdge::new("e3", "b", "c"),
        ];
        let ordinals = board_fan_ordinals(&edges);
        // `a` feeds two edges: indices 0, 1 of 2 — the SECOND pass supplies the
        // final total, so the first edge does not collapse onto count 1.
        assert_eq!(
            ordinals.get("e1").copied(),
            Some(BoardFanOrdinal { index: 0, count: 2 })
        );
        assert_eq!(
            ordinals.get("e2").copied(),
            Some(BoardFanOrdinal { index: 1, count: 2 })
        );
        // A different source counts independently.
        assert_eq!(
            ordinals.get("e3").copied(),
            Some(BoardFanOrdinal { index: 0, count: 1 })
        );
        assert_eq!(
            BoardFanOrdinal::default(),
            BoardFanOrdinal { index: 0, count: 1 }
        );
    }

    #[test]
    fn board_edge_paths_drop_dangling_edges_and_route_junctions() {
        let nodes = vec![
            node("a", 0.0, 0.0, 100.0, 50.0),
            node("b", 300.0, 0.0, 100.0, 50.0),
            BoardNode {
                hidden: true,
                ..node("corner", 150.0, 100.0, 20.0, 20.0)
            },
        ];
        let mut edge = BoardEdge::new("e1", "a", "b");
        edge.via = vec!["corner".to_string(), "missing".to_string()];
        edge.style = BoardEdgeStyle::Orthogonal;
        let paths = board_edge_paths(&nodes, &[edge, BoardEdge::new("e2", "a", "gone")]);
        // The dangling edge is dropped, the via route keeps only known ids.
        assert_eq!(paths.len(), 1, "{paths:?}");
        assert_eq!(paths[0].id, "e1");
        // a center (50,25) -> b left border (300,25) through the corner center.
        assert_eq!(paths[0].ink, BOARD_DEFAULT_INK);
        assert!(!paths[0].dashed);
        assert_eq!(paths[0].width, BOARD_DEFAULT_EDGE_WIDTH);
        assert!(paths[0].d.starts_with("M 100 25 "), "{}", paths[0].d);
        // The junction's center is one of the routed legs; the unknown id in
        // `via` is filtered out instead of breaking the path.
        assert!(paths[0].d.contains("V 110 H 160"), "{}", paths[0].d);
    }

    #[test]
    fn board_layer_styles_match_the_vue_templates() {
        let camera = BoardCamera::new(12.0, -4.0, 1.5);
        let content = BoardRect::new(-20.0, -20.0, 140.0, 90.0);
        assert_eq!(
            board_world_style(camera, content),
            "transform:translate(12px, -4px) scale(1.5);width:140px;height:90px"
        );
        // The grid is world-anchored: step scales with k, origin follows pan.
        assert_eq!(
            board_grid_style(true, 24.0, camera),
            "background-image:radial-gradient(rgb(var(--color-text) / 12%) 1px, transparent 1px);background-size:36px 36px;background-position:12px -4px"
        );
        // `grid: false` keeps the element mounted, collapsed.
        assert_eq!(board_grid_style(false, 24.0, camera), "display:none");
        // Node boxes are laid out in world px.
        let styled_node = BoardNode {
            draggable: true,
            kind: "plc".to_string(),
            ..node("a", 10.0, 20.0, 100.0, 50.0)
        };
        assert_eq!(
            board_node_style(&styled_node),
            "left:10px;top:20px;width:100px;height:50px"
        );
        // Class order: base, draggable, kind.
        assert_eq!(
            board_node_classes(&styled_node),
            "hk-board-node hk-board-node--draggable hk-board-node--plc"
        );
        assert_eq!(
            board_node_classes(&node("a", 0.0, 0.0, 1.0, 1.0)),
            "hk-board-node"
        );
        assert_eq!(board_node_kind_class(""), None);
        // JS-style numbers: no trailing `.0`, and `-0` prints `0`.
        assert_eq!(board_num(1.0), "1");
        assert_eq!(board_num(-0.0), "0");
        assert_eq!(board_num(1.25), "1.25");
        assert_eq!(board_px(0.0), "0px");
        assert_eq!(board_r1(1.04), 1.0);
    }

    #[test]
    fn board_edges_svg_keeps_the_vue_attribute_contract() {
        let edges = vec![
            BoardEdgePath {
                id: "e1".to_string(),
                d: "M 0 0 L 10 10".to_string(),
                ink: BOARD_DEFAULT_INK.to_string(),
                dashed: true,
                width: 2.0,
            },
            BoardEdgePath {
                id: "e2".to_string(),
                d: "M 1 1 L 2 2".to_string(),
                ink: r#"rgb(1 2 3) "quoted""#.to_string(),
                dashed: false,
                width: 1.5,
            },
        ];
        let svg = board_edges_svg(&edges, BoardRect::new(0.0, 0.0, 1200.0, 800.0));
        for needle in [
            r#"<svg class="hk-board-edges" width="1200" height="800">"#,
            r#"class="hk-board-edge""#,
            r#"d="M 0 0 L 10 10""#,
            r#"stroke="rgb(var(--color-primary) / 38%)""#,
            r#"style="stroke:rgb(var(--color-primary) / 38%)""#,
            r#"stroke-width="2""#,
            r#"stroke-dasharray="6 5""#,
            r#"fill="none""#,
            r#"stroke-linecap="round""#,
            "</svg>",
        ] {
            assert!(svg.contains(needle), "missing {needle}: {svg}");
        }
        // The undashed edge carries no dash attribute at all.
        assert_eq!(svg.matches("stroke-dasharray").count(), 1, "{svg}");
        // Caller strings are escaped before they reach the markup.
        assert!(svg.contains("&quot;quoted&quot;"), "{svg}");
        assert!(!svg.contains(r#""quoted""#), "{svg}");
    }

    #[test]
    fn board_renders_its_layers_nodes_and_minimap_dock() {
        let nodes = vec![
            BoardNode {
                label: "plc".to_string(),
                draggable: true,
                kind: "device".to_string(),
                ..node("a", 0.0, 0.0, 100.0, 50.0)
            },
            // The hidden junction paints nothing but still routes edges.
            BoardNode {
                hidden: true,
                ..node("corner", 150.0, 0.0, 10.0, 10.0)
            },
            BoardNode {
                content: rsx! {
                    span { class: "custom-node", "custom" }
                },
                actions: rsx! {
                    button { class: "node-action", "x" }
                },
                ..node("b", 300.0, 0.0, 100.0, 50.0)
            },
        ];
        let mut edge = BoardEdge::new("e1", "a", "b");
        edge.via = vec!["corner".to_string()];
        edge.dashed = true;
        edge.ink = Some("rgb(var(--color-info))".to_string());

        let html = Board(BoardProps {
            nodes,
            edges: vec![edge],
            camera: BoardCamera::new(4.0, 8.0, 1.0),
            minimap: true,
            minimap_content: Some(rsx! {
                div { class: "hk-minimap", "map" }
            }),
            class: "host".to_string(),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-board host""#,
            r#"class="hk-board-grid""#,
            r#"background-size:24px 24px"#,
            r#"class="hk-board-world""#,
            "transform:translate(4px, 8px) scale(1)",
            r#"style="display:contents""#,
            r#"class="hk-board-edges""#,
            r#"class="hk-board-edge""#,
            r#"stroke="rgb(var(--color-info))""#,
            r#"stroke-dasharray="6 5""#,
            r#"class="hk-board-node hk-board-node--draggable hk-board-node--device""#,
            r#"class="hk-board-node-shell""#,
            "plc",
            r#"class="custom-node""#,
            r#"class="hk-board-node-actions""#,
            r#"class="node-action""#,
            r#"class="hk-board-minimap""#,
            r#"class="hk-minimap""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The hidden junction renders no node box at all (its id is only a
        // via), so exactly the two visible nodes paint and only the label-only
        // node gets Vue's default shell.
        assert!(!html.contains("corner"), "{html}");
        assert_eq!(html.matches("hk-board-node-shell").count(), 1, "{html}");
        assert_eq!(html.matches(r#"class="custom-node""#).count(), 1, "{html}");
        // Layer order: grid, world, minimap.
        let grid_at = html.find("hk-board-grid").expect("grid");
        let world_at = html.find("hk-board-world").expect("world");
        let minimap_at = html.find("hk-board-minimap").expect("minimap");
        assert!(grid_at < world_at && world_at < minimap_at, "{html}");
        // The node without a slot gets the label shell, the one with slots
        // gets its own content plus the action dock instead.
        assert!(
            html.find("custom-node").expect("custom") < html.find("node-action").expect("dock")
        );
    }

    #[test]
    fn board_can_hide_the_grid_and_the_minimap() {
        let html = Board(BoardProps {
            nodes: vec![node("a", 0.0, 0.0, 10.0, 10.0)],
            grid: false,
            minimap: false,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("display:none"), "{html}");
        assert!(!html.contains("hk-board-minimap"), "{html}");
        // An empty board is legal and still renders all three layers.
        let empty = Board(BoardProps::default()).render_to_html();
        assert!(empty.contains("hk-board-grid"), "{empty}");
        assert!(empty.contains("hk-board-world"), "{empty}");
        assert!(empty.contains("hk-board-minimap"), "{empty}");
        assert!(empty.contains(r#"width="1240""#), "{empty}");
    }

    #[test]
    fn board_styles_come_from_the_canonical_vue_sheet() {
        let css = BoardComponent::styles();
        for class in [
            ".hk-board",
            ".hk-board-grid",
            ".hk-board-world",
            ".hk-board-edges",
            ".hk-board-node",
            ".hk-board-node-actions",
            ".hk-board-node--draggable",
            ".hk-board-node-shell",
            ".hk-board-minimap",
        ] {
            assert!(css.contains(class), "board css must carry {class:?}");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored board sheet"
        );
        assert_eq!(BoardComponent::name(), "board");
    }
}
