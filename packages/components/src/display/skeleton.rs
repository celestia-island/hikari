// packages/components/src/display/skeleton.rs
// Skeleton component with Arknights + FUI styling

use hikari_palette::classes::{
    ClassesBuilder, Display, FlexDirection, Gap, Padding, SkeletonClass,
    components::SkeletonDisplayClass,
};
use tairitsu_vdom::IntoAttrValue;

use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_hooks::ReactiveSignal;

use crate::{platform, prelude::*, styled::StyledComponent};

pub struct SkeletonComponent;

struct SkeletonAnimState {
    phase: f64,
    last_ts: Option<f64>,
    stopped: bool,
}

const SKELETON_PERIOD_MS: f64 = 1500.0;

fn skeleton_anim_loop(
    state: Rc<RefCell<SkeletonAnimState>>,
    bg_pos_signal: ReactiveSignal<f64>,
    opacity_signal: ReactiveSignal<f64>,
) {
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = state.borrow_mut();
        if s.stopped {
            return;
        }
        let prev = s.last_ts.unwrap_or(ts);
        let delta = ts - prev;
        s.last_ts = Some(ts);
        s.phase = (s.phase + delta / SKELETON_PERIOD_MS) % 1.0;
        let phase = s.phase;
        drop(s);

        let pos = 200.0 - 400.0 * phase;
        let op = 1.0 - 0.3 * (std::f64::consts::PI * phase).sin();
        bg_pos_signal.set(pos);
        opacity_signal.set(op);

        skeleton_anim_loop(state.clone(), bg_pos_signal.clone(), opacity_signal.clone());
    });
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SkeletonVariant {
    #[default]
    Text,
    Circular,
    Rectangular,
    Rounded,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SkeletonSize {
    #[default]
    Medium,
    Small,
    Large,
}

// Implement IntoAttrValue so these types can be used as HTML attributes
impl IntoAttrValue for SkeletonVariant {
    fn into_attr_value(self) -> Option<String> {
        Some(match self {
            SkeletonVariant::Text => "text".to_string(),
            SkeletonVariant::Circular => "circular".to_string(),
            SkeletonVariant::Rectangular => "rectangular".to_string(),
            SkeletonVariant::Rounded => "rounded".to_string(),
        })
    }
}

#[define_props]
pub struct SkeletonProps {
    #[default]
    pub variant: SkeletonVariant,

    #[default]
    pub size: SkeletonSize,

    #[default]
    pub width: Option<String>,

    #[default]
    pub height: Option<String>,

    #[default(true)]
    pub animation: bool,

    #[default]
    pub rows: Option<u32>,

    #[default]
    pub class: String,

    #[default]
    pub style: String,
}

#[component]
pub fn Skeleton(props: SkeletonProps) -> Element {
    let mut style = props.style.clone();
    if let Some(w) = &props.width {
        style = format!("{} width: {};", style, w);
    }
    if let Some(h) = &props.height {
        style = format!("{} height: {};", style, h);
    }

    let mut builder = ClassesBuilder::new()
        .add_typed(SkeletonClass::Skeleton)
        .add(&props.class);

    match props.variant {
        SkeletonVariant::Text => {
            builder = builder.add_typed(SkeletonClass::Text);
        }
        SkeletonVariant::Circular => {
            builder = builder.add_typed(SkeletonDisplayClass::Circular);
        }
        SkeletonVariant::Rectangular => {
            builder = builder.add_typed(SkeletonClass::Rect);
        }
        SkeletonVariant::Rounded => {
            builder = builder.add_typed(SkeletonDisplayClass::Rounded);
        }
    }

    match props.size {
        SkeletonSize::Small => {
            builder = builder.add_typed(SkeletonDisplayClass::Sm);
        }
        SkeletonSize::Medium => {
            builder = builder.add_typed(SkeletonDisplayClass::Md);
        }
        SkeletonSize::Large => {
            builder = builder.add_typed(SkeletonDisplayClass::Lg);
        }
    }

    if props.animation {
        builder = builder.add_typed(SkeletonClass::Active);
    }

    let classes = builder.build();

    let bg_pos_signal = use_signal(|| 200.0_f64);
    let opacity_signal = use_signal(|| 1.0_f64);

    {
        let bp_clone = bg_pos_signal.clone();
        let op_clone = opacity_signal.clone();
        let is_animated = props.animation;
        use_effect(move || {
            if !is_animated {
                return;
            }
            let state = Rc::new(RefCell::new(SkeletonAnimState {
                phase: 0.0,
                last_ts: None,
                stopped: false,
            }));
            let s_ref = state.clone();
            let bp_sig = bp_clone.clone();
            let op_sig = op_clone.clone();
            platform::request_animation_frame_with_timestamp(move |ts| {
                let mut s = s_ref.borrow_mut();
                if s.stopped {
                    return;
                }
                s.last_ts = Some(ts);
                drop(s);
                skeleton_anim_loop(s_ref.clone(), bp_sig.clone(), op_sig.clone());
            });
        });
    }

    let anim_style = if props.animation {
        let pos = bg_pos_signal.get();
        let op = opacity_signal.get();
        format!("background-position: {pos:.1}% 0; opacity: {op:.2};")
    } else {
        String::new()
    };

    if props.rows.is_some() && props.rows.unwrap() > 1 {
        let rows = props.rows.unwrap();
        let anim = anim_style.clone();
        let row_styles: Vec<String> = (0..rows)
            .map(|i| {
                let base = if i == rows - 1 {
                    "width: 60%;".to_string()
                } else {
                    String::new()
                };
                if props.animation {
                    format!("{base} {anim}")
                } else {
                    base
                }
            })
            .collect();

        let children: Vec<VNode> = (0..rows)
            .map(|i| {
                let row_style = row_styles[i as usize].clone();
                let classes = classes.clone();
                rsx! {
                    div { key: i, class: classes, style: row_style }
                }
            })
            .collect();

        return rsx! {
            div {
                class: "hi-skeleton-group",
                style: "display: flex; flex-direction: column; gap: 0.5rem;",
                ..children,
            }
        };
    }

    let final_style = if props.animation && !anim_style.is_empty() {
        format!("{style} {anim_style}")
    } else {
        style
    };

    rsx! {
        div { class: classes, style: final_style }
    }
}

#[define_props]
pub struct SkeletonCardProps {
    #[default]
    pub class: String,

    #[default]
    pub style: String,

    #[default(true)]
    pub show_header: bool,

    #[default(true)]
    pub show_avatar: bool,

    #[default(3)]
    pub rows: u32,
}

#[component]
pub fn SkeletonCard(props: SkeletonCardProps) -> Element {
    let mut builder = ClassesBuilder::new()
        .add_typed(Display::Flex)
        .add_typed(FlexDirection::Column)
        .add_typed(Gap::Gap4)
        .add_typed(Padding::P4)
        .add_typed(SkeletonDisplayClass::Card)
        .add(&props.class);

    let container_classes = builder.build();

    let rows = props.rows;
    let content_rows: Vec<VNode> = (0..rows)
        .map(|i| {
            let width = if i == rows - 1 { "70%" } else { "100%" };
            rsx! {
                Skeleton {
                    variant: SkeletonVariant::Text,
                    width: Some(width.to_string()),
                }
            }
        })
        .collect();

    rsx! {
        div { class: container_classes, style: props.style,

            if props.show_header {
                div {
                    class: "hi-skeleton-card-header",
                    style: "display: flex; align-items: center; gap: 0.75rem;",

                    if props.show_avatar {
                        Skeleton {
                            variant: SkeletonVariant::Circular,
                            width: Some("40px".to_string()),
                            height: Some("40px".to_string()),
                        }
                    }

                    div { style: "flex: 1;",
                        Skeleton {
                            variant: SkeletonVariant::Text,
                            width: Some("40%".to_string()),
                            height: Some("20px".to_string()),
                        }
                        div { style: "height: 8px;" }
                        Skeleton {
                            variant: SkeletonVariant::Text,
                            width: Some("60%".to_string()),
                            height: Some("14px".to_string()),
                        }
                    }
                }
            }

            div {
                class: "hi-skeleton-card-content",
                style: "display: flex; flex-direction: column; gap: 0.5rem;",
                ..content_rows,
            }
        }
    }
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct SkeletonTableProps {
    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,

    #[props(default = 3)]
    pub columns: u32,

    #[props(default = 5)]
    pub rows: u32,
}

#[component]
pub fn SkeletonTable(props: SkeletonTableProps) -> Element {
    let columns = props.columns;
    let rows = props.rows;

    // Build header cells
    let header_cells: Vec<VNode> = (0..columns)
        .map(|_col| {
            rsx! {
                Skeleton {
                    variant: SkeletonVariant::Text,
                    width: Some("80px".to_string()),
                    height: Some("16px".to_string()),
                }
            }
        })
        .collect();

    // Build table rows
    let table_rows: Vec<VNode> = (0..rows)
        .map(|_row| {
            let cells: Vec<VNode> = (0..columns)
                .map(|_col| {
                    rsx! {
                        Skeleton {
                            variant: SkeletonVariant::Text,
                            height: Some("14px".to_string()),
                        }
                    }
                })
                .collect();
            rsx! {
                div {
                    class: "hi-skeleton-table-row",
                    style: "display: flex; gap: 1rem; padding: 0.75rem 1rem;",
                    ..cells,
                }
            }
        })
        .collect();

    rsx! {
        div {
            class: "hi-skeleton-table {props.class}",
            style: props.style,

            div {
                class: "hi-skeleton-table-header",
                style: "display: flex; gap: 1rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--hi-color-border);",
                ..header_cells,
            }

            ..table_rows,
        }
    }
}

impl StyledComponent for SkeletonComponent {
    fn styles() -> &'static str {
        r#"
.hi-skeleton {
    display: block;
    background: linear-gradient(
        90deg,
        var(--hi-color-surface) 25%,
        var(--hi-color-background) 50%,
        var(--hi-color-surface) 75%
    );
    background-size: 200% 100%;
    border-radius: 4px;
}

.hi-skeleton-text {
    height: 14px;
    width: 100%;
    border-radius: 4px;
}

.hi-skeleton-circular {
    border-radius: 50%;
}

.hi-skeleton-rectangular {
    border-radius: 0;
}

.hi-skeleton-rounded {
    border-radius: 8px;
}

.hi-skeleton-sm {
    height: 12px;
}

.hi-skeleton-md {
    height: 14px;
}

.hi-skeleton-lg {
    height: 20px;
}

.hi-skeleton-card {
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    background-color: var(--hi-color-surface);
}

.hi-skeleton-table {
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--hi-color-surface);
}

.hi-skeleton-table-row:not(:last-child) {
    border-bottom: 1px solid var(--hi-color-border);
}

[data-theme="dark"] .hi-skeleton {
    background: linear-gradient(
        90deg,
        var(--hi-surface) 25%,
        var(--hi-surface-hover) 50%,
        var(--hi-surface) 75%
    );
    background-size: 200% 100%;
}
"#
    }

    fn name() -> &'static str {
        "skeleton"
    }
}
