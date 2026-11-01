// packages/components/src/scene/minimap_3d.rs
// Minimap3D — mirror of the canonical Vue `HkMinimap3D`: the stereoscopic
// corner minimap of `HkBoard3D` (main-camera glyph, view-plane frame and the
// object markers live on the GL canvas; this file owns the CARD around them,
// the zoom bar, the slider pop and the collapse affordance).
//
// Two sheets are in play, exactly like the Vue component (which imports both):
// this card's own `HkMinimap3D.scss` (vendored under `src/styles/vue-mirror/`,
// listed in `manifest.tsv`, compiled with `no_hash` — it only carries
// `.hk-minimap3d-canvas`) and the SHARED chrome sheet `HkMinimap.scss`
// (`.hk-minimap`, `.hk-mm-*`). A registry host therefore registers BOTH this
// component and `scene::minimap` — the same sub-sheet relationship the Vue
// build gets from its double import, and the same shape the treemap stage
// documents for its cells.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   button.hk-minimap.hk-minimap3d.hk-minimap--collapsed[aria-label][title]
//     span[style="display:contents"] > lucide map svg (16px)
//
//   div.hk-minimap.hk-minimap3d[data-dragging]
//     canvas.hk-minimap3d-canvas[width=160][height=110]
//         — or the HOST-INJECTED canvas slot (see the header deltas)
//     div.hk-mm-zoom-bar
//       button.hk-mm-zoom-btn[disabled] aria-label="Zoom out"
//       button.hk-mm-zoom-label[aria-haspopup=dialog][aria-expanded][title] "100%"
//       button.hk-mm-zoom-btn[disabled] aria-label="Zoom in"
//       button.hk-mm-zoom-btn.hk-mm-zoom-reset-btn[aria-label="Reset view"]
//       button.hk-mm-zoom-btn.hk-mm-collapse-btn[aria-label="Hide minimap"] (collapsible)
//     div.hk-mm-zoom-pop                                  (sliderOpen only)
//       div.hk-slider…                                    (the MIRRORED `Slider`, size sm)
//       div.hk-mm-zoom-pop-scale[aria-hidden="true"] > span "50%" span "250%"
//
// Vue prop mapping: `engine` has NO Rust counterpart — the renderer, the
// scene graph, the `THREE.WebGLRenderer`, the helper layer, the marker meshes
// and the post-render hook are all HOST state (see the deltas). The mirror
// takes the map camera as CONTROLLED props (`theta` / `phi` / `zoom_percent`),
// the host's canvas as a slot, and reports every gesture as a callback:
// `on_zoom_to(percent)` (wheel / ± / slider), `on_orbit(theta, phi)` (drag),
// `on_reset` (the reset button's `seeded = false`), `on_collapsed_change` and
// `on_slider_open_change`.
//
// Deltas vs Vue (documented, one per deviation):
//   * [D] THE CANVAS IS THE HOST'S. Vue builds a second `THREE.WebGLRenderer`
//     against its own `<canvas>` (`MAP_W` × `MAP_H`, alpha, `setClearColor(0,
//     0)`), and re-inits it whenever a fold/unfold cycle rebuilds the element.
//     WebGL is not available to this crate: the host injects the finished
//     canvas through [`Minimap3DProps::canvas`], and when it injects nothing
//     the mirror renders Vue's bare shell (`canvas.hk-minimap3d-canvas` with
//     the same `width`/`height` attributes) so a host that resolves the
//     element by class still finds it.
//   * [D] EVERY 3D API IS HOST-OWNED, one by one: the `PerspectiveCamera`
//     (fov 48, near 0.1, far 10000) and `mapCamera.layers.enable(HELPERS)`;
//     the camera glyph (wireframe cone + octahedron at opacity 0.9/0.55,
//     depth-test off, renderOrder 999); the view-plane `LineSegments`; the
//     per-object marker meshes (dot/cube, `markerColor` default `#7ecbff`,
//     `marker: "none"` skipping); `getWorldPosition` / `Box3.getBoundingSphere`
//     reads; `addPostRender` / `removePostRender`; `renderer.dispose()` +
//     `forceContextLoss()` on unmount; the helper-layer `disposeNode` sweep.
//     None of it is mirrored — what IS mirrored is the pure math those calls
//     consume (see the next delta), so a host reproduces Vue's pose exactly.
//   * [D] THE SCENE3D KERNELS ARE SHARED, NOT RE-DERIVED. `utils/scene3d.ts`'s
//     minimap half already has a Rust mirror in `scene::board_3d`
//     ([`board3d_orbit_delta`] ≡ `orbitDelta`, [`board3d_spherical_position`]
//     ≡ `sphericalPosition`, [`board3d_fit_distance`] ≡ `fitDistance`,
//     [`board3d_view_plane_half_extents`] ≡ `viewPlaneHalfExtents`, plus the
//     polar clamps and the vec3 helpers). This file adds ONLY what is unique
//     to the minimap: the zoom ladder ([`minimap_3d_clamp_zoom`] ≡
//     `clampMinimapZoom`), the seeding ([`minimap_3d_seed_angles`]), the
//     auto-fit radius ([`minimap_3d_fit_radius`] / [`minimap_3d_orbit_radius`]),
//     the view-plane quad + frame segments ([`minimap_3d_view_plane`] /
//     [`minimap_3d_plane_frame_segments`] ≡ `planeCorners` + the line list),
//     the marker scale clamp ([`minimap_3d_marker_scale`]) and the refit
//     throttle ([`minimap_3d_refit_due`], Vue's `REFIT_MS = 300`).
//   * [D] `theta` / `phi` ARE CONTROLLED and the drag still accumulates: the
//     drag registry carries the running angles (seeded from the props on
//     `pointerdown`), so a host that does not echo every `on_orbit` back still
//     gets Vue's continuous orbit; when the host DOES echo them back, each new
//     press re-seeds from the props. Vue owns both angles in plain `let`s.
//   * [D] `collapsed` is CONTROLLED (Vue: a local ref seeded by
//     `defaultCollapsed`), and `sliderOpen` likewise. Vue's lazy renderer init
//     on first expand and its "skip frames while collapsed" are HOST concerns
//     here, because the renderer is.
//   * [D] NO DOCUMENT-LEVEL POP DISMISSAL (Vue: capture-phase `pointerdown` /
//     `keydown` on `document`). The crate has no document listener seam, so
//     Escape / outside-click belong to the host through
//     `on_slider_open_change` — the same degradation the 2D mirror and
//     `feedback/persistent_toast.rs` document.
//   * [D] NO POINTER CAPTURE, so a drag that leaves the card stops until the
//     pointer returns; `up` / `cancel` on the card still end it.
//   * [D] the reset button reports THREE facts of Vue's `resetView`
//     (`seeded = false`, `zoomPercent = 100`, `sliderOpen = false`) as
//     `on_reset` + `on_zoom_to(100)` + `on_slider_open_change(false)`.
//   * [D] the zoom chrome never arms an orbit: Vue tests
//     `target.closest(".hk-mm-zoom-bar") || target.closest(".hk-mm-zoom-pop")`.
//     The bar and the pop mark the gesture in `scene::minimap`'s registry from
//     their own `pointerdown` (which runs first) and the card consumes the
//     mark — the shared card chrome's single mechanism, not a second one.
//   * [D] `aria-label`s / `title`s read `components.hk.minimap3d.*` through
//     `hikari_i18n::t` (Vue hard-codes `zoomToolbar.*` + `board3d.resetView`
//     literals). The fallbacks are those same words, so the English DOM is
//     identical; the six keys are NEW (listed in the wave receipt).
//   * the glyphs / bar classes / disabled guards / order are the SHARED card
//     machinery from `scene::minimap` (`minimap_bar_items`,
//     `minimap_bar_item_classes`, `minimap_bar_item_glyph`,
//     `minimap_bar_item_disabled`, `minimap_glyph_markup`), because Vue's two
//     cards share the sheet verbatim — the only divergence is the label
//     namespace and the reset wording ("Reset view", not "Reset zoom").
//   * the object registry (`engine.objects()`) and the selection are HOST data.
//     [`Minimap3DMarker`] carries the same fields Vue's registry does (kind,
//     colour, radius, `content`) plus `selected`, and
//     [`minimap_3d_marker_geometry`] resolves the per-marker scale Vue applies
//     — the marker tint for a selected object is the host's own draw call, as
//     it is in Vue (there is no DOM marker layer in either form).
//
// New file: the family had no Rust minimap-3D card.

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
use tairitsu_vdom::{PointerEvent, WheelEvent};

