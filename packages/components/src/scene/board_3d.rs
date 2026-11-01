// hi-components/src/scene/board_3d.rs
// Board3D — mirror of the canonical Vue `HkBoard3D`: the shared 3D scene
// SURFACE every scene-like page builds on.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkBoard3D.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-board3d*` class name is literal and
// identical in both forms.
//
// DOM contract (mirrors the Vue render output):
//
//   div.hk-board3d                        [style="background:transparent"]
//     canvas.hk-board3d-canvas            [id]        ← the HOST CANVAS SLOT
//     div[style="position:absolute;inset:0;pointer-events:none"]
//                                           (Vue: the CSS2DRenderer's own root,
//                                            which carries no class)
//       div.hk-board3d-label[data-label-id]
//           [style="transform:translate(-50%,-50%) translate(Xpx, Ypx)"]
//           [style="display:none"]          (anchor outside the frustum)
//       …                                  (only while the board is alive)
//     <fallback slot> | div.hk-board3d-fallback   (only when `failed`)
//     div.hk-minimap.hk-minimap3d[.hk-minimap--collapsed][data-collapsed]
//                                           (only when `minimap && ready
//                                            && !failed`; Vue mounts HkMinimap3D
//                                            here — see the delta list)
//       <minimap slot>
//     div.hk-board3d-overlay
//       <default slot>                      (the page's own chrome; the sheet
//                                            makes children opt into pointer
//                                            events)
//
// The Rust crate is `wasm32-wasip2`: there is no WebGL, no three.js and no
// DOM measurement. What this file owns is therefore EVERYTHING that is
// arithmetic — the camera policy, the projection/picking conversion, the
// orbit maths of the stereoscopic minimap, the flight easing — and what it
// renders is the surface: a canvas element the HOST acquires a context from,
// the labelled overlay, and the controlled chrome. A host plugs its own
// renderer (WebGL, Canvas2D, or a server-side raster) behind the canvas slot
// and drives the camera through the props below; the mirror never pretends to
// own a frame loop.
//
// Behaviour deltas vs Vue (documented, one per deviation):
//   * NO RENDERER, NO SCENE, NO PICKING RAYCAST. Vue builds a
//     `THREE.WebGLRenderer` + `PerspectiveCamera` + `OrbitControls` in
//     `init()`, keeps a frame loop and raycasts `pickAt` against the
//     registered content. Here the canvas is a SLOT: the host keeps the
//     context, the content and the raycast. The mirror emits the PICK PROBE
//     instead — [`Board3DProps::on_pick`] fires with the click position and,
//     when the host supplied `canvas_rect`, the exact NDC pair Vue hands its
//     own raycaster ([`board3d_pointer_ndc`]); child-to-root resolution
//     against the host's registered ids is [`board3d_pick_resolve`].
//   * `ready(engine)` IS RETIRED — there is no engine handle to hand out.
//     The host signals "the renderer is attached" with the `ready` prop, which
//     is what gates the minimap dock exactly like Vue's `engineRef.value`.
//   * `objectClick` / `objectHover` ARE HOST-SIDE: they carry a registered id,
//     which only a raycast can produce. The mirror keeps the POINTER half
//     ([`Board3DProps::on_pick`], [`Board3DProps::on_pointer_move`],
//     [`Board3DProps::on_pointer_leave`]) — with the press/release slop
//     machine (`CLICK_SLOP_PX`, Manhattan metric) and the "a grab cancels any
//     in-flight flight" rule already applied.
//   * THE CAMERA IS A CONTROLLED POSE, not an internal one. Vue mutates
//     `camera.position` / `controls.target` (OrbitControls, `flyTo`, `frameAll`)
//     and exposes them through the engine. Here [`Board3DProps::camera_position`]
//     + [`Board3DProps::camera_target`] are the truth, [`board3d_orbit_window`]
//     normalises the distance window exactly like Vue does, and every flight the
//     engine would animate is exported as a pure pose function the host applies
//     over its own clock: [`board3d_fly_pose`], [`board3d_focus_pose`],
//     [`board3d_frame_pose`], [`board3d_topdown_pose`].
//   * NO `HkMinimap3D`. That component (a second stereoscopic renderer, its
//     zoom ladder, its collapse button) is not mirrored in this wave; the
//     mirror renders its DOCK — `div.hk-minimap.hk-minimap3d` with Vue's
//     collapsed modifier — so a host mounting its own minimap inherits the
//     sheet's placement (`.hk-board3d .hk-minimap3d { z-index: 50 }`). The
//     minimap's own geometry survives as pure functions
//     ([`BOARD3D_MINIMAP_DRAG_RADIANS_PER_PX`], [`board3d_orbit_delta`],
//     [`board3d_spherical_position`], [`board3d_view_plane_half_extents`]).
//   * `lighting` / `autoClipping` / `hoverBox` / `autoClipping`'s clipping
//     calls / `setGround` / `applyLighting` / `applyEnvironment` / the GLB
//     `ModelLayer` are ALL renderer state: a WASI host owns them. Only the
//     clipping FORMULA is mirrored ([`board3d_clipping_planes`]), because it
//     changes the projection and therefore the label placement.
//   * CSS2D LABELS ARE COMPUTED, NOT MEASURED. Vue attaches a `CSS2DObject`
//     to the object and lets `CSS2DRenderer` transform the chip every frame.
//     The mirror takes `labels` (world anchor + local offset + text) and
//     projects them with the SAME maths ([`board3d_project_to_screen`]), so a
//     host that keeps its anchors in sync gets Vue's placement byte for byte —
//     including the `display:none` a chip takes when its anchor leaves the
//     frustum.
//   * `emit('error', message)` becomes the controlled `error` text: a WASI
//     mirror has no WebGL probe to fail, so the host decides `failed` (and may
//     pass the message it caught).
//   * Theme sync (`MutationObserver` on `document.documentElement`, the
//     `--color-*` channel re-read) is host-side; the two DECISIONS it makes
//     are pure and exported: [`board3d_css_channels`] (the `10 15 25` triplet →
//     linear rgb) and [`board3d_hover_frame_channel`] (text channel on a dark
//     room, muted channel on a light one — the user's 2026-10-01 rule).
//
// Replaces nothing: the family had no 3D surface before this mirror.

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

use tairitsu_vdom::PointerEvent;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct Board3DComponent;

// ── camera policy (Vue: HkBoard3D's prop defaults) ───────────────────────

/// Vertical field of view in degrees (Vue: `fov`, default 45).
pub const BOARD3D_DEFAULT_FOV: f64 = 45.0;

/// Starting eye (Vue: `initialPosition` default `[22, 16, 26]`).
pub const BOARD3D_DEFAULT_POSITION: [f64; 3] = [22.0, 16.0, 26.0];

/// Starting orbit pivot (Vue: `initialTarget` default `[0, 0, 0]`).
pub const BOARD3D_DEFAULT_TARGET: [f64; 3] = [0.0, 0.0, 0.0];

/// Orbit distance window (Vue: `minDistance` / `maxDistance`).
pub const BOARD3D_DEFAULT_MIN_DISTANCE: f64 = 2.0;
pub const BOARD3D_DEFAULT_MAX_DISTANCE: f64 = 600.0;

/// The camera's built-in near/far planes (Vue: `new PerspectiveCamera(fov, 1,
/// 0.1, 4000)`).
pub const BOARD3D_CAMERA_NEAR: f64 = 0.1;
pub const BOARD3D_CAMERA_FAR: f64 = 4000.0;

/// Press→release travel (Manhattan px) that still counts as a click
/// (Vue: `CLICK_SLOP_PX = 4`).
pub const BOARD3D_CLICK_SLOP_PX: f64 = 4.0;

/// The main-camera-only layer (the pointer/selection frames ride it so the
/// minimap render stays clean) and the minimap-helpers layer.
pub const BOARD3D_MAIN_LAYER: usize = 2;
pub const BOARD3D_HELPERS_LAYER: usize = 1;

/// How many frames Vue waits before re-measuring a frame target that had
/// nothing measurable yet (≈100 ms at 60 fps).
pub const BOARD3D_HOVER_BOX_RETRY_FRAMES: u32 = 6;

/// `frameAll`'s default fit padding multiplier.
pub const BOARD3D_FRAME_ALL_PADDING: f64 = 1.3;

/// The direction `frameAll` falls back to when the eye sits on the pivot
/// (Vue: `dir.set(0.6, 0.45, 1)`).
pub const BOARD3D_FRAME_FALLBACK_DIR: [f64; 3] = [0.6, 0.45, 1.0];

/// `flyToFocus`'s framing angle (Vue: `(-0.03, 0.3, -1)`, normalised) and its
/// default distance multiplier.
pub const BOARD3D_FOCUS_DIR: [f64; 3] = [-0.03, 0.3, -1.0];
pub const BOARD3D_FOCUS_PADDING: f64 = 1.6;

