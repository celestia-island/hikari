//! Display utility classes
//!
//! CSS display properties with `hi-` prefix.

use serde::{Serialize, Deserialize};
use super::UtilityClass;

/// Display property values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Display {
    /// `display: none`
    Hidden,
    /// `display: block`
    Block,
    /// `display: inline-block`
    InlineBlock,
    /// `display: flex`
    Flex,
    /// `display: inline-flex`
    InlineFlex,
    /// `display: grid`
    Grid,
    /// `display: inline-grid`
    InlineGrid,
}

impl UtilityClass for Display {
    fn as_suffix(&self) -> &'static str {
        match self {
            Display::Hidden => "hidden",
            Display::Block => "block",
            Display::InlineBlock => "inline-block",
            Display::Flex => "flex",
            Display::InlineFlex => "inline-flex",
            Display::Grid => "grid",
            Display::InlineGrid => "inline-grid",
        }
    }
}

/// Flex direction values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlexDirection {
    /// `flex-direction: row`
    Row,
    /// `flex-direction: column`
    Column,
    /// `flex-direction: row-reverse`
    RowReverse,
    /// `flex-direction: column-reverse`
    ColumnReverse,
}

impl UtilityClass for FlexDirection {
    fn as_suffix(&self) -> &'static str {
        match self {
            FlexDirection::Row => "flex-row",
            FlexDirection::Column => "flex-col",
            FlexDirection::RowReverse => "flex-row-reverse",
            FlexDirection::ColumnReverse => "flex-col-reverse",
        }
    }
}

/// Flex wrap values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlexWrap {
    /// `flex-wrap: wrap`
    Wrap,
    /// `flex-wrap: nowrap`
    Nowrap,
    /// `flex-wrap: wrap-reverse`
    WrapReverse,
}

impl UtilityClass for FlexWrap {
    fn as_suffix(&self) -> &'static str {
        match self {
            FlexWrap::Wrap => "flex-wrap",
            FlexWrap::Nowrap => "flex-nowrap",
            FlexWrap::WrapReverse => "flex-wrap-reverse",
        }
    }
}

/// Flex shorthand utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Flex {
    /// `flex: 1 1 0%`
    Flex1,
    /// `flex: 1 1 auto`
    Auto,
    /// `flex: none`
    None,
    /// `flex-grow: 0`
    Grow0,
    /// `flex-grow: 1`
    Grow1,
    /// `flex-shrink: 0`
    Shrink0,
    /// `flex-shrink: 1`
    Shrink1,
}

impl UtilityClass for Flex {
    fn as_suffix(&self) -> &'static str {
        match self {
            Flex::Flex1 => "flex-1",
            Flex::Auto => "flex-auto",
            Flex::None => "flex-none",
            Flex::Grow0 => "grow-0",
            Flex::Grow1 => "grow-1",
            Flex::Shrink0 => "shrink-0",
            Flex::Shrink1 => "shrink-1",
        }
    }
}

/// Align items values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlignItems {
    /// `align-items: flex-start`
    Start,
    /// `align-items: flex-end`
    End,
    /// `align-items: center`
    Center,
    /// `align-items: stretch`
    Stretch,
    /// `align-items: baseline`
    Baseline,
}

impl UtilityClass for AlignItems {
    fn as_suffix(&self) -> &'static str {
        match self {
            AlignItems::Start => "items-start",
            AlignItems::End => "items-end",
            AlignItems::Center => "items-center",
            AlignItems::Stretch => "items-stretch",
            AlignItems::Baseline => "items-baseline",
        }
    }
}

/// Justify content values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum JustifyContent {
    /// `justify-content: flex-start`
    Start,
    /// `justify-content: flex-end`
    End,
    /// `justify-content: center`
    Center,
    /// `justify-content: space-between`
    Between,
    /// `justify-content: space-around`
    Around,
    /// `justify-content: space-evenly`
    Evenly,
}

