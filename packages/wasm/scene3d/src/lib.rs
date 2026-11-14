//! hikari-wasm-scene3d — the fleet scene spec component.
//!
//! Ports holographicFleetSpec.ts's pure computation (the renderer-agnostic
//! solar-system layout: star ring placement, brood orbit assignment,
//! palette interpolation, FNV-hash determinism) into Rust behind a WIT
//! contract. The three.js renderer consumes the spec unchanged.

#[cfg(target_family = "wasm")]
mod bindings {
    use super::Scene3d;
    wit_bindgen::generate!({ path: "wit", world: "scene3d" });
    export!(Scene3d);
}

// ── Constants (mirror holographicFleetSpec.ts) ────────────────────────────

const GOLDEN_ANGLE: f64 = 2.399_963_229_728_653;
const STAR_SPIN_SEC: f64 = 80.0;
const PLANET_SPIN_MIN_SEC: f64 = 16.0;
const PLANET_SPIN_SPREAD_SEC: f64 = 20.0;
const ORBIT_BASE: f64 = 9.0;
const ORBIT_STEP: f64 = 6.0;
const SATELLITE_VISUAL_CAP: u32 = 8;
const MAX_BODY_RADIUS: f64 = 1.3; // 0.85 + 0.45 (planet max)
const MAX_STAR_RADIUS: f64 = 3.2; // 2.4 + 0.8 (star max)

const STAR_PALETTE: &[&str] = &[
    "#9db4ff", "#aabfff", "#cad7ff", "#f8f7ff", "#fff4ea", "#ffd2a1", "#ffcc6f",
];
const PLANET_PALETTE: &[&str] = &[
    "#4a9eff", "#6bb6ff", "#8ecbff", "#a3d5ff", "#7ee0d6", "#5ec8f0",
];

// ── Pure computation helpers ──────────────────────────────────────────────

/// FNV-1a hash → unit interval [0,1). Mirrors hashIdToUnit in scene3d.ts.
fn hash_id_to_unit(id: &str) -> f64 {
    let mut h: u32 = 0x811c_9dc5;
    for b in id.bytes() {
        h ^= b as u32;
        // FNV prime multiply via shifts (wrapping, 32-bit).
        h = h
            .wrapping_add(
                h.wrapping_shl(1)
                    .wrapping_add(h.wrapping_shl(4))
                    .wrapping_add(h.wrapping_shl(7))
                    .wrapping_add(h.wrapping_shl(8))
                    .wrapping_add(h.wrapping_shl(24)),
            );
    }
    // Second fold (same as TS: murmur-style avalanche).
    h ^= h >> 13;
    h = h.wrapping_mul(0x5bd1_e995);
    h ^= h >> 15;
    (h as f64) / 4294967296.0
}

fn hex_to_rgb(hex: &str) -> (f64, f64, f64) {
    let h = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&h[0..2], 16).unwrap_or(255) as f64 / 255.0;
    let g = u8::from_str_radix(&h[2..4], 16).unwrap_or(255) as f64 / 255.0;
    let b = u8::from_str_radix(&h[4..6], 16).unwrap_or(255) as f64 / 255.0;
    (r, g, b)
}

fn lerp_palette(palette: &[&str], t: f64) -> (f64, f64, f64) {
    if palette.is_empty() {
        return (1.0, 1.0, 1.0);
    }
    if palette.len() == 1 {
        return hex_to_rgb(palette[0]);
    }
    let clamped = if t.is_finite() { t.clamp(0.0, 1.0) } else { 0.0 };
    let x = clamped * (palette.len() - 1) as f64;
    let i = ((palette.len() - 2) as f64).min(x.floor()) as usize;
    let f = x - i as f64;
    let (ar, ag, ab) = hex_to_rgb(palette[i]);
    let (br, bg, bb) = hex_to_rgb(palette[i + 1]);
    (
        ar + (br - ar) * f,
        ag + (bg - ag) * f,
        ab + (bb - ab) * f,
    )
}

fn star_ring_radius(count: usize, widest_brood_outer: f64) -> f64 {
    let base = 14.0 + count as f64 * 4.0;
    if count < 2 {
        return 0.0;
    }
    let min_separation = 2.0 * (widest_brood_outer + MAX_BODY_RADIUS) + 2.0 * MAX_STAR_RADIUS + 2.0;
    let needed = min_separation / (2.0 * (std::f64::consts::PI / count as f64).sin());
    base.max(needed)
}

// ── Spec types (native, mirrors the WIT records) ──────────────────────────

