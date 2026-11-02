// hi-components/src/basic/time_zone_globe.rs
// TimeZoneGlobe — mirror of the canonical Vue `HkTimeZoneGlobe`: the manual
// solar-zone picker as a GLOBE cut into 24 equal time-sector wedges of 15°
// longitude (one per whole-hour standard offset), plus the same 24 sectors as
// a flat, translated, keyboard-reachable list.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTimeZoneGlobe.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-timezone-globe*` class name is
// literal and identical in both forms. The DOM contract below mirrors the
// Vue render output:
//
//   div.hk-timezone-globe[role=group][aria-label]
//     div.hk-timezone-globe__stage
//       div[style="display:contents"][dangerous_inner_html=<svg …>]  ← the sphere
//     div.hk-timezone-globe__list[role=listbox][aria-label]
//         [data-test="hk-timezone-globe-list"]
//       button.hk-timezone-globe__option[.hk-timezone-globe__option--selected]
//              [role=option][aria-selected][data-zone][data-test=…-option]
//         span.hk-timezone-globe__option-offset   {UTC±N}
//         span.hk-timezone-globe__option-name     {translated band name}
//         span.hk-timezone-globe__option-zone     {IANA id}
//         span.hk-timezone-globe__option-cities   {translated city list}
//     p.hk-timezone-globe__hint
//
// Every `<svg>` rides `dangerous_inner_html` on its OWN `display:contents`
// host element: rsx children and `inner_html` cannot coexist on one node
// (`inner_html` suppresses the children), so the sphere is one markup blob on
// a childless host div — the same shape `basic/fab.rs` and
// `feedback/progress_dialog.rs` use.
//
// Behaviour deltas vs Vue (documented):
//   * NO 3D board: Vue builds on `HkBoard3D` (three.js `OrbitControls`, a
//     rasterized world texture, a stereoscopic minimap, camera flights). The
//     mirror renders the sphere as a STATIC inline SVG wireframe and draws the
//     selected sector as a filled lune. Because Vue's camera FLIES to a
//     clicked wedge, the projection here is centred on the SELECTED sector on
//     every render — the eye always faces the selection, which is the state
//     Vue's camera ends in. A 15° meridian lattice is invariant under that
//     rotation, so the PRIME MERIDIAN is stroked heavier: it is what makes the
//     eye's position (and therefore the selection) readable — a selection at
//     UTC+8 shows UTC off to the disc's left limb.
//   * THE EYE'S ELEVATION IS APPLIED, not dropped. Vue pins the board's orbit
//     to `ORBIT_POLAR_DEG = 90 - EYE_TILT_DEG` (= 72° from +Y), i.e. the eye
//     sits 18° above the equatorial plane, so the sphere is always seen from
//     that ring (never pole-on, never equator-on). The static SVG applies the
//     SAME elevation to its orthographic projection
//     ([`GLOBE_EYE_TILT_DEG`], [`globe_point`]): a latitude circle projects to
//     an ellipse instead of a chord, the north pole sits inside the disc's top
//     limb at `y = -R·cos(18°)`, and the near equator sits below the centre.
//     What is NOT reproduced is the drag itself — see the next bullet.
//   * the interactive surface is Vue's OWN no-WebGL fallback list (the
//     `fallback` slot): same 24 sectors, same offsets/names/ids/cities, same
//     emit through `update:modelValue`. Vue renders that slot INSTEAD of the
//     canvas inside `.hk-timezone-globe__stage`; the mirror keeps both — the
//     SVG in the stage, the list as the next child of the root — because the
//     sheet's root is a flex column built for exactly that stacking
//     (`__stage`, `__list`, `__hint`). The globe is display-only: a 3D
//     drag/pick gesture has no tairitsu analogue in this wave.
//   * the ALWAYS-ON READOUT is mirrored; the pointer-following TOOLTIP it
//     replaced is not (upstream retired it too). Vue pins a HUD at the
//     TOP-CENTRE of the stage showing the SELECTED sector — never the hovered
//     wedge, because a drag re-selects without moving the pointer, so a hover
//     preview would be stale exactly when it is read; and an anchored tooltip
//     on a phone lands under the very finger doing the drag (user direction
//     2026-11-01). The mirror renders the same chip with the same parts:
//     offset label, the translated band name ONLY when it differs from that
//     label (English: a band's name IS its offset, so rendering both would
//     read "UTC+8 UTC+8"), the IANA id, and the representative cities.
//     Difference in the HOST shape: Vue hides the chip when its WebGL board
//     reports an error (the fallback list is then the whole interface); the
//     mirror's renderer is the static SVG, which cannot fail, so the chip is
//     always on. `role=status` + `aria-live=polite` + `aria-atomic` are
//     carried verbatim.
//   * NO TURNTABLE GESTURE. Vue locks the orbit elevation with equal polar
//     bounds so the sphere spins about its vertical axis and never tips or
//     rolls (user direction 2026-11-01: "the globe turns in front of you").
//     The mirror owns no camera and no drag: its SVG is centred on the
//     SELECTED sector and drawn from the SAME 18° elevation on every render,
//     which is the pose Vue's camera settles into (the elevation half of the
//     lock is applied — see the bullet above; only the interactive spin is
//     absent). A host that drives a real board gets the full lock through the
//     board mirror's `min_polar_angle` / `max_polar_angle` props
//     ([`crate::scene`]).
//   * no `update` emit: Vue emits both `update` and `update:modelValue` with
//     the same zone id; the mirror exposes the `update:modelValue` edge as
//     [`TimeZoneGlobeProps::on_value_change`] only.
//   * `sectorIndexForZone` cannot probe `Intl` for a zone's standard offset
//     (no zone database in this wave): the selected wedge is the EXACT match
//     in the 24-representative table, and an id outside it (a half-hour zone
//     such as `Asia/Kolkata`, or an empty id) resolves to the UTC band. Vue
//     rounds the probed offset to the nearest whole-hour band.
//   * the 24-sector table is a transcription of
//     `packages/vue/src/theme/solarTimeZones.ts` (offset, representative
//     IANA id, representative city slugs). It is data, not styling, so the
//     sheet drift guard does not cover it — keep the two lists in step.
//   * sector names / city names fall back to a readable English form
//     (`UTC+8`, `Pago Pago`) when the host does not provide the
//     `hikari::theme.solar.*` keys Vue's app ships, so the picker never
//     degrades to raw keys.

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TimeZoneGlobeComponent;