/// Flight durations (Vue: `flyTo(position, target, durationMs = 600)`,
/// `setViewMode(mode, durationMs = 300)`).
pub const BOARD3D_FLY_MS: f64 = 600.0;
pub const BOARD3D_VIEW_MODE_MS: f64 = 300.0;

/// The minimap eye is clamped off the poles (a degenerate azimuth flips the
/// view) and sweeps `1.25π` per full ~160 px drag.
pub const BOARD3D_MINIMAP_MIN_POLAR: f64 = 0.12;
pub const BOARD3D_MINIMAP_MAX_POLAR: f64 = std::f64::consts::PI - 0.12;
pub const BOARD3D_MINIMAP_DRAG_PX: f64 = 160.0;
pub const BOARD3D_MINIMAP_DRAG_RADIANS_PER_PX: f64 =
    (std::f64::consts::PI * 1.25) / BOARD3D_MINIMAP_DRAG_PX;

// ── vec3 helpers (pure) ──────────────────────────────────────────────────

/// `a - b`.
pub fn board3d_v3_sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/// `a + b`.
pub fn board3d_v3_add(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/// `a * k`.
pub fn board3d_v3_scale(a: [f64; 3], k: f64) -> [f64; 3] {
    [a[0] * k, a[1] * k, a[2] * k]
}

/// `a · b`.
pub fn board3d_v3_dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// `a × b`.
pub fn board3d_v3_cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

/// `|a|`.
pub fn board3d_v3_length(a: [f64; 3]) -> f64 {
    board3d_v3_dot(a, a).sqrt()
}

/// `a / |a|`, or `fallback` when the vector is zero/non-finite.
pub fn board3d_v3_normalize_or(a: [f64; 3], fallback: [f64; 3]) -> [f64; 3] {
    let len = board3d_v3_length(a);
    if !len.is_finite() || len <= 1e-12 {
        return board3d_v3_normalize_or(fallback, [0.0, 0.0, -1.0]);
    }
    board3d_v3_scale(a, 1.0 / len)
}

/// Vue's `isFiniteVec3`: a pose component is usable only if all three numbers
/// are finite.
pub fn board3d_is_finite_vec3(v: [f64; 3]) -> bool {
    v[0].is_finite() && v[1].is_finite() && v[2].is_finite()
}

/// A non-finite pose would brick the camera silently (every later projection
/// returns NaN), so Vue falls back to the default instead of applying it.
pub fn board3d_vec3_or(v: [f64; 3], fallback: [f64; 3]) -> [f64; 3] {
    if board3d_is_finite_vec3(v) {
        v
    } else {
        fallback
    }
}

// ── the camera (pure) ────────────────────────────────────────────────────

/// A camera pose: what Vue's `PerspectiveCamera` + `OrbitControls.target`
/// hold at any instant. The mirror takes it as a CONTROLLED prop pair.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Board3dCameraPose {
    /// Eye position, world units.
    pub position: [f64; 3],
    /// Orbit pivot (Vue: `controls.target`).
    pub target: [f64; 3],
    /// Vertical field of view in degrees.
    pub fov: f64,
    /// Near/far planes.
    pub near: f64,
    pub far: f64,
}

impl Default for Board3dCameraPose {
    fn default() -> Self {
        Self {
            position: BOARD3D_DEFAULT_POSITION,
            target: BOARD3D_DEFAULT_TARGET,
            fov: BOARD3D_DEFAULT_FOV,
            near: BOARD3D_CAMERA_NEAR,
            far: BOARD3D_CAMERA_FAR,
        }
    }
}

/// The camera's orthonormal frame (three's `Matrix4.lookAt` basis).
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Board3dViewBasis {
    /// Screen-right axis.
    pub right: [f64; 3],
    /// Screen-up axis.
    pub up: [f64; 3],
    /// View direction (eye → target).
    pub forward: [f64; 3],
}

/// Vue's degenerate-fov guard: `≤ 0` or `≥ 180` silently bricks the
/// projection matrix, so it falls back to 45.
pub fn board3d_clamp_fov(fov: f64) -> f64 {
    if fov.is_finite() && fov > 0.0 && fov < 180.0 {
        fov
    } else {
        BOARD3D_DEFAULT_FOV
    }
}

/// Vue normalises a reversed orbit window instead of rejecting it
/// (`minDistance = min(props.min, props.max)`, `maxDistance = max(...)`).
pub fn board3d_distance_window(min_distance: f64, max_distance: f64) -> (f64, f64) {
    (
        min_distance.min(max_distance),
        min_distance.max(max_distance),
    )
}

/// The EFFECTIVE orbit window: a non-interactive board is an externally driven
/// renderer and must not be fought by the interactive zoom range (Vue sets
/// `minDistance = 0`, `maxDistance = Infinity`).
pub fn board3d_orbit_window(interactive: bool, min_distance: f64, max_distance: f64) -> (f64, f64) {
    if interactive {
        board3d_distance_window(min_distance, max_distance)
    } else {
        (0.0, f64::INFINITY)
    }
}

/// Clamp an orbit radius into a window (`OrbitControls` does this on every
/// update). A non-finite radius passes through untouched.
pub fn board3d_clamp_distance(distance: f64, window: (f64, f64)) -> f64 {
    if !distance.is_finite() {
        return distance;
    }
    let (low, high) = window;
    let high = if high.is_nan() { distance } else { high };
    distance.max(low).min(high)
}

/// The pose after `OrbitControls`' radius clamp: the eye slides along the
/// eye→pivot axis, so the view DIRECTION never changes.
pub fn board3d_clamp_pose_distance(
    pose: Board3dCameraPose,
    window: (f64, f64),
) -> Board3dCameraPose {
    let delta = board3d_v3_sub(pose.position, pose.target);
    let distance = board3d_v3_length(delta);
    if !distance.is_finite() || distance <= 1e-12 {
        return pose;
    }
    let clamped = board3d_clamp_distance(distance, window);
    if !clamped.is_finite() || (clamped - distance).abs() <= 1e-12 {
        return pose;
    }
    let dir = board3d_v3_scale(delta, 1.0 / distance);
    Board3dCameraPose {
        position: board3d_v3_add(pose.target, board3d_v3_scale(dir, clamped)),
        ..pose
    }
}

/// The camera basis for a pose. A degenerate pose (eye on pivot, or a view
/// straight up the world Y axis) falls back the same way `frameAll` does, so
/// the projection never divides by zero.
pub fn board3d_view_basis(pose: Board3dCameraPose) -> Board3dViewBasis {
    let forward =
        board3d_v3_normalize_or(board3d_v3_sub(pose.target, pose.position), [0.0, 0.0, -1.0]);
    // three: x = cross(up, z) with z = -forward, i.e. cross(forward, up).
    let right =
        board3d_v3_normalize_or(board3d_v3_cross(forward, [0.0, 1.0, 0.0]), [1.0, 0.0, 0.0]);
    Board3dViewBasis {
        right,
        up: board3d_v3_cross(right, forward),
        forward,
    }
}

/// Vue's `fitDistance`: the distance at which a sphere of `radius` exactly
/// fills the narrower of the vertical and horizontal fields of view.
pub fn board3d_fit_distance(radius: f64, fov_deg: f64, aspect: f64) -> f64 {
    if !(radius > 0.0) || !(fov_deg > 0.0) || !(aspect > 0.0) {
        return 1.0;
    }
    let vfov = fov_deg.to_radians();
    let hfov = 2.0 * ((vfov / 2.0).tan() * aspect).atan();
    let fov = vfov.min(hfov);
    radius / (fov / 2.0).sin()
}

/// Half extents of the view plane `dist` in front of the camera — the
/// "what the main view is looking at" quad the minimap draws.
pub fn board3d_view_plane_half_extents(fov_deg: f64, aspect: f64, dist: f64) -> (f64, f64) {
    let half_h = ((fov_deg / 2.0).to_radians()).tan() * dist;
    (half_h * aspect, half_h)
}

/// Vue's `applyClipping`: depth planes from a subject distance, so a large
/// scene keeps its depth precision.
pub fn board3d_clipping_planes(dist: f64) -> (f64, f64) {
    if !dist.is_finite() {
        return (BOARD3D_CAMERA_NEAR, BOARD3D_CAMERA_FAR);
    }
    let near = 0.1_f64.max(dist / 200.0);
    (near, (dist * 200.0).max(near + 1.0))
}

/// Drag-to-orbit for the stereoscopic minimap: the pointer delta (CSS px)
/// rotates the minimap eye around the sphere centred on the MAIN camera.
/// Horizontal drag sweeps azimuth, vertical drag sweeps polar — clamped off
/// the poles.
pub fn board3d_orbit_delta(theta: f64, phi: f64, dx_px: f64, dy_px: f64) -> (f64, f64) {
    let theta = theta + dx_px * BOARD3D_MINIMAP_DRAG_RADIANS_PER_PX;
    let phi = phi + dy_px * BOARD3D_MINIMAP_DRAG_RADIANS_PER_PX;
    (
        theta,
        phi.max(BOARD3D_MINIMAP_MIN_POLAR)
            .min(BOARD3D_MINIMAP_MAX_POLAR),
    )
}