#[derive(Debug, Clone)]
pub struct FleetRow {
    pub node_id: String,
    pub tier: u32,
    pub station_count: u32,
    pub label: Option<String>,
    pub status: Option<String>,
    pub online: Option<bool>,
    pub detail: Option<String>,
}

#[derive(Debug, Clone)]
pub struct FleetBodySpec {
    pub id: String,
    pub label: String,
    pub status: String,
    pub online: bool,
    pub detail: String,
    pub role: String,
    pub color: (f64, f64, f64),
    pub radius: f64,
    pub orbit_center: (f64, f64, f64),
    pub orbit_radius: f64,
    pub orbit_period_sec: f64,
    pub orbit_phase: f64,
    pub orbit_tilt: f64,
    pub spin_period_sec: f64,
    pub satellites: u32,
    pub satellite_total: u32,
}

#[derive(Debug, Clone)]
pub struct FleetSceneSpec {
    pub stars: Vec<FleetBodySpec>,
    pub planets: Vec<FleetBodySpec>,
    pub has_registry_core: bool,
}

/// Build the deterministic fleet scene layout (mirrors buildFleetSceneSpec).
pub fn build_fleet_scene_spec(rows: &[FleetRow]) -> FleetSceneSpec {
    let mut hubs: Vec<&FleetRow> = rows.iter().filter(|r| r.tier == 3).collect();
    hubs.sort_by(|a, b| a.node_id.cmp(&b.node_id));
    let mut nodes: Vec<&FleetRow> = rows.iter().filter(|r| r.tier == 2).collect();
    nodes.sort_by(|a, b| a.node_id.cmp(&b.node_id));

    // Brood sizes (needed before the ring).
    let star_index_of = |node_id: &str| -> i64 {
        if hubs.is_empty() { -1 }
        else { ((hash_id_to_unit(node_id) * hubs.len() as f64).floor() as i64) % hubs.len() as i64 }
    };
    let mut brood_sizes = vec![0u32; hubs.len()];
    for node in &nodes {
        let i = star_index_of(&node.node_id);
        if i >= 0 { brood_sizes[i as usize] += 1; }
    }
    let widest_brood_outer = if brood_sizes.is_empty() { 0.0 }
        else {
            let max_brood = *brood_sizes.iter().max().unwrap_or(&0);
            ORBIT_BASE + (max_brood.saturating_sub(1)).max(0) as f64 * ORBIT_STEP
        };

    // Stars.
    let stars: Vec<FleetBodySpec> = hubs.iter().enumerate().map(|(i, row)| {
        let h = hash_id_to_unit(&row.node_id);
        let center = if hubs.len() == 1 {
            (0.0, 0.0, 0.0)
        } else {
            let angle = i as f64 * GOLDEN_ANGLE;
            let ring = star_ring_radius(hubs.len(), widest_brood_outer);
            (
                angle.cos() * ring,
                (h - 0.5) * 4.0,
                angle.sin() * ring,
            )
        };
        FleetBodySpec {
            id: row.node_id.clone(),
            label: row.label.clone().unwrap_or_else(|| row.node_id.clone()),
            status: row.status.clone().unwrap_or_default(),
            online: row.online.unwrap_or(true),
            detail: row.detail.clone().unwrap_or_default(),
            role: "star".to_string(),
            color: lerp_palette(STAR_PALETTE, h),
            radius: 2.4 + h * 0.8,
            orbit_center: center,
            orbit_radius: 0.0,
            orbit_period_sec: 0.0,
            orbit_phase: 0.0,
            orbit_tilt: 0.0,
            spin_period_sec: STAR_SPIN_SEC,
            satellites: row.station_count.min(SATELLITE_VISUAL_CAP),
            satellite_total: row.station_count,
        }
    }).collect();

    // Planets (stable star assignment by hash).
    use std::collections::HashMap;
    let mut brood_index: HashMap<String, u32> = HashMap::new();
    let planets: Vec<FleetBodySpec> = nodes.iter().map(|row| {
        let h = hash_id_to_unit(&row.node_id);
        let star = if stars.is_empty() { None }
        else { Some(&stars[((h * stars.len() as f64).floor() as usize) % stars.len()]) };
        let center = star.map(|s| s.orbit_center).unwrap_or((0.0, 0.0, 0.0));
        let brood_key = star.map(|s| s.id.clone()).unwrap_or_else(|| "core".to_string());
        let k = *brood_index.entry(brood_key).or_insert(0);
        brood_index.insert(
            star.map(|s| s.id.clone()).unwrap_or_else(|| "core".to_string()),
            k + 1,
        );
        let orbit_radius = ORBIT_BASE + k as f64 * ORBIT_STEP;
        FleetBodySpec {
            id: row.node_id.clone(),
            label: row.label.clone().unwrap_or_else(|| row.node_id.clone()),
            status: row.status.clone().unwrap_or_default(),
            online: row.online.unwrap_or(true),
            detail: row.detail.clone().unwrap_or_default(),
            role: "planet".to_string(),
            color: lerp_palette(PLANET_PALETTE, h),
            radius: 0.85 + h * 0.45,
            orbit_center: center,
            orbit_radius,
            orbit_period_sec: 22.0 * (orbit_radius / ORBIT_BASE).powf(1.5),
            orbit_phase: h * std::f64::consts::PI * 2.0,
            orbit_tilt: (h - 0.5) * 0.24,
            spin_period_sec: PLANET_SPIN_MIN_SEC + h * PLANET_SPIN_SPREAD_SEC,
            satellites: row.station_count.min(SATELLITE_VISUAL_CAP),
            satellite_total: row.station_count,
        }
    }).collect();

    FleetSceneSpec {
        has_registry_core: stars.is_empty() && !planets.is_empty(),
        stars,
        planets,
    }
}