/// One 15°-wide sector of the picker's globe (Vue:
/// `SolarTimeZoneSector`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct SolarTimeZoneSector {
    /// Standard-offset whole hours this band represents (-11 … +12). The +12
    /// wedge is the antimeridian band — it covers the -12 islands too
    /// (24 wedges × 15° = 360°, so there is no separate -12 wedge).
    pub offset: i32,
    /// Representative IANA zone id — what selecting the band stores.
    pub zone: &'static str,
    /// Representative city slugs for the row's city line, sorted west → east.
    /// Display-only, translated per language: cities, never countries.
    pub cities: &'static [&'static str],
}

/// The 24 sectors, sorted west → east (offset -11 … +12).
pub const SOLAR_TIME_ZONE_SECTORS: [SolarTimeZoneSector; 24] = [
    SolarTimeZoneSector {
        offset: -11,
        zone: "Pacific/Pago_Pago",
        cities: &["pagoPago"],
    },
    SolarTimeZoneSector {
        offset: -10,
        zone: "Pacific/Honolulu",
        cities: &["honolulu", "papeete"],
    },
    SolarTimeZoneSector {
        offset: -9,
        zone: "America/Anchorage",
        cities: &["anchorage"],
    },
    SolarTimeZoneSector {
        offset: -8,
        zone: "America/Los_Angeles",
        cities: &["losAngeles", "vancouver", "tijuana"],
    },
    SolarTimeZoneSector {
        offset: -7,
        zone: "America/Denver",
        cities: &["denver", "edmonton", "phoenix"],
    },
    SolarTimeZoneSector {
        offset: -6,
        zone: "America/Chicago",
        cities: &["chicago", "mexicoCity", "winnipeg"],
    },
    SolarTimeZoneSector {
        offset: -5,
        zone: "America/New_York",
        cities: &["newYork", "toronto", "lima"],
    },
    SolarTimeZoneSector {
        offset: -4,
        zone: "America/Halifax",
        cities: &["halifax", "santiago", "laPaz"],
    },
    SolarTimeZoneSector {
        offset: -3,
        zone: "America/Sao_Paulo",
        cities: &["saoPaulo", "buenosAires", "montevideo"],
    },
    SolarTimeZoneSector {
        offset: -2,
        zone: "America/Noronha",
        cities: &["noronha"],
    },
    SolarTimeZoneSector {
        offset: -1,
        zone: "Atlantic/Azores",
        cities: &["pontaDelgada"],
    },
    SolarTimeZoneSector {
        offset: 0,
        zone: "Europe/London",
        cities: &["london", "dublin", "accra"],
    },
    SolarTimeZoneSector {
        offset: 1,
        zone: "Europe/Berlin",
        cities: &["berlin", "paris", "rome"],
    },
    SolarTimeZoneSector {
        offset: 2,
        zone: "Africa/Cairo",
        cities: &["cairo", "athens", "kyiv", "johannesburg"],
    },
    SolarTimeZoneSector {
        offset: 3,
        zone: "Europe/Moscow",
        cities: &["moscow", "istanbul", "riyadh", "nairobi"],
    },
    SolarTimeZoneSector {
        offset: 4,
        zone: "Asia/Dubai",
        cities: &["dubai", "baku"],
    },
    SolarTimeZoneSector {
        offset: 5,
        zone: "Asia/Karachi",
        cities: &["karachi", "mumbai", "tashkent"],
    },
    SolarTimeZoneSector {
        offset: 6,
        zone: "Asia/Dhaka",
        cities: &["dhaka", "almaty", "yangon"],
    },
    SolarTimeZoneSector {
        offset: 7,
        zone: "Asia/Bangkok",
        cities: &["bangkok", "jakarta", "hanoi"],
    },
    SolarTimeZoneSector {
        offset: 8,
        zone: "Asia/Shanghai",
        cities: &["shanghai", "taipei", "hongKong", "singapore"],
    },
    SolarTimeZoneSector {
        offset: 9,
        zone: "Asia/Tokyo",
        cities: &["tokyo", "seoul"],
    },
    SolarTimeZoneSector {
        offset: 10,
        zone: "Australia/Sydney",
        cities: &["sydney", "vladivostok"],
    },
    SolarTimeZoneSector {
        offset: 11,
        zone: "Pacific/Guadalcanal",
        cities: &["noumea", "honiara"],
    },
    SolarTimeZoneSector {
        offset: 12,
        zone: "Pacific/Auckland",
        cities: &["auckland", "suva"],
    },
];

/// Degrees of longitude per sector (360° / 24).
pub const SECTOR_SPAN_DEG: f64 = 15.0;

/// Sphere radius inside the SVG view box, in user units.
pub const GLOBE_RADIUS: f64 = 48.0;

/// The SVG view box edge (the sphere plus a 6-unit gutter).
pub const GLOBE_VIEWBOX: f64 = 108.0;

/// Centre longitude of a sector (deg, east positive): offset × 15°.
pub fn sector_center_lng_deg(offset: i32) -> f64 {
    f64::from(offset) * SECTOR_SPAN_DEG
}

/// `[west, east]` edges of a sector in longitude degrees (east positive; the
/// +12 sector legitimately straddles ±180°).
pub fn sector_lng_span_deg(offset: i32) -> (f64, f64) {
    let center = sector_center_lng_deg(offset);
    let half = SECTOR_SPAN_DEG / 2.0;
    (center - half, center + half)
}

/// Sector index into [`SOLAR_TIME_ZONE_SECTORS`] for a longitude. Longitudes
/// wrap: -180° and +180° both land on the +12 antimeridian wedge.
pub fn sector_index_for_lng_deg(lng_deg: f64) -> usize {
    let normalized = (lng_deg + 180.0).rem_euclid(360.0) - 180.0; // [-180, 180)
    let rounded = (normalized / SECTOR_SPAN_DEG).round() as i32; // [-12 … 12]
    if rounded <= -12 {
        return 23; // the -12 half of the antimeridian band
    }
    // Offsets -11 … 12 → indexes 0 … 23.
    (rounded + 11).clamp(0, 23) as usize
}

