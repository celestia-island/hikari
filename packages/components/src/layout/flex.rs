// hi-components/src/layout/flex.rs
// FlexBox component for flexible layouts

use crate::prelude::*;
use hikari_palette::classes::{
    AlignItems, ClassesBuilder, Display, Flex as FlexUtil, FlexDirection, FlexWrap, JustifyContent,
};

use crate::{styled::StyledComponent, theme::use_layout_direction};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Direction {
    #[default]
    Column,
    Row,
    RowReverse,
    ColumnReverse,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Align {
    #[default]
    Start,
    Center,
    End,
    Stretch,
    Baseline,
}

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

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum Wrap {
    #[default]
    NoWrap,
    Wrap,
    WrapReverse,
}

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

#[define_props]
pub struct FlexBoxProps {
    pub direction: Direction,

    pub align: Align,

    pub justify: Justify,

    pub wrap: Wrap,

    pub gap: FlexGap,

    #[default(true)]
    pub flex: bool,

    pub min_width: Option<String>,

    pub min_height: Option<String>,

    pub max_width: Option<String>,

    pub max_height: Option<String>,

    pub inline: bool,

    pub rtl: Option<bool>,

    pub class: String,

    pub style: String,

    pub children: Element,
}

#[component]
pub fn FlexBox(props: FlexBoxProps) -> Element {
    let layout_direction = use_layout_direction();
    let is_rtl = props.rtl.unwrap_or_else(|| layout_direction.is_rtl());

    let direction_class = match props.direction {
        Direction::Column => FlexDirection::Column,
        Direction::Row => {
            if is_rtl {
                FlexDirection::RowReverse
            } else {
                FlexDirection::Row
            }
        }
        Direction::RowReverse => {
            if is_rtl {
                FlexDirection::Row
            } else {
                FlexDirection::RowReverse
            }
        }
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

    let builder = ClassesBuilder::new()
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
            class: classes,
            style: style,
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
