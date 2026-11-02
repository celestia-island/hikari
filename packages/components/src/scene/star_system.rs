// hi-components/src/scene/star_system.rs
// StarSystem — mirror of the canonical Vue `HkStarSystem`: a reusable
// star / planet / satellite business scene.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkStarSystem.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the one class it defines (`.hk-star-system-chip`)
// is literal and identical in both forms.
//
// DOM contract (mirrors the Vue render output — the root is `HkBoard3D`'s, and
// the chips are the DOM counterpart of its CSS2D labels):
//
//   div.hk-board3d[style="background:transparent"]
//     canvas.hk-board3d-canvas
//     div[style="position:absolute;inset:0;pointer-events:none"]
//       div.hk-star-system-chip[.is-core].hk-board3d-label[data-label-id]
//              [style="transform:translate(-50%,-50%) translate(Xpx, Ypx)"]   ← per body
//              {label · status · detail}
//       div.hk-star-system-chip.is-core.hk-board3d-label[data-label-id="__star-system-core__"]
//                                                                           (no hub → core marker)
//     div.hk-board3d-overlay
//       <default slot>
//
// The component owns the deterministic LAYOUT, and that is what this mirror
// reproduces exactly: one hub sits at the origin as the system sun; several hubs
// take a golden-angle ring; planets are assigned to a star by a stable hash of
// their node id (layout only, never topology); a planet's orbit radius comes
// from its order within its own star's brood, so radii never collide within a
// system; periods are Kepler-flavoured (T ∝ r^1.5) and spins scale by tier.
// Every one of those steps is a pure function here, and the id hash is ported
// BYTE FOR BYTE from the Vue source — including the fact that its last multiply
// is a JS double multiply whose rounded product decides the low bits (see
// [`star_system_hash_id_to_unit`]).
//
// Behaviour deltas vs Vue (documented, one per deviation):
//   * NO three.js SCENE, NO MATERIALS, NO GPU RESOURCES. Vue builds a
//     `holographicFleetScene` (polyhedra, coronae, moons, orbit rings, lights)
//     on `HkBoard3D`'s engine and disposes every GPU resource itself. The WASI
//     mirror owns none of that: it composes the mirrored [`Board3D`] surface
//     (host canvas slot + overlay) and hands it the CAMERA the fleet would use,
//     plus the projected label chips. Everything a host needs to draw the bodies
//     itself is exported — [`star_system_build_spec`], the orbit clock
//     ([`star_system_body_position_at`]), the moon layout
//     ([`star_system_satellite_orbit`]) and the framing envelope
//     ([`star_system_fleet_enclosure`]).
//   * `makeLabel` / `makeCoreLabel` RETURN TEXT, NOT ELEMENTS. Vue hands the
//     board an `HTMLElement` it builds itself (and hosts may localize/enrich
//     it). A mirror cannot mint DOM nodes, so
//     [`StarSystemProps::label_formatter`] maps a body to the chip's TEXT, the
//     core chip's text is the `core_label` prop (Vue's `defaultCoreLabel` writes
//     the literal `"Core"`), and the chip's own chrome
//     (`.hk-star-system-chip[.is-core]`) is the sheet's, identical in both
//     forms.
//   * THE CLOCK IS A CONTROLLED PROP. Vue's scene runs on the board's rAF loop
//     and poses every body at `elapsed`; the mirror takes
//     [`StarSystemProps::t`] (seconds since scene start) so the projection, the
//     label anchors and the framing are all pure functions of `(bodies, t)`.
//   * THE CAMERA IS CONTROLLED TOO — Vue's `focusBody`/`frameFleet` fly it. Both
//     flights survive as pure pose functions over the mirrored board's pose type:
//     [`star_system_frame_pose`] (the enclosure fit, margin 1.1, keeping the
//     current viewing direction) and [`star_system_focus_pose`] (distance
//     `max(radius * 7, 4.5)` along the same direction). The `0.65 s`
//     ease-in-out flight and the follow camera's translate-both delta are
//     [`star_system_focus_flight_pose`] and [`star_system_apply_follow`].
//   * `selectBody` / `update:selectedId` KEEP THEIR SHAPE, ONE HOP LATER. Vue
//     selects on `objectClick` (a raycast) and on the chips' own listeners. The
//     mirror cannot raycast, so [`StarSystemProps::on_select`] is invoked by the
//     host's pick delegate and by the CHIPS (which are real DOM here); the
//     symmetric rule — an explicit click on the already-selected body still
//     re-centres, only a DESELECT is idempotent — is
//     [`star_system_selection_action`].
//   * THE VANISHED-SELECTION WATCHER BECOMES A PURE PREDICATE. Vue's `watch`
//     clears a selection whose body left the roster and emits `null`;
//     [`star_system_selected_still_exists`] is that test, so the host's own
//     reducer can apply it without a watcher.
//   * `Minimap`/`HkMinimap3D` is a host slot here (see `scene::board_3d`).
//
// Replaces nothing: the family had no 3D business scene before this mirror.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamp chains, index loops and inline tuple types keep the
// port auditable against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::manual_clamp)]
#![allow(clippy::manual_range_contains)]
#![allow(clippy::needless_range_loop)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
use std::collections::HashMap;

use crate::prelude::*;
use crate::scene::board_3d::{
    Board3D, Board3DProps, Board3dCameraPose, Board3dLabel, board3d_fit_distance,
    board3d_frame_pose,
};
use crate::styled::StyledComponent;

pub struct StarSystemComponent;

// ── the layout grammar (Vue: holographicFleetSpec constants) ─────────────

/// The golden angle: the gap wide enough that no two suns stack on the ring.
pub const STAR_SYSTEM_GOLDEN_ANGLE: f64 = 2.399_963_229_728_653;

/// Star spectral stops, hot → cool. Deliberately NO purple and NO green.
pub const STAR_SYSTEM_STAR_PALETTE: [&str; 8] = [
    "#9bb0ff", "#aabfff", "#c9d6ff", "#f8f9ff", "#fff2df", "#ffd9a0", "#ffb46c", "#ff9a55",
];

/// Planet stops: icy blues through sand and rust — likewise green/purple free.
pub const STAR_SYSTEM_PLANET_PALETTE: [&str; 8] = [
    "#7fb8dd", "#a8c6e0", "#d9c49a", "#c98a5a", "#b06a4f", "#8d9db6", "#e0d3b8", "#c1573b",
];

/// Satellites stay neutral hardware-grey.
pub const STAR_SYSTEM_SATELLITE_PALETTE: [&str; 2] = ["#b9c2cc", "#98a2ad"];

/// Visual moon cap per body — a hub with 60 stations must not bury the scene in
/// pebbles; the label chip still reports the true count.
pub const STAR_SYSTEM_SATELLITE_VISUAL_CAP: usize = 8;

/// First planet orbit radius and the per-brood spacing beyond it.
pub const STAR_SYSTEM_ORBIT_BASE: f64 = 9.0;
pub const STAR_SYSTEM_ORBIT_STEP: f64 = 6.0;

/// Moon geometry bounds the layouts rely on (the renderer builds the spheres and
/// the enclosure measures the same size).
pub const STAR_SYSTEM_MOON_RADIUS: f64 = 0.2;
pub const STAR_SYSTEM_MOON_START_GAP: f64 = 1.3;

/// Caps on the radius formulas (`0.85 + h * 0.45` / `2.4 + h * 0.8`).
pub const STAR_SYSTEM_MAX_BODY_RADIUS: f64 = 1.3;
pub const STAR_SYSTEM_MAX_STAR_RADIUS: f64 = 3.2;

/// Star self-rotation is stately; planets spin briskly.
pub const STAR_SYSTEM_STAR_SPIN_SEC: f64 = 80.0;
pub const STAR_SYSTEM_PLANET_SPIN_MIN_SEC: f64 = 16.0;
pub const STAR_SYSTEM_PLANET_SPIN_SPREAD_SEC: f64 = 20.0;

/// Holographic ring radii as multiples of the body's layout radius (a star
/// carries three restrained rings, a planet two).
pub const STAR_SYSTEM_STAR_RING_SCALES: [f64; 3] = [1.14, 1.28, 1.4];
pub const STAR_SYSTEM_PLANET_RING_SCALES: [f64; 2] = [1.22, 1.48];

/// Where a body's label rides, above its outermost ring.
pub const STAR_SYSTEM_STAR_LABEL_GAP: f64 = 0.65;
pub const STAR_SYSTEM_PLANET_LABEL_GAP: f64 = 0.55;

/// The registry-core marker (drawn when the fleet has no hub): its spec radius
/// and label gap.
pub const STAR_SYSTEM_CORE_RADIUS: f64 = 1.4;
pub const STAR_SYSTEM_CORE_LABEL_GAP: f64 = 0.55;

/// The registry-core object's id (Vue: `"__star-system-core__"`).
pub const STAR_SYSTEM_CORE_OBJECT_ID: &str = "__star-system-core__";

/// The core marker's chip text (Vue's `defaultCoreLabel`).
pub const STAR_SYSTEM_CORE_LABEL: &str = "Core";

/// The framing margin Vue multiplies the enclosure radius by.
pub const STAR_SYSTEM_FRAME_MARGIN: f64 = 1.1;

