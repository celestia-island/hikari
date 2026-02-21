// packages/components/src/display/skeleton.rs
// Skeleton component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, FlexDirection, Gap, Padding};

use crate::styled::StyledComponent;

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

#[derive(Clone, PartialEq, Props, Default)]
pub struct SkeletonProps {
    #[props(default)]
    pub variant: SkeletonVariant,

    #[props(default)]
    pub size: SkeletonSize,

    #[props(default)]
    pub width: Option<String>,

    #[props(default)]
    pub height: Option<String>,

    #[props(default = true)]
    pub animation: bool,

    #[props(default)]
    pub rows: Option<u32>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

#[component]
pub fn Skeleton(props: SkeletonProps) -> Element {
    let variant_class = match props.variant {
        SkeletonVariant::Text => "hi-skeleton-text",
        SkeletonVariant::Circular => "hi-skeleton-circular",
        SkeletonVariant::Rectangular => "hi-skeleton-rectangular",
        SkeletonVariant::Rounded => "hi-skeleton-rounded",
    };

    let size_class = match props.size {
        SkeletonSize::Small => "hi-skeleton-sm",
        SkeletonSize::Medium => "hi-skeleton-md",
        SkeletonSize::Large => "hi-skeleton-lg",
    };

    let animation_class = if props.animation {
        "hi-skeleton-animated"
    } else {
        ""
    };

    let mut style = props.style.clone();
    if let Some(w) = &props.width {
        style = format!("{} width: {};", style, w);
    }
    if let Some(h) = &props.height {
        style = format!("{} height: {};", style, h);
    }

    let classes = ClassesBuilder::new()
        .add_raw("hi-skeleton")
        .add_raw(variant_class)
        .add_raw(size_class)
        .add_raw(animation_class)
        .add_raw(&props.class)
        .build();

    if let Some(rows) = props.rows
        && rows > 1 {
            return rsx! {
                div {
                    class: "hi-skeleton-group",
                    style: "display: flex; flex-direction: column; gap: 0.5rem;",
                    for i in 0..rows {
                        div {
                            key: "{i}",
                            class: "{classes}",
                            style: if i == rows - 1 { "width: 60%;" } else { "" },
                        }
                    }
                }
            };
        }

    rsx! {
        div {
            class: "{classes}",
            style: "{style}",
        }
    }
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct SkeletonCardProps {
    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,

    #[props(default = true)]
    pub show_header: bool,

    #[props(default = true)]
    pub show_avatar: bool,

    #[props(default = 3)]
    pub rows: u32,
}

#[component]
pub fn SkeletonCard(props: SkeletonCardProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(Gap::Gap4)
        .add(Padding::P4)
        .add_raw("hi-skeleton-card")
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{container_classes}",
            style: "{props.style}",

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

                    div {
                        style: "flex: 1;",
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
                for i in 0..props.rows {
                    Skeleton {
                        key: "{i}",
                        variant: SkeletonVariant::Text,
                        width: if i == props.rows - 1 { Some("70%".to_string()) } else { Some("100%".to_string()) },
                    }
                }
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
    rsx! {
        div {
            class: "hi-skeleton-table {props.class}",
            style: "{props.style}",

            div {
                class: "hi-skeleton-table-header",
                style: "display: flex; gap: 1rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--hi-color-border);",
                for col in 0..props.columns {
                    Skeleton {
                        key: "header-{col}",
                        variant: SkeletonVariant::Text,
                        width: Some("80px".to_string()),
                        height: Some("16px".to_string()),
                    }
                }
            }

            for row in 0..props.rows {
                div {
                    key: "{row}",
                    class: "hi-skeleton-table-row",
                    style: "display: flex; gap: 1rem; padding: 0.75rem 1rem;",
                    for col in 0..props.columns {
                        Skeleton {
                            key: "cell-{col}",
                            variant: SkeletonVariant::Text,
                            height: Some("14px".to_string()),
                        }
                    }
                }
            }
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

.hi-skeleton-animated {
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