impl UtilityClass for JustifyContent {
    fn as_suffix(&self) -> &'static str {
        match self {
            JustifyContent::Start => "justify-start",
            JustifyContent::End => "justify-end",
            JustifyContent::Center => "justify-center",
            JustifyContent::Between => "justify-between",
            JustifyContent::Around => "justify-around",
            JustifyContent::Evenly => "justify-evenly",
        }
    }
}

/// Align self values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlignSelf {
    /// `align-self: flex-start`
    Start,
    /// `align-self: flex-end`
    End,
    /// `align-self: center`
    Center,
    /// `align-self: stretch`
    Stretch,
    /// `align-self: auto`
    Auto,
}

impl UtilityClass for AlignSelf {
    fn as_suffix(&self) -> &'static str {
        match self {
            AlignSelf::Start => "self-start",
            AlignSelf::End => "self-end",
            AlignSelf::Center => "self-center",
            AlignSelf::Stretch => "self-stretch",
            AlignSelf::Auto => "self-auto",
        }
    }
}

/// Grid template columns utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GridCols {
    /// 1 column
    Col1,
    /// 2 columns
    Col2,
    /// 3 columns
    Col3,
    /// 4 columns
    Col4,
    /// 5 columns
    Col5,
    /// 6 columns
    Col6,
    /// 12 columns
    Col12,
}

impl UtilityClass for GridCols {
    fn as_suffix(&self) -> &'static str {
        match self {
            GridCols::Col1 => "grid-cols-1",
            GridCols::Col2 => "grid-cols-2",
            GridCols::Col3 => "grid-cols-3",
            GridCols::Col4 => "grid-cols-4",
            GridCols::Col5 => "grid-cols-5",
            GridCols::Col6 => "grid-cols-6",
            GridCols::Col12 => "grid-cols-12",
        }
    }
}

/// Gap utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Gap {
    /// `gap: 0`
    Gap0,
    /// `gap: 0.25rem`
    Gap1,
    /// `gap: 0.5rem`
    Gap2,
    /// `gap: 0.75rem`
    Gap3,
    /// `gap: 1rem`
    Gap4,
    /// `gap: 1.25rem`
    Gap5,
    /// `gap: 1.5rem`
    Gap6,
    /// `gap: 2rem`
    Gap8,
    /// `gap: 3rem`
    Gap12,
}

impl UtilityClass for Gap {
    fn as_suffix(&self) -> &'static str {
        match self {
            Gap::Gap0 => "gap-0",
            Gap::Gap1 => "gap-1",
            Gap::Gap2 => "gap-2",
            Gap::Gap3 => "gap-3",
            Gap::Gap4 => "gap-4",
            Gap::Gap5 => "gap-5",
            Gap::Gap6 => "gap-6",
            Gap::Gap8 => "gap-8",
            Gap::Gap12 => "gap-12",
        }
    }
}

/// Row gap utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RowGap {
    /// `row-gap: 0.25rem`
    Gap1,
    /// `row-gap: 0.5rem`
    Gap2,
    /// `row-gap: 0.75rem`
    Gap3,
    /// `row-gap: 1rem`
    Gap4,
}

impl UtilityClass for RowGap {
    fn as_suffix(&self) -> &'static str {
        match self {
            RowGap::Gap1 => "gap-y-1",
            RowGap::Gap2 => "gap-y-2",
            RowGap::Gap3 => "gap-y-3",
            RowGap::Gap4 => "gap-y-4",
        }
    }
}

/// Column gap utilities
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ColumnGap {
    /// `column-gap: 0.25rem`
    Gap1,
    /// `column-gap: 0.5rem`
    Gap2,
    /// `column-gap: 0.75rem`
    Gap3,
    /// `column-gap: 1rem`
    Gap4,
}

impl UtilityClass for ColumnGap {
    fn as_suffix(&self) -> &'static str {
        match self {
            ColumnGap::Gap1 => "gap-x-1",
            ColumnGap::Gap2 => "gap-x-2",
            ColumnGap::Gap3 => "gap-x-3",
            ColumnGap::Gap4 => "gap-x-4",
        }
    }
}