/// Eye position on the sphere around `center` (the minimap camera glyph).
pub fn board3d_spherical_position(center: [f64; 3], theta: f64, phi: f64, radius: f64) -> [f64; 3] {
    let sin_phi = phi.sin();
    [
        center[0] + radius * sin_phi * theta.sin(),
        center[1] + radius * phi.cos(),
        center[2] + radius * sin_phi * theta.cos(),
    ]
}

/// Vue's `easeInOutCubic`, used by both the camera flight and the star
/// system's focus flight.
pub fn board3d_ease_in_out_cubic(t: f64) -> f64 {
    if t < 0.5 {
        4.0 * t * t * t
    } else {
        1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
    }
}

/// Vue's `easeOutCubic` (the node canvas tween).
pub fn board3d_ease_out_cubic(t: f64) -> f64 {
    1.0 - (1.0 - t).powi(3)
}

/// One frame of a camera flight: `camera.position.lerpVectors(from, to, k)`
/// plus `controls.target.lerpVectors(fromTarget, toTarget, k)`.
pub fn board3d_fly_pose(
    from: Board3dCameraPose,
    to: Board3dCameraPose,
    progress: f64,
) -> Board3dCameraPose {
    let k = if progress.is_finite() {
        progress.max(0.0).min(1.0)
    } else {
        0.0
    };
    let lerp = |a: [f64; 3], b: [f64; 3]| -> [f64; 3] {
        [
            a[0] + (b[0] - a[0]) * k,
            a[1] + (b[1] - a[1]) * k,
            a[2] + (b[2] - a[2]) * k,
        ]
    };
    Board3dCameraPose {
        position: lerp(from.position, to.position),
        target: lerp(from.target, to.target),
        fov: to.fov,
        near: to.near,
        far: to.far,
    }
}

/// The flight progress from wall-clock milliseconds
/// (`Math.min(1, (now - start) / duration)`).
pub fn board3d_flight_progress(started_ms: f64, now_ms: f64, duration_ms: f64) -> f64 {
    if !(duration_ms > 0.0) || !started_ms.is_finite() || !now_ms.is_finite() {
        return 1.0;
    }
    ((now_ms - started_ms) / duration_ms).max(0.0).min(1.0)
}

/// Vue's `flyToFocus`: park the eye at `radius`'s fit distance along the
/// framing angle, optionally biased along the view's right axis.
pub fn board3d_focus_pose(
    pose: Board3dCameraPose,
    target: [f64; 3],
    radius: f64,
    aspect: f64,
    padding: f64,
    lateral_bias: f64,
) -> Board3dCameraPose {
    let dir = board3d_v3_normalize_or(BOARD3D_FOCUS_DIR, [0.0, 0.0, -1.0]);
    let dist = board3d_fit_distance(radius, board3d_clamp_fov(pose.fov), aspect) * padding;
    let mut position = board3d_v3_add(target, board3d_v3_scale(dir, dist));
    if lateral_bias != 0.0 {
        let right =
            board3d_v3_normalize_or(board3d_v3_cross(dir, [0.0, 1.0, 0.0]), [1.0, 0.0, 0.0]);
        position = board3d_v3_add(position, board3d_v3_scale(right, lateral_bias));
    }
    Board3dCameraPose {
        position,
        target,
        ..pose
    }
}

/// The viewing direction a reframe keeps (Vue: `camera.position - target`,
/// with a fixed fallback when the eye sits on the pivot). A frame reframes; it
/// never whips the user around to a canonical side.
pub fn board3d_view_direction(pose: Board3dCameraPose, fallback: [f64; 3]) -> [f64; 3] {
    let dir = board3d_v3_sub(pose.position, pose.target);
    if board3d_v3_dot(dir, dir) < 1e-8 {
        board3d_v3_normalize_or(fallback, [0.0, 0.0, 1.0])
    } else {
        board3d_v3_normalize_or(dir, [0.0, 0.0, 1.0])
    }
}

/// Vue's `frameAll` / the star system's `frameFleet`: centre the sphere of
/// `radius` at `center` and pull back to its fit distance along the CURRENT
/// viewing direction.
pub fn board3d_frame_pose(
    pose: Board3dCameraPose,
    center: [f64; 3],
    radius: f64,
    aspect: f64,
    padding: f64,
    fallback_direction: [f64; 3],
) -> Board3dCameraPose {
    let dist = board3d_fit_distance(radius, board3d_clamp_fov(pose.fov), aspect) * padding;
    let dir = board3d_view_direction(pose, fallback_direction);
    Board3dCameraPose {
        position: board3d_v3_add(center, board3d_v3_scale(dir, dist)),
        target: center,
        ..pose
    }
}

/// Vue's `setViewMode("topdown")`: the eye goes straight above the pivot at
/// the same distance. The `0.001` on Z keeps the up axis from degenerating.
pub fn board3d_topdown_pose(pose: Board3dCameraPose) -> Board3dCameraPose {
    let target = pose.target;
    let dist = board3d_v3_length(board3d_v3_sub(pose.position, target)).max(1.0);
    Board3dCameraPose {
        position: [target[0], target[1] + dist, target[2] + 0.001],
        target,
        ..pose
    }
}

// ── projection + picking (pure) ──────────────────────────────────────────

/// One world point projected to canvas CSS pixels.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct Board3dProjection {
    /// Canvas-local CSS px.
    pub x: f64,
    pub y: f64,
    /// Vue's frustum test: in front of the eye, inside the ±1 NDC box, and
    /// nearer than the far plane.
    pub visible: bool,
    /// Distance along the view axis (positive in front of the eye).
    pub depth: f64,
}

/// `Vector3::project(camera)` written out: the exact conversion Vue's
/// `projectToScreen` (and the CSS2D overlay) uses. A point behind the eye
/// projects to nothing — `visible` is false and the coordinates are zero rather
/// than a mirrored ghost.
pub fn board3d_project_to_screen(
    pose: Board3dCameraPose,
    width: f64,
    height: f64,
    point: [f64; 3],
) -> Board3dProjection {
    let hidden = Board3dProjection {
        x: 0.0,
        y: 0.0,
        visible: false,
        depth: 0.0,
    };
    if !(width > 0.0) || !(height > 0.0) || !board3d_is_finite_vec3(point) {
        return hidden;
    }
    let basis = board3d_view_basis(pose);
    let delta = board3d_v3_sub(point, pose.position);
    let depth = board3d_v3_dot(delta, basis.forward);
    if !depth.is_finite() || depth <= 1e-9 {
        return Board3dProjection { depth, ..hidden };
    }
    let fov = board3d_clamp_fov(pose.fov);
    let tan_half = (fov / 2.0).to_radians().tan();
    if !tan_half.is_finite() || tan_half <= 0.0 {
        return Board3dProjection { depth, ..hidden };
    }
    let aspect = width / height;
    let camera_x = board3d_v3_dot(delta, basis.right);
    let camera_y = board3d_v3_dot(delta, basis.up);
    let ndc_x = camera_x / (aspect * tan_half * depth);
    let ndc_y = camera_y / (tan_half * depth);
    // The perspective depth term: z_clip = a * z_cam + b with z_cam = -depth.
    let (near, far) = board3d_valid_planes(pose);
    let a = (far + near) / (near - far);
    let b = 2.0 * far * near / (near - far);
    let ndc_z = (a * -depth + b) / depth;
    if !ndc_x.is_finite() || !ndc_y.is_finite() || !ndc_z.is_finite() {
        return Board3dProjection { depth, ..hidden };
    }
    Board3dProjection {
        x: ((ndc_x + 1.0) / 2.0) * width,
        y: ((1.0 - ndc_y) / 2.0) * height,
        visible: ndc_z < 1.0 && ndc_x >= -1.0 && ndc_x <= 1.0 && ndc_y >= -1.0 && ndc_y <= 1.0,
        depth,
    }
}

/// A pose's near/far planes, repaired when a host hands over a degenerate pair
/// (the projection would divide by zero).
fn board3d_valid_planes(pose: Board3dCameraPose) -> (f64, f64) {
    let near = if pose.near.is_finite() && pose.near > 0.0 {
        pose.near
    } else {
        BOARD3D_CAMERA_NEAR
    };
    let far = if pose.far.is_finite() && pose.far > near {
        pose.far
    } else {
        BOARD3D_CAMERA_FAR.max(near + 1.0)
    };
    (near, far)
}

/// The canvas box in DRAWN pixels (Vue: `getBoundingClientRect()`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct Board3dCanvasRect {
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
}

