// packages/components/src/display/tag.rs
// Tag component

use hikari_palette::classes::{
    AlignItems, ClassesBuilder, Display, Flex, Gap, TagClass, UtilityClass,
};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TagComponent;

/// Tag variant determining visual style
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TagVariant {
    #[default]
    Default,
    Primary,
    Success,
    Warning,
    Danger,
    Info,
}

#[define_props]
pub struct TagProps {
    pub variant: TagVariant,
    pub closable: bool,
    pub on_close: Option<EventHandler<MouseEvent>>,
    pub class: String,
    pub style: String,
    pub children: Element,
}

#[component]
pub fn Tag(props: TagProps) -> Element {
    let variant_class = match props.variant {
        TagVariant::Default => TagClass::Default,
        TagVariant::Primary => TagClass::Primary,
        TagVariant::Success => TagClass::Success,
        TagVariant::Warning => TagClass::Warning,
        TagVariant::Danger => TagClass::Danger,
        TagVariant::Info => TagClass::Info,
    };

    let tag_classes = ClassesBuilder::new()
        .add(Display::InlineFlex)
        .add(Flex::Flex1)
        .add(AlignItems::Center)
        .add(Gap::Gap2)
        .add(TagClass::Tag)
        .add(variant_class)
        .add_raw(&props.class)
        .build();

    rsx! {
        span { class: tag_classes, style: props.style,

            {props.children}

            if props.closable {
                button {
                    class: TagClass::Close.as_class(),
                    onclick: move |e| {
                        if let Some(ref on_close) = props.on_close {
                            on_close.call(e);
                        }
                    },
                    Icon { icon: MdiIcon::Close, size: 12, class: String::new(), color: String::new() }
                }
            }
        }
    }
}

impl StyledComponent for TagComponent {
    fn styles() -> &'static str {
        r#"
.hk-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1;
    border-radius: 4px;
    border: 1px solid transparent;
    transition: all 0.2s ease;
}

/* Status families ride the theme palette channels (2026-10-19 color
 * audit: these were a hardcoded tailwind-style palette — success/warning/
 * danger/info never followed a themed palette). info maps to the accent
 * slot, matching focus-brightness/glow's own info treatment. The color-mix
 * alphas keep the original visuals; fallbacks keep themeless rendering. */
.hk-tag-default {
    background-color: color-mix(in srgb, var(--hi-text-secondary, #6b7280) 10%, transparent);
    color: var(--hi-color-text-primary);
    border-color: color-mix(in srgb, var(--hi-text-secondary, #6b7280) 20%, transparent);
}

.hk-tag-default:hover {
    background-color: color-mix(in srgb, var(--hi-text-secondary, #6b7280) 20%, transparent);
}

.hk-tag-primary {
    background-color: color-mix(in srgb, var(--hi-color-primary, #3b82f6) 10%, transparent);
    color: var(--hi-color-primary);
    border-color: color-mix(in srgb, var(--hi-color-primary, #3b82f6) 30%, transparent);
}

.hk-tag-primary:hover {
    background-color: color-mix(in srgb, var(--hi-color-primary, #3b82f6) 20%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--hi-color-primary, #3b82f6) 30%, transparent);
}

.hk-tag-success {
    background-color: color-mix(in srgb, var(--hi-success, #10b981) 10%, transparent);
    color: var(--hi-success, #10b981);
    border-color: color-mix(in srgb, var(--hi-success, #10b981) 30%, transparent);
}

.hk-tag-success:hover {
    background-color: color-mix(in srgb, var(--hi-success, #10b981) 20%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--hi-success, #10b981) 30%, transparent);
}

.hk-tag-warning {
    background-color: color-mix(in srgb, var(--hi-warning, #f59e0b) 10%, transparent);
    color: var(--hi-warning, #f59e0b);
    border-color: color-mix(in srgb, var(--hi-warning, #f59e0b) 30%, transparent);
}

.hk-tag-warning:hover {
    background-color: color-mix(in srgb, var(--hi-warning, #f59e0b) 20%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--hi-warning, #f59e0b) 30%, transparent);
}

.hk-tag-danger {
    background-color: color-mix(in srgb, var(--hi-danger, #ff4c00) 10%, transparent);
    color: var(--hi-danger, #ff4c00);
    border-color: color-mix(in srgb, var(--hi-danger, #ff4c00) 30%, transparent);
}

.hk-tag-danger:hover {
    background-color: color-mix(in srgb, var(--hi-danger, #ff4c00) 20%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--hi-danger, #ff4c00) 30%, transparent);
}

.hk-tag-info {
    background-color: color-mix(in srgb, var(--hi-accent, #06b6d4) 10%, transparent);
    color: var(--hi-accent, #06b6d4);
    border-color: color-mix(in srgb, var(--hi-accent, #06b6d4) 30%, transparent);
}

.hk-tag-info:hover {
    background-color: color-mix(in srgb, var(--hi-accent, #06b6d4) 20%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--hi-accent, #06b6d4) 30%, transparent);
}

.hk-tag-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 4px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: inherit;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s ease;
}

.hk-tag-close:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
}
"#
    }

    fn name() -> &'static str {
        "tag"
    }
}
