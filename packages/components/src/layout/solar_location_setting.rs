// hi-components/src/layout/solar_location_setting.rs
// SolarLocationSetting — mirror of the canonical Vue `HkSolarLocationSetting`:
// the solar clock's location STRATEGY row plus its editor modal (the
// user-visible, user-editable ladder: timezone → ip → manual).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSolarLocationSetting.scss`, vendored
// under `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-solar-*` class names are literal and identical in both forms.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   ── the settings row ──
//   div.hk-solar-setting
//     div.hk-solar-summary [data-strategy]
//       span.hk-solar-summary-icon [aria-hidden=true]   (the lucide glyph)
//       span.hk-solar-summary-text                      (live summary)
//     button.hk-btn…hk-solar-edit                        (mirrored Button,
//                                                        size sm / outline)
//   ── the editor (mirrored Modal, width "sm", Cancel/Apply footer) ──
//   div.hk-modal… > div.hk-solar-editor [data-strategy]
//     div.hk-tabs[data-variant=segmented][data-scrollable=true]
//       div.hk-tabs-scroller                             (plain div — delta)
//         div.hk-tabs-list[data-variant=segmented][data-block=true]
//                              [role=radiogroup][aria-label]
//           div.hk-tabs-indicator                        (inert — delta)
//           button.hk-tabs-trigger[type=button][role=radio][aria-checked]
//               [data-active?] [tabindex=0|-1]
//             span.hk-tabs-trigger-icon?                 (the lucide glyph)
//             span {label}
//     p.hk-solar-hint                                   (per-strategy copy)
//     ── manual only ──
//     div.hk-solar-manual
//       {mirrored TimeZoneGlobe}                         (the band picker)
//       div.hk-solar-hemisphere
//         label.hk-solar-field-label                     (Hemisphere)
//         div.hk-tabs… (the segmented hemisphere strip, no icons)
//       p.hk-solar-resolved [data-test=hk-solar-resolved]? (the readout)
//
// STATE CONTRACT (the crate's zero-signal rule): Vue's engine state
// (`solarLocationStrategy` / `solarManualLocation`) and the modal's draft
// (`draftStrategy` / `draftTimeZone` / `draftHemisphere`) are ALL refs in
// Vue; the mirror takes every one of them as a CONTROLLED prop and exposes
// the activation edges — [`SolarLocationSettingProps::on_open`] (Edit),
// `on_close` (modal ✕ / Cancel), `on_strategy_change` / `on_time_zone_change`
// / `on_hemisphere_change` (the editor), and `on_apply` (OK: the host runs
// the engine setters + refresh, then emits nothing — Vue's `applied` emit
// corresponds to flipping its own state). Seeding the draft on open is the
// host's job, exactly like Vue's `seedDraft()`.
//
// Deltas vs Vue (documented, not accidental):
//   * NO ENGINE. `theme/useSolarTime.ts` (storage, `Intl`-based zone
//     offsets, the sun clock) is not mirrored: the strategy, manual
//     location and system zone id arrive as props, and the manual pane's
//     resolved-coordinates readout is either passed in
//     ([`SolarLocationSettingProps::resolved_geo`]) or derived from the
//     standard-offset prop via [`solar_manual_location_geo`] (Vue's
//     formula — hemisphere fixes the latitude's sign, longitude =
//     standard offset / 4 — with `Intl` doing the offset in Vue and the
//     host doing it here).
//   * `HkTabs` (segmented) IS NOT MIRRORED and `HkTabs.scss` is not part
//     of the vendored set, so the segmented strip renders here as DOM
//     hooks — the same `hk-tabs*` classes/attributes Vue's HTabs emits
//     for the plain options this editor passes (no spans, no merged runs,
//     no edge actions): `data-variant`/`data-block`/`role=radiogroup`,
//     `role=radio` + `aria-checked` + `data-active` triggers, the roving
//     tabindex (the active trigger joins the page tab sequence). The
//     scroller wrapper is a plain `div.hk-tabs-scroller` (the
//     overlay-scrollbar viewport is not mirrored — the same delta family
//     as `basic/card.rs`'s `hk-card-body-scroll`), and the sliding
//     indicator renders WITHOUT `data-ready`: Vue gates its visibility on
//     a measured frame, and there is no measurement pairing in the crate
//     this wave, so it stays the sheet's transparent pre-measurement self
//     and a host may measure and light it up.
//   * The three summary/editor glyphs (lucide `Clock` / `Globe2` /
//     `MapPin`, size 16) are TRUSTED STATIC MARKUP through
//     `dangerous_inner_html` (ledger L49: an `rsx!` `svg {}` child lands
//     in the HTML namespace; `Globe2` is lucide's `earth` icon under its
//     alias — the class pair says `lucide-earth`), serialized byte for
//     byte the way `lucide-vue-next` v1 renders `<Clock size={16} />`.
//   * `refreshThemeClock()` on apply is the host's step (the engine call
//     it belongs to is not mirrored).
//
// I18N: every string rides `hikari_i18n::t` under
// `components.hk.solarLocationSetting.*` — the English literals are the
// canonical ones from the Vue app dictionary (`hikari::theme.solar.*` in
// `packages/vue/src/i18n/locales/en/platform.json`), re-keyed to the
// crate's component namespace (the same mapping `layout/affix_picker.rs`
// applies). New keys (see the wave receipt): title, edit, apply, cancel,
// strategyTimezone, strategyIp, strategyManual, timezoneHint, ipHint,
// manualHint, hemisphere, north, south, resolvedAt.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamps and inline tuple types keep the port auditable
// against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
#![allow(clippy::too_many_arguments)]
use hikari_i18n::t;