/// Vue's `pickAt` NDC conversion — the one place a pointer position becomes
/// something a raycaster can consume. `None` when the box is unmeasured
/// (Vue returns `null` from `pickAt` in exactly that case).
pub fn board3d_pointer_ndc(
    rect: Board3dCanvasRect,
    client_x: f64,
    client_y: f64,
) -> Option<(f64, f64)> {
    if !(rect.width > 0.0) || !(rect.height > 0.0) {
        return None;
    }
    Some((
        ((client_x - rect.left) / rect.width) * 2.0 - 1.0,
        -((client_y - rect.top) / rect.height) * 2.0 + 1.0,
    ))
}

/// The press→release slop (`|dx| + |dy| > 4` is a drag, not a click).
pub fn board3d_is_click_press(from_x: f64, from_y: f64, to_x: f64, to_y: f64) -> bool {
    (to_x - from_x).abs() + (to_y - from_y).abs() <= BOARD3D_CLICK_SLOP_PX
}

/// Vue's `pickAt` resolution half: walk the hit object's chain of
/// `userData.board3dId` stamps up to the scene root and return the FIRST id the
/// registry still owns. Ids are compared with `is_some` semantics, never
/// truthiness — `""` is a legal id.
pub fn board3d_pick_resolve(chain: &[Option<String>], registered: &[String]) -> Option<String> {
    for candidate in chain.iter().flatten() {
        if registered.iter().any(|id| id == candidate) {
            return Some(candidate.clone());
        }
    }
    None
}

/// Vue's `projectToScreen`'s `visible` flag on its own (a chip is hidden
/// without being moved).
pub fn board3d_point_is_visible(
    pose: Board3dCameraPose,
    width: f64,
    height: f64,
    point: [f64; 3],
) -> bool {
    board3d_project_to_screen(pose, width, height, point).visible
}

// ── theme channels (pure) ────────────────────────────────────────────────

/// Vue's `cssRgbToColor`: a palette channel (`"10 15 25"`, also comma
/// separated) → linear rgb in `[0, 1]`. Missing parts default to the dark room
/// (`10/15/25`), exactly Vue's `?? 10 / ?? 15 / ?? 25`.
pub fn board3d_css_channels(raw: &str, fallback: [f64; 3]) -> [f64; 3] {
    let mut parts: Vec<f64> = Vec::new();
    for chunk in raw.split([' ', ',', '\t', '\n']) {
        let trimmed = chunk.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(value) = trimmed.parse::<f64>() {
            if value.is_finite() {
                parts.push(value);
            }
        }
    }
    [
        parts.first().copied().unwrap_or(fallback[0]) / 255.0,
        parts.get(1).copied().unwrap_or(fallback[1]) / 255.0,
        parts.get(2).copied().unwrap_or(fallback[2]) / 255.0,
    ]
}

/// Perceived brightness, 0 (black) … 1 (white).
pub fn board3d_rgb_luminance(rgb: [f64; 3]) -> f64 {
    0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

/// The hover frame's tint channel, taken from the page's own palette: the TEXT
/// channel in a dark room, the MUTED channel in a light one (user direction
/// 2026-10-01). Tokens, not literals, so a re-skinned palette re-skins the
/// frame with it.
pub fn board3d_hover_frame_channel(background: [f64; 3]) -> &'static str {
    if board3d_rgb_luminance(background) < 0.5 {
        "--color-text"
    } else {
        "--color-muted"
    }
}

/// The selection frame's tint channel: the theme's primary on both modes.
pub fn board3d_selection_frame_channel() -> &'static str {
    "--color-primary"
}

// ── the press machine (the one piece of pointer state) ───────────────────

/// A live press: Vue keeps this in a closure (`pressAt`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Board3dPress {
    pub pointer_id: i32,
    pub x: f64,
    pub y: f64,
}

thread_local! {
    /// Live presses per board instance (`instance_key`). Vue's `pressAt` is a
    /// per-mount closure; the mirror has no signals, so the same one-slot state
    /// lives here.
    static BOARD3D_PRESSES: RefCell<HashMap<String, Board3dPress>> = RefCell::new(HashMap::new());
}

/// Record a press (Vue: `onPointerDown` sets `pressAt`).
pub fn board3d_begin_press(key: &str, pointer_id: i32, x: f64, y: f64) {
    if key.is_empty() {
        return;
    }
    BOARD3D_PRESSES.with(|presses| {
        presses
            .borrow_mut()
            .insert(key.to_string(), Board3dPress { pointer_id, x, y });
    });
}

/// Drop a live press (Vue: `onPointerCancel` / `onLostPointerCapture`).
pub fn board3d_cancel_press(key: &str) {
    BOARD3D_PRESSES.with(|presses| {
        presses.borrow_mut().remove(key);
    });
}

/// Vue's `onPointerUp`: only the PRESSING pointer's release clicks, and only
/// while it stayed inside the Manhattan slop. Returns the click position.
pub fn board3d_finish_press(key: &str, pointer_id: i32, x: f64, y: f64) -> Option<(f64, f64)> {
    let press = BOARD3D_PRESSES.with(|presses| presses.borrow_mut().remove(key));
    let press = press?;
    if press.pointer_id != pointer_id {
        return None;
    }
    if board3d_is_click_press(press.x, press.y, x, y) {
        Some((x, y))
    } else {
        None
    }
}

// ── props ────────────────────────────────────────────────────────────────

/// One CSS2D-equivalent label chip: Vue attaches an `HTMLElement` to a
/// registered object at `labelOffset`; the mirror takes the anchor in WORLD
/// units and project it with the same maths.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct Board3dLabel {
    /// The registered object's id (the rendering key and the click payload).
    pub id: String,
    /// The chip's text content.
    pub text: String,
    /// The object's world position at this instant.
    pub anchor: [f64; 3],
    /// Vue's `labelOffset`, in the object's own space (default `[0, 0, 0]`).
    pub offset: [f64; 3],
    /// Extra classes the chip carries — Vue's `classList.add` keeps whatever
    /// the host element brought (the star system's `hk-star-system-chip`).
    pub class: String,
}

/// The pointer payload a pick probe carries.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct Board3dPointerPick {
    /// Client (viewport) pixels of the probe.
    pub client_x: f64,
    pub client_y: f64,
    /// Vue's `raycaster.setFromCamera` input — present only when the host
    /// handed the canvas box in `canvas_rect` (Vue reads it live).
    pub ndc: Option<(f64, f64)>,
}

#[define_props]
pub struct Board3DProps {
    /// Wire the orbit/zoom/pan gestures and the interactive distance window
    /// (Vue: `interactive`).
    #[default(true)]
    pub interactive: bool,

    /// Dock the minimap in the corner (Vue: `minimap`).
    #[default(true)]
    pub minimap: bool,

    /// Give the minimap the collapse affordance (Vue: `minimapCollapsible`).
    #[default(false)]
    pub minimap_collapsible: bool,

    /// Mount the minimap already folded (Vue: `minimapDefaultCollapsed`).
    #[default(false)]
    pub minimap_default_collapsed: bool,

    /// Vertical field of view in degrees; a degenerate value falls back to 45
    /// (Vue's `init()` guard).
    #[default(BOARD3D_DEFAULT_FOV)]
    pub fov: f64,

    /// The controlled eye (Vue: `initialPosition` — static after mount there,
    /// because OrbitControls owns the live value).
    #[default(BOARD3D_DEFAULT_POSITION)]
    pub camera_position: [f64; 3],

    /// The controlled orbit pivot (Vue: `initialTarget` / `controls.target`).
    #[default(BOARD3D_DEFAULT_TARGET)]
    pub camera_target: [f64; 3],

    /// Orbit distance window (Vue: `minDistance` / `maxDistance`; a reversed
    /// window is normalised).
    #[default(BOARD3D_DEFAULT_MIN_DISTANCE)]
    pub min_distance: f64,

    #[default(BOARD3D_DEFAULT_MAX_DISTANCE)]
    pub max_distance: f64,

    /// Wire two-finger / right-drag panning (Vue: `enablePan`).
    #[default(true)]
    pub enable_pan: bool,

    /// Keep the near/far planes clipped to the framed extent (Vue:
    /// `autoClipping`; the formula is [`board3d_clipping_planes`]).
    #[default(false)]
    pub auto_clipping: bool,

    /// Wrap the hovered object in the 8-corner frame (Vue: `hoverBox`). The
    /// mirror owns no objects, so this only records the policy for the host.
    #[default(true)]
    pub hover_box: bool,

    /// Clear the canvas to transparent so the page's backdrop shows through
    /// (Vue: `transparentBackground`, mirrored as the root's inline
    /// `background: transparent`).
    #[default(false)]
    pub transparent_background: bool,

    /// Freeze the frame loop (Vue: `paused`).
    #[default(false)]
    pub paused: bool,

    /// The host has attached its renderer (Vue: `engineRef.value`). Gates the
    /// minimap dock exactly like Vue's own check.
    #[default(false)]
    pub ready: bool,

    /// No WebGL (or the host's renderer never came up) — the board renders the
    /// fallback slot / note instead of the live surface (Vue: `failed`).
    #[default(false)]
    pub failed: bool,

    /// The failure message the host caught (Vue: the `error` emit payload).
    pub error: Option<String>,