/// `frameFleet` keeps the current viewing direction; this is its fallback when
/// the eye sits on the pivot.
pub const STAR_SYSTEM_FRAME_FALLBACK_DIR: [f64; 3] = [0.45, -0.32, 0.83];

/// `frameFleet`'s default flight duration (ms) — Vue passes 600 for a reframe.
pub const STAR_SYSTEM_FRAME_MS: f64 = 600.0;

/// `focusBody`'s distance policy and flight duration.
pub const STAR_SYSTEM_FOCUS_DISTANCE_RATIO: f64 = 7.0;
pub const STAR_SYSTEM_FOCUS_MIN_DISTANCE: f64 = 4.5;
pub const STAR_SYSTEM_FOCUS_FALLBACK_DIR: [f64; 3] = [0.5, 0.4, 1.0];
pub const STAR_SYSTEM_FOCUS_DURATION_SEC: f64 = 0.65;

/// The camera policy `HkStarSystem` pins on its board: fov 45, a 3–420 distance
/// window, a transparent backdrop and the opening pose `[22, -19, 34]`.
pub const STAR_SYSTEM_FOV: f64 = 45.0;
pub const STAR_SYSTEM_MIN_DISTANCE: f64 = 3.0;
pub const STAR_SYSTEM_MAX_DISTANCE: f64 = 420.0;
pub const STAR_SYSTEM_INITIAL_POSITION: [f64; 3] = [22.0, -19.0, 34.0];
pub const STAR_SYSTEM_INITIAL_TARGET: [f64; 3] = [0.0, 0.0, 0.0];

/// The spacer between the parts of a chip's text (Vue: `.join(" · ")`).
pub const STAR_SYSTEM_CHIP_SEPARATOR: &str = " · ";

// ── the id hash (pure, and deliberately bit-exact) ───────────────────────

/// Vue's `hashIdToUnit`: an FNV-1a 32-bit hash of a string folded into
/// `[0, 1)`, so the same node id always lands on the same palette stop.
///
/// The port is bit-exact, INCLUDING the last step: the original multiplies the
/// SIGNED int32 view of the hash by `0x5bd1e995` and then applies `>>> 0`. The
/// exact product exceeds 2^53, so JavaScript rounds it as a double first — and
/// that ROUNDED product decides the low bits `>>> 0` keeps. Reproducing the hash
/// with exact integer arithmetic would therefore produce a DIFFERENT palette
/// stop than the Vue form for most ids, which is why the multiply below goes
/// through `f64` on purpose.
pub fn star_system_hash_id_to_unit(id: &str) -> f64 {
    let mut h: u32 = 0x811c_9dc5;
    for unit in id.encode_utf16() {
        h ^= u32::from(unit);
        let mixed = h
            .wrapping_shl(1)
            .wrapping_add(h.wrapping_shl(4))
            .wrapping_add(h.wrapping_shl(7))
            .wrapping_add(h.wrapping_shl(8))
            .wrapping_add(h.wrapping_shl(24));
        h = h.wrapping_add(mixed);
    }
    h ^= h >> 13;
    let signed = h as i32 as f64;
    let product = signed * 1_540_483_477.0; // 0x5bd1_e995
    h = product.rem_euclid(4_294_967_296.0) as u32;
    h ^= h >> 15;
    f64::from(h) / 4_294_967_296.0
}

/// Vue's `hexToRgb`: `#rrggbb` (the `#` optional) → linear rgb; anything else is
/// white.
pub fn star_system_hex_to_rgb(hex: &str) -> [f64; 3] {
    let trimmed = hex.trim();
    let body = trimmed.strip_prefix('#').unwrap_or(trimmed);
    if body.len() != 6 || !body.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return [1.0, 1.0, 1.0];
    }
    let value = u32::from_str_radix(body, 16).unwrap_or(0x00ff_ffff);
    [
        f64::from((value >> 16) & 255) / 255.0,
        f64::from((value >> 8) & 255) / 255.0,
        f64::from(value & 255) / 255.0,
    ]
}

/// Vue's `lerpPalette`: slide along an evenly spaced hex palette, `t = 0` → the
/// first stop, `t = 1` → the last. An empty palette is white, a single stop is
/// that stop, and a non-finite position clamps to the first stop instead of
/// indexing with NaN.
pub fn star_system_lerp_palette(palette: &[&str], t: f64) -> [f64; 3] {
    if palette.is_empty() {
        return [1.0, 1.0, 1.0];
    }
    if palette.len() == 1 {
        return star_system_hex_to_rgb(palette[0]);
    }
    let clamped = if t.is_finite() {
        t.max(0.0).min(1.0)
    } else {
        0.0
    };
    let x = clamped * (palette.len() - 1) as f64;
    let index = ((palette.len() - 2) as f64).min(x.floor()) as usize;
    let f = x - index as f64;
    let a = star_system_hex_to_rgb(palette[index]);
    let b = star_system_hex_to_rgb(palette[index + 1]);
    [
        a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f,
    ]
}

/// id → stable palette colour (Vue: `paletteColorForId`).
pub fn star_system_palette_color(id: &str, palette: &[&str]) -> [f64; 3] {
    star_system_lerp_palette(palette, star_system_hash_id_to_unit(id))
}

/// Vue's `rgbCss`: the minimap marker colour string.
pub fn star_system_rgb_css(rgb: [f64; 3]) -> String {
    format!(
        "rgb({}, {}, {})",
        (rgb[0] * 255.0).round() as i64,
        (rgb[1] * 255.0).round() as i64,
        (rgb[2] * 255.0).round() as i64
    )
}

/// The id ordering Vue sorts a roster by (`a.node_id < b.node_id`). Compared by
/// UTF-16 CODE UNITS, which is what JavaScript's string comparison does — a
/// byte-wise `str` comparison would order non-ASCII ids differently and move the
/// brood indices with them.
pub fn star_system_id_order(a: &str, b: &str) -> std::cmp::Ordering {
    a.encode_utf16().cmp(b.encode_utf16())
}

// ── the spec (pure) ──────────────────────────────────────────────────────

/// Which grammar slot a body occupies.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StarSystemRole {
    /// A hub — the system sun.
    Star,
    /// A node — a planet circling a star.
    #[default]
    Planet,
}

impl StarSystemRole {
    /// The role name Vue's input contract carries.
    pub fn as_str(self) -> &'static str {
        match self {
            StarSystemRole::Star => "star",
            StarSystemRole::Planet => "planet",
        }
    }

    /// The outermost holographic ring scale of this role.
    pub fn outer_ring_scale(self) -> f64 {
        match self {
            StarSystemRole::Star => {
                STAR_SYSTEM_STAR_RING_SCALES[STAR_SYSTEM_STAR_RING_SCALES.len() - 1]
            }
            StarSystemRole::Planet => {
                STAR_SYSTEM_PLANET_RING_SCALES[STAR_SYSTEM_PLANET_RING_SCALES.len() - 1]
            }
        }
    }

    /// The label's gap above the outermost ring.
    pub fn label_gap(self) -> f64 {
        match self {
            StarSystemRole::Star => STAR_SYSTEM_STAR_LABEL_GAP,
            StarSystemRole::Planet => STAR_SYSTEM_PLANET_LABEL_GAP,
        }
    }
}

/// Public, renderer-agnostic node input. Every field is caller-owned data: the
/// component never invents traffic, alerts or liveness the host did not supply.
#[derive(Clone, PartialEq, Debug)]
pub struct StarSystemBodyInput {
    pub id: String,
    pub label: String,
    pub role: StarSystemRole,
    /// Localized current state, for example "Online" / "Offline".
    pub status: String,
    pub online: bool,
    /// Real passive-endpoint count — rendered as the body's moon system.
    pub endpoint_count: u32,
    /// Optional real, already-formatted summary.
    pub detail: String,
}

impl Default for StarSystemBodyInput {
    fn default() -> Self {
        Self {
            id: String::new(),
            label: String::new(),
            role: StarSystemRole::default(),
            status: String::new(),
            online: true,
            endpoint_count: 0,
            detail: String::new(),
        }
    }
}

/// One body resolved onto the layout grammar (Vue: `FleetBodySpec`).
#[derive(Clone, PartialEq, Debug)]
pub struct StarSystemBody {
    pub id: String,
    /// Real display data carried onto the HUD band and the chip.
    pub label: String,
    pub status: String,
    pub online: bool,
    pub detail: String,
    pub role: StarSystemRole,
    pub color: [f64; 3],
    /// Body radius in scene units.
    pub radius: f64,
    /// The point this body orbits (its own position for a star).
    pub orbit_center: [f64; 3],
    /// 0 for a star (it holds its place), > 0 for a planet.
    pub orbit_radius: f64,
    pub orbit_period_sec: f64,
    pub orbit_phase: f64,
    /// Orbit-plane tilt (radians) — keeps stacked systems readable.
    pub orbit_tilt: f64,
    pub spin_period_sec: f64,
    /// Visible moons (capped) and the true endpoint count.
    pub satellites: usize,
    pub satellite_total: u32,
}

