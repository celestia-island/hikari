// hi-components/src/data/stat_card.rs
// StatCard — mirror of the canonical Vue `HkStatCard`: one KPI cell for the
// admin stat grids.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkStatCard.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`.
//
//   div.hk-stat-card.hk-stat-card-{variant} [.hk-stat-card-clickable]
//        [role=button][tabindex=0]        (clickable)
//        (style: --hk-pad)
//     ── plain ──
//     div.hk-stat-card-head
//       span.hk-stat-card-label
//       span.hk-stat-card-dot.hk-stat-card-dot-{tone} aria-hidden
//     div.hk-stat-card-value
//     ── chip ──
//     div.hk-stat-card-chip-body
//       span.hk-stat-card-chip-icon.hk-stat-card-chip-icon-{tone} aria-hidden
//       div.hk-stat-card-chip-main
//         div.hk-stat-card-chip-value
//         div.hk-stat-card-chip-label
//       div.hk-stat-card-aside?            (aside slot)
//     ── ring ──
//     GaugeRing (104 / 7 / gap 4, no animation, center value + unit)
//     div.hk-stat-card-ring-label
//       {icon} span.hk-stat-card-ring-label-text
//     ── bar ──
//     div.hk-stat-card-bar-head
//       span.hk-stat-card-label
//       span.hk-stat-card-bar-value
//     ProgressBar (xs, one tone segment)
//     ── every variant ──
//     div.hk-stat-card-hint[.hk-stat-card-{variant}-detail]?   (hint)
//       └ with an action slot: wrapped in
//         div.hk-stat-card-foot[data-has-action] > .hk-stat-card-action
//     div.hk-stat-card-footer?             (footer slot)
//
// The `tone` palette (six) is the one HkIconChip/HkDateTag share.
// Deltas vs Vue (documented): the leading icon is a typed `MdiIcon` (Vue
// takes a component); the ring variant renders through the mirrored
// `GaugeRing`; `pct` is clamped to 0–100 exactly like Vue's `clampPct`.

use hikari_icons::Icon;
use hikari_icons::MdiIcon;

use crate::data::gauge_ring::{GaugeRing, GaugeRingData, GaugeRingProps};
use crate::feedback::progress_bar::{
    ProgressBar, ProgressBarProps, ProgressBarSegment, ProgressBarSize,
};
use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::utils::{HkPad, hk_pad_style};

pub struct StatCardComponent;

/// Tone palette (Vue: `StatTone`, default `muted`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StatTone {
    Success,
    Warning,
    Error,
    Info,
    Primary,
    #[default]
    Muted,
}

impl StatTone {
    /// The modifier suffix Vue appends (`hk-stat-card-dot-{tone}`,
    /// `hk-stat-card-chip-icon-{tone}`).
    pub fn name(self) -> &'static str {
        match self {
            StatTone::Success => "success",
            StatTone::Warning => "warning",
            StatTone::Error => "error",
            StatTone::Info => "info",
            StatTone::Primary => "primary",
            StatTone::Muted => "muted",
        }
    }

    /// Vue's exported `statToneColor()` — the exact theme variable the card
    /// paints itself with.
    pub fn color(self) -> &'static str {
        match self {
            StatTone::Success => "rgb(var(--color-success))",
            StatTone::Warning => "rgb(var(--color-warning))",
            StatTone::Error => "rgb(var(--color-error))",
            StatTone::Info => "rgb(var(--color-info, rgb(var(--color-primary))))",
            StatTone::Primary => "rgb(var(--color-primary))",
            StatTone::Muted => "rgb(var(--color-muted))",
        }
    }
}

/// The four KPI shapes (Vue: `StatVariant`, default `plain`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StatVariant {
    #[default]
    Plain,
    Chip,
    Ring,
    Bar,
}

impl StatVariant {
    pub fn name(self) -> &'static str {
        match self {
            StatVariant::Plain => "plain",
            StatVariant::Chip => "chip",
            StatVariant::Ring => "ring",
            StatVariant::Bar => "bar",
        }
    }
}

/// Vue's `clampPct`: absent → 0, otherwise clamped into 0–100.
pub fn stat_clamp_pct(pct: Option<f64>) -> f64 {
    match pct {
        None => 0.0,
        Some(pct) => pct.clamp(0.0, 100.0),
    }
}

#[define_props]
pub struct StatCardProps {
    #[default]
    pub variant: StatVariant,

    /// Shared container-padding override (`--hk-pad`).
    pub padding: Option<HkPad>,

    #[default]
    pub label: String,

    /// The headline value (Vue: `string | number`).
    #[default]
    pub value: String,

    #[default]
    pub tone: StatTone,

    pub hint: Option<String>,

    /// Whole-card click (drill-through).
    #[default]
    pub clickable: bool,

