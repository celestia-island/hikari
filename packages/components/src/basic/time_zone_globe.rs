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
//     mirror renders the sphere as a STATIC inline SVG wireframe (orthographic
//     projection: parallels are straight chords, meridians are ellipses) and
//     draws the selected sector as a filled lune. Because Vue's camera FLIES
//     to a clicked wedge, the projection here is centred on the SELECTED
//     sector on every render — the eye always faces the selection, which is
//     the state Vue's camera ends in. A 15° meridian lattice is invariant
//     under that rotation, so the PRIME MERIDIAN is stroked heavier: it is
//     what makes the eye's position (and therefore the selection) readable —
//     a selection at UTC+8 shows UTC off to the disc's left limb.
//   * the interactive surface is Vue's OWN no-WebGL fallback list (the
//     `fallback` slot): same 24 sectors, same offsets/names/ids/cities, same
//     emit through `update:modelValue`. Vue renders that slot INSTEAD of the
//     canvas inside `.hk-timezone-globe__stage`; the mirror keeps both — the
//     SVG in the stage, the list as the next child of the root — because the
//     sheet's root is a flex column built for exactly that stacking
//     (`__stage`, `__list`, `__hint`). The globe is display-only: a 3D
//     drag/pick gesture has no tairitsu analogue in this wave.
//   * no hover tooltip and no `hoveredSector` state: the tooltip needs the
//     board's per-wedge picking plus pointer coordinates, and it repeats the
//     row content the list already shows inline (offset · name · zone ·
//     cities), so nothing is lost by dropping the echo.
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

/// Orthographic projection of one point of the visible hemisphere: `lng` is
/// measured from the eye's meridian (0 = the centre of the disc), `lat` runs
/// -90 (south pole) … +90 (north pole).
pub fn globe_point(radius: f64, lng_deg: f64, lat_deg: f64) -> (f64, f64) {
    let lng = lng_deg.to_radians();
    let lat = lat_deg.to_radians();
    (radius * lat.cos() * lng.sin(), -radius * lat.sin())
}