/// The whole deterministic sky.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct StarSystemSpec {
    pub stars: Vec<StarSystemBody>,
    pub planets: Vec<StarSystemBody>,
    /// True when no hub exists and planets circle the origin marker instead.
    pub has_registry_core: bool,
}

impl StarSystemSpec {
    /// Every body, stars first.
    pub fn bodies(&self) -> impl Iterator<Item = &StarSystemBody> {
        self.stars.iter().chain(self.planets.iter())
    }

    /// Whether the spec draws nothing at all.
    pub fn is_empty(&self) -> bool {
        self.stars.is_empty() && self.planets.is_empty()
    }
}

/// A body's satellite orbit (index `j` of `n`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct StarSystemSatellite {
    pub radius: f64,
    pub period_sec: f64,
    pub phase: f64,
    pub tilt: f64,
}

/// The moon band: `MOON_BAND` derived from `ORBIT_STEP` and the largest real
/// body radius, so a gateway's whole moon system plus the next planet's sphere
/// still fit between two consecutive brood orbits. (Vue folds the same
/// expression into a module-level constant.)
pub fn star_system_moon_band() -> f64 {
    let budget = STAR_SYSTEM_ORBIT_STEP
        - STAR_SYSTEM_MOON_START_GAP
        - STAR_SYSTEM_MOON_RADIUS
        - 2.0 * STAR_SYSTEM_MAX_BODY_RADIUS;
    0.04_f64.max(budget / (STAR_SYSTEM_SATELLITE_VISUAL_CAP - 1) as f64)
}

/// Vue's `satelliteOrbit`.
pub fn star_system_satellite_orbit(parent_radius: f64, j: usize) -> StarSystemSatellite {
    StarSystemSatellite {
        radius: parent_radius + STAR_SYSTEM_MOON_START_GAP + j as f64 * star_system_moon_band(),
        period_sec: 5.0 + j as f64 * 1.7,
        phase: (j as f64 * STAR_SYSTEM_GOLDEN_ANGLE) % std::f64::consts::TAU,
        tilt: (j % 3) as f64 * 0.35,
    }
}

/// Vue's `hologramOuterRadius`: the outer decorative extent used by labels and
/// framing.
pub fn star_system_hologram_outer_radius(radius: f64, role: StarSystemRole) -> f64 {
    radius * role.outer_ring_scale()
}

/// Vue's `bodyReach`: how far the polyhedron, the holographic rings and the moon
/// system reach.
pub fn star_system_body_reach(body: &StarSystemBody) -> f64 {
    let visual_reach = star_system_hologram_outer_radius(body.radius, body.role);
    if body.satellites == 0 {
        return visual_reach;
    }
    let outer = star_system_satellite_orbit(body.radius, body.satellites - 1);
    visual_reach.max(outer.radius + STAR_SYSTEM_MOON_RADIUS)
}

/// The star carousel's ring radius. The base keeps the suns comfortably apart,
/// but a star's brood can outgrow it (planets march outward by `ORBIT_STEP`), so
/// the ring also has to satisfy the clearance the widest brood needs.
pub fn star_system_star_ring_radius(count: usize, widest_brood_outer: f64) -> f64 {
    let base = 14.0 + count as f64 * 4.0;
    if count < 2 {
        return 0.0;
    }
    let min_separation = 2.0 * (widest_brood_outer + STAR_SYSTEM_MAX_BODY_RADIUS)
        + 2.0 * STAR_SYSTEM_MAX_STAR_RADIUS
        + 2.0;
    let needed = min_separation / (2.0 * (std::f64::consts::PI / count as f64).sin());
    base.max(needed)
}

/// Vue's `buildFleetSceneSpec`: the deterministic solar system behind the roster.
pub fn star_system_build_spec(bodies: &[StarSystemBodyInput]) -> StarSystemSpec {
    let mut hub_rows: Vec<&StarSystemBodyInput> = bodies
        .iter()
        .filter(|body| body.role == StarSystemRole::Star)
        .collect();
    hub_rows.sort_by(|a, b| star_system_id_order(&a.id, &b.id));
    let mut node_rows: Vec<&StarSystemBodyInput> = bodies
        .iter()
        .filter(|body| body.role == StarSystemRole::Planet)
        .collect();
    node_rows.sort_by(|a, b| star_system_id_order(&a.id, &b.id));

    // ── brood sizes (needed BEFORE the ring: it must clear the widest brood) ──
    let star_index_of = |node_id: &str| -> Option<usize> {
        if hub_rows.is_empty() {
            return None;
        }
        let count = hub_rows.len();
        let scaled = (star_system_hash_id_to_unit(node_id) * count as f64).floor() as usize;
        Some(scaled % count)
    };
    let mut brood_sizes: Vec<usize> = vec![0; hub_rows.len()];
    for node in &node_rows {
        if let Some(index) = star_index_of(&node.id) {
            brood_sizes[index] += 1;
        }
    }
    let widest_brood_outer = if brood_sizes.is_empty() {
        0.0
    } else {
        let widest = brood_sizes.iter().copied().max().unwrap_or(0);
        STAR_SYSTEM_ORBIT_BASE + widest.saturating_sub(1) as f64 * STAR_SYSTEM_ORBIT_STEP
    };

    // ── stars ────────────────────────────────────────────────────────────────
    let ring = star_system_star_ring_radius(hub_rows.len(), widest_brood_outer);
    let stars: Vec<StarSystemBody> = hub_rows
        .iter()
        .enumerate()
        .map(|(index, row)| {
            let h = star_system_hash_id_to_unit(&row.id);
            let center = if hub_rows.len() == 1 {
                // A single hub IS the system sun — dead centre.
                [0.0, 0.0, 0.0]
            } else {
                // NO per-star jitter on the angle: the golden angle's whole point
                // is a gap wide enough to keep every pair apart. The hash still
                // drives altitude and colour.
                let angle = index as f64 * STAR_SYSTEM_GOLDEN_ANGLE;
                [angle.cos() * ring, (h - 0.5) * 4.0, angle.sin() * ring]
            };
            StarSystemBody {
                id: row.id.clone(),
                label: row.label.clone(),
                status: row.status.clone(),
                online: row.online,
                detail: row.detail.clone(),
                role: StarSystemRole::Star,
                color: star_system_lerp_palette(&STAR_SYSTEM_STAR_PALETTE, h),
                radius: 2.4 + h * 0.8,
                orbit_center: center,
                orbit_radius: 0.0,
                orbit_period_sec: 0.0,
                orbit_phase: 0.0,
                orbit_tilt: 0.0,
                spin_period_sec: STAR_SYSTEM_STAR_SPIN_SEC,
                satellites: (row.endpoint_count as usize).min(STAR_SYSTEM_SATELLITE_VISUAL_CAP),
                satellite_total: row.endpoint_count,
            }
        })
        .collect();

    // ── planets ──────────────────────────────────────────────────────────────
    // Stable star assignment (hash mod star count); with no stars every planet
    // circles the registry core at the origin.
    let mut brood_index: HashMap<String, usize> = HashMap::new();
    let planets: Vec<StarSystemBody> = node_rows
        .iter()
        .map(|row| {
            let h = star_system_hash_id_to_unit(&row.id);
            let host_star = if stars.is_empty() {
                None
            } else {
                star_index_of(&row.id)
            };
            let center = host_star
                .map(|index| stars[index].orbit_center)
                .unwrap_or([0.0, 0.0, 0.0]);
            let brood_key = host_star
                .map(|index| stars[index].id.clone())
                .unwrap_or_else(|| "core".to_string());
            let k = brood_index.get(&brood_key).copied().unwrap_or(0);
            brood_index.insert(brood_key, k + 1);
            let orbit_radius = STAR_SYSTEM_ORBIT_BASE + k as f64 * STAR_SYSTEM_ORBIT_STEP;
            StarSystemBody {
                id: row.id.clone(),
                label: row.label.clone(),
                status: row.status.clone(),
                online: row.online,
                detail: row.detail.clone(),
                role: StarSystemRole::Planet,
                color: star_system_lerp_palette(&STAR_SYSTEM_PLANET_PALETTE, h),
                radius: 0.85 + h * 0.45,
                orbit_center: center,
                orbit_radius,
                // Kepler-flavoured: outer rings sweep slower (T ∝ r^1.5).
                orbit_period_sec: 22.0 * (orbit_radius / STAR_SYSTEM_ORBIT_BASE).powf(1.5),
                orbit_phase: h * std::f64::consts::TAU,
                orbit_tilt: (h - 0.5) * 0.24,
                spin_period_sec: STAR_SYSTEM_PLANET_SPIN_MIN_SEC
                    + h * STAR_SYSTEM_PLANET_SPIN_SPREAD_SEC,
                satellites: (row.endpoint_count as usize).min(STAR_SYSTEM_SATELLITE_VISUAL_CAP),
                satellite_total: row.endpoint_count,
            }
        })
        .collect();

    StarSystemSpec {
        has_registry_core: stars.is_empty() && !planets.is_empty(),
        stars,
        planets,
    }
}