/// Sector index for a stored IANA zone id — the representative table's EXACT
/// match, or the UTC band when the id is not one of the 24 representatives
/// (see the header delta: Vue probes `Intl` for the real standard offset).
pub fn sector_index_for_zone(zone: &str) -> usize {
    SOLAR_TIME_ZONE_SECTORS
        .iter()
        .position(|sector| sector.zone == zone)
        .unwrap_or(11)
}

/// Locale-neutral offset label ("UTC-11", "UTC", "UTC+8"); the numbers are
/// language-independent, so only the band NAME needs translating.
pub fn offset_label(offset: i32) -> String {
    if offset == 0 {
        return "UTC".to_string();
    }
    format!("UTC{}{}", if offset > 0 { "+" } else { "-" }, offset.abs())
}

/// Whether the pinned readout shows the translated band name BESIDE the
/// offset label (Vue: `infoName !== infoOffset`).
///
/// In English a band's translated name IS its offset label ("UTC+8"), so
/// rendering both would read "UTC+8 UTC+8"; only a locale that actually names
/// the band ("东八区") gets the second run. The comparison is on the rendered
/// strings, exactly like Vue's, so a translation table that happens to return
/// the label suppresses the duplicate too.
pub fn time_zone_globe_readout_is_named(offset_label: &str, band_name: &str) -> bool {
    band_name != offset_label
}

/// Locale key of a sector's translated band name (`m11`…`m1`, `z0`, `p1`…`p12`).
pub fn sector_name_key(offset: i32) -> String {
    let key = if offset == 0 {
        "z0".to_string()
    } else if offset < 0 {
        format!("m{}", -offset)
    } else {
        format!("p{offset}")
    };
    format!("hikari::theme.solar.sector.{key}")
}

/// Locale key of a representative city slug.
pub fn city_key(slug: &str) -> String {
    format!("hikari::theme.solar.city.{slug}")
}

/// Readable English fallback for a city slug (`losAngeles` → `Los Angeles`)
/// — used when the host ships no `hikari::theme.solar.city.*` translation, so
/// the picker never shows raw keys.
pub fn city_display_name(slug: &str) -> String {
    let mut out = String::with_capacity(slug.len() + 2);
    let mut previous_lower = false;
    for character in slug.chars() {
        if character.is_ascii_uppercase() && previous_lower {
            out.push(' ');
        }
        out.push(character);
        previous_lower = character.is_ascii_lowercase() || character.is_ascii_digit();
    }
    let mut characters = out.chars();
    match characters.next() {
        Some(first) => first.to_uppercase().collect::<String>() + characters.as_str(),
        None => out,
    }
}

/// One row's translated city line, joined by the locale's own separator.
pub fn cities_line(sector: &SolarTimeZoneSector) -> String {
    let separator = t("hikari::theme.solar.citySeparator", ", ");
    sector
        .cities
        .iter()
        .map(|slug| t(&city_key(slug), &city_display_name(slug)))
        .collect::<Vec<String>>()
        .join(&separator)
}

/// Wrap a longitude into `[-180, 180)` — the frame the globe's meridian grid
/// and the prime-meridian marker both measure in.
pub fn wrap_lng_deg(lng_deg: f64) -> f64 {
    (lng_deg + 180.0).rem_euclid(360.0) - 180.0
}

/// `{:.2}` without a negative zero: trigonometry leaves vanishing
/// coordinates at ±1e-17, and `-0.00` is pure noise in SVG path data.
fn svg_coord(value: f64) -> String {
    // Round to the emitted precision FIRST, then collapse the sign.
    let rounded = (value * 100.0).round() / 100.0;
    let rounded = if rounded == 0.0 { 0.0 } else { rounded };
    format!("{rounded:.2}")
}

/// The eye's elevation above the equatorial plane, in degrees — Vue's
/// `HkTimeZoneGlobe` `EYE_TILT_DEG` (the board pins `minPolarAngle` ===
/// `maxPolarAngle` === `90 - EYE_TILT_DEG`). Both forms therefore look at the
/// sphere from the same latitude: the north pole is visible INSIDE the disc's
/// top limb and the near equator sits below the centre.
pub const GLOBE_EYE_TILT_DEG: f64 = 18.0;

/// Orthographic projection of one point of the visible hemisphere, seen from
/// `eye_tilt_deg` above the equatorial plane: `lng` is measured from the eye's
/// meridian (0 = the centre of the disc), `lat` runs -90 (south pole) … +90
/// (north pole), and the returned `y` grows DOWNWARD like SVG's.
///
/// `eye_tilt_deg = 0` is the plain equator-on projection (parallels collapse
/// to horizontal chords); the picker uses [`GLOBE_EYE_TILT_DEG`], where each
/// latitude circle is a real ellipse and the poles sit at `(0, ∓R·cos(tilt))`.
pub fn globe_point_at(radius: f64, eye_tilt_deg: f64, lng_deg: f64, lat_deg: f64) -> (f64, f64) {
    let tilt = eye_tilt_deg.to_radians();
    let lng = lng_deg.to_radians();
    let lat = lat_deg.to_radians();
    (
        radius * lat.cos() * lng.sin(),
        radius * (tilt.sin() * lat.cos() * lng.cos() - tilt.cos() * lat.sin()),
    )
}

/// [`globe_point_at`] at the picker's eye tilt — the projection the wireframe
/// and the lune are both drawn with, so the two never drift apart.
pub fn globe_point(radius: f64, lng_deg: f64, lat_deg: f64) -> (f64, f64) {
    globe_point_at(radius, GLOBE_EYE_TILT_DEG, lng_deg, lat_deg)
}