use crate::basic::slider::{Slider, SliderSize};
use crate::prelude::*;
use crate::scene::board_3d::{
    BOARD3D_MINIMAP_MAX_POLAR, BOARD3D_MINIMAP_MIN_POLAR, board3d_fit_distance,
    board3d_orbit_delta, board3d_spherical_position, board3d_v3_cross, board3d_v3_length,
    board3d_v3_normalize_or, board3d_v3_sub, board3d_view_plane_half_extents,
};
use crate::scene::minimap::{
    MinimapBarItem, MinimapGlyph, minimap_bar_item_classes, minimap_bar_item_disabled,
    minimap_bar_item_glyph, minimap_bar_items, minimap_can_step_in, minimap_can_step_out,
    minimap_format_percent, minimap_glyph_markup, minimap_mark_chrome_press, minimap_step_zoom,
    minimap_take_chrome_press,
};
use crate::styled::StyledComponent;

pub struct Minimap3DComponent;

// ── canvas + frame constants (Vue: MAP_W / MAP_H / REFIT_MS) ────────────

/// The map canvas' width in px (`const MAP_W = 160`).
pub const MINIMAP_3D_MAP_W: u32 = 160;

/// The map canvas' height in px (`const MAP_H = 110`).
pub const MINIMAP_3D_MAP_H: u32 = 110;

/// The auto-fit throttle: "re-fit the auto radius at ~3 Hz" (`REFIT_MS`).
pub const MINIMAP_3D_REFIT_MS: f64 = 300.0;

/// The map camera's own vertical FOV (`new THREE.PerspectiveCamera(48, …)`).
pub const MINIMAP_3D_MAP_FOV: f64 = 48.0;

// ── the zoom ladder (Vue: MINIMAP_ZOOM_STEP/MIN/MAX_PERCENT) ────────────

/// The ±/wheel rung: "100% = everything fits, higher = closer" (`15`).
pub const MINIMAP_3D_ZOOM_STEP_PERCENT: f64 = 15.0;

/// The ladder floor (`MINIMAP_MIN_ZOOM_PERCENT = 50`).
pub const MINIMAP_3D_MIN_ZOOM_PERCENT: f64 = 50.0;

/// The ladder ceiling (`MINIMAP_MAX_ZOOM_PERCENT = 250`).
pub const MINIMAP_3D_MAX_ZOOM_PERCENT: f64 = 250.0;

/// The resting rung (`zoomPercent = ref(100)`).
pub const MINIMAP_3D_DEFAULT_ZOOM_PERCENT: f64 = 100.0;

/// The polar seed Vue starts the map eye at (`let phi = 1.1`).
pub const MINIMAP_3D_DEFAULT_POLAR: f64 = 1.1;

// ── fit + marker constants (Vue: `refit` / `markerFor` / `syncMarkers`) ──

/// "the orbit distance plus a little breathing room" (`* 1.05`).
pub const MINIMAP_3D_FIT_PADDING: f64 = 1.05;

/// The auto-fit radius never drops below this (`Math.max(r, 1)`).
pub const MINIMAP_3D_FIT_FLOOR: f64 = 1.0;

/// The orbit radius never drops below this (`Math.max(base * …, 1)`).
pub const MINIMAP_3D_ORBIT_RADIUS_FLOOR: f64 = 1.0;

/// "A star reads bigger than a satellite": marker scale = radius × this.
pub const MINIMAP_3D_MARKER_SCALE_RATIO: f64 = 0.25;

/// The marker scale clamp (`Math.min(3, Math.max(0.6, …))`).
pub const MINIMAP_3D_MARKER_MIN_SCALE: f64 = 0.6;
pub const MINIMAP_3D_MARKER_MAX_SCALE: f64 = 3.0;

/// Vue's default marker tint (`def.markerColor ?? "#7ecbff"`).
pub const MINIMAP_3D_DEFAULT_MARKER_COLOR: &str = "#7ecbff";

/// A degenerate camera→target distance is floored here
/// (`Math.max(camera.position.distanceTo(controls.target), 0.001)`).
pub const MINIMAP_3D_TARGET_DISTANCE_FLOOR: f64 = 0.001;

// ── class names (the DOM contract, pinned by the tests) ─────────────────

/// The card's root classes (Vue: `class="hk-minimap hk-minimap3d"`).
pub const MINIMAP_3D_ROOT_CLASS: &str = "hk-minimap hk-minimap3d";

/// The folded affordance's root classes (Vue:
/// `class="hk-minimap hk-minimap3d hk-minimap--collapsed"`).
pub const MINIMAP_3D_COLLAPSED_CLASS: &str = "hk-minimap hk-minimap3d hk-minimap--collapsed";

// ── models ─────────────────────────────────────────────────────────────

/// A marker kind (Vue: `def.marker?: "dot" | "cube" | "none"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Minimap3DMarkerKind {
    /// `THREE.SphereGeometry(0.9, 8, 6)` at opacity 0.9 (the default).
    #[default]
    Dot,
    /// `THREE.BoxGeometry(1.6, 1.6, 1.6)`, wireframe at opacity 0.85.
    Cube,
    /// No mesh at all (`markerFor` returns `null`).
    None,
}

impl Minimap3DMarkerKind {
    /// The token Vue's object definitions use.
    pub fn token(self) -> &'static str {
        match self {
            Minimap3DMarkerKind::Dot => "dot",
            Minimap3DMarkerKind::Cube => "cube",
            Minimap3DMarkerKind::None => "none",
        }
    }

    /// Whether a mesh is built for this kind.
    pub fn visible(self) -> bool {
        !matches!(self, Minimap3DMarkerKind::None)
    }
}

/// One entry of the host's object registry (`engine.objects()`): everything
/// Vue reads off a `Board3DObject` definition plus the world position the
/// engine would resolve through `getWorldPosition`.
#[derive(Clone, PartialEq, Debug)]
pub struct Minimap3DMarker {
    /// Registry id (`markerMeshes` key / `userData.mm3dId`).
    pub id: String,
    /// World position (`def.object.getWorldPosition`).
    pub position: [f64; 3],
    /// The object's bounding-sphere radius (`Box3.getBoundingSphere`).
    pub radius: f64,
    /// Which mesh Vue builds (default `Dot`).
    pub kind: Minimap3DMarkerKind,
    /// Marker tint (`def.markerColor`, defaulting to `#7ecbff` when empty).
    pub color: String,
    /// Whether the object participates in the auto-fit (`def.content !== false`).
    pub content: bool,
    /// The host's selection flag for this object. Vue tints a selected marker
    /// in its own draw path; the model carries the fact so the host's marker
    /// layer can do the same (see the header).
    pub selected: bool,
}

impl Minimap3DMarker {
    /// A default marker: sphere, default tint, content, nothing selected.
    pub fn new(id: &str, position: [f64; 3], radius: f64) -> Self {
        Self {
            id: id.to_string(),
            position,
            radius,
            kind: Minimap3DMarkerKind::Dot,
            color: MINIMAP_3D_DEFAULT_MARKER_COLOR.to_string(),
            content: true,
            selected: false,
        }
    }