use crate::basic::time_zone_globe::{TimeZoneGlobe, TimeZoneGlobeProps};
use crate::basic::{Button, ButtonProps, ButtonSize, ButtonVariant};
use crate::feedback::modal::{Modal, ModalAction, ModalActionVariant, ModalProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SolarLocationSettingComponent;

/// How the solar clock decides where the sun is (Vue:
/// `SolarLocationStrategy`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SolarLocationStrategy {
    #[default]
    Timezone,
    Ip,
    Manual,
}

impl SolarLocationStrategy {
    /// The union token exactly as Vue stores/emits it (also the
    /// `data-strategy` attribute and the segmented option key).
    pub fn token(self) -> &'static str {
        match self {
            SolarLocationStrategy::Timezone => "timezone",
            SolarLocationStrategy::Ip => "ip",
            SolarLocationStrategy::Manual => "manual",
        }
    }
}

/// Vue's tab-key cast back into the enum (`value as SolarLocationStrategy`
/// on the trusted option keys).
pub fn solar_strategy_from_token(token: &str) -> Option<SolarLocationStrategy> {
    match token {
        "timezone" => Some(SolarLocationStrategy::Timezone),
        "ip" => Some(SolarLocationStrategy::Ip),
        "manual" => Some(SolarLocationStrategy::Manual),
        _ => None,
    }
}

/// Which half of the globe the observer stands on — a timezone pins only
/// the longitude, so the hemisphere decides the latitude's sign (Vue:
/// `SolarHemisphere`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SolarHemisphere {
    #[default]
    North,
    South,
}

impl SolarHemisphere {
    /// The union token (also the segmented option key).
    pub fn token(self) -> &'static str {
        match self {
            SolarHemisphere::North => "north",
            SolarHemisphere::South => "south",
        }
    }
}

/// Vue's tab-key cast for the hemisphere group.
pub fn solar_hemisphere_from_token(token: &str) -> Option<SolarHemisphere> {
    match token {
        "north" => Some(SolarHemisphere::North),
        "south" => Some(SolarHemisphere::South),
        _ => None,
    }
}

/// Manual solar location: an IANA timezone id plus a hemisphere (Vue:
/// `SolarManualLocation`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SolarManualLocation {
    pub time_zone: String,
    pub hemisphere: SolarHemisphere,
}

/// A geographic fix (Vue: `GeoLocation`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct SolarGeo {
    pub lat: f64,
    pub lng: f64,
}

/// Vue's `DEFAULT_GEO_LOCATION` — the manual strategy's latitude
/// magnitude and its longitude fallback.
pub const SOLAR_DEFAULT_GEO: SolarGeo = SolarGeo {
    lat: 31.23,
    lng: 121.47,
};

/// Vue's `manualLocationOf`: the hemisphere fixes the latitude's sign and
/// the STANDARD zone offset (minutes east of UTC — `Intl`'s job in Vue,
/// the host's here) fixes the longitude at a quarter degree per minute.
pub fn solar_manual_location_geo(
    standard_offset_minutes: f64,
    hemisphere: SolarHemisphere,
) -> SolarGeo {
    SolarGeo {
        lat: match hemisphere {
            SolarHemisphere::South => -SOLAR_DEFAULT_GEO.lat,
            SolarHemisphere::North => SOLAR_DEFAULT_GEO.lat,
        },
        lng: standard_offset_minutes / 4.0,
    }
}

/// One decimal, rounding half away from zero — JavaScript's
/// `toFixed(1)` for the coordinate range this readout prints (Rust's
/// `{:.1}` rounds half to even and would print 86.25 as "86.2" where the
/// Vue form prints "86.3").
pub fn solar_format_coord(value: f64) -> String {
    format!("{:.1}", (value * 10.0).round() / 10.0)
}