    /// chip/ring: the leading glyph (Vue passes a component).
    pub icon: Option<MdiIcon>,

    /// ring/bar: gauge percentage (clamped to 0–100).
    pub pct: Option<f64>,

    /// ring: the unit rendered inside the ring under the value.
    pub unit: Option<String>,

    /// Fired on a clickable card (click or Enter/Space).
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// The `action` slot: a corner affordance in the hint row.
    pub action: Option<Element>,

    /// The `footer` slot: free-form row under the hint.
    pub footer: Option<Element>,

    /// The `aside` slot (chip variant only).
    pub aside: Option<Element>,
}

#[component]
pub fn StatCard(props: StatCardProps) -> Element {
    let mut classes = format!("hk-stat-card hk-stat-card-{}", props.variant.name());
    if props.clickable {
        classes.push_str(" hk-stat-card-clickable");
    }

    let click_handler = {
        let onclick = props.onclick.clone();
        move |event: MouseEvent| {
            if let Some(handler) = onclick.as_ref() {
                handler.call(event.clone());
            }
        }
    };

    let key_handler = {
        let onclick = props.onclick.clone();
        move |event: KeyboardEvent| {
            if event.key != "Enter" && event.key != " " {
                return;
            }
            event.prevent_default();
            if let Some(handler) = onclick.as_ref() {
                handler.call(MouseEvent::default());
            }
        }
    };

    // The hint line, wrapped when an action slot needs the corner anchor.
    let hint_detail_class = match props.variant {
        StatVariant::Plain => None,
        StatVariant::Chip => None,
        StatVariant::Ring => Some("hk-stat-card-ring-detail"),
        StatVariant::Bar => Some("hk-stat-card-bar-detail"),
    };
    let hint_node = match &props.hint {
        Some(hint) => {
            // The chip variant's hint never carried a title (Vue R1).
            let titled = props.variant != StatVariant::Chip;
            let mut element = VElement::new("div").class(if let Some(detail) = hint_detail_class {
                format!("hk-stat-card-hint {detail}")
            } else {
                "hk-stat-card-hint".to_string()
            });
            if titled {
                element = element.attr("title", hint.clone());
            }
            element = element.child(VNode::Text(VText::new(hint)));
            Some(VNode::Element(Box::new(element)))
        }
        None => None,
    };
    let hint_markup = match (props.action.as_ref(), hint_node) {
        (Some(action), Some(hint)) => rsx! {
            div {
                class: "hk-stat-card-foot",
                "data-has-action": "",
                {hint}
                div {
                    class: "hk-stat-card-action",
                    // An action must never double-fire a clickable card's click.
                    onclick: move |event: MouseEvent| event.stop_propagation(),
                    {action.clone()}
                }
            }
        },
        (Some(action), None) => rsx! {
            div {
                class: "hk-stat-card-foot",
                "data-has-action": "",
                div {
                    class: "hk-stat-card-action",
                    onclick: move |event: MouseEvent| event.stop_propagation(),
                    {action.clone()}
                }
            }
        },
        (None, Some(hint)) => hint,
        (None, None) => empty_vnode(),
    };

    let footer_markup = match &props.footer {
        Some(footer) => rsx! { div { class: "hk-stat-card-footer", {footer.clone()} } },
        None => empty_vnode(),
    };

    let body: Element = match props.variant {
        StatVariant::Plain => rsx! {
            div {
                class: "hk-stat-card-head",
                span { class: "hk-stat-card-label", "{props.label}" }
                span {
                    class: format!("hk-stat-card-dot hk-stat-card-dot-{}", props.tone.name()),
                    "aria-hidden": "true",
                }
            }
            div { class: "hk-stat-card-value", "{props.value}" }
        },
        StatVariant::Chip => {
            let icon_markup = match props.icon {
                Some(icon) => rsx! {
                    span {
                        class: format!(
                            "hk-stat-card-chip-icon hk-stat-card-chip-icon-{}",
                            props.tone.name()
                        ),
                        "aria-hidden": "true",
                        Icon { icon, size: 16 }
                    }
                },
                None => empty_vnode(),
            };
            let aside_markup = match &props.aside {
                Some(aside) => rsx! { div { class: "hk-stat-card-aside", {aside.clone()} } },
                None => empty_vnode(),
            };
            rsx! {
                div {
                    class: "hk-stat-card-chip-body",
                    {icon_markup}
                    div {
                        class: "hk-stat-card-chip-main",
                        div { class: "hk-stat-card-chip-value", "{props.value}" }
                        div { class: "hk-stat-card-chip-label", "{props.label}" }
                    }
                    {aside_markup}
                }
            }
        }
        StatVariant::Ring => {
            let ring_label_icon = match props.icon {
                Some(icon) => rsx! {
                    span { "aria-hidden": "true", Icon { icon, size: 13 } }
                },
                None => empty_vnode(),
            };
            rsx! {
                // The mirrored ring (sized/animated exactly like Vue's inline
                // usage). A `stat`-shaped wrapper keeps the geometry in props.
                GaugeRing {
                    size: 104.0,
                    stroke_width: 7.0,
                    gap: 4.0,
                    animate: false,
                    rings: Some(vec![GaugeRingData {
                        pct: stat_clamp_pct(props.pct),
                        color: props.tone.color().to_string(),
                        track_color: "rgb(var(--color-text) / 8%)".to_string(),
                        ..Default::default()
                    }]),
                    center_value: Some(props.value.clone()),
                    center_label: props.unit.clone().unwrap_or_default(),
                }
                div {
                    class: "hk-stat-card-ring-label",
                    {ring_label_icon}
                    span { class: "hk-stat-card-ring-label-text", "{props.label}" }
                }
            }
        }
        StatVariant::Bar => rsx! {
            div {
                class: "hk-stat-card-bar-head",
                span { class: "hk-stat-card-label", "{props.label}" }
                span { class: "hk-stat-card-bar-value", "{props.value}" }
            }
            ProgressBar {
                max: 100.0,
                size: ProgressBarSize::Xs,
                segments: Some(vec![ProgressBarSegment {
                    value: stat_clamp_pct(props.pct),
                    color: Some(props.tone.color().to_string()),
                    class: String::new(),
                }]),
            }
        },
    };

    let mut root = VElement::new("div")
        .class(classes)
        .style(hk_pad_style(props.padding));
    if props.clickable {
        root = root
            .attr("role", "button")
            .attr("tabindex", "0")
            .on_click(click_handler)
            .on_keydown(key_handler);
    }
    VNode::Element(Box::new(
        root.child(body).child(hint_markup).child(footer_markup),
    ))
}