/// Vue's `bodyPositionAt`: the world position of a body at `t` seconds since
/// scene start. A star holds its place; a planet sweeps its tilted orbit.
///
/// A body whose orbit radius is positive but whose period is zero or non-finite
/// holds its place too, instead of dividing by zero: Vue lets `t / 0` reach
/// `Math.cos` and hands NaN positions to the CSS2D overlay and the camera, and a
/// mirror that already guards every other pose entry point has no reason to
/// reproduce that one.
pub fn star_system_body_position_at(body: &StarSystemBody, t: f64) -> [f64; 3] {
    if body.orbit_radius <= 0.0
        || !body.orbit_period_sec.is_finite()
        || body.orbit_period_sec <= 0.0
        || !t.is_finite()
    {
        return body.orbit_center;
    }
    let angle = body.orbit_phase + (t / body.orbit_period_sec) * std::f64::consts::TAU;
    let x = angle.cos() * body.orbit_radius;
    let z = angle.sin() * body.orbit_radius;
    // The tilt rotates the flat orbit around the X axis.
    let y = -z * body.orbit_tilt.sin();
    let z_tilted = z * body.orbit_tilt.cos();
    [
        body.orbit_center[0] + x,
        body.orbit_center[1] + y,
        body.orbit_center[2] + z_tilted,
    ]
}

/// The fleet's framing sphere (Vue: `fleetEnclosure`): the CENTRE is the
/// volume-weighted centroid of the drawn bodies, and the RADIUS is the smallest
/// one that still holds the whole PICTURE — a planet is not a point, it is a body
/// SWEEPING its orbit, so its term is `|center - orbitCentre| + orbitRadius +
/// reach`.
pub fn star_system_fleet_enclosure(spec: &StarSystemSpec) -> Option<StarSystemEnclosure> {
    let bodies: Vec<&StarSystemBody> = spec.bodies().collect();
    if bodies.is_empty() {
        return None;
    }
    let volumes: Vec<f64> = bodies.iter().map(|body| body.radius.powi(3)).collect();
    let total: f64 = volumes.iter().sum();
    let center = if total > 0.0 && total.is_finite() {
        let mut center = [0.0, 0.0, 0.0];
        for (body, volume) in bodies.iter().zip(volumes.iter()) {
            let weight = volume / total;
            for axis in 0..3 {
                center[axis] += body.orbit_center[axis] * weight;
            }
        }
        center
    } else {
        // A hand-built spec whose radii sum to nothing: weight them evenly
        // instead of dividing by zero.
        let weight = 1.0 / bodies.len() as f64;
        let mut center = [0.0, 0.0, 0.0];
        for body in &bodies {
            for axis in 0..3 {
                center[axis] += body.orbit_center[axis] * weight;
            }
        }
        center
    };
    let mut radius: f64 = 0.0;
    for body in &bodies {
        let sweep = star_system_distance(center, body.orbit_center) + body.orbit_radius;
        radius = radius.max(sweep + star_system_body_reach(body));
    }
    Some(StarSystemEnclosure { center, radius })
}

/// The fleet's framing sphere.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct StarSystemEnclosure {
    pub center: [f64; 3],
    pub radius: f64,
}

fn star_system_distance(a: [f64; 3], b: [f64; 3]) -> f64 {
    (a[0] - b[0]).hypot(a[1] - b[1]).hypot(a[2] - b[2])
}

// ── the camera (pure) ────────────────────────────────────────────────────

/// Vue's `frameFleet`: fit the enclosure, KEEPING the current viewing direction
/// (a fit reframes, it never whips the user around to a canonical side).
pub fn star_system_frame_pose(
    pose: Board3dCameraPose,
    enclosure: StarSystemEnclosure,
    aspect: f64,
) -> Board3dCameraPose {
    board3d_frame_pose(
        pose,
        enclosure.center,
        enclosure.radius * STAR_SYSTEM_FRAME_MARGIN,
        aspect,
        1.0,
        STAR_SYSTEM_FRAME_FALLBACK_DIR,
    )
}

/// The distance `frameFleet` parks the eye at, before the flight.
pub fn star_system_frame_distance(enclosure: StarSystemEnclosure, fov: f64, aspect: f64) -> f64 {
    board3d_fit_distance(enclosure.radius * STAR_SYSTEM_FRAME_MARGIN, fov, aspect)
}

/// `frameFleet` widens the orbit ceiling so a big fleet's fit is not pulled
/// straight back in by OrbitControls — and gives the slack back on a later,
/// smaller fleet.
pub fn star_system_frame_max_distance(base_max_distance: f64, dist: f64) -> f64 {
    base_max_distance.max(dist * 1.25)
}

/// `frameFleet` also pushes the far plane out: a huge single-brood fleet fits
/// beyond the camera's fixed 420 units and would render nothing at all.
pub fn star_system_frame_far_plane(far: f64, dist: f64) -> f64 {
    if far < dist * 4.0 { dist * 4.0 } else { far }
}

/// `focusBody`'s distance policy: close enough that one body fills the view.
pub fn star_system_focus_distance(radius: f64) -> f64 {
    (radius * STAR_SYSTEM_FOCUS_DISTANCE_RATIO).max(STAR_SYSTEM_FOCUS_MIN_DISTANCE)
}

/// `focusBody`'s direction: the current view vector, normalised, against a fixed
/// fallback when the eye sits on the pivot.
pub fn star_system_focus_direction(pose: Board3dCameraPose) -> [f64; 3] {
    let delta = [
        pose.position[0] - pose.target[0],
        pose.position[1] - pose.target[1],
        pose.position[2] - pose.target[2],
    ];
    let length = (delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]).sqrt();
    if length <= 1e-12 {
        let fallback = STAR_SYSTEM_FOCUS_FALLBACK_DIR;
        let flen =
            (fallback[0] * fallback[0] + fallback[1] * fallback[1] + fallback[2] * fallback[2])
                .sqrt();
        return [fallback[0] / flen, fallback[1] / flen, fallback[2] / flen];
    }
    [delta[0] / length, delta[1] / length, delta[2] / length]
}

/// `focusBody`'s destination pose: the body's pose THIS frame plus the frozen
/// direction at the focus distance.
pub fn star_system_focus_pose(
    pose: Board3dCameraPose,
    body_position: [f64; 3],
    body_radius: f64,
) -> Board3dCameraPose {
    let dir = star_system_focus_direction(pose);
    let dist = star_system_focus_distance(body_radius);
    Board3dCameraPose {
        position: [
            body_position[0] + dir[0] * dist,
            body_position[1] + dir[1] * dist,
            body_position[2] + dir[2] * dist,
        ],
        target: body_position,
        ..pose
    }
}

/// One frame of the focus flight: `lerpVectors(from, dest, ease(k))` where the
/// destination is recomputed from the body's CURRENT pose (a moving target is
/// centred at rest).
pub fn star_system_focus_flight_pose(
    from: Board3dCameraPose,
    dir: [f64; 3],
    dist: f64,
    target: [f64; 3],
    progress: f64,
) -> Board3dCameraPose {
    let t = if progress.is_finite() {
        progress.max(0.0).min(1.0)
    } else {
        1.0
    };
    let eased = if t < 0.5 {
        4.0 * t * t * t
    } else {
        1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
    };
    let dest = [
        target[0] + dir[0] * dist,
        target[1] + dir[1] * dist,
        target[2] + dir[2] * dist,
    ];
    Board3dCameraPose {
        position: [
            from.position[0] + (dest[0] - from.position[0]) * eased,
            from.position[1] + (dest[1] - from.position[1]) * eased,
            from.position[2] + (dest[2] - from.position[2]) * eased,
        ],
        target: [
            from.target[0] + (target[0] - from.target[0]) * eased,
            from.target[1] + (target[1] - from.target[1]) * eased,
            from.target[2] + (target[2] - from.target[2]) * eased,
        ],
        ..from
    }
}

/// The follow camera's translation: the followed body's motion since the last
/// frame. Both the eye and the orbit pivot move by the SAME delta, so the view
/// vector the user dialled in is preserved exactly. `None` when the delta is not
/// finite — a non-finite pose must never poison the camera.
pub fn star_system_follow_delta(previous: [f64; 3], next: [f64; 3]) -> Option<[f64; 3]> {
    let delta = [
        next[0] - previous[0],
        next[1] - previous[1],
        next[2] - previous[2],
    ];
    if delta.iter().all(|value| value.is_finite()) {
        Some(delta)
    } else {
        None
    }
}

/// Apply a follow delta to both the eye and the pivot.
pub fn star_system_apply_follow(pose: Board3dCameraPose, delta: [f64; 3]) -> Board3dCameraPose {
    Board3dCameraPose {
        position: [
            pose.position[0] + delta[0],
            pose.position[1] + delta[1],
            pose.position[2] + delta[2],
        ],
        target: [
            pose.target[0] + delta[0],
            pose.target[1] + delta[1],
            pose.target[2] + delta[2],
        ],
        ..pose
    }
}

// ── chips (pure) ─────────────────────────────────────────────────────────

/// Vue's `defaultLabel` text: `[label, status, detail]`, whitespace-only parts
/// dropped, joined with `" · "`.
pub fn star_system_chip_text(body: &StarSystemBody) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for part in [
        body.label.as_str(),
        body.status.as_str(),
        body.detail.as_str(),
    ] {
        if !part.trim().is_empty() {
            parts.push(part);
        }
    }
    parts.join(STAR_SYSTEM_CHIP_SEPARATOR)
}