/// The readout line: `t("…resolvedAt")` with `{lat}` / `{lng}` filled in,
/// in Vue's replace order.
pub fn solar_resolved_text(geo: SolarGeo) -> String {
    t(
        "components.hk.solarLocationSetting.resolvedAt",
        "Sun clock resolves to ≈ {lat}, {lng}",
    )
    .replace("{lat}", &solar_format_coord(geo.lat))
    .replace("{lng}", &solar_format_coord(geo.lng))
}

/// The strategy's localized short name (the segmented option labels).
pub fn solar_strategy_label(strategy: SolarLocationStrategy) -> String {
    match strategy {
        SolarLocationStrategy::Timezone => t(
            "components.hk.solarLocationSetting.strategyTimezone",
            "Time zone",
        ),
        SolarLocationStrategy::Ip => t(
            "components.hk.solarLocationSetting.strategyIp",
            "IP location",
        ),
        SolarLocationStrategy::Manual => t(
            "components.hk.solarLocationSetting.strategyManual",
            "Manual",
        ),
    }
}

/// The hemisphere's localized name.
pub fn solar_hemisphere_label(hemisphere: SolarHemisphere) -> String {
    match hemisphere {
        SolarHemisphere::North => t("components.hk.solarLocationSetting.north", "Northern"),
        SolarHemisphere::South => t("components.hk.solarLocationSetting.south", "Southern"),
    }
}

/// The row's live summary (Vue's `summaryText` computed): the strategy
/// name, plus the live zone for `timezone`, the zone and hemisphere for
/// `manual` (falling back to the system zone when no manual fix is
/// stored — Vue's `??` nullish fallbacks, so an EMPTY stored zone stays
/// empty), and the bare label for `ip`.
pub fn solar_summary_text(
    strategy: SolarLocationStrategy,
    manual_location: Option<&SolarManualLocation>,
    system_time_zone: &str,
) -> String {
    match strategy {
        SolarLocationStrategy::Ip => solar_strategy_label(strategy),
        SolarLocationStrategy::Manual => {
            let (zone, hemisphere) = match manual_location {
                Some(location) => (location.time_zone.as_str(), location.hemisphere),
                None => (system_time_zone, SolarHemisphere::North),
            };
            format!(
                "{} · {} · {}",
                solar_strategy_label(strategy),
                zone,
                solar_hemisphere_label(hemisphere)
            )
        }
        SolarLocationStrategy::Timezone => {
            format!("{} · {}", solar_strategy_label(strategy), system_time_zone)
        }
    }
}

/// The per-strategy explanation under the segmented strip (Vue's
/// `hintText`).
pub fn solar_strategy_hint(strategy: SolarLocationStrategy) -> String {
    match strategy {
        SolarLocationStrategy::Timezone => t(
            "components.hk.solarLocationSetting.timezoneHint",
            "Offline: follow the device time zone. No network request, no permission prompt.",
        ),
        SolarLocationStrategy::Ip => t(
            "components.hk.solarLocationSetting.ipHint",
            "Locate over the network: granted browser geolocation → IP lookup → time-zone estimate fallback.",
        ),
        SolarLocationStrategy::Manual => t(
            "components.hk.solarLocationSetting.manualHint",
            "Pick an IANA time zone and hemisphere; the sun clock follows them exactly.",
        ),
    }
}

// ── the lucide glyphs (static trusted markup — see the header) ──────────

/// One lucide glyph, serialized exactly as `lucide-vue-next` renders it
/// (the 24-unit viewBox, the stroke set, the class pair, the automatic
/// `aria-hidden`); the same serializer `layout/locale_picker_popup.rs`
/// pins for its glyphs.
fn lucide_icon_svg(name: &str, size: u32, body: &str) -> String {
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" \
         viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" \
         stroke-linecap=\"round\" stroke-linejoin=\"round\" \
         class=\"lucide lucide-{name}-icon lucide-{name}\" aria-hidden=\"true\">{body}</svg>"
    )
}

/// lucide `clock` (`<Clock size={16} />`).
pub fn solar_clock_icon_svg() -> String {
    lucide_icon_svg(
        "clock",
        16,
        r#"<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>"#,
    )
}

/// lucide `earth` — `Globe2` is its alias export (`<Globe2 size={16} />`).
pub fn solar_globe_icon_svg() -> String {
    lucide_icon_svg(
        "earth",
        16,
        r#"<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"></path><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"></path><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"></path><circle cx="12" cy="12" r="10"></circle>"#,
    )
}