impl StyledComponent for StatCardComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkStatCard.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "stat-card"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stat_card_tones_match_the_vue_palette() {
        assert_eq!(StatTone::Success.color(), "rgb(var(--color-success))");
        assert_eq!(StatTone::Error.name(), "error");
        assert_eq!(
            StatTone::Info.color(),
            "rgb(var(--color-info, rgb(var(--color-primary))))"
        );
        assert_eq!(StatVariant::Ring.name(), "ring");
    }

    #[test]
    fn stat_clamp_pct_matches_the_vue_helper() {
        assert_eq!(stat_clamp_pct(None), 0.0);
        assert_eq!(stat_clamp_pct(Some(-5.0)), 0.0);
        assert_eq!(stat_clamp_pct(Some(150.0)), 100.0);
        assert_eq!(stat_clamp_pct(Some(37.5)), 37.5);
    }

    #[test]
    fn stat_card_defaults_match_the_vue_props() {
        let props = StatCardProps::default();
        assert_eq!(props.variant, StatVariant::Plain);
        assert_eq!(props.tone, StatTone::Muted);
        assert!(!props.clickable);
        assert!(props.padding.is_none());
        assert!(props.pct.is_none());
        assert!(props.icon.is_none());
        assert!(props.hint.is_none());
    }

    #[test]
    fn stat_card_plain_renders_head_value_and_dot() {
        let html = StatCard(StatCardProps {
            label: "Hub".to_string(),
            value: "2/2".to_string(),
            tone: StatTone::Success,
            hint: Some("hint".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-stat-card hk-stat-card-plain",
            "hk-stat-card-head",
            "hk-stat-card-dot hk-stat-card-dot-success",
            "hk-stat-card-value",
            "hk-stat-card-hint",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("role=\"button\""), "{html}");
    }

    #[test]
    fn stat_card_clickable_gets_the_button_contract() {
        let html = StatCard(StatCardProps {
            label: "A".to_string(),
            value: "1".to_string(),
            clickable: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-stat-card-clickable"), "{html}");
        assert!(html.contains("role=\"button\""), "{html}");
        assert!(html.contains("tabindex=\"0\""), "{html}");
    }

    #[test]
    fn stat_card_chip_embeds_the_icon_chip_and_aside() {
        let html = StatCard(StatCardProps {
            variant: StatVariant::Chip,
            label: "Running".to_string(),
            value: "3".to_string(),
            tone: StatTone::Info,
            icon: Some(MdiIcon::Help),
            aside: Some(rsx! { span { "A" } }),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains("hk-stat-card-chip-icon hk-stat-card-chip-icon-info"),
            "{html}"
        );
        assert!(html.contains("hk-stat-card-aside"), "{html}");
    }

    #[test]
    fn stat_card_styles_come_from_the_canonical_vue_sheet() {
        let css = StatCardComponent::styles();
        assert!(css.contains(".hk-stat-card"), "missing vue classes");
        assert!(!css.contains("CSS generation failed"), "scss failed");
    }
}