/// Half-width of one meridian's projected ellipse — the lune path uses the
/// same projection, so the two never drift apart.
pub fn globe_meridian_rx(radius: f64, lng_deg: f64) -> f64 {
    radius * lng_deg.to_radians().sin().abs()
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

/// The static globe: a themed wireframe sphere (parallels as chords,
/// meridians as ellipses) with the SELECTED sector filled.
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
    // Parallels: a latitude circle projects to a horizontal chord at
    // y = ∓R·sin(lat) with half-width R·cos(lat).
    for lat in [60.0_f64, 30.0, 0.0, -30.0, -60.0] {
        let y = centre - radius * lat.to_radians().sin();
        let half = radius * lat.to_radians().cos();
        svg.push_str(&format!(
            r#"<line x1="{}" y1="{}" x2="{}" y2="{}" stroke="currentColor" stroke-opacity="0.16" stroke-width="1"/>"#,
            svg_coord(centre - half),
            svg_coord(y),
            svg_coord(centre + half),
            svg_coord(y),
        ));
    }
    // Meridians every 15° — one great circle per band edge, measured from the
    // eye. Only the front half is visible, but the projected outline of a
    // full great circle IS the ellipse, so drawing it whole stays
    // geometrically correct.
    for step in 0..24 {
        let lng = wrap_lng_deg(-180.0 + (step as f64) * SECTOR_SPAN_DEG - eye_lng);
        let rx = globe_meridian_rx(radius, lng);
        if rx < 0.01 {
            // The eye's own meridian projects to a straight vertical chord.
            svg.push_str(&format!(
                r#"<line x1="{centre:.2}" y1="{}" x2="{centre:.2}" y2="{}" stroke="currentColor" stroke-opacity="0.16" stroke-width="1"/>"#,
                svg_coord(centre - radius),
                svg_coord(centre + radius),
            ));
            continue;
        }
        svg.push_str(&format!(
            r#"<ellipse cx="{centre:.2}" cy="{centre:.2}" rx="{}" ry="{radius:.2}" fill="none" stroke="currentColor" stroke-opacity="0.16" stroke-width="1"/>"#,
            svg_coord(rx),
        ));
    }
    // The prime meridian: the one asymmetry that makes the rotation readable.
    let prime_lng = wrap_lng_deg(-eye_lng);
    if prime_lng.abs() < 89.0 {
        let prime_rx = globe_meridian_rx(radius, prime_lng);
        if prime_rx < 0.01 {
            // Eye on the prime meridian: it IS the disc's diameter.
            svg.push_str(&format!(
                r#"<line x1="{centre:.2}" y1="{}" x2="{centre:.2}" y2="{}" stroke="currentColor" stroke-opacity="0.38" stroke-width="1.6"/>"#,
                svg_coord(centre - radius),
                svg_coord(centre + radius),
            ));
        } else {
            svg.push_str(&format!(
                r#"<ellipse cx="{centre:.2}" cy="{centre:.2}" rx="{}" ry="{radius:.2}" fill="none" stroke="currentColor" stroke-opacity="0.38" stroke-width="1.6"/>"#,
                svg_coord(prime_rx),
            ));
        }
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
        // The eye's meridian and the equator meet at the centre of the disc.
        assert_eq!(globe_point(radius, 0.0, 0.0), (0.0, 0.0));
        // 90° east sits on the right limb; the north pole is straight up.
        assert!((globe_point(radius, 90.0, 0.0).0 - radius).abs() < 1e-9);
        assert!((globe_point(radius, 0.0, 90.0).1 + radius).abs() < 1e-9);
        // A meridian's ellipse collapses at 0°/180° and is widest at ±90°.
        assert!(globe_meridian_rx(radius, 0.0) < 1e-9);
        assert!((globe_meridian_rx(radius, 90.0) - radius).abs() < 1e-9);
        assert!((globe_meridian_rx(radius, -90.0) - radius).abs() < 1e-9);
        assert!((globe_meridian_rx(radius, 30.0) - radius * 0.5).abs() < 1e-9);
    }

    #[test]
    fn time_zone_globe_svg_carries_the_wireframe_and_the_selected_lune() {
        // A selection away from UTC: 5 parallels + 2 straight meridian
        // chords, 22 meridian ellipses, and the lune.
        let svg = time_zone_globe_svg(19);
        assert!(svg.starts_with("<svg"), "{svg}");
        assert!(svg.ends_with("</svg>"), "{svg}");
        assert!(svg.contains("<circle"), "the sphere body is missing");
        assert_eq!(svg.matches("<line").count(), 5 + 2, "{svg}");
        assert_eq!(svg.matches("<ellipse").count(), 22, "{svg}");
        assert_eq!(svg.matches("<path").count(), 1, "{svg}");
        // The lune always starts at the north pole of the projected disc,
        // and no coordinate renders as a negative zero.
        let path = globe_sector_path(19, GLOBE_RADIUS);
        assert!(path.starts_with("M0.00,-48.00"), "{path}");
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
        // disc's diameter, stroked heavier than the rest of the grid.
        let utc = time_zone_globe_svg(11);
        assert_eq!(utc.matches("<line").count(), 5 + 2 + 1, "{utc}");
        assert_eq!(utc.matches("stroke-width=\"1.6\"").count(), 1, "{utc}");
        // One band east (UTC+1) tilts it into an ellipse.
        let berlin = time_zone_globe_svg(12);
        assert_eq!(
            berlin.matches("stroke-width=\"1.6\"").count(),
            1,
            "{berlin}"
        );
        assert_eq!(berlin.matches("<ellipse").count(), 23, "{berlin}");
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
    fn time_zone_globe_styles_come_from_the_canonical_vue_sheet() {
        let css = TimeZoneGlobeComponent::styles();
        for needle in [
            ".hk-timezone-globe",
            ".hk-timezone-globe__stage",
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