/// lucide `map-pin` (`<MapPin size={16} />`).
pub fn solar_map_pin_icon_svg() -> String {
    lucide_icon_svg(
        "map-pin",
        16,
        r#"<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>"#,
    )
}

/// The row's summary glyph, per strategy (Vue's `summaryIcon`).
pub fn solar_summary_icon_svg(strategy: SolarLocationStrategy) -> String {
    match strategy {
        SolarLocationStrategy::Ip => solar_globe_icon_svg(),
        SolarLocationStrategy::Manual => solar_map_pin_icon_svg(),
        SolarLocationStrategy::Timezone => solar_clock_icon_svg(),
    }
}

// ── the segmented strip (HkTabs' DOM hooks — see the header) ────────────

/// One option of a segmented strip (Vue's `TabItem` for this editor: key,
/// label, optional icon vnode).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SolarSegmentedOption {
    pub key: String,
    pub label: String,
    /// The lucide glyph markup (strategy strip only).
    pub icon: Option<String>,
}

/// The strategy ladder's options, top-priority first (Vue's
/// `strategyOptions`).
pub fn solar_strategy_options() -> Vec<SolarSegmentedOption> {
    vec![
        SolarSegmentedOption {
            key: SolarLocationStrategy::Timezone.token().to_string(),
            label: solar_strategy_label(SolarLocationStrategy::Timezone),
            icon: Some(solar_clock_icon_svg()),
        },
        SolarSegmentedOption {
            key: SolarLocationStrategy::Ip.token().to_string(),
            label: solar_strategy_label(SolarLocationStrategy::Ip),
            icon: Some(solar_globe_icon_svg()),
        },
        SolarSegmentedOption {
            key: SolarLocationStrategy::Manual.token().to_string(),
            label: solar_strategy_label(SolarLocationStrategy::Manual),
            icon: Some(solar_map_pin_icon_svg()),
        },
    ]
}

/// The hemisphere group's options (Vue's `hemisphereOptions` — no icons).
pub fn solar_hemisphere_options() -> Vec<SolarSegmentedOption> {
    vec![
        SolarSegmentedOption {
            key: SolarHemisphere::North.token().to_string(),
            label: solar_hemisphere_label(SolarHemisphere::North),
            icon: None,
        },
        SolarSegmentedOption {
            key: SolarHemisphere::South.token().to_string(),
            label: solar_hemisphere_label(SolarHemisphere::South),
            icon: None,
        },
    ]
}

/// One `hk-tabs-trigger` button: `role=radio` + `aria-checked` (the
/// segmented working mode), the `data-active` face and the roving
/// tabindex — the active trigger joins the page tab sequence, the others
/// stay arrow-reachable.
fn solar_segmented_trigger(
    option: &SolarSegmentedOption,
    active: bool,
    on_select: &Option<EventHandler<String>>,
) -> VNode {
    let mut trigger = VElement::new("button")
        .class("hk-tabs-trigger")
        .attr("type", "button")
        .attr("role", "radio")
        .attr("aria-checked", if active { "true" } else { "false" })
        .attr("tabindex", if active { "0" } else { "-1" });
    if active {
        trigger = trigger.attr("data-active", "true");
    }
    if let Some(icon) = &option.icon {
        trigger = trigger.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-tabs-trigger-icon")
                .dangerous_inner_html(icon.clone()),
        )));
    }
    trigger = trigger.child(VNode::Element(Box::new(
        VElement::new("span").child(VNode::Text(VText::new(option.label.as_str()))),
    )));

    let key = option.key.clone();
    let handler = on_select.clone();
    trigger = trigger.on_click(move |_event: MouseEvent| {
        if let Some(handler) = handler.as_ref() {
            handler.call(key.clone());
        }
    });
    VNode::Element(Box::new(trigger))
}

/// The segmented strip (HkTabs' DOM for this editor's plain options — see
/// the header delta): `hk-tabs` > scroller > `hk-tabs-list` radiogroup >
/// the inert indicator + one trigger per option.
fn solar_segmented_strip(
    options: &[SolarSegmentedOption],
    active_key: &str,
    aria_label: &str,
    on_select: &Option<EventHandler<String>>,
) -> VNode {
    let mut list = VElement::new("div")
        .class("hk-tabs-list")
        .attr("data-variant", "segmented")
        .attr("data-block", "true")
        .attr("role", "radiogroup")
        .attr("aria-label", aria_label);
    // Vue always mounts the sliding indicator; without `data-ready` it is
    // the sheet's transparent pre-measurement self (see the header).
    list = list.child(VNode::Element(Box::new(
        VElement::new("div").class("hk-tabs-indicator"),
    )));
    for option in options {
        list = list.child(solar_segmented_trigger(
            option,
            option.key == active_key,
            on_select,
        ));
    }

    let scroller = VElement::new("div")
        .class("hk-tabs-scroller")
        .style("overflow-x:auto")
        .child(VNode::Element(Box::new(list)));
    VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-tabs")
            .attr("data-variant", "segmented")
            .attr("data-scrollable", "true")
            .child(VNode::Element(Box::new(scroller))),
    ))
}

