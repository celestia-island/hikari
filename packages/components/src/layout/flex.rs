// hi-components/src/layout/flex.rs
// FlexBox component for flexible layouts

use dioxus::prelude::*;
use palette::classes::{
    AlignItems, ClassesBuilder, Display, Flex as FlexUtil, FlexDirection, FlexWrap, JustifyContent,
};

use crate::styled::StyledComponent;

/// FlexBox component direction
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Direction {
    #[default]
    Column,
    Row,
    RowReverse,
    ColumnReverse,
}

/// FlexBox component alignment
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Align {
    #[default]
    Start,
    Center,
    End,
    Stretch,
    Baseline,
}

/// FlexBox component justify
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Justify {
    #[default]
    Start,
    Center,
    End,
    Between,
    Around,
    Evenly,
}

/// FlexBox component wrap
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Wrap {
    #[default]
    NoWrap,
    Wrap,
    WrapReverse,
}

/// FlexBox component gap size
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FlexGap {
    #[default]
    None,
    Gap1,
    Gap2,
    Gap3,
    Gap4,
    Gap5,
    Gap6,
    Gap8,
}

#[derive(Clone, PartialEq, Props)]
pub struct FlexBoxProps {
    #[props(default)]
    pub direction: Direction,

    #[props(default)]
    pub align: Align,

    #[props(default)]
    pub justify: Justify,

    #[props(default)]
    pub wrap: Wrap,

    #[props(default)]
    pub gap: FlexGap,

    #[props(default = true)]
    pub flex: bool,

    /// Minimum width (CSS value like "120px", "10rem")
    #[props(default)]
    pub min_width: Option<String>,

    /// Minimum height (CSS value like "100px", "5rem")
    #[props(default)]
    pub min_height: Option<String>,

    /// Maximum width (CSS value like "300px", "20rem")
    #[props(default)]
    pub max_width: Option<String>,

    /// Maximum height (CSS value like "400px", "25rem")
    #[props(default)]
    pub max_height: Option<String>,

    /// Inline flex mode
    #[props(default)]
    pub inline: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,

    #[props(default)]
    pub children: Element,
}

impl Default for FlexBoxProps {
    fn default() -> Self {
        Self {
            direction: Direction::Column,
            align: Align::Start,
            justify: Justify::Start,
            wrap: Wrap::NoWrap,
            gap: FlexGap::None,
            flex: true,
            min_width: None,
            min_height: None,
            max_width: None,
            max_height: None,
            inline: false,
            class: String::default(),
            style: String::default(),
            children: VNode::empty(),
        }
    }
}

#[component]
pub fn FlexBox(props: FlexBoxProps) -> Element {
    let direction_class = match props.direction {
        Direction::Column => FlexDirection::Column,
        Direction::Row => FlexDirection::Row,
        Direction::RowReverse => FlexDirection::RowReverse,
        Direction::ColumnReverse => FlexDirection::ColumnReverse,
    };

    let align_class = match props.align {
        Align::Start => AlignItems::Start,
        Align::Center => AlignItems::Center,
        Align::End => AlignItems::End,
        Align::Stretch => AlignItems::Stretch,
        Align::Baseline => AlignItems::Baseline,
    };

    let justify_class = match props.justify {
        Justify::Start => JustifyContent::Start,
        Justify::Center => JustifyContent::Center,
        Justify::End => JustifyContent::End,
        Justify::Between => JustifyContent::Between,
        Justify::Around => JustifyContent::Around,
        Justify::Evenly => JustifyContent::Evenly,
    };

    let wrap_class = match props.wrap {
        Wrap::NoWrap => FlexWrap::Nowrap,
        Wrap::Wrap => FlexWrap::Wrap,
        Wrap::WrapReverse => FlexWrap::WrapReverse,
    };

    let gap_class = match props.gap {
        FlexGap::None => "",
        FlexGap::Gap1 => "gap-1",
        FlexGap::Gap2 => "gap-2",
        FlexGap::Gap3 => "gap-3",
        FlexGap::Gap4 => "gap-4",
        FlexGap::Gap5 => "gap-5",
        FlexGap::Gap6 => "gap-6",
        FlexGap::Gap8 => "gap-8",
    };

    let display_class = if props.inline {
        Display::InlineFlex
    } else {
        Display::Flex
    };

    let mut builder = ClassesBuilder::new()
        .add(display_class)
        .add(direction_class)
        .add(align_class)
        .add(justify_class)
        .add(wrap_class)
        .add_if(FlexUtil::Flex1, || props.flex)
        .add_raw(gap_class)
        .add_raw(&props.class);

    let classes = builder.build();

    let mut style = props.style.clone();
    if let Some(min_w) = &props.min_width {
        style = format!("{} min-width: {};", style, min_w);
    }
    if let Some(min_h) = &props.min_height {
        style = format!("{} min-height: {};", style, min_h);
    }
    if let Some(max_w) = &props.max_width {
        style = format!("{} max-width: {};", style, max_w);
    }
    if let Some(max_h) = &props.max_height {
        style = format!("{} max-height: {};", style, max_h);
    }

    rsx! {
        div {
            class: "{classes}",
            style: "{style}",
            { props.children }
        }
    }
}

pub struct FlexBoxComponent;

impl StyledComponent for FlexBoxComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/flex.css"))
    }

    fn name() -> &'static str {
        "flex"
    }
}
