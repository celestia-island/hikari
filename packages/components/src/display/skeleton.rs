// packages/components/src/display/skeleton.rs
// Skeleton component with Arknights + FUI styling

use hikari_palette::classes::{
    ClassesBuilder, Display, FlexDirection, Gap, Padding, SkeletonClass,
};
use tairitsu_vdom::IntoAttrValue;

use crate::{prelude::*, styled::StyledComponent};

pub struct SkeletonComponent;

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
        .add(SkeletonClass::Skeleton)
        .add_raw(&props.class);

    // Add variant class
    match props.variant {
        SkeletonVariant::Text => {
            builder = builder.add(SkeletonClass::Text);
        }
        SkeletonVariant::Circular => {
            builder = builder.add_raw("hk-skeleton-circular");
        }
        SkeletonVariant::Rectangular => {
            builder = builder.add(SkeletonClass::Rect);
        }
        SkeletonVariant::Rounded => {
            builder = builder.add_raw("hk-skeleton-rounded");
        }
    }

    // Add size class
    match props.size {
        SkeletonSize::Small => {
            builder = builder.add_raw("hk-skeleton-sm");
        }
        SkeletonSize::Medium => {
            builder = builder.add_raw("hk-skeleton-md");
        }
        SkeletonSize::Large => {
            builder = builder.add_raw("hk-skeleton-lg");
        }
    }

    // Add animation class
    if props.animation {
        builder = builder.add(SkeletonClass::Active);
    }

    let classes = builder.build();

    if props.rows.is_some() && props.rows.unwrap() > 1 {
        let rows = props.rows.unwrap();
        let row_styles: Vec<String> = (0..rows)
            .map(|i| {
                if i == rows - 1 {
                    "width: 60%;".to_string()
                } else {
                    String::new()
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
                class: "hk-skeleton-group",
                style: "display: flex; flex-direction: column; gap: 0.5rem;",
                ..children,
            }
        };
    }

    rsx! {
        div { class: classes, style }
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
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(Gap::Gap4)
        .add(Padding::P4)
        .add_raw("hk-skeleton-card")
        .add_raw(&props.class);

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
                    class: "hk-skeleton-card-header",
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
                class: "hk-skeleton-card-content",
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
                    class: "hk-skeleton-table-row",
                    style: "display: flex; gap: 1rem; padding: 0.75rem 1rem;",
                    ..cells,
                }
            }
        })
        .collect();

    rsx! {
        div {
            class: "hk-skeleton-table {props.class}",
            style: props.style,
            ..table_rows,

            div {
                class: "hk-skeleton-table-header",
                style: "display: flex; gap: 1rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--hi-color-border);",
                ..header_cells,
            }
        }
    }
}

impl StyledComponent for SkeletonComponent {
    fn styles() -> &'static str {
        r#"
.hk-skeleton {
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

.hk-skeleton-animated {
    animation: hi-skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes hi-skeleton-pulse {
    0% {
        background-position: 200% 0;
        opacity: 1;
    }
    50% {
        opacity: 0.7;
    }
    100% {
        background-position: -200% 0;
        opacity: 1;
    }
}

.hk-skeleton-text {
    height: 14px;
    width: 100%;
    border-radius: 4px;
}

.hk-skeleton-circular {
    border-radius: 50%;
}

.hk-skeleton-rectangular {
    border-radius: 0;
}

.hk-skeleton-rounded {
    border-radius: 8px;
}

.hk-skeleton-sm {
    height: 12px;
}

.hk-skeleton-md {
    height: 14px;
}

.hk-skeleton-lg {
    height: 20px;
}

.hk-skeleton-card {
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    background-color: var(--hi-color-surface);
}

.hk-skeleton-table {
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--hi-color-surface);
}

.hk-skeleton-table-row:not(:last-child) {
    border-bottom: 1px solid var(--hi-color-border);
}

[data-theme="dark"] .hk-skeleton {
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