#[define_props]
pub struct SolarLocationSettingProps {
    /// The live strategy (Vue: `solarLocationStrategy`).
    #[default]
    pub strategy: SolarLocationStrategy,

    /// The stored manual fix (Vue: `solarManualLocation`).
    pub manual_location: Option<SolarManualLocation>,

    /// The device's IANA zone id (Vue: `systemTimeZoneId()` — `Intl` is
    /// the host's job here; the default matches Vue's fallback).
    #[default("UTC".to_string())]
    pub system_time_zone: String,

    /// Editor visibility (Vue: the `open` ref — the host seeds the draft
    /// on every open, like `seedDraft()`).
    #[default]
    pub open: bool,

    /// The drafted strategy (Vue: `draftStrategy`).
    #[default]
    pub draft_strategy: SolarLocationStrategy,

    /// The drafted IANA zone id (Vue: `draftTimeZone`).
    pub draft_time_zone: String,

    /// The drafted hemisphere (Vue: `draftHemisphere`) — NEVER re-derived
    /// from the zone; picking it is the point of the manual knob.
    #[default]
    pub draft_hemisphere: SolarHemisphere,

    /// The manual pane's resolved readout. `None` hides the line (Vue
    /// derives it live from the engine; see the header delta).
    pub resolved_geo: Option<SolarGeo>,

    /// The Edit button was pressed; the host seeds the draft and opens.
    pub on_open: Option<EventHandler<()>>,

    /// The modal asked to close (✕ / overlay / Cancel).
    pub on_close: Option<EventHandler<()>>,

    /// A strategy option was picked in the editor.
    pub on_strategy_change: Option<EventHandler<SolarLocationStrategy>>,

    /// A globe band was picked (Vue: `onSelectTimeZone` — the zone only,
    /// never the hemisphere).
    pub on_time_zone_change: Option<EventHandler<String>>,

    /// A hemisphere option was picked.
    pub on_hemisphere_change: Option<EventHandler<SolarHemisphere>>,

    /// OK was pressed; carries the drafted strategy. The host applies the
    /// engine setters and refreshes the theme clock (Vue's `applyDraft`).
    pub on_apply: Option<EventHandler<SolarLocationStrategy>>,
}