/// One parallel's projected ellipse in the tilted view: the centre's offset
/// from the disc centre on the y axis (screen-down), then the semi-axes.
///
/// A latitude circle `lat` projects to `y = offset + ry·cos(Δlng)` with
/// `x = rx·sin(Δlng)`, so at tilt 0 the `ry` term vanishes and the curve IS
/// the horizontal chord an equator-on view draws.
pub fn globe_parallel_ellipse(radius: f64, eye_tilt_deg: f64, lat_deg: f64) -> (f64, f64, f64) {
    let tilt = eye_tilt_deg.to_radians();
    let lat = lat_deg.to_radians();
    (
        -radius * tilt.cos() * lat.sin(),
        radius * lat.cos(),
        radius * tilt.sin() * lat.cos(),
    )
}

/// One meridian's projected ellipse in the tilted view.
///
/// A meridian is a great circle, so its projection is an ellipse centred on
/// the disc centre; `rx` / `ry` are the semi-axes in projection px and
/// `rotation_deg` is the SVG `rotate()` angle (clockwise, y-down, about the
/// disc centre). `ry ≈ 0` is the DEGENERATE case — the meridian's plane
/// contains the view direction, so the ellipse collapses onto a straight
/// vertical chord (the eye's own meridian and its antipode).
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct GlobeMeridianEllipse {
    pub rx: f64,
    pub ry: f64,
    pub rotation_deg: f64,
}

/// The projected ellipse of the meridian at `lng_deg` from the eye.
///
/// The meridian parametrises as `p(ψ) = (A·cosψ, B·cosψ + C·sinψ)` with
/// `A = sin(lng)`, `B = sin(tilt)·cos(lng)`, `C = -cos(tilt)` — the image of
/// the unit circle under that 2×2 matrix, i.e. an ellipse whose semi-axes are
/// its singular values and whose major axis is `M·v` for the major eigenvector
/// `v` of `MᵀM`.
pub fn globe_meridian_ellipse(
    radius: f64,
    eye_tilt_deg: f64,
    lng_deg: f64,
) -> GlobeMeridianEllipse {
    let tilt = eye_tilt_deg.to_radians();
    let lng = lng_deg.to_radians();
    let a = lng.sin();
    let b = tilt.sin() * lng.cos();
    let c = -tilt.cos();
    let p = a * a + b * b;
    let q = b * c;
    let r = c * c;
    let mid = (p + r) / 2.0;
    let spread = (((p - r) / 2.0).powi(2) + q * q).sqrt();
    let major = (mid + spread).max(0.0).sqrt();
    let minor = (mid - spread).max(0.0).sqrt();
    // The major eigenvector of `MᵀM`, then its image under `M` gives the
    // major axis direction (SVG rotation, y-down).
    let (vx, vy) = if q.abs() > 1e-12 {
        (q, (mid + spread) - p)
    } else if p >= r {
        (1.0, 0.0)
    } else {
        (0.0, 1.0)
    };
    let ux = a * vx;
    let uy = b * vx + c * vy;
    let rotation = if ux.abs() + uy.abs() > 1e-12 {
        uy.atan2(ux).to_degrees()
    } else {
        0.0
    };
    GlobeMeridianEllipse {
        rx: radius * major,
        ry: radius * minor,
        rotation_deg: rotation,
    }
}

/// The filled lune of a sector, projected with that sector's centre on the
/// eye's meridian (Vue: the camera flies to the clicked wedge).
pub fn globe_sector_path(offset: i32, radius: f64) -> String {
    let center = sector_center_lng_deg(offset);
    let (west, east) = sector_lng_span_deg(offset);
    let mut points: Vec<(f64, f64)> = Vec::with_capacity(26);
    // Down the west edge…
    for step in 0..=12 {
        let lat = 90.0 - (step as f64) * SECTOR_SPAN_DEG;
        points.push(globe_point(radius, west - center, lat));
    }
    // …then up the east edge.
    for step in 0..=12 {
        let lat = -90.0 + (step as f64) * SECTOR_SPAN_DEG;
        points.push(globe_point(radius, east - center, lat));
    }
    let mut path = String::new();
    for (index, (x, y)) in points.iter().enumerate() {
        path.push_str(if index == 0 { "M" } else { " L" });
        path.push_str(&svg_coord(*x));
        path.push(',');
        path.push_str(&svg_coord(*y));
    }
    path.push_str(" Z");
    path
}

/// One meridian as SVG: its rotated ellipse, or a straight vertical chord
/// when the ellipse is degenerate (the eye's meridian / its antipode, whose
/// plane contains the view direction).
fn meridian_svg(radius: f64, centre: f64, lng: f64, opacity: &str, width: &str) -> String {
    let ellipse = globe_meridian_ellipse(radius, GLOBE_EYE_TILT_DEG, lng);
    if ellipse.ry < 0.01 {
        return format!(
            r#"<line x1="{centre:.2}" y1="{}" x2="{centre:.2}" y2="{}" stroke="currentColor" stroke-opacity="{opacity}" stroke-width="{width}"/>"#,
            svg_coord(centre - radius),
            svg_coord(centre + radius),
        );
    }
    format!(
        r#"<ellipse cx="{centre:.2}" cy="{centre:.2}" rx="{}" ry="{}" transform="rotate({} {centre:.2} {centre:.2})" fill="none" stroke="currentColor" stroke-opacity="{opacity}" stroke-width="{width}"/>"#,
        svg_coord(ellipse.rx),
        svg_coord(ellipse.ry),
        svg_coord(ellipse.rotation_deg),
    )
}