    /// The resolved tint: Vue's `def.markerColor ?? "#7ecbff"` — an empty
    /// string falls back to the default, an explicit colour wins.
    pub fn resolved_color(&self) -> &str {
        if self.color.is_empty() {
            MINIMAP_3D_DEFAULT_MARKER_COLOR
        } else {
            &self.color
        }
    }

    /// The mesh scale Vue applies (`Math.min(3, Math.max(0.6, r * 0.25))`).
    pub fn scale(&self) -> f64 {
        minimap_3d_marker_scale(self.radius)
    }
}

/// One marker as the host's draw call consumes it: the resolved kind, tint,
/// scale, selection flag and position, with `None`-kind entries dropped.
#[derive(Clone, PartialEq, Debug)]
pub struct Minimap3DMarkerGeometry {
    pub id: String,
    pub position: [f64; 3],
    pub scale: f64,
    pub kind: Minimap3DMarkerKind,
    pub color: String,
    pub selected: bool,
}

/// The host's main camera pose — the fields Vue reads off
/// `engine.camera` + `controls.target` for the minimap's helper geometry.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Minimap3DCamera {
    /// `camera.position`.
    pub position: [f64; 3],
    /// `controls.target` (the orbit centre).
    pub target: [f64; 3],
    /// The camera's forward axis (Vue derives it from `camera.quaternion`,
    /// which is a 3D object the host owns — the axis is passed directly).
    pub forward: [f64; 3],
    /// The camera's up axis.
    pub up: [f64; 3],
    /// `camera.fov` (degrees).
    pub fov: f64,
    /// `camera.aspect`.
    pub aspect: f64,
}

impl Default for Minimap3DCamera {
    fn default() -> Self {
        Self {
            position: [0.0, 0.0, 10.0],
            target: [0.0, 0.0, 0.0],
            forward: [0.0, 0.0, -1.0],
            up: [0.0, 1.0, 0.0],
            fov: 45.0,
            aspect: 1.0,
        }
    }
}

/// The view-plane footprint the minimap draws ("查看平面范围"): the quad `dist`
/// in front of the eye plus the four edges back to it.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Minimap3DPlane {
    /// The eye (`camera.position`).
    pub eye: [f64; 3],
    /// The quad's centre (`eye + forward * dist`).
    pub center: [f64; 3],
    /// `dist` — the eye→target distance, floored at
    /// [`MINIMAP_3D_TARGET_DISTANCE_FLOOR`].
    pub distance: f64,
    /// Half width (`viewPlaneHalfExtents.…halfW`).
    pub half_w: f64,
    /// Half height.
    pub half_h: f64,
    /// Top-left, top-right, bottom-right, bottom-left (Vue's `planeCorners`).
    pub corners: [[f64; 3]; 4],
}

/// One line segment of the view-plane frame, as `[from, to]`.
pub type Minimap3DSegment = ([f64; 3], [f64; 3]);

// ── the zoom ladder (pure) ─────────────────────────────────────────────

/// Vue's `clampMinimapZoom`: a non-finite percent is 100, everything else is
/// held inside `[50, 250]`.
pub fn minimap_3d_clamp_zoom(percent: f64) -> f64 {
    if !percent.is_finite() {
        return MINIMAP_3D_DEFAULT_ZOOM_PERCENT;
    }
    percent
        .max(MINIMAP_3D_MIN_ZOOM_PERCENT)
        .min(MINIMAP_3D_MAX_ZOOM_PERCENT)
}

/// One ±/wheel rung: `direction` is +1 (in) or -1 (out). `None` when the
/// clamped target does not move (Vue re-assigns the same value, which is not
/// an observable change — the shared helper's contract).
pub fn minimap_3d_step_zoom(percent: f64, direction: i32) -> Option<f64> {
    minimap_step_zoom(
        percent,
        direction,
        MINIMAP_3D_ZOOM_STEP_PERCENT,
        MINIMAP_3D_MIN_ZOOM_PERCENT,
        MINIMAP_3D_MAX_ZOOM_PERCENT,
    )
}

/// Vue's `canStepIn` for the 3D ladder.
pub fn minimap_3d_can_step_in(percent: f64) -> bool {
    minimap_can_step_in(true, percent, MINIMAP_3D_MAX_ZOOM_PERCENT)
}

/// Vue's `canStepOut` for the 3D ladder.
pub fn minimap_3d_can_step_out(percent: f64) -> bool {
    minimap_can_step_out(true, percent, MINIMAP_3D_MIN_ZOOM_PERCENT)
}

/// The root class list: the card's own classes, plus the collapsed modifier
/// when folded (Vue's `v-if` splits two literal class strings).
pub fn minimap_3d_root_classes(collapsed: bool) -> &'static str {
    if collapsed {
        MINIMAP_3D_COLLAPSED_CLASS
    } else {
        MINIMAP_3D_ROOT_CLASS
    }
}

/// The `aria-label` / `title` of one bar child, in this card's i18n
/// namespace. The reset button speaks `board3d.resetView` ("Reset view"), not
/// the 2D card's "Reset zoom".
pub fn minimap_3d_bar_item_label(item: MinimapBarItem) -> String {
    match item {
        MinimapBarItem::StepOut => t("components.hk.minimap3d.zoomOut", "Zoom out"),
        MinimapBarItem::StepIn => t("components.hk.minimap3d.zoomIn", "Zoom in"),
        MinimapBarItem::Label => t("components.hk.minimap3d.zoomSlider", "Zoom level"),
        MinimapBarItem::Reset => t("components.hk.minimap3d.resetView", "Reset view"),
        MinimapBarItem::Collapse => t("components.hk.minimap3d.collapseMap", "Hide minimap"),
    }
}

/// The collapsible glyph's label (Vue: `zoomToolbar.expandMap`).
pub fn minimap_3d_expand_label() -> String {
    t("components.hk.minimap3d.expandMap", "Show minimap")
}

// ── the auto-fit (pure) ────────────────────────────────────────────────

/// Vue's `refit`: start from the orbit distance plus the fit padding, grow to
/// cover every content object (`distance + sphere radius`), floor at 1.
pub fn minimap_3d_fit_radius(orbit_distance: f64, content: &[(f64, f64)]) -> f64 {
    let mut radius = orbit_distance * MINIMAP_3D_FIT_PADDING;
    if !radius.is_finite() {
        radius = MINIMAP_3D_FIT_FLOOR;
    }
    for (distance, sphere_radius) in content {
        if !distance.is_finite() || !sphere_radius.is_finite() {
            continue;
        }
        radius = radius.max(distance + sphere_radius);
    }
    radius.max(MINIMAP_3D_FIT_FLOOR)
}

/// The `(distance, radius)` pairs Vue's `refit` walks: every CONTENT object's
/// distance from the eye plus its bounding-sphere radius.
pub fn minimap_3d_fit_inputs(
    camera_position: [f64; 3],
    markers: &[Minimap3DMarker],
) -> Vec<(f64, f64)> {
    markers
        .iter()
        .filter(|marker| marker.content && marker.radius.is_finite())
        .map(|marker| {
            (
                board3d_v3_length(board3d_v3_sub(marker.position, camera_position)),
                marker.radius,
            )
        })
        .collect()
}

/// The map eye's orbit radius: `max(fitDistance(fit, fov, aspect) * (100 /
/// zoom), 1)` — 100% fits everything, a higher rung pulls the eye closer.
pub fn minimap_3d_orbit_radius(
    fit_radius: f64,
    fov_deg: f64,
    aspect: f64,
    zoom_percent: f64,
) -> f64 {
    let base = board3d_fit_distance(fit_radius, fov_deg, aspect);
    let zoom = minimap_3d_clamp_zoom(zoom_percent);
    (base * (MINIMAP_3D_DEFAULT_ZOOM_PERCENT / zoom)).max(MINIMAP_3D_ORBIT_RADIUS_FLOOR)
}