#[component]
pub fn SolarLocationSetting(props: SolarLocationSettingProps) -> Element {
    // ── the row ────────────────────────────────────────────────────────
    let summary = solar_summary_text(
        props.strategy,
        props.manual_location.as_ref(),
        &props.system_time_zone,
    );
    let summary_icon_host = VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-solar-summary-icon")
            .attr("aria-hidden", "true")
            .dangerous_inner_html(solar_summary_icon_svg(props.strategy)),
    ));

    let open_button = Button(ButtonProps {
        variant: ButtonVariant::Outline,
        size: ButtonSize::Sm,
        class: "hk-solar-edit".to_string(),
        label: Some(t("components.hk.solarLocationSetting.edit", "Edit")),
        onclick: props
            .on_open
            .clone()
            .map(|handler| EventHandler::new(move |_event: MouseEvent| handler.call(()))),
        ..Default::default()
    });

    let row = VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-solar-setting")
            .child(VNode::Element(Box::new(
                VElement::new("div")
                    .class("hk-solar-summary")
                    .attr("data-strategy", props.strategy.token())
                    .child(summary_icon_host)
                    .child(VNode::Element(Box::new(
                        VElement::new("span")
                            .class("hk-solar-summary-text")
                            .child(VNode::Text(VText::new(&summary))),
                    ))),
            )))
            .child(open_button),
    ));

    // ── the editor ─────────────────────────────────────────────────────
    let title = t(
        "components.hk.solarLocationSetting.title",
        "Sun clock location",
    );
    let strategy_on_change = props.on_strategy_change.clone();
    let strategy_strip = solar_segmented_strip(
        &solar_strategy_options(),
        props.draft_strategy.token(),
        &title,
        &Some(EventHandler::new(move |key: String| {
            if let (Some(handler), Some(strategy)) =
                (strategy_on_change.as_ref(), solar_strategy_from_token(&key))
            {
                handler.call(strategy);
            }
        })),
    );

    let hint = VNode::Element(Box::new(VElement::new("p").class("hk-solar-hint").child(
        VNode::Text(VText::new(&solar_strategy_hint(props.draft_strategy))),
    )));

    let mut editor = VElement::new("div")
        .class("hk-solar-editor")
        .attr("data-strategy", props.draft_strategy.token());
    editor = editor.child(strategy_strip);
    editor = editor.child(hint);
    if props.draft_strategy == SolarLocationStrategy::Manual {
        let hemisphere_label = t(
            "components.hk.solarLocationSetting.hemisphere",
            "Hemisphere",
        );
        let hemisphere_on_change = props.on_hemisphere_change.clone();
        let hemisphere_strip = solar_segmented_strip(
            &solar_hemisphere_options(),
            props.draft_hemisphere.token(),
            &hemisphere_label,
            &Some(EventHandler::new(move |key: String| {
                if let (Some(handler), Some(hemisphere)) = (
                    hemisphere_on_change.as_ref(),
                    solar_hemisphere_from_token(&key),
                ) {
                    handler.call(hemisphere);
                }
            })),
        );

        let globe = TimeZoneGlobe(TimeZoneGlobeProps {
            model_value: props.draft_time_zone.clone(),
            on_value_change: props.on_time_zone_change.clone(),
            ..Default::default()
        });

        let mut hemisphere_group = VElement::new("div").class("hk-solar-hemisphere");
        hemisphere_group = hemisphere_group.child(VNode::Element(Box::new(
            VElement::new("label")
                .class("hk-solar-field-label")
                .child(VNode::Text(VText::new(&hemisphere_label))),
        )));
        hemisphere_group = hemisphere_group.child(hemisphere_strip);

        let mut manual = VElement::new("div").class("hk-solar-manual");
        manual = manual.child(globe);
        manual = manual.child(VNode::Element(Box::new(hemisphere_group)));
        if let Some(geo) = props.resolved_geo {
            manual = manual.child(VNode::Element(Box::new(
                VElement::new("p")
                    .class("hk-solar-resolved")
                    .attr("data-test", "hk-solar-resolved")
                    .child(VNode::Text(VText::new(&solar_resolved_text(geo)))),
            )));
        }
        editor = editor.child(VNode::Element(Box::new(manual)));
    }

    let on_close = props.on_close.clone();
    let on_apply = props.on_apply.clone();
    let apply_strategy = props.draft_strategy;
    let modal = Modal(ModalProps {
        open: props.open,
        title: Some(title),
        width: "sm".to_string(),
        footer_actions: Some(vec![
            ModalAction {
                label: t("components.hk.solarLocationSetting.cancel", "Cancel"),
                variant: ModalActionVariant::Secondary,
                on_click: on_close.map(|handler| EventHandler::new(move |()| handler.call(()))),
                ..Default::default()
            },
            ModalAction {
                label: t("components.hk.solarLocationSetting.apply", "Apply"),
                variant: ModalActionVariant::Primary,
                on_click: on_apply
                    .map(|handler| EventHandler::new(move |()| handler.call(apply_strategy))),
                ..Default::default()
            },
        ]),
        on_close: props
            .on_close
            .clone()
            .map(|handler| EventHandler::new(move |_event: MouseEvent| handler.call(()))),
        children: VNode::Element(Box::new(editor)),
        ..Default::default()
    });

    VNode::Fragment(vec![row, modal])
}