// ── Wasm bindings ─────────────────────────────────────────────────────────

#[cfg(target_family = "wasm")]
pub struct Scene3d;

#[cfg(target_family = "wasm")]
impl bindings::Guest for Scene3d {
    fn build_fleet_scene(rows: Vec<bindings::hikari::scene3d::types::FleetRow>) -> bindings::hikari::scene3d::types::FleetSceneSpec {
        let native_rows: Vec<FleetRow> = rows.iter().map(|r| FleetRow {
            node_id: r.node_id.clone(),
            tier: r.tier,
            station_count: r.station_count,
            label: r.label.clone(),
            status: r.status.clone(),
            online: r.online,
            detail: r.detail.clone(),
        }).collect();
        let spec = build_fleet_scene_spec(&native_rows);
        let to_body = |b: &FleetBodySpec| bindings::hikari::scene3d::types::FleetBodySpec {
            id: b.id.clone(),
            label: b.label.clone(),
            status: b.status.clone(),
            online: b.online,
            detail: b.detail.clone(),
            role: b.role.clone(),
            color: (b.color.0 as f32, b.color.1 as f32, b.color.2 as f32),
            radius: b.radius as f32,
            orbit_center: (b.orbit_center.0 as f32, b.orbit_center.1 as f32, b.orbit_center.2 as f32),
            orbit_radius: b.orbit_radius as f32,
            orbit_period_sec: b.orbit_period_sec as f32,
            orbit_phase: b.orbit_phase as f32,
            orbit_tilt: b.orbit_tilt as f32,
            spin_period_sec: b.spin_period_sec as f32,
            satellites: b.satellites,
            satellite_total: b.satellite_total,
        };
        bindings::hikari::scene3d::types::FleetSceneSpec {
            stars: spec.stars.iter().map(&to_body).collect(),
            planets: spec.planets.iter().map(&to_body).collect(),
            has_registry_core: spec.has_registry_core,
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn row(id: &str, tier: u32, stations: u32) -> FleetRow {
        FleetRow {
            node_id: id.to_string(),
            tier,
            station_count: stations,
            label: None,
            status: None,
            online: None,
            detail: None,
        }
    }

    #[test]
    fn single_hub_is_centered() {
        let spec = build_fleet_scene_spec(&[row("hub", 3, 2), row("node", 2, 1)]);
        assert_eq!(spec.stars.len(), 1);
        assert_eq!(spec.planets.len(), 1);
        assert_eq!(spec.stars[0].orbit_center, (0.0, 0.0, 0.0));
        assert!(!spec.has_registry_core);
    }

    #[test]
    fn no_hub_has_registry_core() {
        let spec = build_fleet_scene_spec(&[row("a", 2, 0), row("b", 2, 0)]);
        assert!(spec.stars.is_empty());
        assert!(spec.has_registry_core);
    }

    #[test]
    fn deterministic_for_same_input() {
        let rows = vec![row("x", 3, 1), row("y", 2, 2), row("z", 2, 3)];
        let a = build_fleet_scene_spec(&rows);
        let b = build_fleet_scene_spec(&rows);
        assert_eq!(a.stars.len(), b.stars.len());
        assert_eq!(a.planets[0].orbit_phase, b.planets[0].orbit_phase);
    }
}