/// The refit throttle: has [`MINIMAP_3D_REFIT_MS`] elapsed since the last fit?
pub fn minimap_3d_refit_due(now_ms: f64, last_refit_ms: f64) -> bool {
    if !now_ms.is_finite() || !last_refit_ms.is_finite() {
        return true;
    }
    now_ms - last_refit_ms >= MINIMAP_3D_REFIT_MS
}

/// Vue's marker scale: `Math.min(3, Math.max(0.6, radius * 0.25))`.
pub fn minimap_3d_marker_scale(sphere_radius: f64) -> f64 {
    if !sphere_radius.is_finite() {
        return MINIMAP_3D_MARKER_MIN_SCALE;
    }
    (sphere_radius * MINIMAP_3D_MARKER_SCALE_RATIO)
        .max(MINIMAP_3D_MARKER_MIN_SCALE)
        .min(MINIMAP_3D_MARKER_MAX_SCALE)
}

/// The host's draw list: every marker with a mesh, resolved to its kind,
/// tint, scale and selection flag (`marker: "none"` markers are dropped).
pub fn minimap_3d_marker_geometry(markers: &[Minimap3DMarker]) -> Vec<Minimap3DMarkerGeometry> {
    markers
        .iter()
        .filter(|marker| marker.kind.visible())
        .map(|marker| Minimap3DMarkerGeometry {
            id: marker.id.clone(),
            position: marker.position,
            scale: marker.scale(),
            kind: marker.kind,
            color: marker.resolved_color().to_string(),
            selected: marker.selected,
        })
        .collect()
}

// ── the seeding + the view plane (pure) ────────────────────────────────

/// Vue's `!seeded` block: azimuth from the eye→target offset's `(x, z)` and
/// the polar angle from its normalized `y`, clamped off the poles.
/// `offset` is `camera.position - controls.target`.
pub fn minimap_3d_seed_angles(offset: [f64; 3]) -> (f64, f64) {
    // Vue: `theta = Math.atan2(off.x, off.z)` — the azimuth is measured off +Z.
    let theta = offset[0].atan2(offset[2]);
    let length = board3d_v3_length(offset).max(1e-6);
    let ratio = (offset[1] / length).max(-1.0).min(1.0);
    let phi = ratio
        .acos()
        .max(BOARD3D_MINIMAP_MIN_POLAR)
        .min(BOARD3D_MINIMAP_MAX_POLAR);
    (theta, phi)
}

/// The eye→target distance, floored at
/// [`MINIMAP_3D_TARGET_DISTANCE_FLOOR`].
pub fn minimap_3d_camera_distance(camera: &Minimap3DCamera) -> f64 {
    board3d_v3_length(board3d_v3_sub(camera.position, camera.target))
        .max(MINIMAP_3D_TARGET_DISTANCE_FLOOR)
}

/// Vue's `planeCorners`: the four quad corners (top-left, top-right,
/// bottom-right, bottom-left as the camera sees them).
pub fn minimap_3d_plane_corners(
    center: [f64; 3],
    right: [f64; 3],
    up: [f64; 3],
    half_w: f64,
    half_h: f64,
) -> [[f64; 3]; 4] {
    let at = |sr: f64, su: f64| -> [f64; 3] {
        [
            center[0] + right[0] * half_w * sr + up[0] * half_h * su,
            center[1] + right[1] * half_w * sr + up[1] * half_h * su,
            center[2] + right[2] * half_w * sr + up[2] * half_h * su,
        ]
    };
    [at(-1.0, 1.0), at(1.0, 1.0), at(1.0, -1.0), at(-1.0, -1.0)]
}

/// The view-plane footprint: Vue's `dist` / `planeCenter` /
/// `viewPlaneHalfExtents` / `right` / `trueUp` / `planeCorners` block from
/// `updateHelpersAndCamera`, minus the `THREE` objects.
pub fn minimap_3d_view_plane(camera: &Minimap3DCamera) -> Minimap3DPlane {
    let distance = minimap_3d_camera_distance(camera);
    let forward = board3d_v3_normalize_or(camera.forward, [0.0, 0.0, -1.0]);
    let center = [
        camera.position[0] + forward[0] * distance,
        camera.position[1] + forward[1] * distance,
        camera.position[2] + forward[2] * distance,
    ];
    let (half_w, half_h) = board3d_view_plane_half_extents(camera.fov, camera.aspect, distance);
    let right = board3d_v3_normalize_or(
        board3d_v3_cross(forward, board3d_v3_normalize_or(camera.up, [0.0, 1.0, 0.0])),
        [1.0, 0.0, 0.0],
    );
    let true_up = board3d_v3_normalize_or(board3d_v3_cross(right, forward), [0.0, 1.0, 0.0]);
    Minimap3DPlane {
        eye: camera.position,
        center,
        distance,
        half_w,
        half_h,
        corners: minimap_3d_plane_corners(center, right, true_up, half_w, half_h),
    }
}

/// The `LineSegments` position list Vue uploads: four spokes (eye → corner)
/// followed by the four quad edges (corner *i* → corner *i+1*, closing the
/// loop). Eight segments, in that order.
pub fn minimap_3d_plane_frame_segments(plane: &Minimap3DPlane) -> Vec<Minimap3DSegment> {
    let mut segments: Vec<Minimap3DSegment> = Vec::with_capacity(8);
    for corner in plane.corners.iter() {
        segments.push((plane.eye, *corner));
    }
    for index in 0..4 {
        segments.push((plane.corners[index], plane.corners[(index + 1) % 4]));
    }
    segments
}

/// The map eye's world position for a rung: the spherical helper around the
/// MAIN camera (`sphericalPosition(center = camera.position, theta, phi,
/// radius)`), so "dragging reads as walking around the operator's viewpoint".
pub fn minimap_3d_map_eye(camera: &Minimap3DCamera, theta: f64, phi: f64, radius: f64) -> [f64; 3] {
    board3d_spherical_position(camera.position, theta, phi, radius)
}

// ── the orbit drag registry (non-reactive house pattern) ───────────────

thread_local! {
    /// The in-flight orbit: `(card handle, last client x, last client y,
    /// running theta, running phi)`. The angles accumulate here so a host that
    /// does not echo every `on_orbit` back still gets Vue's continuous orbit.
    static MINIMAP_3D_DRAG: Cell<Option<(u64, i32, i32, f64, f64)>> =
        const { Cell::new(None) };
}

/// Arm the orbit for `surface`, seeding the running angles from the props.
pub fn minimap_3d_drag_begin(
    surface: Option<u64>,
    client_x: i32,
    client_y: i32,
    theta: f64,
    phi: f64,
) {
    let Some(surface) = surface else {
        return;
    };
    MINIMAP_3D_DRAG.with(|drag| drag.set(Some((surface, client_x, client_y, theta, phi))));
}

/// Advance the orbit by this event's pointer delta and return the new
/// `(theta, phi)`. `None` when this surface is not the one dragging.
pub fn minimap_3d_drag_orbit(
    surface: Option<u64>,
    client_x: i32,
    client_y: i32,
) -> Option<(f64, f64)> {
    let surface = surface?;
    MINIMAP_3D_DRAG.with(|drag| match drag.get() {
        Some((owner, last_x, last_y, theta, phi)) if owner == surface => {
            let (theta, phi) = board3d_orbit_delta(
                theta,
                phi,
                f64::from(client_x - last_x),
                f64::from(client_y - last_y),
            );
            drag.set(Some((owner, client_x, client_y, theta, phi)));
            Some((theta, phi))
        }
        _ => None,
    })
}

