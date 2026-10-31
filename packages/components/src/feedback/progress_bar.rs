// hi-components/src/feedback/progress_bar.rs
// ProgressBar — mirror of the canonical Vue `HkProgressBar`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkProgressBar.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-progress-bar*` class names are literal and identical in both forms.
// DOM contract (mirrors Vue one-to-one):
//
//   div.hk-progress-bar[data-size={size}]
//     span.hk-progress-bar-label                       (show_label only)
//     div.hk-progress-bar-track [.hk-progress-bar-track--segments]
//       ── segments mode ──
//       div.hk-progress-bar-seg [+segment.class]
//                                    (style: width %; background if color)
//       ── value mode ──
//       div.hk-progress-bar-secondary .hk-progress-bar-secondary-{status}
//                                    (style: width %; only when secondary)
//       div.hk-progress-bar-fill .hk-progress-bar-fill-{status}
//                                    (style: width %)
//       ── indeterminate ──
//       div.hk-progress-bar-indeterminate
//           .hk-progress-bar-indeterminate-{status}
//
// Replaces the retired legacy `Progress` component (`hk-progress-*`
// linear/circle variants, hand-rolled inline CSS); the ring half of the
// legacy component lives on in `progress_ring.rs` (mirror of HkProgressRing).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ProgressBarComponent;

/// The three status inks (Vue: `"loading" | "done" | "error"`, default
/// `loading`). Ignored in segments mode.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ProgressBarStatus {
    #[default]
    Loading,
    Done,
    Error,
}

impl ProgressBarStatus {
    pub fn class_name(self) -> &'static str {
        match self {
            ProgressBarStatus::Loading => "loading",
            ProgressBarStatus::Done => "done",
            ProgressBarStatus::Error => "error",
        }
    }
}

/// Track size: `data-size` on the root (`xs` / `sm` / `md`, default `sm`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ProgressBarSize {
    Xs,
    #[default]
    Sm,
    Md,
}

impl ProgressBarSize {
    pub fn class_name(self) -> &'static str {
        match self {
            ProgressBarSize::Xs => "xs",
            ProgressBarSize::Sm => "sm",
            ProgressBarSize::Md => "md",
        }
    }
}

/// One block of a segmented progress bar (Vue: `HProgressBarSegment`).
/// `value` is a percentage (0-100); blocks lay left-to-right and their
/// values must not sum past 100.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ProgressBarSegment {
    pub value: f64,
    /// Any CSS color, including `rgb(var(--x) / a)` space syntax. `None`
    /// falls back to the theme primary background.
    pub color: Option<String>,
    /// Extra class appended to this block.
    pub class: String,
}

#[define_props]
pub struct ProgressBarProps {
    /// Determinate fill percentage input, scaled by `max`. `None` renders
    /// the indeterminate track.
    pub value: Option<f64>,

    /// Secondary (buffered) fill behind the primary one.
    pub secondary: Option<f64>,

    /// The `value`/`secondary` scale denominator (default 100).
    #[default(100.0)]
    pub max: f64,

    /// Fill ink.
    #[default]
    pub status: ProgressBarStatus,

    /// Track size (`data-size`).
    #[default]
    pub size: ProgressBarSize,

    /// Render the label line above the track.
    #[default]
    pub show_label: bool,

    /// Explicit label text; when empty the rounded percentage shows (and
    /// segments mode shows nothing without it).
    pub label: Option<String>,

    /// Segmented mode: when `Some` (an empty vec included) the track renders
    /// one block per segment instead of the value/secondary fills.
    pub segments: Option<Vec<ProgressBarSegment>>,
}

fn clamp_pct(value: f64, max: f64) -> f64 {
    if max <= 0.0 {
        return 0.0;
    }
    ((value / max) * 100.0).clamp(0.0, 100.0)
}