/// The static globe: a themed wireframe sphere (parallels and meridians as
/// ellipses in the same 18° elevation the Vue board uses) with the SELECTED
/// sector filled.
///
/// The eye rotates to the selection — Vue's camera flies to a clicked wedge,
/// and this is where it comes to rest — so the selected lune always sits at
/// the centre of the disc. Because the meridian grid is a 15° lattice, that
/// rotation leaves the grid itself unchanged; the PRIME MERIDIAN is therefore
/// drawn heavier, which is what makes the eye's position readable ("UTC is
/// over there").
pub fn time_zone_globe_svg(selected_index: usize) -> String {
    let radius = GLOBE_RADIUS;
    let centre = GLOBE_VIEWBOX / 2.0;
    let sector = SOLAR_TIME_ZONE_SECTORS
        .get(selected_index)
        .unwrap_or(&SOLAR_TIME_ZONE_SECTORS[11]);
    // Where the eye sits, in degrees of longitude.
    let eye_lng = sector_center_lng_deg(sector.offset);
    let mut svg = String::with_capacity(4096);
    svg.push_str(&format!(
        r#"<svg viewBox="0 0 {GLOBE_VIEWBOX:.0} {GLOBE_VIEWBOX:.0}" width="100%" height="100%" role="img" aria-hidden="true" focusable="false">"#
    ));
    // The sphere body.
    svg.push_str(&format!(
        r#"<circle cx="{centre:.2}" cy="{centre:.2}" r="{radius:.2}" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.35" stroke-width="1"/>"#
    ));
    // Parallels: a latitude circle projects to an ellipse at
    // y = -R·cos(tilt)·sin(lat) with semi-axes R·cos(lat) and
    // R·sin(tilt)·cos(lat) — at tilt 0 the ry term collapses and the ellipse
    // IS the horizontal chord an equator-on view draws.
    for lat in [60.0_f64, 30.0, 0.0, -30.0, -60.0] {
        let (offset_y, rx, ry) = globe_parallel_ellipse(radius, GLOBE_EYE_TILT_DEG, lat);
        svg.push_str(&format!(
            r#"<ellipse cx="{centre:.2}" cy="{}" rx="{}" ry="{}" fill="none" stroke="currentColor" stroke-opacity="0.16" stroke-width="1"/>"#,
            svg_coord(centre + offset_y),
            svg_coord(rx),
            svg_coord(ry),
        ));
    }
    // Meridians every 15° — one great circle per band edge, measured from the
    // eye. Only the front half is visible, but the projected outline of a
    // full great circle IS the ellipse (rotated by the eye's tilt), so drawing
    // it whole stays geometrically correct.
    for step in 0..24 {
        let lng = wrap_lng_deg(-180.0 + (step as f64) * SECTOR_SPAN_DEG - eye_lng);
        svg.push_str(&meridian_svg(radius, centre, lng, "0.16", "1"));
    }
    // The prime meridian: the one asymmetry that makes the rotation readable.
    let prime_lng = wrap_lng_deg(-eye_lng);
    if prime_lng.abs() < 89.0 {
        svg.push_str(&meridian_svg(radius, centre, prime_lng, "0.38", "1.6"));
    }
    // The selected sector, above the wireframe (Vue's highlight shells sit
    // above the base texture).
    let path = globe_sector_path(sector.offset, radius);
    svg.push_str(&format!(
        r#"<path transform="translate({centre:.2} {centre:.2})" d="{path}" fill="currentColor" fill-opacity="0.26" stroke="currentColor" stroke-opacity="0.55" stroke-width="1"/>"#
    ));
    svg.push_str("</svg>");
    svg
}

#[define_props]
pub struct TimeZoneGlobeProps {
    /// The selected IANA zone id (Vue: `modelValue`, required). An id that is
    /// not one of the 24 representatives keeps its value and highlights the
    /// UTC band (see the header delta).
    #[default]
    pub model_value: String,

    /// Appended to the root div, after `hk-timezone-globe`.
    #[default]
    pub class: String,

    /// Fires with the chosen band's representative zone id (Vue:
    /// `update:modelValue`).
    pub on_value_change: Option<EventHandler<String>>,
}

#[component]
pub fn TimeZoneGlobe(props: TimeZoneGlobeProps) -> Element {
    let selected = sector_index_for_zone(&props.model_value);
    let globe_label = t("hikari::theme.solar.globeLabel", "Time zone");
    let list_label = t("hikari::theme.solar.globeListLabel", "Time zones");
    let hint = t(
        "hikari::theme.solar.globeHint",
        "Pick the band that matches where you are.",
    );

    // The sphere: SVG markup on its own `display:contents` host (see the
    // header note — inner_html and children cannot share one node).
    let globe_host = VNode::Element(Box::new(
        VElement::new("div")
            .attr("style", "display:contents")
            .dangerous_inner_html(time_zone_globe_svg(selected)),
    ));

    // The pinned readout: the COMMITTED selection, never the hovered wedge.
    // A band's translated name is skipped when it IS the offset label
    // (`infoName !== infoOffset` upstream).
    let readout_sector = &SOLAR_TIME_ZONE_SECTORS[selected];
    let readout_offset = offset_label(readout_sector.offset);
    let readout_name = t(
        &sector_name_key(readout_sector.offset),
        &offset_label(readout_sector.offset),
    );
    let readout_is_named = time_zone_globe_readout_is_named(&readout_offset, &readout_name);
    let readout_zone = readout_sector.zone.to_string();
    let readout_cities = cities_line(readout_sector);

    // The 24 bands as Vue's no-WebGL fallback list rows.
    let mut rows: Vec<VNode> = Vec::with_capacity(SOLAR_TIME_ZONE_SECTORS.len());
    for (index, sector) in SOLAR_TIME_ZONE_SECTORS.iter().enumerate() {
        let is_selected = index == selected;
        let mut class = String::from("hk-timezone-globe__option");
        if is_selected {
            class.push_str(" hk-timezone-globe__option--selected");
        }
        let aria_selected = if is_selected { "true" } else { "false" };
        let offset_text = offset_label(sector.offset);
        let name = t(
            &sector_name_key(sector.offset),
            &offset_label(sector.offset),
        );
        let cities = cities_line(sector);
        let zone_attr = sector.zone.to_string();
        let zone_text = sector.zone.to_string();
        let zone_for_click = sector.zone.to_string();
        let current_value = props.model_value.clone();
        let on_value_change = props.on_value_change.clone();
        rows.push(rsx! {
            button {
                class: class,
                "type": "button",
                "role": "option",
                "aria-selected": aria_selected,
                "data-zone": zone_attr,
                "data-test": "hk-timezone-globe-option",
                onclick: move |_event: MouseEvent| {
                    // Vue's `emitZone` guard: the band already stored as the
                    // model is not re-emitted.
                    if zone_for_click == current_value {
                        return;
                    }
                    if let Some(handler) = on_value_change.as_ref() {
                        handler.call(zone_for_click.clone());
                    }
                },
                span { class: "hk-timezone-globe__option-offset", {offset_text} }
                span { class: "hk-timezone-globe__option-name", {name} }
                span { class: "hk-timezone-globe__option-zone", {zone_text} }
                span { class: "hk-timezone-globe__option-cities", {cities} }
            }
        });
    }

    let mut root_classes = String::from("hk-timezone-globe");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    rsx! {
        div {
            class: root_classes,
            "role": "group",
            "aria-label": globe_label,
            "data-test": "hk-timezone-globe",
            div { class: "hk-timezone-globe__stage",
                div {
                    class: "hk-timezone-globe__readout",
                    "data-test": "hk-timezone-globe-readout",
                    "role": "status",
                    "aria-live": "polite",
                    "aria-atomic": "true",
                    span { class: "hk-timezone-globe__readout-head",
                        span { class: "hk-timezone-globe__readout-offset", {readout_offset.clone()} }
                        if readout_is_named {
                            span { class: "hk-timezone-globe__readout-name", {readout_name.clone()} }
                        }
                        span { class: "hk-timezone-globe__readout-zone", {readout_zone.clone()} }
                    }
                    span { class: "hk-timezone-globe__readout-cities", {readout_cities.clone()} }
                }
                {globe_host}
            }
            div {
                class: "hk-timezone-globe__list",
                "role": "listbox",
                "aria-label": list_label,
                "data-test": "hk-timezone-globe-list",
                {VNode::Fragment(rows)}
            }
            p { class: "hk-timezone-globe__hint", {hint} }
        }
    }
}