/// End the orbit (Vue: `onUp` / `onPointercancel`).
pub fn minimap_3d_drag_end() {
    MINIMAP_3D_DRAG.with(|drag| drag.set(None));
}

/// Whether an orbit is in flight (the `data-dragging` hook).
pub fn minimap_3d_is_dragging() -> bool {
    MINIMAP_3D_DRAG.with(|drag| drag.get().is_some())
}

/// Vue's presence-attribute marker (`dragging ? "" : undefined`).
fn minimap_3d_marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("") } else { None }
}

// ── render assembly ────────────────────────────────────────────────────

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule).
fn minimap_3d_glyph_host(markup: &str) -> VNode {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

/// One round bar button, sharing the 2D card's chrome classes.
fn minimap_3d_bar_button(
    item: MinimapBarItem,
    disabled: bool,
    onclick: EventHandler<MouseEvent>,
) -> VNode {
    let label = minimap_3d_bar_item_label(item);
    let inner = match minimap_bar_item_glyph(item) {
        Some(glyph) => minimap_3d_glyph_host(&minimap_glyph_markup(glyph)),
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
pub struct Minimap3DProps {
    /// The HOST's render canvas (see the header). When `None` the mirror
    /// renders Vue's bare `canvas.hk-minimap3d-canvas` shell instead.
    pub canvas: Option<Element>,

    /// The folded state (Vue: the local `collapsed` ref seeded by
    /// `defaultCollapsed`); controlled here.
    #[default]
    pub collapsed: bool,

    /// Grow the minimize button in the zoom bar (Vue: `collapsible`).
    #[default]
    pub collapsible: bool,

    /// Whether the slider pop is open (Vue's local `sliderOpen`); controlled
    /// here (see the header).
    #[default]
    pub slider_open: bool,

    /// The map ladder's current rung (Vue's local `zoomPercent` ref).
    #[default(MINIMAP_3D_DEFAULT_ZOOM_PERCENT)]
    pub zoom_percent: f64,

    /// The map eye's azimuth on the sphere centred on the main camera
    /// (Vue's local `theta`; seed it with [`minimap_3d_seed_angles`]).
    #[default]
    pub theta: f64,

    /// The map eye's polar angle (Vue's local `phi`, seeded at `1.1`).
    #[default(MINIMAP_3D_DEFAULT_POLAR)]
    pub phi: f64,

    /// Zoom request with an already clamped percent (Vue: the wheel / ± /
    /// slider writes into `zoomPercent`).
    pub on_zoom_to: Option<EventHandler<f64>>,

    /// Orbit request with the running `(theta, phi)` (Vue: the drag mutation).
    pub on_orbit: Option<EventHandler<(f64, f64)>>,

    /// Reset intent (Vue's `resetView`: `seeded = false`; the zoom and the pop
    /// arrive through their own channels, see the header).
    pub on_reset: Option<EventHandler<MouseEvent>>,

    /// Collapse intent (Vue's `toggleCollapsed`).
    pub on_collapsed_change: Option<EventHandler<bool>>,

    /// Slider-pop open/close intent (Vue's local `sliderOpen` writes).
    pub on_slider_open_change: Option<EventHandler<bool>>,
}

#[component]
pub fn Minimap3D(props: Minimap3DProps) -> Element {
    // ── the folded affordance (a plain button, never a drag surface) ────
    if props.collapsed {
        let label = minimap_3d_expand_label();
        let on_expand = props.on_collapsed_change.clone();
        let glyph = minimap_3d_glyph_host(&minimap_glyph_markup(MinimapGlyph::Map));
        return rsx! {
            button {
                class: minimap_3d_root_classes(true),
                "type": "button",
                "aria-label": label.clone(),
                title: label,
                onclick: move |_event: MouseEvent| {
                    if let Some(handler) = on_expand.as_ref() {
                        handler.call(false);
                    }
                },
                {glyph}
            }
        };
    }

    // ── the map camera (Copy, so the handlers capture snapshots) ────────
    let zoom_percent = props.zoom_percent;
    let theta = props.theta;
    let phi = props.phi;
    let slider_open = props.slider_open;

    // ── the canvas: the host's, or Vue's bare shell ─────────────────────
    let canvas_node = match props.canvas.clone() {
        Some(canvas) => canvas,
        None => rsx! {
            canvas {
                class: "hk-minimap3d-canvas",
                width: MINIMAP_3D_MAP_W,
                height: MINIMAP_3D_MAP_H,
            }
        },
    };

    // ── the zoom bar (reset is unconditional on this card) ──────────────
    let on_zoom_to = props.on_zoom_to.clone();
    let step_out_handler = {
        let on_zoom_to = on_zoom_to.clone();
        move |_event: MouseEvent| {
            if let Some(percent) = minimap_3d_step_zoom(zoom_percent, -1) {
                if let Some(handler) = on_zoom_to.as_ref() {
                    handler.call(minimap_3d_clamp_zoom(percent));
                }
            }
        }
    };
    let step_in_handler = {
        let on_zoom_to = on_zoom_to.clone();
        move |_event: MouseEvent| {
            if let Some(percent) = minimap_3d_step_zoom(zoom_percent, 1) {
                if let Some(handler) = on_zoom_to.as_ref() {
                    handler.call(minimap_3d_clamp_zoom(percent));
                }
            }
        }
    };
    let on_reset = props.on_reset.clone();
    let reset_handler = {
        let on_zoom_to = on_zoom_to.clone();
        let on_slider_open_change = props.on_slider_open_change.clone();
        move |event: MouseEvent| {
            // Vue's `resetView`: reseed the eye, land on 100%, dismiss the pop.
            if let Some(handler) = on_zoom_to.as_ref() {
                handler.call(MINIMAP_3D_DEFAULT_ZOOM_PERCENT);
            }
            if let Some(handler) = on_slider_open_change.as_ref() {
                handler.call(false);
            }
            if let Some(handler) = on_reset.as_ref() {
                handler.call(event);
            }
        }
    };
    let on_collapsed_change = props.on_collapsed_change.clone();
    let collapse_handler = move |_event: MouseEvent| {
        // Vue: `toggleCollapsed(true)` also dismisses the pop.
        minimap_3d_drag_end();
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
    let min_zoom_label = minimap_format_percent(MINIMAP_3D_MIN_ZOOM_PERCENT);
    let max_zoom_label = minimap_format_percent(MINIMAP_3D_MAX_ZOOM_PERCENT);
    let zoom_slider_label = minimap_3d_bar_item_label(MinimapBarItem::Label);
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
    for item in minimap_bar_items(true, props.collapsible) {
        let disabled = minimap_bar_item_disabled(
            item,
            true,
            true,
            zoom_percent,
            MINIMAP_3D_MIN_ZOOM_PERCENT,
            MINIMAP_3D_MAX_ZOOM_PERCENT,
        );
        let node = match item {
            MinimapBarItem::Label => label_node.clone(),
            MinimapBarItem::StepOut => {
                minimap_3d_bar_button(item, disabled, EventHandler::new(step_out_handler.clone()))
            }
            MinimapBarItem::StepIn => {
                minimap_3d_bar_button(item, disabled, EventHandler::new(step_in_handler.clone()))
            }
            MinimapBarItem::Reset => {
                minimap_3d_bar_button(item, disabled, EventHandler::new(reset_handler.clone()))
            }
            MinimapBarItem::Collapse => {
                minimap_3d_bar_button(item, disabled, EventHandler::new(collapse_handler.clone()))
            }
        };
        bar_nodes.push(node);
    }
    let bar_node = rsx! {
        div {
            class: "hk-mm-zoom-bar",
            onpointerdown: move |_event: PointerEvent| minimap_mark_chrome_press(),
            {VNode::Fragment(bar_nodes)}
        }
    };

    // ── the slider pop (bounded by the 3D ladder, clamped on input) ─────
    let pop_node = if slider_open {
        let on_zoom_to = props.on_zoom_to.clone();
        let on_input = EventHandler::new(move |value: f64| {
            if let Some(handler) = on_zoom_to.as_ref() {
                handler.call(minimap_3d_clamp_zoom(value));
            }
        });
        let format_value = Callback::new(minimap_format_percent);
        rsx! {
            div {
                class: "hk-mm-zoom-pop",
                onpointerdown: move |_event: PointerEvent| minimap_mark_chrome_press(),
                Slider {
                    value: minimap_3d_clamp_zoom(zoom_percent),
                    min: MINIMAP_3D_MIN_ZOOM_PERCENT,
                    max: MINIMAP_3D_MAX_ZOOM_PERCENT,
                    step: MINIMAP_3D_ZOOM_STEP_PERCENT,
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

    // ── gestures: drag orbits the eye, wheel steps the ladder ───────────
    let on_orbit = props.on_orbit.clone();
    let on_slider_open_change = props.on_slider_open_change.clone();
    let pointer_down = move |event: PointerEvent| {
        // A press in the zoom chrome leaves everything alone (Vue's
        // `closest(".hk-mm-zoom-bar")` guard, shared with the 2D card).
        if minimap_take_chrome_press() {
            return;
        }
        if slider_open {
            if let Some(handler) = on_slider_open_change.as_ref() {
                handler.call(false);
            }
        }
        event.stop_propagation();
        event.prevent_default();
        minimap_3d_drag_begin(
            event.current_target,
            event.client_x,
            event.client_y,
            theta,
            phi,
        );
    };
    let pointer_move = move |event: PointerEvent| {
        let Some((next_theta, next_phi)) =
            minimap_3d_drag_orbit(event.current_target, event.client_x, event.client_y)
        else {
            return;
        };
        event.stop_propagation();
        if let Some(handler) = on_orbit.as_ref() {
            handler.call((next_theta, next_phi));
        }
    };
    // Vue's `onWheel`: `deltaY < 0` is one rung in, else one rung out.
    let wheel_handler = {
        let on_zoom_to = props.on_zoom_to.clone();
        move |event: WheelEvent| {
            event.stop_propagation();
            event.prevent_default();
            let direction = if event.delta_y < 0.0 { 1 } else { -1 };
            if let Some(percent) = minimap_3d_step_zoom(zoom_percent, direction) {
                if let Some(handler) = on_zoom_to.as_ref() {
                    handler.call(minimap_3d_clamp_zoom(percent));
                }
            }
        }
    };

    rsx! {
        div {
            class: minimap_3d_root_classes(false),
            "data-dragging": minimap_3d_marker_attr(minimap_3d_is_dragging()),
            onpointerdown: pointer_down,
            onpointermove: pointer_move,
            onpointerup: move |_event: PointerEvent| minimap_3d_drag_end(),
            onpointercancel: move |_event: PointerEvent| minimap_3d_drag_end(),
            onwheel: wheel_handler,
            {canvas_node}
            {bar_node}
            {pop_node}
        }
    }
}

impl StyledComponent for Minimap3DComponent {
    fn styles() -> &'static str {
        // This card's own sheet. The shared chrome (`.hk-minimap`,
        // `.hk-mm-*`) lives in `scene::minimap`'s sheet, exactly as the Vue
        // component imports HkMinimap.scss alongside HkMinimap3D.scss.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMinimap3D.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "minimap-3d"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scene::board_3d::board3d_minimap_classes;
    use crate::scene::minimap::MinimapComponent;

    fn approx(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-9,
            "expected {expected}, got {actual}"
        );
    }

    fn marker(id: &str, position: [f64; 3], radius: f64) -> Minimap3DMarker {
        Minimap3DMarker::new(id, position, radius)
    }

    #[test]
    fn minimap_3d_defaults_match_the_vue_props() {
        let props = Minimap3DProps::default();
        assert!(props.canvas.is_none());
        // Vue: `collapsible` / `defaultCollapsed` both default to false.
        assert!(!props.collapsed);
        assert!(!props.collapsible);
        assert!(!props.slider_open);
        assert_eq!(props.zoom_percent, 100.0);
        assert_eq!(props.theta, 0.0);
        // Vue: `let phi = 1.1`.
        assert_eq!(props.phi, 1.1);
        assert!(props.on_zoom_to.is_none());
        assert!(props.on_orbit.is_none());
        assert!(props.on_reset.is_none());
        assert!(props.on_collapsed_change.is_none());
        assert!(props.on_slider_open_change.is_none());
        // Vue's `const MAP_W / MAP_H / REFIT_MS`.
        assert_eq!(MINIMAP_3D_MAP_W, 160);
        assert_eq!(MINIMAP_3D_MAP_H, 110);
        assert_eq!(MINIMAP_3D_REFIT_MS, 300.0);
        // scene3d.ts's ladder.
        assert_eq!(MINIMAP_3D_ZOOM_STEP_PERCENT, 15.0);
        assert_eq!(MINIMAP_3D_MIN_ZOOM_PERCENT, 50.0);
        assert_eq!(MINIMAP_3D_MAX_ZOOM_PERCENT, 250.0);
    }

    #[test]
    fn minimap_3d_class_names_match_the_vue_roots() {
        // Vue: two literal class strings (card / collapsed).
        assert_eq!(minimap_3d_root_classes(false), "hk-minimap hk-minimap3d");
        assert_eq!(
            minimap_3d_root_classes(true),
            "hk-minimap hk-minimap3d hk-minimap--collapsed"
        );
        // Drift guard: the board's dock helper speaks the same strings.
        assert_eq!(
            minimap_3d_root_classes(false),
            board3d_minimap_classes(false)
        );
        assert_eq!(minimap_3d_root_classes(true), board3d_minimap_classes(true));
        // The bar chrome is the shared card family.
        assert_eq!(
            minimap_bar_item_classes(MinimapBarItem::StepOut),
            "hk-mm-zoom-btn"
        );
        assert_eq!(
            minimap_bar_item_classes(MinimapBarItem::Reset),
            "hk-mm-zoom-btn hk-mm-zoom-reset-btn"
        );
        // The 3D reset button speaks the board's wording, not the 2D's.
        assert_eq!(
            minimap_3d_bar_item_label(MinimapBarItem::Reset),
            "Reset view"
        );
        assert_eq!(
            minimap_3d_bar_item_label(MinimapBarItem::StepOut),
            "Zoom out"
        );
        assert_eq!(minimap_3d_bar_item_label(MinimapBarItem::StepIn), "Zoom in");
        assert_eq!(
            minimap_3d_bar_item_label(MinimapBarItem::Collapse),
            "Hide minimap"
        );
        assert_eq!(minimap_3d_expand_label(), "Show minimap");
    }

    #[test]
    fn minimap_3d_zoom_ladder_runs_50_to_250_in_15_rungs() {
        // clampMinimapZoom: non-finite → 100, otherwise held in [50, 250].
        assert_eq!(minimap_3d_clamp_zoom(100.0), 100.0);
        assert_eq!(minimap_3d_clamp_zoom(10.0), 50.0);
        assert_eq!(minimap_3d_clamp_zoom(400.0), 250.0);
        assert_eq!(minimap_3d_clamp_zoom(f64::NAN), 100.0);
        assert_eq!(minimap_3d_clamp_zoom(f64::INFINITY), 100.0);

        // ±15 rungs, clamped like Vue's `clampMinimapZoom(percent ± 15)`.
        assert_eq!(minimap_3d_step_zoom(100.0, 1), Some(115.0));
        assert_eq!(minimap_3d_step_zoom(100.0, -1), Some(85.0));
        assert_eq!(minimap_3d_step_zoom(245.0, 1), Some(250.0));
        assert_eq!(minimap_3d_step_zoom(55.0, -1), Some(50.0));
        // At the bounds the rung does not move ⇒ no request at all.
        assert_eq!(minimap_3d_step_zoom(250.0, 1), None);
        assert_eq!(minimap_3d_step_zoom(50.0, -1), None);
        assert_eq!(minimap_3d_step_zoom(100.0, 0), None);

        // The endpoint guards match, with the shared 1e-9 slack.
        assert!(minimap_3d_can_step_in(249.0));
        assert!(!minimap_3d_can_step_in(250.0));
        assert!(minimap_3d_can_step_out(51.0));
        assert!(!minimap_3d_can_step_out(50.0));
    }

    #[test]
    fn minimap_3d_auto_fit_and_orbit_radius_follow_the_vue_math() {
        // `refit`: orbit distance × 1.05, grown by content, floored at 1.
        approx(minimap_3d_fit_radius(10.0, &[]), 10.5);
        approx(minimap_3d_fit_radius(10.0, &[(20.0, 2.0)]), 22.0);
        approx(minimap_3d_fit_radius(0.0, &[]), 1.0);
        // Non-finite input never poisons the radius.
        approx(minimap_3d_fit_radius(10.0, &[(f64::NAN, 1.0)]), 10.5);

        // `fitInputs`: content markers only, distance + radius.
        let markers = vec![
            marker("a", [0.0, 0.0, 4.0], 1.0),
            Minimap3DMarker {
                content: false,
                ..marker("b", [0.0, 0.0, 100.0], 9.0)
            },
            marker("c", [3.0, 4.0, 0.0], 0.5),
        ];
        let inputs = minimap_3d_fit_inputs([0.0, 0.0, 0.0], &markers);
        assert_eq!(inputs.len(), 2, "the non-content marker is skipped");
        approx(inputs[0].0, 4.0);
        approx(inputs[0].1, 1.0);
        approx(inputs[1].0, 5.0);

        // The eye's orbit radius: 100% fits everything, higher pulls closer.
        let base = minimap_3d_orbit_radius(10.0, MINIMAP_3D_MAP_FOV, 160.0 / 110.0, 100.0);
        approx(
            base,
            board3d_fit_distance(10.0, MINIMAP_3D_MAP_FOV, 160.0 / 110.0),
        );
        let closer = minimap_3d_orbit_radius(10.0, MINIMAP_3D_MAP_FOV, 160.0 / 110.0, 250.0);
        assert!(closer < base, "a higher rung pulls the eye closer");
        approx(closer * 2.5, base);
        // The floor keeps a degenerate fit off the target.
        approx(
            minimap_3d_orbit_radius(0.0, MINIMAP_3D_MAP_FOV, 1.0, 100.0),
            1.0,
        );
        // A wild zoom percent is clamped first.
        approx(
            minimap_3d_orbit_radius(10.0, MINIMAP_3D_MAP_FOV, 1.0, 1e9),
            minimap_3d_orbit_radius(10.0, MINIMAP_3D_MAP_FOV, 1.0, 250.0),
        );

        // The 300 ms refit window.
        assert!(!minimap_3d_refit_due(299.0, 0.0));
        assert!(minimap_3d_refit_due(300.0, 0.0));
        assert!(minimap_3d_refit_due(1000.0, 700.0));
        assert!(minimap_3d_refit_due(f64::NAN, 0.0));
    }

    #[test]
    fn minimap_3d_marker_models_resolve_kind_colour_and_scale() {
        // The scale clamp: radius × 0.25 inside [0.6, 3].
        approx(minimap_3d_marker_scale(10.0), 2.5);
        approx(minimap_3d_marker_scale(100.0), 3.0);
        approx(minimap_3d_marker_scale(0.1), 0.6);
        approx(minimap_3d_marker_scale(f64::NAN), 0.6);

        // Kinds: dot / cube are drawn, none is dropped.
        assert_eq!(Minimap3DMarkerKind::Dot.token(), "dot");
        assert_eq!(Minimap3DMarkerKind::Cube.token(), "cube");
        assert_eq!(Minimap3DMarkerKind::None.token(), "none");
        assert!(Minimap3DMarkerKind::Dot.visible());
        assert!(!Minimap3DMarkerKind::None.visible());

        let mut blank = marker("blank", [0.0, 0.0, 0.0], 2.0);
        blank.color = String::new();
        assert_eq!(blank.resolved_color(), MINIMAP_3D_DEFAULT_MARKER_COLOR);
        let tinted = Minimap3DMarker {
            color: "#ff0000".to_string(),
            ..marker("tinted", [1.0, 0.0, 0.0], 2.0)
        };
        assert_eq!(tinted.resolved_color(), "#ff0000");

        // The host's draw list: kind None dropped, scale + selection carried.
        let drawn = minimap_3d_marker_geometry(&[
            marker("a", [0.0, 0.0, 0.0], 2.0),
            Minimap3DMarker {
                kind: Minimap3DMarkerKind::None,
                ..marker("hidden", [0.0, 0.0, 0.0], 2.0)
            },
            Minimap3DMarker {
                kind: Minimap3DMarkerKind::Cube,
                selected: true,
                ..marker("picked", [1.0, 2.0, 3.0], 4.0)
            },
        ]);
        assert_eq!(drawn.len(), 2);
        assert_eq!(drawn[0].kind, Minimap3DMarkerKind::Dot);
        approx(drawn[0].scale, 0.6);
        assert!(!drawn[0].selected);
        assert_eq!(drawn[1].id, "picked");
        assert_eq!(drawn[1].kind, Minimap3DMarkerKind::Cube);
        assert_eq!(drawn[1].position, [1.0, 2.0, 3.0]);
        assert!(drawn[1].selected, "the host's selection rides the model");
        approx(drawn[1].scale, 1.0);
    }

    #[test]
    fn minimap_3d_seed_angles_match_the_vue_seeding_block() {
        // Vue: theta = atan2(off.x, off.z), phi = acos(clamp(off.y / |off|)).
        let (theta, phi) = minimap_3d_seed_angles([0.0, 0.0, 10.0]);
        approx(theta, 0.0);
        approx(phi, std::f64::consts::FRAC_PI_2);

        // Straight up / down clamps off the poles (0.12 … π - 0.12).
        let (_, up) = minimap_3d_seed_angles([0.0, 10.0, 0.0]);
        approx(up, BOARD3D_MINIMAP_MIN_POLAR);
        let (_, down) = minimap_3d_seed_angles([0.0, -10.0, 0.0]);
        approx(down, BOARD3D_MINIMAP_MAX_POLAR);

        // A quarter turn on +X.
        let (theta, phi) = minimap_3d_seed_angles([10.0, 0.0, 0.0]);
        approx(theta, std::f64::consts::FRAC_PI_2);
        approx(phi, std::f64::consts::FRAC_PI_2);

        // A degenerate offset never divides by zero.
        let (_, phi) = minimap_3d_seed_angles([0.0, 0.0, 0.0]);
        assert!(phi.is_finite());
    }

    #[test]
    fn minimap_3d_view_plane_and_frame_follow_the_vue_helpers() {
        let camera = Minimap3DCamera {
            position: [0.0, 0.0, 10.0],
            target: [0.0, 0.0, 0.0],
            forward: [0.0, 0.0, -1.0],
            up: [0.0, 1.0, 0.0],
            fov: 90.0,
            aspect: 1.0,
        };
        let plane = minimap_3d_view_plane(&camera);
        approx(plane.distance, 10.0);
        // Forward is -Z, so the quad sits at z = 0 (the target).
        assert_eq!(plane.center, [0.0, 0.0, 0.0]);
        // 90° vfov, aspect 1 ⇒ halfH = tan(45°) * 10 = 10.
        approx(plane.half_h, 10.0);
        approx(plane.half_w, 10.0);
        // Corners: top-left, top-right, bottom-right, bottom-left.
        approx(plane.corners[0][0], -10.0);
        approx(plane.corners[0][1], 10.0);
        approx(plane.corners[1][0], 10.0);
        approx(plane.corners[1][1], 10.0);
        approx(plane.corners[2][1], -10.0);
        approx(plane.corners[3][0], -10.0);

        // Eight segments: four spokes to the eye, then the quad edges.
        let segments = minimap_3d_plane_frame_segments(&plane);
        assert_eq!(segments.len(), 8);
        assert_eq!(segments[0].0, plane.eye);
        assert_eq!(segments[0].1, plane.corners[0]);
        assert_eq!(segments[3].1, plane.corners[3]);
        assert_eq!(segments[4], (plane.corners[0], plane.corners[1]));
        assert_eq!(segments[7], (plane.corners[3], plane.corners[0]));

        // The degenerate eye→target distance is floored, never zero.
        let degenerate = Minimap3DCamera {
            position: [0.0, 0.0, 0.0],
            target: [0.0, 0.0, 0.0],
            ..camera
        };
        approx(
            minimap_3d_camera_distance(&degenerate),
            MINIMAP_3D_TARGET_DISTANCE_FLOOR,
        );

        // The map eye is the spherical helper around the main camera.
        let eye = minimap_3d_map_eye(&camera, 0.0, std::f64::consts::FRAC_PI_2, 3.0);
        approx(eye[0], 0.0);
        approx(eye[1], 0.0);
        approx(eye[2], 13.0);
    }

    #[test]
    fn minimap_3d_orbit_registry_accumulates_like_the_vue_refs() {
        minimap_3d_drag_begin(None, 0, 0, 0.0, 1.1);
        assert!(!minimap_3d_is_dragging());
        assert!(minimap_3d_drag_orbit(Some(3), 10, 10).is_none());

        // A press seeds from the props, then every move advances the angles.
        minimap_3d_drag_begin(Some(3), 100, 100, 0.0, 1.1);
        assert!(minimap_3d_is_dragging());
        let (theta, phi) = minimap_3d_drag_orbit(Some(3), 140, 100).expect("orbit");
        let step = f64::from(40) * std::f64::consts::PI * 1.25 / 160.0;
        approx(theta, step);
        approx(phi, 1.1);
        // Accumulation: the next move continues from the running angles.
        let (theta_2, _) = minimap_3d_drag_orbit(Some(3), 180, 100).expect("orbit");
        approx(theta_2, step * 2.0);
        // A different surface never steals the drag.
        assert!(minimap_3d_drag_orbit(Some(4), 999, 999).is_none());
        minimap_3d_drag_end();
        assert!(!minimap_3d_is_dragging());
        assert!(minimap_3d_drag_orbit(Some(3), 200, 100).is_none());
    }

    #[test]
    fn minimap_3d_renders_the_vue_dom_contract() {
        let html = Minimap3D(Minimap3DProps {
            zoom_percent: 115.0,
            collapsible: true,
            ..Default::default()
        })
        .render_to_html();

        // The card and its bare canvas shell (no host slot given).
        assert!(
            html.contains(r#"class="hk-minimap hk-minimap3d""#),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-minimap3d-canvas""#),
            "the canvas shell is Vue's own node: {html}"
        );
        assert!(html.contains(r#"width="160""#), "{html}");
        assert!(html.contains(r#"height="110""#), "{html}");
        assert!(!html.contains("data-dragging="), "{html}");

        // Vue's bar order with an unconditional reset and the percent label.
        let out = html.find(r#"aria-label="Zoom out""#).expect("zoom out");
        let label = html.find(r#"class="hk-mm-zoom-label""#).expect("label");
        let into = html.find(r#"aria-label="Zoom in""#).expect("zoom in");
        let reset = html.find(r#"aria-label="Reset view""#).expect("reset");
        let collapse = html.find(r#"aria-label="Hide minimap""#).expect("collapse");
        assert!(
            out < label && label < into && into < reset && reset < collapse,
            "Vue's order is out → label → in → reset → collapse: {html}"
        );
        assert!(html.contains(">115%<"), "{html}");
        assert!(html.contains(r#"aria-haspopup="dialog""#), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        assert!(html.contains(r#"title="Zoom level""#), "{html}");
        // Closed pop ⇒ no slider and no captions.
        assert!(!html.contains("hk-mm-zoom-pop"), "{html}");
    }

    #[test]
    fn minimap_3d_renders_the_host_canvas_slot_and_the_slider_pop() {
        let host_canvas = rsx! {
            canvas { class: "host-gl", width: 160u32, height: 110u32 }
        };
        let html = Minimap3D(Minimap3DProps {
            canvas: Some(host_canvas),
            slider_open: true,
            ..Default::default()
        })
        .render_to_html();

        // The injected canvas REPLACES Vue's shell (the host owns its GL
        // surface) — the card is still the dock the board expects.
        assert!(html.contains(r#"class="host-gl""#), "{html}");
        assert!(!html.contains("hk-minimap3d-canvas"), "{html}");

        // The pop: mirrored slider between the 3D ladder's bounds.
        assert!(html.contains(r#"class="hk-mm-zoom-pop""#), "{html}");
        assert!(html.contains(r#"class="hk-slider""#), "{html}");
        assert!(html.contains(r#"data-size="sm""#), "{html}");
        assert!(html.contains(r#"aria-valuemin="50""#), "{html}");
        assert!(html.contains(r#"aria-valuemax="250""#), "{html}");
        assert!(html.contains(r#"aria-expanded="true""#), "{html}");
        assert!(html.contains(">50%<") && html.contains(">250%<"), "{html}");
    }

    #[test]
    fn minimap_3d_renders_the_collapsed_affordance() {
        let html = Minimap3D(Minimap3DProps {
            collapsed: true,
            collapsible: true,
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains(r#"class="hk-minimap hk-minimap3d hk-minimap--collapsed""#),
            "{html}"
        );
        assert!(html.contains(r#"type="button""#), "{html}");
        assert!(html.contains(r#"aria-label="Show minimap""#), "{html}");
        assert!(html.contains("lucide-map"), "{html}");
        // Folded: no canvas, no bar.
        assert!(!html.contains("hk-minimap3d-canvas"), "{html}");
        assert!(!html.contains("hk-mm-zoom-bar"), "{html}");
    }

    #[test]
    fn minimap_3d_styles_come_from_its_own_sheet_and_the_shared_chrome() {
        let css = Minimap3DComponent::styles();
        assert!(
            css.contains(".hk-minimap3d-canvas"),
            "the 3D sheet carries the canvas rule: {css}"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored minimap-3d sheet"
        );
        // The chrome is the 2D card's sheet (Vue imports both), so a host
        // registering only this component gets an unstyled card — the
        // two-registration contract the header documents.
        assert!(!css.contains(".hk-mm-zoom-bar"), "{css}");
        let shared = MinimapComponent::styles();
        for class in [
            ".hk-minimap {",
            ".hk-mm-zoom-bar",
            ".hk-mm-zoom-btn",
            ".hk-mm-zoom-label",
            ".hk-mm-zoom-pop",
            ".hk-mm-collapse-btn",
            ".hk-minimap--collapsed",
        ] {
            assert!(
                shared.contains(class),
                "the shared minimap sheet must carry {class:?}"
            );
        }
        assert_eq!(Minimap3DComponent::name(), "minimap-3d");
    }
}