/// The chip's class string. Vue writes `hk-star-system-chip` (+ `is-core` for the
/// registry marker) and the board then appends `hk-board3d-label`.
pub fn star_system_chip_classes(is_core: bool) -> String {
    if is_core {
        "hk-star-system-chip is-core".to_string()
    } else {
        "hk-star-system-chip".to_string()
    }
}

/// Where a body's chip rides: its position at `t`, lifted above its outermost
/// ring (Vue's `labelOffset`).
pub fn star_system_label_anchor(body: &StarSystemBody, t: f64) -> [f64; 3] {
    let position = star_system_body_position_at(body, t);
    let lift = star_system_hologram_outer_radius(body.radius, body.role) + body.role.label_gap();
    [position[0], position[1] + lift, position[2]]
}

/// The registry-core marker's chip anchor (the core sits at the origin).
pub fn star_system_core_anchor() -> [f64; 3] {
    let lift = star_system_hologram_outer_radius(STAR_SYSTEM_CORE_RADIUS, StarSystemRole::Star)
        + STAR_SYSTEM_CORE_LABEL_GAP;
    [0.0, lift, 0.0]
}

/// Every chip the fleet draws, ready for the mirrored board's `labels`: the
/// registry core first (Vue registers it before the bodies), then the stars, then
/// the planets.
pub fn star_system_labels(
    spec: &StarSystemSpec,
    t: f64,
    core_label: &str,
    formatter: Option<&Callback<StarSystemBody, String>>,
) -> Vec<Board3dLabel> {
    let mut labels: Vec<Board3dLabel> = Vec::new();
    if spec.has_registry_core {
        labels.push(Board3dLabel {
            id: STAR_SYSTEM_CORE_OBJECT_ID.to_string(),
            text: core_label.to_string(),
            anchor: star_system_core_anchor(),
            offset: [0.0, 0.0, 0.0],
            class: star_system_chip_classes(true),
        });
    }
    for body in spec.bodies() {
        let text = match formatter {
            Some(formatter) => formatter.call(body.clone()),
            None => star_system_chip_text(body),
        };
        labels.push(Board3dLabel {
            id: body.id.clone(),
            text,
            anchor: star_system_label_anchor(body, t),
            offset: [0.0, 0.0, 0.0],
            class: star_system_chip_classes(false),
        });
    }
    labels
}

// ── the selection protocol (pure) ────────────────────────────────────────

/// Vue's `selectBody`: an explicit click on the ALREADY selected body still
/// re-centres it; only a deselect is idempotent.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum StarSystemSelectionAction {
    /// Nothing to do (deselecting what was already deselected).
    Idle,
    /// Emit the new selection and re-centre on the body.
    Focus,
    /// Clear the selection and reframe the fleet.
    Reframe,
}

/// Which action a selection request maps to.
pub fn star_system_selection_action(
    current: Option<&str>,
    next: Option<&str>,
) -> StarSystemSelectionAction {
    match next {
        Some(_id) => StarSystemSelectionAction::Focus,
        None => {
            if current.is_some() {
                StarSystemSelectionAction::Reframe
            } else {
                StarSystemSelectionAction::Idle
            }
        }
    }
}

/// Vue's roster watcher: a selection whose body left the roster is cleared (and
/// `null` is emitted). `true` = still there, so the selection survives.
pub fn star_system_selected_still_exists(
    bodies: &[StarSystemBodyInput],
    selected: Option<&str>,
) -> bool {
    match selected {
        None => true,
        Some(id) => bodies.iter().any(|body| body.id == id),
    }
}

// ── class names (the DOM contract, pinned by the tests) ──────────────────

/// The board's own root class the star system inherits (it renders THROUGH the
/// mirrored `Board3D`, so there is no second wrapper).
pub fn star_system_root_classes() -> &'static str {
    "hk-board3d"
}

// ── props ────────────────────────────────────────────────────────────────

#[define_props]
pub struct StarSystemProps {
    /// The host's roster — every field is caller-owned data.
    pub bodies: Vec<StarSystemBodyInput>,

    /// Controlled selection. A remount restores the cursor without an
    /// unsolicited camera flight; an explicit change focuses the body.
    pub selected_id: Option<String>,

    /// Seconds since scene start (Vue: the board's `elapsed`). Bodies are posed
    /// at this instant.
    #[default(0.0)]
    pub t: f64,

    /// The registry core chip's text (Vue's `defaultCoreLabel` writes "Core").
    #[default(STAR_SYSTEM_CORE_LABEL.to_string())]
    pub core_label: String,

    /// The mirror of `makeLabel`: a body → the chip's TEXT (Vue returns an
    /// element). `None` uses Vue's `label · status · detail` default.
    pub label_formatter: Option<Callback<StarSystemBody, String>>,

    /// The controlled camera eye (Vue passes `initialPosition={[22, -19, 34]}`).
    #[default(STAR_SYSTEM_INITIAL_POSITION)]
    pub camera_position: [f64; 3],

    /// The controlled orbit pivot.
    #[default(STAR_SYSTEM_INITIAL_TARGET)]
    pub camera_target: [f64; 3],

    /// Canvas WIDTH in CSS px (Vue measures the board; the mirror cannot).
    #[default(0.0)]
    pub width: f64,

    /// Canvas HEIGHT in CSS px (see `width`).
    #[default(0.0)]
    pub height: f64,

    /// The canvas element's DOM id (the host canvas slot).
    pub canvas_id: Option<String>,

    /// The host has attached its renderer (gates the board's minimap dock).
    #[default(false)]
    pub ready: bool,

    /// Dock the host's minimap (Vue mounts `HkMinimap3D`; only docked when a slot
    /// is actually supplied).
    #[default(true)]
    pub minimap: bool,

    /// The gesture registry key passed through to the board.
    #[default]
    pub instance_key: String,

    /// Page chrome laid over the sky (Vue: `slots.default`).
    pub children: Element,

    /// The host's minimap.
    pub minimap_slot: Element,

    /// The board's no-WebGL fallback (Vue: `slots.fallback`).
    pub fallback: Option<Element>,

    /// A body (or the core) asked to be selected; `None` clears the selection
    /// (Vue: `update:selectedId`).
    pub on_select: Option<EventHandler<Option<String>>>,
}

/// The chips for a roster at `t` — the composition the render performs, exposed
/// so a host can project them itself.
pub fn star_system_resolved_labels(props: &StarSystemProps) -> Vec<Board3dLabel> {
    let spec = star_system_build_spec(&props.bodies);
    star_system_labels(
        &spec,
        props.t,
        &props.core_label,
        props.label_formatter.as_ref(),
    )
}

/// The camera policy `HkStarSystem` pins on its board.
pub fn star_system_board_props(props: &StarSystemProps) -> Board3DProps {
    let minimap = props.minimap && !star_system_slot_is_empty(&props.minimap_slot);
    let on_label_click = props
        .on_select
        .clone()
        .map(|handler| EventHandler::new(move |id: String| handler.call(Some(id))));
    Board3DProps {
        fov: STAR_SYSTEM_FOV,
        camera_position: props.camera_position,
        camera_target: props.camera_target,
        min_distance: STAR_SYSTEM_MIN_DISTANCE,
        max_distance: STAR_SYSTEM_MAX_DISTANCE,
        transparent_background: true,
        width: props.width,
        height: props.height,
        canvas_id: props.canvas_id.clone(),
        labels: star_system_resolved_labels(props),
        selection_id: props.selected_id.clone(),
        minimap,
        ready: props.ready,
        instance_key: props.instance_key.clone(),
        minimap_slot: props.minimap_slot.clone(),
        children: props.children.clone(),
        fallback: props.fallback.clone(),
        on_label_click,
        ..Default::default()
    }
}