impl StyledComponent for TimeZoneGlobeComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (`no_hash` keeps the
        // `.hk-timezone-globe*` names literal).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTimeZoneGlobe.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "time-zone-globe"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn time_zone_globe_props_default_matches_the_vue_props() {
        let props = TimeZoneGlobeProps::default();
        assert_eq!(props.model_value, "");
        assert_eq!(props.class, "");
        assert!(props.on_value_change.is_none());
    }

    #[test]
    fn time_zone_globe_table_covers_the_whole_day() {
        assert_eq!(SOLAR_TIME_ZONE_SECTORS.len(), 24);
        // Sorted west → east, one hour apart, -11 … +12.
        for (index, sector) in SOLAR_TIME_ZONE_SECTORS.iter().enumerate() {
            assert_eq!(sector.offset, index as i32 - 11);
            assert!(!sector.zone.is_empty());
            assert!(!sector.cities.is_empty());
        }
        // 24 wedges of 15° close the circle exactly.
        assert_eq!(
            f64::from(SOLAR_TIME_ZONE_SECTORS.len() as u32) * SECTOR_SPAN_DEG,
            360.0
        );
        // The representative ids are unique (the reverse lookup depends on it).
        let mut zones: Vec<&str> = SOLAR_TIME_ZONE_SECTORS.iter().map(|s| s.zone).collect();
        zones.sort_unstable();
        zones.dedup();
        assert_eq!(zones.len(), 24);
    }

    #[test]
    fn time_zone_globe_offset_labels_match_vue() {
        assert_eq!(offset_label(0), "UTC");
        assert_eq!(offset_label(8), "UTC+8");
        assert_eq!(offset_label(-11), "UTC-11");
        assert_eq!(offset_label(12), "UTC+12");
        assert_eq!(sector_name_key(0), "hikari::theme.solar.sector.z0");
        assert_eq!(sector_name_key(-11), "hikari::theme.solar.sector.m11");
        assert_eq!(sector_name_key(8), "hikari::theme.solar.sector.p8");
        assert_eq!(city_key("pagoPago"), "hikari::theme.solar.city.pagoPago");
    }

    #[test]
    fn time_zone_globe_city_fallbacks_split_the_slug() {
        assert_eq!(city_display_name("pagoPago"), "Pago Pago");
        assert_eq!(city_display_name("losAngeles"), "Los Angeles");
        assert_eq!(city_display_name("newYork"), "New York");
        assert_eq!(city_display_name("hanoi"), "Hanoi");
        assert_eq!(city_display_name(""), "");
    }

    #[test]
    fn time_zone_globe_sector_lookup_matches_the_vue_math() {
        // Sector centres are offset × 15°.
        assert_eq!(sector_center_lng_deg(8), 120.0);
        assert_eq!(sector_lng_span_deg(8), (112.5, 127.5));
        // Longitude → band, including the antimeridian wrap.
        assert_eq!(sector_index_for_lng_deg(120.0), 19);
        assert_eq!(sector_index_for_lng_deg(0.0), 11);
        assert_eq!(sector_index_for_lng_deg(-165.0), 0);
        assert_eq!(sector_index_for_lng_deg(180.0), 23);
        assert_eq!(sector_index_for_lng_deg(-180.0), 23);
        // A stored representative id resolves to its own band…
        assert_eq!(sector_index_for_zone("Asia/Shanghai"), 19);
        assert_eq!(sector_index_for_zone("Pacific/Auckland"), 23);
        // …and an id outside the table (or an empty one) resolves to UTC.
        assert_eq!(sector_index_for_zone("Asia/Kolkata"), 11);
        assert_eq!(sector_index_for_zone(""), 11);
    }

    #[test]
    fn time_zone_globe_projection_is_orthographic() {
        let radius = 10.0;
        // Equator-on (tilt 0) is the plain orthographic projection the
        // mirror has always documented: the eye's meridian and the equator
        // meet at the centre, 90° east sits on the right limb, and the pole
        // reaches the disc's top edge.
        assert_eq!(globe_point_at(radius, 0.0, 0.0, 0.0), (0.0, 0.0));
        assert!((globe_point_at(radius, 0.0, 90.0, 0.0).0 - radius).abs() < 1e-9);
        assert!(
            (globe_point_at(radius, 0.0, 0.0, 90.0).1 + radius).abs() < 1e-9,
            "tilt 0 puts the north pole on the disc's top edge"
        );
        // The picker's projection is the SAME orthographic projection seen
        // from 18° above the equator: the pole moves INSIDE the disc's top
        // limb by cos(18°), and the near equator drops below the centre by
        // sin(18°) while its left/right limbs stay on the equator line.
        let tilt = GLOBE_EYE_TILT_DEG.to_radians();
        assert!((globe_point(radius, 0.0, 0.0).0).abs() < 1e-9);
        assert!((globe_point(radius, 0.0, 0.0).1 - radius * tilt.sin()).abs() < 1e-9);
        assert!((globe_point(radius, 0.0, 90.0).1 + radius * tilt.cos()).abs() < 1e-9);
        assert!((globe_point(radius, 90.0, 0.0).0 - radius).abs() < 1e-9);
        assert!(globe_point(radius, 90.0, 0.0).1.abs() < 1e-9);
        // The eye's meridian is a vertical chord at EVERY elevation.
        for lat in [-60.0_f64, -30.0, 0.0, 30.0, 60.0, 90.0] {
            assert!(globe_point(radius, 0.0, lat).0.abs() < 1e-9, "{lat}");
        }
    }

    #[test]
    fn time_zone_globe_parallels_are_ellipses_at_the_eye_tilt() {
        let radius = 10.0;
        let tilt = GLOBE_EYE_TILT_DEG.to_radians();
        // The equator: centred on the disc centre, full width, foreshortened
        // in y by sin(tilt).
        let (offset, rx, ry) = globe_parallel_ellipse(radius, GLOBE_EYE_TILT_DEG, 0.0);
        assert!(offset.abs() < 1e-9);
        assert!((rx - radius).abs() < 1e-9);
        assert!((ry - radius * tilt.sin()).abs() < 1e-9);
        // The pole: a degenerate ellipse at y = -R·cos(tilt) — INSIDE the
        // disc's top limb, which is exactly the visual difference the Vue
        // board's 18° elevation produces.
        let (offset, rx, ry) = globe_parallel_ellipse(radius, GLOBE_EYE_TILT_DEG, 90.0);
        assert!((offset + radius * tilt.cos()).abs() < 1e-9);
        assert!(rx.abs() < 1e-9 && ry.abs() < 1e-9);
        // A northern parallel sits above the centre; a southern one below.
        assert!(globe_parallel_ellipse(radius, GLOBE_EYE_TILT_DEG, 60.0).0 < 0.0);
        assert!(globe_parallel_ellipse(radius, GLOBE_EYE_TILT_DEG, -60.0).0 > 0.0);
        // Every projected point of the parallel must satisfy the ellipse
        // equation (the guard the SVG's cx/cy/rx/ry values rest on).
        for lat in [60.0_f64, 30.0, 0.0, -30.0, -60.0] {
            let (offset, rx, ry) = globe_parallel_ellipse(radius, GLOBE_EYE_TILT_DEG, lat);
            for step in 0..24 {
                let lng = -180.0 + step as f64 * 15.0;
                let (x, y) = globe_point(radius, lng, lat);
                let on_curve = (x / rx).powi(2) + ((y - offset) / ry).powi(2);
                assert!(
                    (on_curve - 1.0).abs() < 1e-9,
                    "lat {lat} lng {lng}: {on_curve}"
                );
            }
        }
    }

    #[test]
    fn time_zone_globe_meridian_ellipses_match_the_tilted_projection() {
        let radius = 10.0;
        let tilt = GLOBE_EYE_TILT_DEG.to_radians();
        // The eye's meridian (and its antipode) collapse onto the vertical
        // chord: the ellipse's minor axis vanishes.
        for lng in [0.0_f64, 180.0] {
            let ellipse = globe_meridian_ellipse(radius, GLOBE_EYE_TILT_DEG, lng);
            assert!(ellipse.ry < 0.01, "lng {lng}: {ellipse:?}");
            assert!((ellipse.rx - radius).abs() < 1e-9, "{ellipse:?}");
        }
        // The meridian 90° from the eye is axis-aligned: the disc's full
        // height in x and cos(tilt) of it in y.
        let side = globe_meridian_ellipse(radius, GLOBE_EYE_TILT_DEG, 90.0);
        assert!((side.rx - radius).abs() < 1e-9, "{side:?}");
        assert!((side.ry - radius * tilt.cos()).abs() < 1e-9, "{side:?}");
        assert!(side.rotation_deg.abs() < 1e-9, "{side:?}");
        // Any other meridian is a ROTATED ellipse; every projected point of
        // the meridian must lie on it (rotate into the ellipse frame, then
        // check the ellipse equation).
        for lng in [15.0_f64, 30.0, 45.0, 75.0, 120.0, -45.0] {
            let ellipse = globe_meridian_ellipse(radius, GLOBE_EYE_TILT_DEG, lng);
            assert!(ellipse.ry > 0.0, "lng {lng} should not be degenerate");
            let rotation = ellipse.rotation_deg.to_radians();
            let (sin_r, cos_r) = rotation.sin_cos();
            for step in 0..24 {
                let lat = -90.0 + step as f64 * 7.5;
                let (x, y) = globe_point(radius, lng, lat);
                let local_x = x * cos_r + y * sin_r;
                let local_y = -x * sin_r + y * cos_r;
                let on_curve = (local_x / ellipse.rx).powi(2) + (local_y / ellipse.ry).powi(2);
                assert!(
                    (on_curve - 1.0).abs() < 1e-6,
                    "lng {lng} lat {lat}: {on_curve} ({ellipse:?})"
                );
            }
        }
    }

    #[test]
    fn time_zone_globe_svg_carries_the_wireframe_and_the_selected_lune() {
        // A selection away from UTC: 5 parallel ellipses + 22 rotated
        // meridian ellipses (the eye's meridian and its antipode are straight
        // chords), plus the lune path.
        let svg = time_zone_globe_svg(19);
        assert!(svg.starts_with("<svg"), "{svg}");
        assert!(svg.ends_with("</svg>"), "{svg}");
        assert!(svg.contains("<circle"), "the sphere body is missing");
        assert_eq!(svg.matches("<line").count(), 2, "{svg}");
        assert_eq!(svg.matches("<ellipse").count(), 5 + 22, "{svg}");
        assert_eq!(svg.matches("<path").count(), 1, "{svg}");
        // The tilted meridians are ROTATED ellipses (the equator-on form had
        // no rotation at all) — the elevation is applied, not just declared.
        assert!(svg.contains("transform=\"rotate("), "{svg}");
        // The lune starts at the north pole of the TILTED disc:
        // y = -R·cos(18°) = -45.65, inside the disc's -48 top limb.
        let path = globe_sector_path(19, GLOBE_RADIUS);
        assert!(path.starts_with("M0.00,-45.65"), "{path}");
        assert!(path.ends_with(" Z"), "{path}");
        assert!(!path.contains("-0.00"), "{path}");
        // Every sector produces a lune, whatever its offset.
        for offset in -11..=12 {
            assert!(globe_sector_path(offset, GLOBE_RADIUS).contains('M'));
        }
    }

    #[test]
    fn time_zone_globe_marks_the_prime_meridian_as_the_eye_turns() {
        // Selecting UTC puts the eye ON the prime meridian: it becomes the
        // disc's vertical diameter, stroked heavier than the rest of the grid.
        let utc = time_zone_globe_svg(11);
        assert_eq!(utc.matches("<line").count(), 2 + 1, "{utc}");
        assert_eq!(utc.matches("<ellipse").count(), 5 + 22, "{utc}");
        assert_eq!(utc.matches("stroke-width=\"1.6\"").count(), 1, "{utc}");
        // The heavier stroke must ride the CHORD, not an ellipse.
        let heavy = utc
            .split('<')
            .find(|element| element.contains("stroke-width=\"1.6\""))
            .expect("the prime meridian is drawn");
        assert!(heavy.starts_with("line"), "UTC's prime meridian: {heavy}");
        // One band east (UTC+1) tilts it into a rotated ellipse.
        let berlin = time_zone_globe_svg(12);
        assert_eq!(
            berlin.matches("stroke-width=\"1.6\"").count(),
            1,
            "{berlin}"
        );
        assert_eq!(berlin.matches("<ellipse").count(), 5 + 22 + 1, "{berlin}");
        let heavy = berlin
            .split('<')
            .find(|element| element.contains("stroke-width=\"1.6\""))
            .expect("the prime meridian is drawn");
        assert!(
            heavy.starts_with("ellipse"),
            "UTC+1's prime meridian: {heavy}"
        );
        // From the far side of the globe it is simply not on the disc.
        let shanghai = time_zone_globe_svg(19);
        assert_eq!(
            shanghai.matches("stroke-width=\"1.6\"").count(),
            0,
            "{shanghai}"
        );
    }

    #[test]
    fn time_zone_globe_renders_the_vue_shell() {
        let html = TimeZoneGlobe(TimeZoneGlobeProps {
            model_value: "Asia/Shanghai".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-timezone-globe",
            "hk-timezone-globe__stage",
            "hk-timezone-globe__list",
            "hk-timezone-globe__option",
            "hk-timezone-globe__option--selected",
            "hk-timezone-globe__option-offset",
            "hk-timezone-globe__option-zone",
            "hk-timezone-globe__option-cities",
            "hk-timezone-globe__hint",
            "data-zone=\"Asia/Shanghai\"",
            "<svg",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Exactly one band is selected, and it is the stored one.
        assert_eq!(
            html.matches("hk-timezone-globe__option--selected").count(),
            1
        );
        assert_eq!(html.matches("hk-timezone-globe__option-cities").count(), 24);
    }

    #[test]
    fn time_zone_globe_readout_keeps_the_name_only_when_it_says_something() {
        // English: the band name IS the offset label → no duplicate run.
        assert!(!time_zone_globe_readout_is_named("UTC+8", "UTC+8"));
        assert!(!time_zone_globe_readout_is_named("UTC", "UTC"));
        // A locale that NAMES the band keeps both ("UTC+8" + "东八区").
        assert!(time_zone_globe_readout_is_named("UTC+8", "东八区"));
        assert!(time_zone_globe_readout_is_named("UTC-11", "Midway Islands"));
    }

    #[test]
    fn time_zone_globe_renders_the_pinned_readout_above_the_stage() {
        let html = TimeZoneGlobe(TimeZoneGlobeProps {
            model_value: "Asia/Shanghai".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="hk-timezone-globe__readout""#,
            r#"data-test="hk-timezone-globe-readout""#,
            r#"role="status""#,
            r#"aria-live="polite""#,
            r#"aria-atomic="true""#,
            r#"class="hk-timezone-globe__readout-head""#,
            r#"class="hk-timezone-globe__readout-offset""#,
            r#"class="hk-timezone-globe__readout-zone""#,
            r#"class="hk-timezone-globe__readout-cities""#,
            "UTC+8",
            "Asia/Shanghai",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The committed selection is reported without any pointer interaction.
        assert!(html.contains("Shanghai"), "{html}");
        // English suppresses the duplicate band name (see the identity rule).
        assert!(
            !html.contains("hk-timezone-globe__readout-name"),
            "English must not render the band name beside its own offset label: {html}"
        );
        // The HUD is INSIDE the stage, painted before the sphere, and the old
        // pointer-following tooltip is gone upstream — neither may appear.
        let stage = html.find("hk-timezone-globe__stage").expect("stage");
        let readout = html.find("hk-timezone-globe__readout").expect("readout");
        let svg = html.find("<svg").expect("sphere");
        assert!(stage < readout && readout < svg, "{html}");
        assert!(!html.contains("hk-timezone-globe__tooltip"), "{html}");
    }

    #[test]
    fn time_zone_globe_styles_come_from_the_canonical_vue_sheet() {
        let css = TimeZoneGlobeComponent::styles();
        for needle in [
            ".hk-timezone-globe",
            ".hk-timezone-globe__stage",
            ".hk-timezone-globe__readout",
            ".hk-timezone-globe__readout-head",
            ".hk-timezone-globe__readout-cities",
            ".hk-timezone-globe__list",
            ".hk-timezone-globe__option",
            ".hk-timezone-globe__hint",
        ] {
            assert!(css.contains(needle), "missing {needle} in globe css");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored globe sheet"
        );
    }
}