#[component]
pub fn ProgressBar(props: ProgressBarProps) -> Element {
    let segmented = props.segments.is_some();
    let pct = props.value.map(|v| clamp_pct(v, props.max));
    let secondary_pct = props.secondary.map(|v| clamp_pct(v, props.max));

    // Vue: explicit label wins; segments mode has no single value, so only
    // an explicit caller label shows there; otherwise the rounded percentage.
    let display_label = match &props.label {
        Some(label) if !label.is_empty() => label.clone(),
        _ => {
            if segmented {
                String::new()
            } else {
                match pct {
                    Some(pct) => format!("{}%", pct.round() as i64),
                    None => String::new(),
                }
            }
        }
    };

    let mut track_classes = String::from("hk-progress-bar-track");
    if segmented {
        track_classes.push(' ');
        track_classes.push_str("hk-progress-bar-track--segments");
    }

    let status = props.status.class_name();
    let root_size = props.size.class_name();

    rsx! {
        div {
            class: "hk-progress-bar",
            "data-size": root_size,
            if props.show_label {
                span { class: "hk-progress-bar-label",
                    "{display_label}"
                }
            }
            div {
                class: track_classes,
                if let Some(segments) = &props.segments {
                    for (i, seg) in segments.iter().enumerate() {
                        {
                            let width = format!("{}%", seg.value.clamp(0.0, 100.0));
                            let mut style = format!("width:{width}");
                            if let Some(color) = &seg.color {
                                style.push_str(&format!(";background:{color}"));
                            }
                            let mut classes = String::from("hk-progress-bar-seg");
                            if !seg.class.is_empty() {
                                classes.push(' ');
                                classes.push_str(&seg.class);
                            }
                            rsx! {
                                div {
                                    key: i,
                                    class: classes,
                                    style: style,
                                }
                            }
                        }
                    }
                } else if let Some(pct) = pct {
                    if let Some(secondary) = secondary_pct {
                        div {
                            class: format!("hk-progress-bar-secondary hk-progress-bar-secondary-{status}"),
                            style: format!("width:{secondary}%"),
                        }
                    }
                    div {
                        class: format!("hk-progress-bar-fill hk-progress-bar-fill-{status}"),
                        style: format!("width:{pct}%"),
                    }
                } else {
                    div {
                        class: format!("hk-progress-bar-indeterminate hk-progress-bar-indeterminate-{status}"),
                    }
                }
            }
        }
    }
}

impl StyledComponent for ProgressBarComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkProgressBar.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "progress-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_bar_clamp_matches_the_vue_math() {
        assert_eq!(clamp_pct(50.0, 100.0), 50.0);
        assert_eq!(clamp_pct(-10.0, 100.0), 0.0);
        assert_eq!(clamp_pct(150.0, 100.0), 100.0);
        assert_eq!(clamp_pct(3.0, 4.0), 75.0);
        // A zero/negative max cannot divide; Vue would produce NaN, the
        // mirror pins 0 — documented in the PR.
        assert_eq!(clamp_pct(10.0, 0.0), 0.0);
    }

    #[test]
    fn progress_bar_defaults_match_the_vue_props() {
        let props = ProgressBarProps::default();
        assert_eq!(props.value, None);
        assert_eq!(props.secondary, None);
        assert_eq!(props.max, 100.0);
        assert_eq!(props.status, ProgressBarStatus::Loading);
        assert_eq!(props.size, ProgressBarSize::Sm);
        assert!(!props.show_label);
        assert_eq!(props.label, None);
        assert_eq!(props.segments, None);
    }

    #[test]
    fn progress_bar_status_and_size_tokens() {
        assert_eq!(ProgressBarStatus::Loading.class_name(), "loading");
        assert_eq!(ProgressBarStatus::Done.class_name(), "done");
        assert_eq!(ProgressBarStatus::Error.class_name(), "error");
        assert_eq!(ProgressBarSize::Xs.class_name(), "xs");
        assert_eq!(ProgressBarSize::Sm.class_name(), "sm");
        assert_eq!(ProgressBarSize::Md.class_name(), "md");
    }

    #[test]
    fn progress_bar_styles_come_from_the_canonical_vue_sheet() {
        let css = ProgressBarComponent::styles();
        assert!(
            css.contains(".hk-progress-bar") && css.contains(".hk-progress-bar-track"),
            "progress bar css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored progress bar sheet"
        );
    }
}