/// True when a slot carries nothing to render (Vue tests `slots.x`).
fn star_system_slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(star_system_slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

// ── render assembly (no geometry below this line) ────────────────────────

#[component]
pub fn StarSystem(props: StarSystemProps) -> Element {
    // Vue's `HkStarSystem` renders `HkBoard3D` and nothing else: the root, the
    // canvas slot, the label layer and the overlay are all the board's.
    Board3D(star_system_board_props(&props))
}

impl StyledComponent for StarSystemComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkStarSystem.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "star-system"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    fn body(id: &str, role: StarSystemRole, endpoints: u32) -> StarSystemBodyInput {
        StarSystemBodyInput {
            id: id.to_string(),
            label: id.to_string(),
            role,
            status: "Online".to_string(),
            online: true,
            endpoint_count: endpoints,
            detail: String::new(),
        }
    }

    fn star(id: &str) -> StarSystemBodyInput {
        body(id, StarSystemRole::Star, 0)
    }

    fn planet(id: &str) -> StarSystemBodyInput {
        body(id, StarSystemRole::Planet, 0)
    }

    fn pose(position: [f64; 3], target: [f64; 3]) -> Board3dCameraPose {
        Board3dCameraPose {
            position,
            target,
            ..Default::default()
        }
    }

    // ── props defaults ────────────────────────────────────────────────

    #[test]
    fn star_system_defaults_match_the_vue_props() {
        let props = StarSystemProps::default();
        assert!(props.bodies.is_empty());
        assert_eq!(props.selected_id, None);
        assert_eq!(props.t, 0.0);
        assert_eq!(props.core_label, "Core");
        assert_eq!(props.label_formatter, None);
        assert_eq!(props.camera_position, [22.0, -19.0, 34.0]);
        assert_eq!(props.camera_target, [0.0, 0.0, 0.0]);
        assert_eq!(props.width, 0.0);
        assert_eq!(props.height, 0.0);
        assert_eq!(props.canvas_id, None);
        assert!(!props.ready);
        assert!(props.minimap);
        assert_eq!(props.instance_key, "");
        assert!(props.fallback.is_none());
        assert!(props.on_select.is_none());
        // The board policy Vue pins: fov 45, 3–420, a transparent backdrop.
        let board = star_system_board_props(&props);
        assert_eq!(board.fov, 45.0);
        assert_eq!(board.min_distance, 3.0);
        assert_eq!(board.max_distance, 420.0);
        assert!(board.transparent_background);
        assert_eq!(board.camera_position, [22.0, -19.0, 34.0]);
        // No minimap slot → no dock (see the header).
        assert!(!board.minimap);
    }

    // ── class names ───────────────────────────────────────────────────

    #[test]
    fn star_system_class_names_match_the_vue_sheet() {
        assert_eq!(star_system_root_classes(), "hk-board3d");
        assert_eq!(star_system_chip_classes(false), "hk-star-system-chip");
        assert_eq!(
            star_system_chip_classes(true),
            "hk-star-system-chip is-core"
        );
        assert_eq!(StarSystemRole::Star.as_str(), "star");
        assert_eq!(StarSystemRole::Planet.as_str(), "planet");
        // The board appends its own label class on top (Vue: `classList.add`).
        assert_eq!(
            crate::scene::board_3d::board3d_label_classes(&star_system_chip_classes(true)),
            "hk-star-system-chip is-core hk-board3d-label"
        );
    }

    // ── the id hash + the palettes (pure) ─────────────────────────────

    #[test]
    fn star_system_hash_is_bit_exact_with_the_vue_implementation() {
        // Reference values produced by the canonical `hashIdToUnit` in
        // packages/vue/src/utils/scene3d.ts (run through node).
        for (id, expected) in [
            ("", 0.992_113_945_307_210_1_f64),
            ("a", 0.737_320_333_719_253_5),
            ("sun", 0.739_339_830_353_856_1),
            ("hub-1", 0.963_503_797_305_747_9),
            ("node-2", 0.956_139_536_574_482_9),
            ("aurora", 0.629_217_574_838_548_9),
        ] {
            let actual = star_system_hash_id_to_unit(id);
            assert!(
                close(actual, expected),
                "hashIdToUnit({id:?}) = {actual}, expected {expected}"
            );
            assert!((0.0..1.0).contains(&actual), "the fold is in [0, 1)");
        }
        // Stable across calls and sensitive to the input.
        assert_eq!(
            star_system_hash_id_to_unit("sun"),
            star_system_hash_id_to_unit("sun")
        );
        assert!(star_system_hash_id_to_unit("sun") != star_system_hash_id_to_unit("sUn"));
    }

    #[test]
    fn star_system_palettes_slide_and_parse_hex() {
        assert_eq!(star_system_hex_to_rgb("#ff8000"), [1.0, 128.0 / 255.0, 0.0]);
        assert_eq!(star_system_hex_to_rgb("ff8000"), [1.0, 128.0 / 255.0, 0.0]);
        // Anything unparseable is white (Vue's `hexToRgb` fallback).
        assert_eq!(star_system_hex_to_rgb("nope"), [1.0, 1.0, 1.0]);
        assert_eq!(star_system_hex_to_rgb("#fff"), [1.0, 1.0, 1.0]);
        // The ends of a palette are its stops; the middle interpolates.
        assert_eq!(
            star_system_lerp_palette(&["#000000", "#ffffff"], 0.0),
            [0.0, 0.0, 0.0]
        );
        assert_eq!(
            star_system_lerp_palette(&["#000000", "#ffffff"], 1.0),
            [1.0, 1.0, 1.0]
        );
        let mid = star_system_lerp_palette(&["#000000", "#ffffff"], 0.5);
        assert!(close(mid[0], 0.5) && close(mid[2], 0.5));
        // Degenerate palettes and positions are tolerated.
        assert_eq!(star_system_lerp_palette(&[], 0.5), [1.0, 1.0, 1.0]);
        assert_eq!(
            star_system_lerp_palette(&["#123456"], 0.5),
            star_system_hex_to_rgb("#123456")
        );
        assert_eq!(
            star_system_lerp_palette(&["#000000", "#ffffff"], f64::NAN),
            [0.0, 0.0, 0.0]
        );
        assert_eq!(
            star_system_lerp_palette(&["#000000", "#ffffff"], 9.0),
            [1.0, 1.0, 1.0]
        );
        // The reference stop of a real star id (node-verified).
        let sun = star_system_palette_color("sun", &STAR_SYSTEM_STAR_PALETTE);
        assert!(close(sun[0], 1.0));
        assert!(close(sun[1], 0.825_533_270_346_475_6));
        assert!(close(sun[2], 0.591_687_457_847_829));
        assert_eq!(star_system_rgb_css([1.0, 0.5, 0.0]), "rgb(255, 128, 0)");
    }

    #[test]
    fn star_system_orders_ids_by_utf16_code_units() {
        use std::cmp::Ordering;
        // ASCII: plain lexicographic.
        assert_eq!(star_system_id_order("a", "b"), Ordering::Less);
        assert_eq!(star_system_id_order("b", "a"), Ordering::Greater);
        assert_eq!(star_system_id_order("a", "a"), Ordering::Equal);
        // A UTF-8 byte order would sort U+FFFD (EF BF BD) BEFORE U+10000
        // (F0 90 80 80); JavaScript compares UTF-16 code units, where the
        // surrogate 0xD800 comes first and U+FFFD lands after it. The roster
        // order — and therefore every brood index — depends on which one is
        // used.
        let bmp_high = "\u{FFFD}";
        let astral = "\u{10000}";
        assert_eq!(
            star_system_id_order(bmp_high, astral),
            bmp_high.encode_utf16().cmp(astral.encode_utf16())
        );
        assert_eq!(star_system_id_order(bmp_high, astral), Ordering::Greater);
        assert!(
            bmp_high.as_bytes() < astral.as_bytes(),
            "utf-8 would disagree"
        );
    }

    // ── the layout (pure) ─────────────────────────────────────────────

    #[test]
    fn star_system_single_hub_sits_at_the_origin_as_the_sun() {
        let spec = star_system_build_spec(&[star("hub"), planet("p1"), planet("p2")]);
        assert_eq!(spec.stars.len(), 1);
        assert_eq!(spec.planets.len(), 2);
        assert!(!spec.has_registry_core);
        assert_eq!(spec.stars[0].orbit_center, [0.0, 0.0, 0.0]);
        assert_eq!(spec.stars[0].orbit_radius, 0.0);
        assert_eq!(spec.stars[0].role, StarSystemRole::Star);
        // A star's radius/spin come from the hash and the tier.
        let h = star_system_hash_id_to_unit("hub");
        assert!(close(spec.stars[0].radius, 2.4 + h * 0.8));
        assert!(close(spec.stars[0].spin_period_sec, 80.0));
        // Brood radii never collide within one star: 9, 15, …
        let mut radii: Vec<f64> = spec.planets.iter().map(|p| p.orbit_radius).collect();
        radii.sort_by(|a, b| a.partial_cmp(b).expect("finite"));
        assert!(close(radii[0], 9.0));
        assert!(close(radii[1], 15.0));
        // Kepler-flavoured periods: T ∝ r^1.5.
        for planet in &spec.planets {
            let expected = 22.0 * (planet.orbit_radius / 9.0).powf(1.5);
            assert!(close(planet.orbit_period_sec, expected));
            assert_eq!(planet.orbit_center, [0.0, 0.0, 0.0]);
            assert!(planet.orbit_tilt.abs() < 0.12);
        }
    }

    #[test]
    fn star_system_several_hubs_take_a_golden_angle_ring() {
        let spec = star_system_build_spec(&[star("hub-1"), star("hub-2"), star("hub-3")]);
        assert_eq!(spec.stars.len(), 3);
        // No planets → the widest brood is 0 → the ring takes the base radius.
        assert!(close(star_system_star_ring_radius(3, 9.0), 26.0));
        for star in &spec.stars {
            let ground = (star.orbit_center[0] * star.orbit_center[0]
                + star.orbit_center[2] * star.orbit_center[2])
                .sqrt();
            assert!(close(ground, 26.0), "radius {ground}");
            // The hash only drives ALTITUDE (±2), never the angle.
            assert!(star.orbit_center[1].abs() <= 2.0);
        }
        // The ring clears a wide brood when one star hoards the planets.
        assert!(
            star_system_star_ring_radius(3, 21.0) > 26.0,
            "a wide brood widens the ring"
        );
        // A single hub has no ring at all.
        assert_eq!(star_system_star_ring_radius(1, 9.0), 0.0);
    }

    #[test]
    fn star_system_planets_hash_onto_a_star_and_keep_their_brood_index() {
        let bodies = vec![
            star("hub-1"),
            star("hub-2"),
            planet("node-2"),
            planet("aurora"),
            planet("a"),
        ];
        let spec = star_system_build_spec(&bodies);
        assert_eq!(spec.stars.len(), 2);
        assert_eq!(spec.planets.len(), 3);
        // Each planet's centre is one of the two star centres (layout only).
        for planet in &spec.planets {
            assert!(
                spec.stars
                    .iter()
                    .any(|star| star.orbit_center == planet.orbit_center),
                "planet {} is not on a star",
                planet.id
            );
        }
        // Brood radii are unique per brood, and the roster order is sorted by id.
        let order: Vec<&str> = spec.planets.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(order, vec!["a", "aurora", "node-2"]);
        // Brood sizes drive the ring: it must clear the widest brood's reach.
        let ring = star_system_star_ring_radius(2, 9.0);
        assert!(close(ring, 22.0));
    }

    #[test]
    fn star_system_without_hubs_circles_the_registry_core() {
        let spec = star_system_build_spec(&[planet("a"), planet("aurora")]);
        assert!(spec.stars.is_empty());
        assert_eq!(spec.planets.len(), 2);
        assert!(spec.has_registry_core);
        for planet in &spec.planets {
            assert_eq!(planet.orbit_center, [0.0, 0.0, 0.0]);
        }
        // No bodies at all: no core marker either (Vue's `hasRegistryCore` needs
        // at least one planet).
        let empty = star_system_build_spec(&[]);
        assert!(empty.is_empty());
        assert!(!empty.has_registry_core);
        // A hub-only fleet draws no core marker.
        assert!(!star_system_build_spec(&[star("hub")]).has_registry_core);
    }

    #[test]
    fn star_system_moon_band_and_orbits_stay_inside_one_brood_step() {
        // MOON_BAND = (6 − 1.3 − 0.2 − 2 × 1.3) / 7.
        assert!(close(star_system_moon_band(), 1.9 / 7.0));
        let first = star_system_satellite_orbit(1.0, 0);
        assert!(close(first.radius, 2.3));
        assert!(close(first.period_sec, 5.0));
        assert!(close(first.phase, 0.0));
        assert!(close(first.tilt, 0.0));
        let second = star_system_satellite_orbit(1.0, 1);
        assert!(close(second.radius, 2.3 + 1.9 / 7.0));
        assert!(close(second.period_sec, 6.7));
        assert!(close(second.tilt, 0.35));
        // The outermost moon plus the biggest body still fits inside ORBIT_STEP.
        let outermost = star_system_satellite_orbit(
            STAR_SYSTEM_MAX_BODY_RADIUS,
            STAR_SYSTEM_SATELLITE_VISUAL_CAP - 1,
        );
        assert!(
            outermost.radius + STAR_SYSTEM_MOON_RADIUS + STAR_SYSTEM_MAX_BODY_RADIUS
                <= STAR_SYSTEM_ORBIT_STEP,
            "the moon band must not reach into the next brood"
        );
    }

    #[test]
    fn star_system_reach_and_hologram_radii_match_the_spec() {
        // The outer ring is the last scale of the body's own ladder.
        assert!(close(
            star_system_hologram_outer_radius(2.4, StarSystemRole::Star),
            3.36
        ));
        assert!(close(
            star_system_hologram_outer_radius(0.85, StarSystemRole::Planet),
            1.258
        ));
        // Without moons the reach IS the hologram.
        let mut hub_spec = star_system_build_spec(&[star("hub")]);
        let mut hub = hub_spec.stars.remove(0);
        assert!(close(
            star_system_body_reach(&hub),
            star_system_hologram_outer_radius(hub.radius, StarSystemRole::Star)
        ));
        // With moons the outermost moon can take over.
        hub.satellites = 8;
        let outer = star_system_satellite_orbit(hub.radius, 7);
        assert!(close(
            star_system_body_reach(&hub),
            star_system_hologram_outer_radius(hub.radius, StarSystemRole::Star)
                .max(outer.radius + STAR_SYSTEM_MOON_RADIUS)
        ));
        // The moon cap holds a 60-endpoint hub down to 8 visible moons.
        let capped = star_system_build_spec(&[body("hub", StarSystemRole::Star, 60)]);
        assert_eq!(capped.stars[0].satellites, 8);
        assert_eq!(capped.stars[0].satellite_total, 60);
    }

    #[test]
    fn star_system_body_position_sweeps_its_tilted_orbit() {
        let spec = star_system_build_spec(&[star("hub"), planet("aurora")]);
        let orbiter = &spec.planets[0];
        // t = 0 is the orbit phase.
        let at_zero = star_system_body_position_at(orbiter, 0.0);
        // The orbit is tilted around X, so the preserved invariant is the 3D
        // distance to the orbit centre (the x-z projection is cos(tilt)-short).
        let dx = at_zero[0] - orbiter.orbit_center[0];
        let dy = at_zero[1] - orbiter.orbit_center[1];
        let dz = at_zero[2] - orbiter.orbit_center[2];
        let radius = (dx * dx + dy * dy + dz * dz).sqrt();
        assert!(close(radius, orbiter.orbit_radius), "{radius}");
        // A full period returns to the same point.
        let after_one = star_system_body_position_at(orbiter, orbiter.orbit_period_sec);
        assert!(close(after_one[0], at_zero[0]));
        assert!(close(after_one[2], at_zero[2]));
        // A quarter period moves the body by a chord, never further than 2r.
        let quarter = star_system_body_position_at(orbiter, orbiter.orbit_period_sec / 4.0);
        let chord = (quarter[0] - at_zero[0]).hypot(quarter[2] - at_zero[2]);
        assert!(chord <= 2.0 * orbiter.orbit_radius + 1e-9);
        assert!(chord > 0.0);
        // A star holds its place at every instant.
        let sun = &spec.stars[0];
        assert_eq!(
            star_system_body_position_at(sun, 12.5),
            star_system_body_position_at(sun, 0.0)
        );
        // The tilt only ever adds the -z·sin(tilt) term.
        let untilted = StarSystemBody {
            orbit_tilt: 0.0,
            ..orbiter.clone()
        };
        let flat = star_system_body_position_at(&untilted, 1.0);
        let tilted = star_system_body_position_at(orbiter, 1.0);
        assert!(close(flat[0], tilted[0]));
        assert!(close(flat[1], 0.0));
    }

    #[test]
    fn star_system_enclosure_centres_by_volume_and_covers_the_sweep() {
        // A single star: the centroid is its own centre and the radius is its
        // reach.
        let solo = star_system_build_spec(&[star("hub")]);
        let enclosure = star_system_fleet_enclosure(&solo).expect("a fleet");
        assert_eq!(enclosure.center, [0.0, 0.0, 0.0]);
        let star_reach =
            star_system_hologram_outer_radius(solo.stars[0].radius, StarSystemRole::Star);
        assert!(close(enclosure.radius, star_reach));
        // Empty fleets have no sphere at all.
        assert_eq!(
            star_system_fleet_enclosure(&StarSystemSpec::default()),
            None
        );
        // A planet's term is the SWEPT orbit, not its t = 0 parking spot.
        let fleet = star_system_build_spec(&[planet("a"), planet("aurora")]);
        let enclosure = star_system_fleet_enclosure(&fleet).expect("a fleet");
        let widest = fleet
            .planets
            .iter()
            .map(|planet| {
                star_system_distance(enclosure.center, planet.orbit_center)
                    + planet.orbit_radius
                    + star_system_body_reach(planet)
            })
            .fold(0.0_f64, f64::max);
        assert!(close(enclosure.radius, widest));
        assert!(
            enclosure.radius >= 15.0,
            "the outer orbit is inside the sphere"
        );
    }

    // ── the camera flights (pure) ─────────────────────────────────────

    #[test]
    fn star_system_frame_pose_keeps_the_view_direction() {
        let spec = star_system_build_spec(&[star("hub"), planet("aurora")]);
        let enclosure = star_system_fleet_enclosure(&spec).expect("a fleet");
        let pose = pose([3.0, 4.0, 5.0], [0.0, 0.0, 0.0]);
        let framed = star_system_frame_pose(pose, enclosure, 1.0);
        let dir = star_system_focus_direction(pose);
        let dist = star_system_frame_distance(enclosure, STAR_SYSTEM_FOV, 1.0);
        for axis in 0..3 {
            assert!(
                close(
                    framed.position[axis],
                    enclosure.center[axis] + dir[axis] * dist
                ),
                "axis {axis}: {} vs expected",
                framed.position[axis]
            );
        }
        assert!(close(framed.target[0], enclosure.center[0]));
        assert!(close(framed.target[2], enclosure.center[2]));
        // The distance uses the 1.1 margin.
        let dist = star_system_frame_distance(enclosure, 45.0, 1.0);
        let expected = board3d_fit_distance(enclosure.radius * 1.1, 45.0, 1.0);
        assert!(close(dist, expected));
        // The fit widens the orbit ceiling and pushes the far plane out.
        assert!(close(star_system_frame_max_distance(420.0, 500.0), 625.0));
        assert!(close(star_system_frame_max_distance(420.0, 10.0), 420.0));
        assert!(close(star_system_frame_far_plane(4000.0, 500.0), 4000.0));
        assert!(close(star_system_frame_far_plane(4000.0, 2000.0), 8000.0));
    }

    #[test]
    fn star_system_focus_pose_parks_next_to_the_body() {
        let parked = pose([10.0, 0.0, 0.0], [0.0, 0.0, 0.0]);
        let dir = star_system_focus_direction(parked);
        assert!(close(dir[0], 1.0) && close(dir[1], 0.0));
        let focused = star_system_focus_pose(parked, [100.0, 0.0, 0.0], 1.0);
        assert_eq!(focused.target, [100.0, 0.0, 0.0]);
        // A small body parks at the floor distance, a big one at 7r.
        assert!(close(star_system_focus_distance(1.0), 7.0));
        assert!(close(star_system_focus_distance(0.1), 4.5));
        assert!(close(focused.position[0], 100.0 + 7.0));
        // The degenerate eye-on-pivot pose falls back to a fixed direction.
        let degenerate = pose([0.0, 0.0, 0.0], [0.0, 0.0, 0.0]);
        let dir = star_system_focus_direction(degenerate);
        let length = (dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]).sqrt();
        assert!(close(length, 1.0));
        // The flight eases in-out and lands exactly on both ends.
        let from = pose([0.0, 0.0, 0.0], [0.0, 0.0, 0.0]);
        let start = star_system_focus_flight_pose(from, dir, 7.0, [1.0, 2.0, 3.0], 0.0);
        assert!(close(start.position[0], 0.0) && close(start.target[0], 0.0));
        let end = star_system_focus_flight_pose(from, dir, 7.0, [1.0, 2.0, 3.0], 1.0);
        assert!(close(end.target[0], 1.0) && close(end.target[2], 3.0));
        assert!(close(end.position[0], 1.0 + dir[0] * 7.0));
        let mid = star_system_focus_flight_pose(from, dir, 7.0, [1.0, 2.0, 3.0], 0.5);
        assert!(close(mid.target[0], 0.5), "ease(0.5) is exactly half");
    }

    #[test]
    fn star_system_follow_moves_eye_and_pivot_by_the_same_delta() {
        let pose = pose([10.0, 5.0, 0.0], [0.0, 0.0, 0.0]);
        let delta = star_system_follow_delta([1.0, 2.0, 3.0], [4.0, 3.0, 3.0]).expect("finite");
        assert_eq!(delta, [3.0, 1.0, 0.0]);
        let followed = star_system_apply_follow(pose, delta);
        assert_eq!(followed.position, [13.0, 6.0, 0.0]);
        assert_eq!(followed.target, [3.0, 1.0, 0.0]);
        // The view vector is preserved exactly.
        let before = [
            pose.position[0] - pose.target[0],
            pose.position[1] - pose.target[1],
            pose.position[2] - pose.target[2],
        ];
        let after = [
            followed.position[0] - followed.target[0],
            followed.position[1] - followed.target[1],
            followed.position[2] - followed.target[2],
        ];
        assert_eq!(before, after);
        // A non-finite motion never reaches the camera.
        assert_eq!(
            star_system_follow_delta([0.0, 0.0, 0.0], [f64::NAN, 0.0, 0.0]),
            None
        );
    }

    // ── chips + selection (pure) ──────────────────────────────────────

    #[test]
    fn star_system_chip_text_joins_the_real_fields() {
        let body = StarSystemBodyInput {
            id: "hub".to_string(),
            label: "Hub".to_string(),
            role: StarSystemRole::Star,
            status: "Online".to_string(),
            online: true,
            endpoint_count: 0,
            detail: "3 endpoints".to_string(),
        };
        let spec = star_system_build_spec(&[body]);
        assert_eq!(
            star_system_chip_text(&spec.stars[0]),
            "Hub · Online · 3 endpoints"
        );
        // Whitespace-only parts are dropped, not joined as empty segments.
        let mut bare = spec.stars[0].clone();
        bare.status = "   ".to_string();
        bare.detail = String::new();
        assert_eq!(star_system_chip_text(&bare), "Hub");
        // The label rides above the body's outermost ring.
        let anchor = star_system_label_anchor(&spec.stars[0], 0.0);
        let lift = star_system_hologram_outer_radius(spec.stars[0].radius, StarSystemRole::Star)
            + STAR_SYSTEM_STAR_LABEL_GAP;
        assert!(close(anchor[1], lift));
    }

    #[test]
    fn star_system_labels_cover_the_registry_core_first() {
        let spec = star_system_build_spec(&[planet("a"), planet("aurora")]);
        let labels = star_system_labels(&spec, 0.0, "Core", None);
        assert_eq!(labels.len(), 3);
        // Vue registers the core marker BEFORE the bodies.
        assert_eq!(labels[0].id, STAR_SYSTEM_CORE_OBJECT_ID);
        assert_eq!(labels[0].text, "Core");
        assert_eq!(labels[0].class, "hk-star-system-chip is-core");
        assert!(close(labels[0].anchor[1], star_system_core_anchor()[1]));
        assert_eq!(labels[1].class, "hk-star-system-chip");
        // A hub fleet draws no core chip.
        let hubs = star_system_build_spec(&[star("hub")]);
        let labels = star_system_labels(&hubs, 0.0, "Core", None);
        assert_eq!(labels.len(), 1);
        assert_eq!(labels[0].id, "hub");
        // A formatter replaces the default text.
        let formatter = Callback::new(|body: StarSystemBody| format!("{}!", body.id));
        let labels = star_system_labels(&hubs, 0.0, "Core", Some(&formatter));
        assert_eq!(labels[0].text, "hub!");
    }

    #[test]
    fn star_system_selection_protocol_matches_the_vue_rules() {
        // A click on the already-selected body STILL re-centres it.
        assert_eq!(
            star_system_selection_action(Some("a"), Some("a")),
            StarSystemSelectionAction::Focus
        );
        assert_eq!(
            star_system_selection_action(Some("a"), Some("b")),
            StarSystemSelectionAction::Focus
        );
        // Only a deselect is idempotent.
        assert_eq!(
            star_system_selection_action(Some("a"), None),
            StarSystemSelectionAction::Reframe
        );
        assert_eq!(
            star_system_selection_action(None, None),
            StarSystemSelectionAction::Idle
        );
        // The vanished-selection watcher.
        let bodies = vec![star("hub"), planet("p1")];
        assert!(star_system_selected_still_exists(&bodies, None));
        assert!(star_system_selected_still_exists(&bodies, Some("p1")));
        assert!(!star_system_selected_still_exists(&bodies, Some("gone")));
        assert!(!star_system_selected_still_exists(&[], Some("p1")));
    }

    // ── DOM contract ─────────────────────────────────────────────────

    #[test]
    fn star_system_renders_through_the_board_with_its_chips() {
        let html = StarSystem(StarSystemProps {
            bodies: vec![star("hub"), planet("aurora")],
            width: 800.0,
            height: 600.0,
            ..Default::default()
        })
        .render_to_html();
        // The root, the canvas slot and the label layer are the BOARD's.
        for needle in [
            "class=\"hk-board3d\"",
            "hk-board3d-canvas",
            "background:transparent",
            "position:absolute;inset:0;pointer-events:none",
            "hk-board3d-label",
            "hk-star-system-chip",
            "data-label-id=\"hub\"",
            "data-label-id=\"aurora\"",
            "hub · Online",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // A hub fleet draws no registry core.
        assert!(!html.contains("hk-star-system-chip is-core"), "{html}");
        assert!(!html.contains(STAR_SYSTEM_CORE_OBJECT_ID), "{html}");
    }

    #[test]
    fn star_system_renders_the_core_chip_when_no_hub_exists() {
        let html = StarSystem(StarSystemProps {
            bodies: vec![planet("a")],
            core_label: "Registry".to_string(),
            width: 800.0,
            height: 600.0,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-star-system-chip is-core hk-board3d-label",
            "data-label-id=\"__star-system-core__\"",
            ">Registry<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The core chip sits above the origin marker.
        let lift = star_system_core_anchor()[1];
        let projection = crate::scene::board_3d::board3d_project_to_screen(
            Board3dCameraPose {
                position: [22.0, -19.0, 34.0],
                ..Default::default()
            },
            800.0,
            600.0,
            [0.0, lift, 0.0],
        );
        let expected = crate::scene::board_3d::board3d_label_style(projection);
        assert!(
            html.contains(&expected),
            "missing chip style {expected}: {html}"
        );
    }

    #[test]
    fn star_system_styles_come_from_the_canonical_vue_sheet() {
        let css = StarSystemComponent::styles();
        for class in [".hk-star-system-chip", ".hk-star-system-chip.is-core"] {
            assert!(css.contains(class), "star system css must carry {class}");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored star system sheet"
        );
        assert_eq!(StarSystemComponent::name(), "star-system");
    }
}