    /// Override for the localized fallback note (Vue:
    /// `t("hikari::board3d.unavailable", …)`).
    pub unavailable_text: Option<String>,

    /// Canvas WIDTH in CSS px (Vue: `ResizeObserver` on the container; the
    /// mirror cannot measure, so the host passes it).
    #[default(0.0)]
    pub width: f64,

    /// Canvas HEIGHT in CSS px (see `width`).
    #[default(0.0)]
    pub height: f64,

    /// The canvas box in drawn pixels, for the pick probe's NDC conversion
    /// (Vue: `getBoundingClientRect()` at pick time).
    pub canvas_rect: Option<Board3dCanvasRect>,

    /// The canvas element's DOM id, so the host can acquire the element and
    /// open its own context on it.
    pub canvas_id: Option<String>,

    /// World-anchored label chips (Vue: `setObject({ label, labelOffset })`).
    pub labels: Vec<Board3dLabel>,

    /// The controlled hovered id (Vue: `lastHover`). The mirror cannot raycast,
    /// so the host decides; this drives the chip/pointer policy.
    pub hover_id: Option<String>,

    /// The controlled selected id (Vue: `engine.setSelection(id)`).
    pub selection_id: Option<String>,

    /// The host's pointer delegate key (Vue's per-mount closure). Distinct keys
    /// keep two boards from sharing one press slot.
    #[default]
    pub instance_key: String,

    /// Fallback slot (Vue: `slots.fallback`).
    pub fallback: Option<Element>,

    /// Minimap slot: the mirror owns the DOCK, the host owns the map
    /// (Vue mounts `HkMinimap3D` here).
    pub minimap_slot: Element,

    /// Default slot: the page's own chrome, laid over the canvas (Vue: the
    /// `.hk-board3d-overlay` layer).
    pub children: Element,

    /// A click landed on the board: Vue raycasts here and emits `objectClick`
    /// with the registered id; the mirror hands the host the probe.
    pub on_pick: Option<EventHandler<Board3dPointerPick>>,

    /// The pointer moved over the board (Vue: `hoverDirty` → next-frame pick).
    pub on_pointer_move: Option<EventHandler<Board3dPointerPick>>,

    /// The pointer left the BOARD (the container, not the canvas — so moving
    /// onto a label chip does not drop the hover).
    pub on_pointer_leave: Option<EventHandler<()>>,

    /// A label chip was activated (Vue: the chip's own `click` listener).
    pub on_label_click: Option<EventHandler<String>>,
}

/// The sanitized pose the surface is drawn with: non-finite components fall
/// back to Vue's defaults, a degenerate fov to 45, and the eye is clamped into
/// the effective orbit window.
pub fn board3d_resolved_pose(props: &Board3DProps) -> Board3dCameraPose {
    let pose = Board3dCameraPose {
        position: board3d_vec3_or(props.camera_position, BOARD3D_DEFAULT_POSITION),
        target: board3d_vec3_or(props.camera_target, BOARD3D_DEFAULT_TARGET),
        fov: board3d_clamp_fov(props.fov),
        near: BOARD3D_CAMERA_NEAR,
        far: BOARD3D_CAMERA_FAR,
    };
    board3d_clamp_pose_distance(
        pose,
        board3d_orbit_window(props.interactive, props.min_distance, props.max_distance),
    )
}

// ── class names (the DOM contract, pinned by the tests) ──────────────────

/// The root's class string — Vue's `hk-board3d` is the only class it carries.
pub fn board3d_root_classes() -> &'static str {
    "hk-board3d"
}

/// The minimap dock's class string. Vue's `HkMinimap3D` root is
/// `hk-minimap hk-minimap3d`, plus `hk-minimap--collapsed` when folded.
pub fn board3d_minimap_classes(collapsed: bool) -> String {
    if collapsed {
        "hk-minimap hk-minimap3d hk-minimap--collapsed".to_string()
    } else {
        "hk-minimap hk-minimap3d".to_string()
    }
}

/// A label chip's class string: the host's own classes, then Vue's
/// `classList.add("hk-board3d-label")`.
pub fn board3d_label_classes(host_class: &str) -> String {
    let host = host_class.trim();
    if host.is_empty() {
        "hk-board3d-label".to_string()
    } else {
        format!("{host} hk-board3d-label")
    }
}

/// The CSS2D overlay root's inline style (Vue's `CSS2DRenderer.domElement`:
/// absolute, inset 0, pointer-events none — chips opt back in through the
/// sheet's `.hk-board3d-label { pointer-events: auto }`).
pub fn board3d_label_layer_style() -> &'static str {
    "position:absolute;inset:0;pointer-events:none"
}

/// A chip's inline style, exactly what `CSS2DRenderer` writes: the centring
/// translate followed by the projected position, or `display:none` when the
/// anchor left the frustum.
pub fn board3d_label_style(projection: Board3dProjection) -> String {
    if projection.visible {
        format!(
            "transform:translate(-50%,-50%) translate({}px, {}px)",
            projection.x, projection.y
        )
    } else {
        "display:none".to_string()
    }
}

/// The root's inline style: the transparent-backdrop mode has to clear the
/// CONTAINER's own surface paint too, or a page-colored rectangle sits where
/// the page's backdrop should show (Vue: `style={{ background: "transparent" }}`).
pub fn board3d_root_style(transparent_background: bool) -> Option<&'static str> {
    if transparent_background {
        Some("background:transparent")
    } else {
        None
    }
}

// ── render assembly (no geometry below this line) ────────────────────────

fn board3d_label_node(
    label: &Board3dLabel,
    pose: Board3dCameraPose,
    width: f64,
    height: f64,
    on_label_click: Option<EventHandler<String>>,
) -> VNode {
    let anchor = board3d_v3_add(label.anchor, label.offset);
    let projection = board3d_project_to_screen(pose, width, height, anchor);
    let style = board3d_label_style(projection);
    let classes = board3d_label_classes(&label.class);
    let id = label.id.clone();
    let click = move |_event: MouseEvent| {
        if let Some(handler) = on_label_click.as_ref() {
            handler.call(id.clone());
        }
    };
    VNode::Element(Box::new(
        VElement::new("div")
            .class(classes)
            .attr("data-label-id", label.id.as_str())
            .style(style)
            .on_click(click)
            .child(VNode::Text(VText::new(label.text.as_str()))),
    ))
}

#[component]
pub fn Board3D(props: Board3DProps) -> Element {
    let pose = board3d_resolved_pose(&props);
    let width = props.width;
    let height = props.height;
    let failed = props.failed;
    let ready = props.ready;

    let chip_nodes: Vec<VNode> = if failed {
        Vec::new()
    } else {
        props
            .labels
            .iter()
            .map(|label| {
                board3d_label_node(label, pose, width, height, props.on_label_click.clone())
            })
            .collect()
    };

    let unavailable_text = props.unavailable_text.clone().unwrap_or_else(|| {
        hikari_i18n::t(
            "components.hk.board3d.unavailable",
            "3D is unavailable on this device",
        )
    });

    let root_style = board3d_root_style(props.transparent_background);
    let canvas_id = props.canvas_id.clone();
    let press_key = props.instance_key.clone();
    let canvas_rect = props.canvas_rect;

    let on_pointer_down = {
        let key = press_key.clone();
        move |event: PointerEvent| {
            // A press on the canvas is a grab: it cancels any in-flight flight
            // (Vue nulls its tween in `onPointerDown`).
            board3d_begin_press(
                &key,
                event.pointer_id,
                f64::from(event.client_x),
                f64::from(event.client_y),
            );
        }
    };
    let on_pointer_up = {
        let key = press_key.clone();
        let on_pick = props.on_pick.clone();
        move |event: PointerEvent| {
            let x = f64::from(event.client_x);
            let y = f64::from(event.client_y);
            let pick = board3d_finish_press(&key, event.pointer_id, x, y);
            if let (Some((px, py)), Some(handler)) = (pick, on_pick.as_ref()) {
                handler.call(Board3dPointerPick {
                    client_x: px,
                    client_y: py,
                    ndc: canvas_rect.and_then(|rect| board3d_pointer_ndc(rect, px, py)),
                });
            }
        }
    };
    let on_pointer_move = {
        let on_move = props.on_pointer_move.clone();
        move |event: PointerEvent| {
            if let Some(handler) = on_move.as_ref() {
                let x = f64::from(event.client_x);
                let y = f64::from(event.client_y);
                handler.call(Board3dPointerPick {
                    client_x: x,
                    client_y: y,
                    ndc: canvas_rect.and_then(|rect| board3d_pointer_ndc(rect, x, y)),
                });
            }
        }
    };
    let on_pointer_leave = {
        let on_leave = props.on_pointer_leave.clone();
        move |_event: PointerEvent| {
            if let Some(handler) = on_leave.as_ref() {
                handler.call(());
            }
        }
    };

    let minimap_ready = props.minimap && ready && !failed;
    let minimap_classes = board3d_minimap_classes(props.minimap_default_collapsed);
    let minimap_collapsed = if props.minimap_default_collapsed {
        Some("")
    } else {
        None
    };
    let minimap_collapsible = if props.minimap_collapsible {
        Some("")
    } else {
        None
    };

    // The overlay layer exists only when the page brought chrome (Vue tests
    // `slots.default`).
    let has_overlay = !board3d_slot_is_empty(&props.children);

    let fallback_node = if failed {
        match props.fallback.clone() {
            Some(slot) => slot,
            None => rsx! {
                div { class: "hk-board3d-fallback", {unavailable_text.clone()} }
            },
        }
    } else {
        empty_vnode()
    };

    let mut root = VElement::new("div")
        .class(board3d_root_classes())
        .on_pointerleave(on_pointer_leave);
    if let Some(style) = root_style {
        root = root.style(style);
    }
    let mut canvas = VElement::new("canvas")
        .class("hk-board3d-canvas")
        .on_pointerdown(on_pointer_down)
        .on_pointerup(on_pointer_up)
        .on_pointermove(on_pointer_move);
    if let Some(id) = canvas_id {
        canvas = canvas.attr("id", id);
    }
    root = root.child(VNode::Element(Box::new(canvas)));

    if !chip_nodes.is_empty() {
        let mut layer = VElement::new("div").style(board3d_label_layer_style());
        for chip in chip_nodes {
            layer = layer.child(chip);
        }
        root = root.child(VNode::Element(Box::new(layer)));
    }
    if failed {
        root = root.child(fallback_node);
    }
    if minimap_ready {
        let mut dock = VElement::new("div").class(minimap_classes);
        if let Some(flag) = minimap_collapsed {
            dock = dock.attr("data-collapsed", flag);
        }
        if let Some(flag) = minimap_collapsible {
            dock = dock.attr("data-collapsible", flag);
        }
        root = root.child(VNode::Element(Box::new(dock.child(props.minimap_slot))));
    }
    if has_overlay {
        root = root.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-board3d-overlay")
                .child(props.children),
        )));
    }

    VNode::Element(Box::new(root))
}

