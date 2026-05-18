// hi-components/src/basic/typography.rs
// Typography component — unified text rendering for headings, body, code, etc.

use crate::prelude::*;
use crate::styled::StyledComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TextVariant {
    #[default]
    Body,
    H1,
    H2,
    H3,
    H4,
    H5,
    H6,
    Caption,
    Code,
    Muted,
    Overline,
}

#[define_props]
pub struct TypographyProps {
    #[default]
    pub variant: TextVariant,

    #[default]
    pub class: String,

    #[default]
    pub style: String,

    pub children: Element,
}

#[component]
pub fn Typography(props: TypographyProps) -> Element {
    let variant_class = match props.variant {
        TextVariant::H1 => "hi-typography hi-typography-h1",
        TextVariant::H2 => "hi-typography hi-typography-h2",
        TextVariant::H3 => "hi-typography hi-typography-h3",
        TextVariant::H4 => "hi-typography hi-typography-h4",
        TextVariant::H5 => "hi-typography hi-typography-h5",
        TextVariant::H6 => "hi-typography hi-typography-h6",
        TextVariant::Body => "hi-typography hi-typography-body",
        TextVariant::Caption => "hi-typography hi-typography-caption",
        TextVariant::Code => "hi-typography hi-typography-code",
        TextVariant::Muted => "hi-typography hi-typography-muted",
        TextVariant::Overline => "hi-typography hi-typography-overline",
    };

    let tag = match props.variant {
        TextVariant::H1
        | TextVariant::H2
        | TextVariant::H3
        | TextVariant::H4
        | TextVariant::H5
        | TextVariant::H6 => "div",
        TextVariant::Code => "code",
        _ => "span",
    };

    let mut classes = variant_class.to_string();
    if !props.class.is_empty() {
        classes.push(' ');
        classes.push_str(&props.class);
    }

    match tag {
        "code" => VNode::Element(
            VElement::new("code")
                .class(classes)
                .style(props.style)
                .child(props.children),
        ),
        "div" => VNode::Element(
            VElement::new("div")
                .class(classes)
                .style(props.style)
                .child(props.children),
        ),
        _ => VNode::Element(
            VElement::new("span")
                .class(classes)
                .style(props.style)
                .child(props.children),
        ),
    }
}

pub struct TypographyComponent;

impl StyledComponent for TypographyComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/typography.css"))
    }

    fn name() -> &'static str {
        "typography"
    }
}
