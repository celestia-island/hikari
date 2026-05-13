//! Display utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Display {
    Hidden,
    Block,
    InlineBlock,
    Flex,
    InlineFlex,
    Grid,
    InlineGrid,
}

impl TypedClass for Display {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Hidden => "hi-hidden",
            Self::Block => "hi-block",
            Self::InlineBlock => "hi-inline-block",
            Self::Flex => "hi-flex",
            Self::InlineFlex => "hi-inline-flex",
            Self::Grid => "hi-grid",
            Self::InlineGrid => "hi-inline-grid",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FlexDirection {
    Row,
    Column,
    RowReverse,
    ColumnReverse,
}

impl TypedClass for FlexDirection {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Row => "hi-flex-row",
            Self::Column => "hi-flex-col",
            Self::RowReverse => "hi-flex-row-reverse",
            Self::ColumnReverse => "hi-flex-col-reverse",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FlexWrap {
    Wrap,
    Nowrap,
    WrapReverse,
}

impl TypedClass for FlexWrap {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Wrap => "hi-flex-wrap",
            Self::Nowrap => "hi-flex-nowrap",
            Self::WrapReverse => "hi-flex-wrap-reverse",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flex {
    Flex1,
    Auto,
    None,
    Grow0,
    Grow1,
    Shrink0,
    Shrink1,
}

impl TypedClass for Flex {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Flex1 => "hi-flex-1",
            Self::Auto => "hi-flex-auto",
            Self::None => "hi-flex-none",
            Self::Grow0 => "hi-grow-0",
            Self::Grow1 => "hi-grow-1",
            Self::Shrink0 => "hi-shrink-0",
            Self::Shrink1 => "hi-shrink-1",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlignItems {
    Start,
    End,
    Center,
    Stretch,
    Baseline,
}

impl TypedClass for AlignItems {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Start => "hi-items-start",
            Self::End => "hi-items-end",
            Self::Center => "hi-items-center",
            Self::Stretch => "hi-items-stretch",
            Self::Baseline => "hi-items-baseline",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JustifyContent {
    Start,
    End,
    Center,
    Between,
    Around,
    Evenly,
}

impl TypedClass for JustifyContent {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Start => "hi-justify-start",
            Self::End => "hi-justify-end",
            Self::Center => "hi-justify-center",
            Self::Between => "hi-justify-between",
            Self::Around => "hi-justify-around",
            Self::Evenly => "hi-justify-evenly",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlignSelf {
    Start,
    End,
    Center,
    Stretch,
    Auto,
}

impl TypedClass for AlignSelf {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Start => "hi-self-start",
            Self::End => "hi-self-end",
            Self::Center => "hi-self-center",
            Self::Stretch => "hi-self-stretch",
            Self::Auto => "hi-self-auto",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GridCols {
    Col1,
    Col2,
    Col3,
    Col4,
    Col5,
    Col6,
    Col12,
}

impl TypedClass for GridCols {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Col1 => "hi-grid-cols-1",
            Self::Col2 => "hi-grid-cols-2",
            Self::Col3 => "hi-grid-cols-3",
            Self::Col4 => "hi-grid-cols-4",
            Self::Col5 => "hi-grid-cols-5",
            Self::Col6 => "hi-grid-cols-6",
            Self::Col12 => "hi-grid-cols-12",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Gap {
    Gap0,
    Gap1,
    Gap2,
    Gap3,
    Gap4,
    Gap5,
    Gap6,
    Gap8,
    Gap12,
}

impl TypedClass for Gap {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Gap0 => "hi-gap-0",
            Self::Gap1 => "hi-gap-1",
            Self::Gap2 => "hi-gap-2",
            Self::Gap3 => "hi-gap-3",
            Self::Gap4 => "hi-gap-4",
            Self::Gap5 => "hi-gap-5",
            Self::Gap6 => "hi-gap-6",
            Self::Gap8 => "hi-gap-8",
            Self::Gap12 => "hi-gap-12",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RowGap {
    Gap1,
    Gap2,
    Gap3,
    Gap4,
}

impl TypedClass for RowGap {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Gap1 => "hi-gap-y-1",
            Self::Gap2 => "hi-gap-y-2",
            Self::Gap3 => "hi-gap-y-3",
            Self::Gap4 => "hi-gap-y-4",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColumnGap {
    Gap1,
    Gap2,
    Gap3,
    Gap4,
}

impl TypedClass for ColumnGap {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Gap1 => "hi-gap-x-1",
            Self::Gap2 => "hi-gap-x-2",
            Self::Gap3 => "hi-gap-x-3",
            Self::Gap4 => "hi-gap-x-4",
        }
    }
}