/// True when a slot carries nothing to render (Vue tests `slots.default`).
fn board3d_slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(board3d_slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

impl StyledComponent for Board3DComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkBoard3D.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "board-3d"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    // ── props defaults ────────────────────────────────────────────────

    #[test]
    fn board3d_defaults_match_the_vue_props() {
        let props = Board3DProps::default();
        assert!(props.interactive);
        assert!(props.minimap);
        assert!(!props.minimap_collapsible);
        assert!(!props.minimap_default_collapsed);
        assert_eq!(props.fov, BOARD3D_DEFAULT_FOV);
        assert_eq!(props.camera_position, BOARD3D_DEFAULT_POSITION);
        assert_eq!(props.camera_target, BOARD3D_DEFAULT_TARGET);
        assert_eq!(props.min_distance, 2.0);
        assert_eq!(props.max_distance, 600.0);
        assert!(props.enable_pan);
        assert!(!props.auto_clipping);
        assert!(props.hover_box);
        assert!(!props.transparent_background);
        assert!(!props.paused);
        assert!(!props.ready);
        assert!(!props.failed);
        assert_eq!(props.error, None);
        assert_eq!(props.unavailable_text, None);
        assert_eq!(props.width, 0.0);
        assert_eq!(props.height, 0.0);
        assert_eq!(props.canvas_rect, None);
        assert_eq!(props.canvas_id, None);
        assert!(props.labels.is_empty());
        assert_eq!(props.hover_id, None);
        assert_eq!(props.selection_id, None);
        assert_eq!(props.instance_key, "");
        assert!(props.fallback.is_none());
        assert!(props.on_pick.is_none());
        assert!(props.on_pointer_move.is_none());
        assert!(props.on_pointer_leave.is_none());
        assert!(props.on_label_click.is_none());
    }

    // ── class names ───────────────────────────────────────────────────

    #[test]
    fn board3d_class_names_match_the_vue_sheet() {
        assert_eq!(board3d_root_classes(), "hk-board3d");
        assert_eq!(board3d_minimap_classes(false), "hk-minimap hk-minimap3d");
        assert_eq!(
            board3d_minimap_classes(true),
            "hk-minimap hk-minimap3d hk-minimap--collapsed"
        );
        // Vue's `classList.add("hk-board3d-label")` appends; the host element's
        // own classes stay in front.
        assert_eq!(board3d_label_classes(""), "hk-board3d-label");
        assert_eq!(board3d_label_classes("  "), "hk-board3d-label");
        assert_eq!(
            board3d_label_classes("hk-star-system-chip"),
            "hk-star-system-chip hk-board3d-label"
        );
        assert_eq!(board3d_root_style(true), Some("background:transparent"));
        assert_eq!(board3d_root_style(false), None);
    }

    // ── the camera (pure) ─────────────────────────────────────────────

    #[test]
    fn board3d_clamp_fov_rejects_the_degenerate_range() {
        assert_eq!(board3d_clamp_fov(60.0), 60.0);
        assert_eq!(board3d_clamp_fov(0.0), BOARD3D_DEFAULT_FOV);
        assert_eq!(board3d_clamp_fov(-12.0), BOARD3D_DEFAULT_FOV);
        assert_eq!(board3d_clamp_fov(180.0), BOARD3D_DEFAULT_FOV);
        assert_eq!(board3d_clamp_fov(f64::NAN), BOARD3D_DEFAULT_FOV);
        assert_eq!(board3d_clamp_fov(f64::INFINITY), BOARD3D_DEFAULT_FOV);
    }

    #[test]
    fn board3d_distance_window_normalises_a_reversed_range() {
        assert_eq!(board3d_distance_window(2.0, 600.0), (2.0, 600.0));
        // Vue normalises instead of letting OrbitControls pin the eye at min.
        assert_eq!(board3d_distance_window(600.0, 2.0), (2.0, 600.0));
        assert_eq!(board3d_clamp_distance(1.0, (2.0, 600.0)), 2.0);
        assert_eq!(board3d_clamp_distance(900.0, (2.0, 600.0)), 600.0);
        assert_eq!(board3d_clamp_distance(50.0, (2.0, 600.0)), 50.0);
        // A non-interactive board is an externally driven renderer: no window.
        let window = board3d_orbit_window(false, 2.0, 600.0);
        assert_eq!(window, (0.0, f64::INFINITY));
        assert_eq!(board3d_clamp_distance(5000.0, window), 5000.0);
    }

    #[test]
    fn board3d_clamp_pose_distance_slides_the_eye_along_the_view_axis() {
        let pose = Board3dCameraPose {
            position: [0.0, 0.0, 1000.0],
            target: [0.0, 0.0, 0.0],
            ..Default::default()
        };
        let clamped = board3d_clamp_pose_distance(pose, (2.0, 600.0));
        assert!(close(board3d_v3_length(clamped.position), 600.0));
        // The direction is untouched — the clamp only changes the radius.
        let before = board3d_view_direction(pose, BOARD3D_FRAME_FALLBACK_DIR);
        let after = board3d_view_direction(clamped, BOARD3D_FRAME_FALLBACK_DIR);
        assert!(close(before[2], after[2]) && close(before[0], after[0]));
        // A radius already inside the window is a no-op.
        let inside = Board3dCameraPose {
            position: [0.0, 0.0, 100.0],
            ..pose
        };
        assert_eq!(board3d_clamp_pose_distance(inside, (2.0, 600.0)), inside);
    }

    #[test]
    fn board3d_fit_distance_matches_the_frustum_math() {
        // A 90° vertical fov at aspect 1: radius / sin(45°) = radius * √2.
        assert!(close(
            board3d_fit_distance(1.0, 90.0, 1.0),
            std::f64::consts::SQRT_2
        ));
        // A long thin viewport narrows the horizontal fov, so the fit backs off.
        let wide = board3d_fit_distance(2.0, 45.0, 1.0);
        let narrow = board3d_fit_distance(2.0, 45.0, 0.25);
        assert!(narrow > wide, "{narrow} must exceed {wide}");
        // Degenerate inputs fall back to Vue's `1`.
        assert_eq!(board3d_fit_distance(0.0, 45.0, 1.0), 1.0);
        assert_eq!(board3d_fit_distance(1.0, 0.0, 1.0), 1.0);
        assert_eq!(board3d_fit_distance(1.0, 45.0, 0.0), 1.0);
    }

    #[test]
    fn board3d_view_plane_and_clipping_follow_the_fov() {
        let (half_w, half_h) = board3d_view_plane_half_extents(90.0, 2.0, 10.0);
        assert!(close(half_h, 10.0));
        assert!(close(half_w, 20.0));
        // Vue's applyClipping: near = max(0.1, dist/200), far = max(dist*200,
        // near + 1).
        assert_eq!(board3d_clipping_planes(5.0), (0.1, 1000.0));
        let (near, far) = board3d_clipping_planes(1000.0);
        assert!(close(near, 5.0));
        assert!(close(far, 200_000.0));
        assert_eq!(
            board3d_clipping_planes(f64::NAN),
            (BOARD3D_CAMERA_NEAR, BOARD3D_CAMERA_FAR)
        );
    }

    #[test]
    fn board3d_project_to_screen_puts_the_pivot_at_the_viewport_centre() {
        let pose = Board3dCameraPose {
            position: [0.0, 0.0, 10.0],
            target: [0.0, 0.0, 0.0],
            fov: 90.0,
            ..Default::default()
        };
        let centre = board3d_project_to_screen(pose, 800.0, 600.0, [0.0, 0.0, 0.0]);
        assert!(centre.visible);
        assert!(close(centre.x, 400.0));
        assert!(close(centre.y, 300.0));
        assert!(close(centre.depth, 10.0));
        // At 10 units out with a 90° fov the half-height is exactly 10 world
        // units, so +Y 10 lands on the top edge of the canvas.
        let top = board3d_project_to_screen(pose, 800.0, 600.0, [0.0, 9.99, 0.0]);
        assert!(top.visible && top.y < 300.0);
        let off = board3d_project_to_screen(pose, 800.0, 600.0, [0.0, 20.0, 0.0]);
        assert!(!off.visible, "20 units up is outside the frustum");
        // Behind the eye there is nothing to project.
        let behind = board3d_project_to_screen(pose, 800.0, 600.0, [0.0, 0.0, 20.0]);
        assert!(!behind.visible);
        assert_eq!((behind.x, behind.y), (0.0, 0.0));
        assert_eq!(behind.depth, -10.0);
        // An unmeasured canvas projects nothing at all.
        let unmeasured = board3d_project_to_screen(pose, 0.0, 600.0, [0.0, 0.0, 0.0]);
        assert!(!unmeasured.visible);
        // The pivot is visible at any canvas size — the `visible` flag alone.
        assert!(board3d_point_is_visible(
            pose,
            800.0,
            600.0,
            [0.0, 0.0, 0.0]
        ));
    }

    #[test]
    fn board3d_pointer_ndc_matches_the_raycaster_conversion() {
        let rect = Board3dCanvasRect {
            left: 100.0,
            top: 50.0,
            width: 400.0,
            height: 200.0,
        };
        // The box centre is NDC (0, 0).
        let (x, y) = board3d_pointer_ndc(rect, 300.0, 150.0).expect("measured box");
        assert!(close(x, 0.0) && close(y, 0.0));
        // Top-left is (-1, 1); bottom-right is (1, -1).
        let (x, y) = board3d_pointer_ndc(rect, 100.0, 50.0).expect("measured box");
        assert!(close(x, -1.0) && close(y, 1.0));
        let (x, y) = board3d_pointer_ndc(rect, 500.0, 250.0).expect("measured box");
        assert!(close(x, 1.0) && close(y, -1.0));
        // Vue returns null from `pickAt` on an unmeasured box.
        assert_eq!(
            board3d_pointer_ndc(
                Board3dCanvasRect {
                    width: 0.0,
                    height: 200.0,
                    ..rect
                },
                300.0,
                150.0
            ),
            None
        );
    }

    #[test]
    fn board3d_pick_slop_is_the_manhattan_metric() {
        assert!(board3d_is_click_press(10.0, 10.0, 12.0, 12.0));
        assert!(board3d_is_click_press(10.0, 10.0, 14.0, 10.0));
        assert!(!board3d_is_click_press(10.0, 10.0, 15.0, 10.0));
        assert!(!board3d_is_click_press(10.0, 10.0, 13.0, 14.0));
        assert!(board3d_is_click_press(10.0, 10.0, 8.0, 8.0));
    }

    #[test]
    fn board3d_pick_resolve_walks_the_chain_and_skips_empty_ids() {
        let registered = vec!["sun".to_string(), String::new()];
        let chain = vec![None, Some("sun".to_string())];
        assert_eq!(
            board3d_pick_resolve(&chain, &registered),
            Some("sun".to_string())
        );
        // A child's stamp that nobody registered keeps walking up.
        let chain = vec![
            Some("moon-of-sun".to_string()),
            Some("sun".to_string()),
            None,
        ];
        assert_eq!(
            board3d_pick_resolve(&chain, &registered),
            Some("sun".to_string())
        );
        // `""` is a legal id — Vue tests `id !== undefined`, never truthiness.
        let chain = vec![Some(String::new())];
        assert_eq!(
            board3d_pick_resolve(&chain, &registered),
            Some(String::new())
        );
        assert_eq!(board3d_pick_resolve(&[], &registered), None);
        assert_eq!(
            board3d_pick_resolve(&[Some("gone".to_string())], &registered),
            None
        );
    }

    #[test]
    fn board3d_flights_ease_and_interpolate() {
        assert!(close(board3d_ease_in_out_cubic(0.0), 0.0));
        assert!(close(board3d_ease_in_out_cubic(0.5), 0.5));
        assert!(close(board3d_ease_in_out_cubic(1.0), 1.0));
        assert!(close(board3d_ease_out_cubic(0.0), 0.0));
        assert!(close(board3d_ease_out_cubic(1.0), 1.0));
        let from = Board3dCameraPose::default();
        let to = Board3dCameraPose {
            position: [0.0, 0.0, 10.0],
            target: [1.0, 2.0, 3.0],
            ..Default::default()
        };
        let start = board3d_fly_pose(from, to, 0.0);
        assert_eq!(start.position, from.position);
        let end = board3d_fly_pose(from, to, 1.0);
        assert_eq!(end.position, to.position);
        assert_eq!(end.target, to.target);
        let mid = board3d_fly_pose(from, to, 0.5);
        assert!(close(
            mid.position[0],
            (from.position[0] + to.position[0]) / 2.0
        ));
        // An out-of-range progress is clamped, not extrapolated.
        assert_eq!(board3d_fly_pose(from, to, 4.0).position, to.position);
        assert_eq!(board3d_fly_pose(from, to, -1.0).position, from.position);
        assert!(close(board3d_flight_progress(0.0, 300.0, 600.0), 0.5));
        assert_eq!(board3d_flight_progress(0.0, 900.0, 600.0), 1.0);
        assert_eq!(board3d_flight_progress(0.0, 0.0, 0.0), 1.0);
    }

    #[test]
    fn board3d_focus_pose_parks_on_the_framing_angle() {
        let pose = Board3dCameraPose::default();
        let focused = board3d_focus_pose(pose, [3.0, -2.0, 1.0], 2.0, 2.0, 1.6, 0.0);
        assert_eq!(focused.target, [3.0, -2.0, 1.0]);
        let offset = board3d_v3_sub(focused.position, focused.target);
        let expected = board3d_fit_distance(2.0, 45.0, 2.0) * 1.6;
        assert!(close(board3d_v3_length(offset), expected));
        // The framing angle is Vue's normalised (-0.03, 0.3, -1).
        let dir = board3d_v3_normalize_or(BOARD3D_FOCUS_DIR, [0.0, 0.0, -1.0]);
        let unit = board3d_v3_scale(offset, 1.0 / board3d_v3_length(offset));
        assert!(close(unit[0], dir[0]) && close(unit[1], dir[1]) && close(unit[2], dir[2]));
        // A lateral bias shifts the eye along the view's right axis only.
        let biased = board3d_focus_pose(pose, [0.0, 0.0, 0.0], 2.0, 2.0, 1.6, 5.0);
        let right =
            board3d_v3_normalize_or(board3d_v3_cross(dir, [0.0, 1.0, 0.0]), [1.0, 0.0, 0.0]);
        let shifted = board3d_v3_sub(biased.position, focused_position(pose, 2.0, 2.0));
        assert!(close(board3d_v3_dot(shifted, right), 5.0));
        assert!(close(board3d_v3_dot(shifted, dir), 0.0));
    }

    fn focused_position(pose: Board3dCameraPose, radius: f64, aspect: f64) -> [f64; 3] {
        board3d_focus_pose(pose, [0.0, 0.0, 0.0], radius, aspect, 1.6, 0.0).position
    }

    #[test]
    fn board3d_frame_pose_keeps_the_viewing_direction() {
        let pose = Board3dCameraPose {
            position: [3.0, 4.0, 5.0],
            target: [0.0, 0.0, 0.0],
            ..Default::default()
        };
        let framed = board3d_frame_pose(
            pose,
            [1.0, 1.0, 1.0],
            4.0,
            1.0,
            1.3,
            BOARD3D_FRAME_FALLBACK_DIR,
        );
        assert_eq!(framed.target, [1.0, 1.0, 1.0]);
        let before = board3d_view_direction(pose, BOARD3D_FRAME_FALLBACK_DIR);
        let after = board3d_view_direction(framed, BOARD3D_FRAME_FALLBACK_DIR);
        assert!(close(before[0], after[0]) && close(before[2], after[2]));
        let expected = board3d_fit_distance(4.0, 45.0, 1.0) * 1.3;
        assert!(close(
            board3d_v3_length(board3d_v3_sub(framed.position, framed.target)),
            expected
        ));
        // An eye parked on the pivot has no direction: the fallback is used.
        let degenerate = Board3dCameraPose {
            position: [0.0, 0.0, 0.0],
            target: [0.0, 0.0, 0.0],
            ..Default::default()
        };
        let dir = board3d_view_direction(degenerate, BOARD3D_FRAME_FALLBACK_DIR);
        let expected_dir = board3d_v3_normalize_or(BOARD3D_FRAME_FALLBACK_DIR, [0.0, 0.0, 1.0]);
        assert!(close(dir[0], expected_dir[0]) && close(dir[1], expected_dir[1]));
    }

    #[test]
    fn board3d_topdown_pose_parks_straight_above_at_the_same_distance() {
        let pose = Board3dCameraPose {
            position: [6.0, 8.0, 0.0],
            target: [1.0, 2.0, 3.0],
            ..Default::default()
        };
        let dist = board3d_v3_length(board3d_v3_sub(pose.position, pose.target));
        let top = board3d_topdown_pose(pose);
        assert_eq!(top.target, pose.target);
        assert!(close(top.position[0], 1.0));
        assert!(close(top.position[1], 2.0 + dist));
        assert!(close(top.position[2], 3.001));
        // A zero-radius pose still lifts by Vue's `max(distance, 1)`.
        let flat = board3d_topdown_pose(Board3dCameraPose {
            position: [0.0, 0.0, 0.0],
            target: [0.0, 0.0, 0.0],
            ..Default::default()
        });
        assert!(close(flat.position[1], 1.0));
    }

    #[test]
    fn board3d_minimap_orbit_sweeps_and_clamps_off_the_poles() {
        // One full 160 px drag sweeps 1.25π of azimuth.
        let (theta, phi) = board3d_orbit_delta(0.0, 1.0, 160.0, 0.0);
        assert!(close(theta, std::f64::consts::PI * 1.25));
        assert!(close(phi, 1.0));
        // The polar angle never reaches a pole.
        let (_, high) = board3d_orbit_delta(0.0, 0.0, 0.0, -10_000.0);
        assert!(close(high, BOARD3D_MINIMAP_MIN_POLAR));
        let (_, low) = board3d_orbit_delta(0.0, 3.0, 0.0, 10_000.0);
        assert!(close(low, BOARD3D_MINIMAP_MAX_POLAR));
        // The eye rides the sphere: phi = π/2 puts it on the equator.
        let eye =
            board3d_spherical_position([1.0, 2.0, 3.0], 0.0, std::f64::consts::FRAC_PI_2, 5.0);
        assert!(close(eye[0], 1.0));
        assert!(close(eye[1], 2.0));
        assert!(close(eye[2], 8.0));
        // phi = 0 is the north pole.
        let pole = board3d_spherical_position([0.0, 0.0, 0.0], 0.0, 0.0, 5.0);
        assert!(close(pole[1], 5.0));
    }

    // ── theme channels ───────────────────────────────────────────────

    #[test]
    fn board3d_css_channels_parse_a_palette_triplet() {
        let rgb = board3d_css_channels("10 15 25", [0.0, 0.0, 0.0]);
        assert!(close(rgb[0], 10.0 / 255.0));
        assert!(close(rgb[1], 15.0 / 255.0));
        assert!(close(rgb[2], 25.0 / 255.0));
        // Comma separated and partially filled channels both parse.
        let rgb = board3d_css_channels("255,128", [1.0, 1.0, 25.0]);
        assert!(close(rgb[0], 1.0));
        assert!(close(rgb[1], 128.0 / 255.0));
        assert!(close(rgb[2], 25.0 / 255.0));
        // Nothing parseable keeps the fallback.
        let rgb = board3d_css_channels("", [10.0, 15.0, 25.0]);
        assert!(close(rgb[0], 10.0 / 255.0));
        // The hover frame flips channel by background luminance.
        let dark = board3d_css_channels("10 15 25", [0.0, 0.0, 0.0]);
        assert!(board3d_rgb_luminance(dark) < 0.5);
        assert_eq!(board3d_hover_frame_channel(dark), "--color-text");
        let light = board3d_css_channels("247 249 252", [0.0, 0.0, 0.0]);
        assert_eq!(board3d_hover_frame_channel(light), "--color-muted");
        assert_eq!(board3d_selection_frame_channel(), "--color-primary");
    }

    // ── the press machine ────────────────────────────────────────────

    #[test]
    fn board3d_press_machine_gates_the_click() {
        board3d_begin_press("board-a", 7, 10.0, 10.0);
        assert_eq!(
            board3d_finish_press("board-a", 7, 12.0, 11.0),
            Some((12.0, 11.0))
        );
        // The press is consumed.
        assert_eq!(board3d_finish_press("board-a", 7, 12.0, 11.0), None);
        // Only the pressing pointer's release clicks.
        board3d_begin_press("board-a", 7, 10.0, 10.0);
        assert_eq!(board3d_finish_press("board-a", 8, 10.0, 10.0), None);
        // A drag past the slop is not a click.
        board3d_begin_press("board-a", 7, 10.0, 10.0);
        assert_eq!(board3d_finish_press("board-a", 7, 40.0, 10.0), None);
        // A cancel drops the press.
        board3d_begin_press("board-b", 1, 0.0, 0.0);
        board3d_cancel_press("board-b");
        assert_eq!(board3d_finish_press("board-b", 1, 0.0, 0.0), None);
        // Instances never share a slot.
        board3d_begin_press("board-c", 1, 0.0, 0.0);
        assert_eq!(board3d_finish_press("board-d", 1, 0.0, 0.0), None);
        board3d_cancel_press("board-c");
    }

    // ── DOM contract ─────────────────────────────────────────────────

    #[test]
    fn board3d_renders_the_canvas_layer_chips_and_overlay() {
        let html = Board3D(Board3DProps {
            width: 800.0,
            height: 600.0,
            ready: true,
            // An AXIS-ALIGNED pose, so the projection of the pivot onto the
            // canvas centre is exact (a tilted pose lands a hair off 300).
            camera_position: [0.0, 0.0, 10.0],
            camera_target: [0.0, 0.0, 0.0],
            labels: vec![Board3dLabel {
                id: "sun".to_string(),
                text: "Sun".to_string(),
                anchor: [0.0, 0.0, 0.0],
                ..Default::default()
            }],
            children: rsx! {
                div { class: "page-chrome", "panel" }
            },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-board3d\"",
            "hk-board3d-canvas",
            "position:absolute;inset:0;pointer-events:none",
            "hk-board3d-label",
            "data-label-id=\"sun\"",
            "transform:translate(-50%,-50%) translate(400px, 300px)",
            "hk-board3d-overlay",
            "page-chrome",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Vue's `minimap` prop defaults to TRUE: a ready board docks it.
        assert!(html.contains("hk-minimap hk-minimap3d"), "{html}");
        let no_dock = Board3D(Board3DProps {
            ready: true,
            minimap: false,
            ..Default::default()
        })
        .render_to_html();
        assert!(!no_dock.contains("hk-minimap3d"), "{no_dock}");
        assert!(!html.contains("hk-board3d-fallback"), "{html}");
    }

    #[test]
    fn board3d_renders_the_fallback_and_the_minimap_dock() {
        let html = Board3D(Board3DProps {
            failed: true,
            ready: true,
            error: Some("no webgl".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-board3d-fallback"), "{html}");
        assert!(
            html.contains("3D is unavailable on this device"),
            "the localized note is the Vue fallback text: {html}"
        );
        // A failed board never docks the minimap and paints no chips.
        assert!(!html.contains("hk-minimap3d"), "{html}");

        // A healthy board docks the host's minimap in Vue's own wrapper.
        let html = Board3D(Board3DProps {
            ready: true,
            minimap_default_collapsed: true,
            minimap_slot: rsx! {
                canvas { class: "host-minimap", "x" }
            },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-minimap hk-minimap3d hk-minimap--collapsed",
            "data-collapsed=\"\"",
            "host-minimap",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn board3d_transparent_backdrop_clears_the_root_paint() {
        let html = Board3D(Board3DProps {
            transparent_background: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("background:transparent"), "{html}");
        let opaque = Board3D(Board3DProps::default()).render_to_html();
        assert!(!opaque.contains("background:transparent"), "{opaque}");
    }

    #[test]
    fn board3d_styles_come_from_the_canonical_vue_sheet() {
        let css = Board3DComponent::styles();
        for class in [
            ".hk-board3d",
            ".hk-board3d-canvas",
            ".hk-board3d-label",
            ".hk-board3d-overlay",
            ".hk-board3d-fallback",
        ] {
            assert!(css.contains(class), "board3d css must carry {class}");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored board3d sheet"
        );
        assert_eq!(Board3DComponent::name(), "board-3d");
    }
}