impl StyledComponent for SolarLocationSettingComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-solar-*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSolarLocationSetting.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "solar-location-setting"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solar_defaults_match_the_vue_state() {
        let props = SolarLocationSettingProps::default();
        assert_eq!(props.strategy, SolarLocationStrategy::Timezone);
        assert!(props.manual_location.is_none());
        assert_eq!(props.system_time_zone, "UTC");
        assert!(!props.open);
        assert_eq!(props.draft_strategy, SolarLocationStrategy::Timezone);
        assert_eq!(props.draft_time_zone, "");
        // The explicit-pick contract's neutral start.
        assert_eq!(props.draft_hemisphere, SolarHemisphere::North);
        assert!(props.resolved_geo.is_none());
        assert!(props.on_open.is_none());
        assert!(props.on_close.is_none());
        assert!(props.on_strategy_change.is_none());
        assert!(props.on_time_zone_change.is_none());
        assert!(props.on_hemisphere_change.is_none());
        assert!(props.on_apply.is_none());
    }

    #[test]
    fn solar_tokens_round_trip_the_vue_union() {
        assert_eq!(SolarLocationStrategy::Timezone.token(), "timezone");
        assert_eq!(SolarLocationStrategy::Ip.token(), "ip");
        assert_eq!(SolarLocationStrategy::Manual.token(), "manual");
        assert_eq!(SolarHemisphere::North.token(), "north");
        assert_eq!(SolarHemisphere::South.token(), "south");
        for strategy in [
            SolarLocationStrategy::Timezone,
            SolarLocationStrategy::Ip,
            SolarLocationStrategy::Manual,
        ] {
            assert_eq!(solar_strategy_from_token(strategy.token()), Some(strategy));
        }
        assert_eq!(
            solar_hemisphere_from_token(SolarHemisphere::South.token()),
            Some(SolarHemisphere::South)
        );
        assert_eq!(solar_strategy_from_token("bogus"), None);
        assert_eq!(solar_hemisphere_from_token(""), None);
    }

    #[test]
    fn solar_summary_matches_the_vue_computed() {
        // timezone: label · system zone.
        assert_eq!(
            solar_summary_text(SolarLocationStrategy::Timezone, None, "Asia/Shanghai"),
            "Time zone · Asia/Shanghai"
        );
        // ip: the bare label.
        assert_eq!(
            solar_summary_text(SolarLocationStrategy::Ip, None, "UTC"),
            "IP location"
        );
        // manual without a stored fix falls back to the system zone and
        // the neutral north (Vue's `??` chain).
        assert_eq!(
            solar_summary_text(SolarLocationStrategy::Manual, None, "UTC"),
            "Manual · UTC · Northern"
        );
        let south = SolarManualLocation {
            time_zone: "Australia/Sydney".to_string(),
            hemisphere: SolarHemisphere::South,
        };
        assert_eq!(
            solar_summary_text(SolarLocationStrategy::Manual, Some(&south), "UTC"),
            "Manual · Australia/Sydney · Southern"
        );
    }

    #[test]
    fn solar_geo_and_readout_follow_vues_formula() {
        // The hemisphere fixes the latitude's sign; the standard offset
        // fixes the longitude (a quarter degree per minute).
        let north = solar_manual_location_geo(480.0, SolarHemisphere::North);
        assert_eq!(north.lat, 31.23);
        assert_eq!(north.lng, 120.0);
        let south = solar_manual_location_geo(-300.0, SolarHemisphere::South);
        assert_eq!(south.lat, -31.23);
        assert_eq!(south.lng, -75.0);
        // toFixed(1) rounds half AWAY from zero: 86.25 → "86.3" (Rust's
        // {:.1} alone would print "86.2").
        assert_eq!(solar_format_coord(31.23), "31.2");
        assert_eq!(solar_format_coord(86.25), "86.3");
        assert_eq!(solar_format_coord(-31.23), "-31.2");
        assert_eq!(solar_format_coord(121.47), "121.5");
        let text = solar_resolved_text(north);
        assert_eq!(text, "Sun clock resolves to ≈ 31.2, 120.0");
    }

    #[test]
    fn solar_strategy_hint_and_options_match_the_vue_side() {
        assert!(solar_strategy_hint(SolarLocationStrategy::Timezone).contains("Offline"));
        assert!(solar_strategy_hint(SolarLocationStrategy::Ip).contains("network"));
        assert!(solar_strategy_hint(SolarLocationStrategy::Manual).contains("IANA"));

        let strategies = solar_strategy_options();
        assert_eq!(strategies.len(), 3);
        assert_eq!(strategies[0].key, "timezone");
        assert_eq!(strategies[1].key, "ip");
        assert_eq!(strategies[2].key, "manual");
        assert!(strategies.iter().all(|option| option.icon.is_some()));

        let hemispheres = solar_hemisphere_options();
        assert_eq!(hemispheres.len(), 2);
        assert_eq!(hemispheres[0].label, "Northern");
        assert_eq!(hemispheres[1].label, "Southern");
        assert!(hemispheres.iter().all(|option| option.icon.is_none()));
    }

    #[test]
    fn solar_glyphs_are_the_lucide_serializations() {
        let clock = solar_clock_icon_svg();
        assert!(
            clock.starts_with(r#"<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" "#),
            "{clock}"
        );
        assert!(
            clock.contains(r#"class="lucide lucide-clock-icon lucide-clock""#),
            "{clock}"
        );
        // Globe2 renders as lucide's `earth` (the alias export).
        assert!(
            solar_globe_icon_svg().contains(r#"class="lucide lucide-earth-icon lucide-earth""#)
        );
        assert!(
            solar_map_pin_icon_svg()
                .contains(r#"class="lucide lucide-map-pin-icon lucide-map-pin""#)
        );
        assert!(clock.contains(r#"<circle cx="12" cy="12" r="10"></circle>"#));
        // The summary glyph follows the strategy.
        assert_eq!(
            solar_summary_icon_svg(SolarLocationStrategy::Manual),
            solar_map_pin_icon_svg()
        );
    }

    #[test]
    fn solar_row_renders_the_vue_contract() {
        let html = SolarLocationSetting(SolarLocationSettingProps {
            strategy: SolarLocationStrategy::Manual,
            manual_location: Some(SolarManualLocation {
                time_zone: "Australia/Sydney".to_string(),
                hemisphere: SolarHemisphere::South,
            }),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-solar-setting""#,
            r#"class="hk-solar-summary""#,
            r#"data-strategy="manual""#,
            r#"class="hk-solar-summary-icon""#,
            r#"aria-hidden="true""#,
            "lucide-map-pin",
            r#"class="hk-solar-summary-text""#,
            "Manual · Australia/Sydney · Southern",
            "hk-solar-edit",
            "hk-btn-outline",
            ">Edit</span>",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Editor closed: no editor body, no modal surface.
        assert!(!html.contains("hk-solar-editor"), "{html}");
        assert!(!html.contains("hk-modal-root"), "{html}");
    }

    #[test]
    fn solar_editor_renders_the_manual_pane_and_the_segmented_strips() {
        let html = SolarLocationSetting(SolarLocationSettingProps {
            open: true,
            draft_strategy: SolarLocationStrategy::Manual,
            draft_time_zone: "Asia/Shanghai".to_string(),
            draft_hemisphere: SolarHemisphere::South,
            resolved_geo: Some(SolarGeo {
                lat: 31.23,
                lng: 120.0,
            }),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-solar-editor""#,
            r#"data-strategy="manual""#,
            r#"class="hk-tabs""#,
            r#"data-variant="segmented""#,
            r#"data-scrollable="true""#,
            r#"class="hk-tabs-scroller""#,
            r#"class="hk-tabs-list""#,
            r#"data-block="true""#,
            r#"role="radiogroup""#,
            r#"class="hk-tabs-indicator""#,
            r#"role="radio""#,
            r#"aria-checked="true""#,
            r#"aria-checked="false""#,
            r#"data-active="true""#,
            r#"class="hk-tabs-trigger-icon""#,
            r#"tabindex="-1""#,
            r#"class="hk-solar-hint""#,
            "Pick an IANA time zone",
            r#"class="hk-solar-manual""#,
            // The mirrored globe picker writes the same draft zone.
            "hk-timezone-globe",
            r#"data-zone="Asia/Shanghai""#,
            r#"class="hk-solar-hemisphere""#,
            r#"class="hk-solar-field-label""#,
            "Hemisphere",
            "Southern",
            r#"class="hk-solar-resolved""#,
            r#"data-test="hk-solar-resolved""#,
            "Sun clock resolves to ≈ 31.2, 120.0",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The modal frame: Cancel + Apply footer, the sm preset.
        assert!(html.contains("hk-modal-title"), "{html}");
        assert!(html.contains("Sun clock location"), "{html}");
        assert!(html.contains(">Cancel<"), "{html}");
        assert!(html.contains(">Apply<"), "{html}");
    }

    #[test]
    fn solar_editor_hides_the_manual_pane_for_other_strategies() {
        let html = SolarLocationSetting(SolarLocationSettingProps {
            open: true,
            draft_strategy: SolarLocationStrategy::Ip,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-strategy="ip""#), "{html}");
        assert!(!html.contains("hk-solar-manual"), "{html}");
        assert!(!html.contains("hk-timezone-globe"), "{html}");
        assert!(!html.contains("hk-solar-resolved"), "{html}");
        // Three strategy triggers; the ip one is active.
        assert_eq!(
            html.matches(r#"class="hk-tabs-trigger""#).count(),
            3,
            "{html}"
        );
        assert!(html.contains(r#"aria-checked="true""#), "{html}");
    }

    #[test]
    fn solar_styles_come_from_the_canonical_vue_sheet() {
        let css = SolarLocationSettingComponent::styles();
        for needle in [
            ".hk-solar-setting",
            ".hk-solar-summary",
            ".hk-solar-summary-icon",
            ".hk-solar-summary-text",
            ".hk-solar-edit",
            ".hk-solar-editor",
            ".hk-solar-hint",
            ".hk-solar-manual",
            ".hk-solar-hemisphere",
            ".hk-solar-field-label",
            ".hk-solar-resolved",
        ] {
            assert!(
                css.contains(needle),
                "solar-location-setting css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored solar-location-setting sheet"
        );
        assert_eq!(
            SolarLocationSettingComponent::name(),
            "solar-location-setting"
        );
    }
}
