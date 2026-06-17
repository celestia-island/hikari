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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_all_variants() {
        assert_eq!(Display::Hidden.class_name(), "hi-hidden");
        assert_eq!(Display::Block.class_name(), "hi-block");
        assert_eq!(Display::InlineBlock.class_name(), "hi-inline-block");
        assert_eq!(Display::Flex.class_name(), "hi-flex");
        assert_eq!(Display::InlineFlex.class_name(), "hi-inline-flex");
        assert_eq!(Display::Grid.class_name(), "hi-grid");
        assert_eq!(Display::InlineGrid.class_name(), "hi-inline-grid");
    }

    #[test]
    fn display_copy_equality() {
        let a = Display::Flex;
        let b = a;
        assert_eq!(a, b);
        assert_ne!(Display::Hidden, Display::Flex);
    }

    #[test]
    fn flex_direction_all_variants() {
        assert_eq!(FlexDirection::Row.class_name(), "hi-flex-row");
        assert_eq!(FlexDirection::Column.class_name(), "hi-flex-col");
        assert_eq!(
            FlexDirection::RowReverse.class_name(),
            "hi-flex-row-reverse"
        );
        assert_eq!(
            FlexDirection::ColumnReverse.class_name(),
            "hi-flex-col-reverse"
        );
    }

    #[test]
    fn flex_wrap_all_variants() {
        assert_eq!(FlexWrap::Wrap.class_name(), "hi-flex-wrap");
        assert_eq!(FlexWrap::Nowrap.class_name(), "hi-flex-nowrap");
        assert_eq!(FlexWrap::WrapReverse.class_name(), "hi-flex-wrap-reverse");
    }

    #[test]
    fn flex_all_variants() {
        assert_eq!(Flex::Flex1.class_name(), "hi-flex-1");
        assert_eq!(Flex::Auto.class_name(), "hi-flex-auto");
        assert_eq!(Flex::None.class_name(), "hi-flex-none");
        assert_eq!(Flex::Grow0.class_name(), "hi-grow-0");
        assert_eq!(Flex::Grow1.class_name(), "hi-grow-1");
        assert_eq!(Flex::Shrink0.class_name(), "hi-shrink-0");
        assert_eq!(Flex::Shrink1.class_name(), "hi-shrink-1");
    }

    #[test]
    fn align_items_all_variants() {
        assert_eq!(AlignItems::Start.class_name(), "hi-items-start");
        assert_eq!(AlignItems::End.class_name(), "hi-items-end");
        assert_eq!(AlignItems::Center.class_name(), "hi-items-center");
        assert_eq!(AlignItems::Stretch.class_name(), "hi-items-stretch");
        assert_eq!(AlignItems::Baseline.class_name(), "hi-items-baseline");
    }

    #[test]
    fn justify_content_all_variants() {
        assert_eq!(JustifyContent::Start.class_name(), "hi-justify-start");
        assert_eq!(JustifyContent::End.class_name(), "hi-justify-end");
        assert_eq!(JustifyContent::Center.class_name(), "hi-justify-center");
        assert_eq!(JustifyContent::Between.class_name(), "hi-justify-between");
        assert_eq!(JustifyContent::Around.class_name(), "hi-justify-around");
        assert_eq!(JustifyContent::Evenly.class_name(), "hi-justify-evenly");
    }

    #[test]
    fn align_self_all_variants() {
        assert_eq!(AlignSelf::Start.class_name(), "hi-self-start");
        assert_eq!(AlignSelf::End.class_name(), "hi-self-end");
        assert_eq!(AlignSelf::Center.class_name(), "hi-self-center");
        assert_eq!(AlignSelf::Stretch.class_name(), "hi-self-stretch");
        assert_eq!(AlignSelf::Auto.class_name(), "hi-self-auto");
    }

    #[test]
    fn grid_cols_all_variants() {
        assert_eq!(GridCols::Col1.class_name(), "hi-grid-cols-1");
        assert_eq!(GridCols::Col2.class_name(), "hi-grid-cols-2");
        assert_eq!(GridCols::Col3.class_name(), "hi-grid-cols-3");
        assert_eq!(GridCols::Col4.class_name(), "hi-grid-cols-4");
        assert_eq!(GridCols::Col5.class_name(), "hi-grid-cols-5");
        assert_eq!(GridCols::Col6.class_name(), "hi-grid-cols-6");
        assert_eq!(GridCols::Col12.class_name(), "hi-grid-cols-12");
    }

    #[test]
    fn gap_all_variants() {
        assert_eq!(Gap::Gap0.class_name(), "hi-gap-0");
        assert_eq!(Gap::Gap1.class_name(), "hi-gap-1");
        assert_eq!(Gap::Gap2.class_name(), "hi-gap-2");
        assert_eq!(Gap::Gap3.class_name(), "hi-gap-3");
        assert_eq!(Gap::Gap4.class_name(), "hi-gap-4");
        assert_eq!(Gap::Gap5.class_name(), "hi-gap-5");
        assert_eq!(Gap::Gap6.class_name(), "hi-gap-6");
        assert_eq!(Gap::Gap8.class_name(), "hi-gap-8");
        assert_eq!(Gap::Gap12.class_name(), "hi-gap-12");
    }

    #[test]
    fn row_gap_all_variants() {
        assert_eq!(RowGap::Gap1.class_name(), "hi-gap-y-1");
        assert_eq!(RowGap::Gap2.class_name(), "hi-gap-y-2");
        assert_eq!(RowGap::Gap3.class_name(), "hi-gap-y-3");
        assert_eq!(RowGap::Gap4.class_name(), "hi-gap-y-4");
    }

    #[test]
    fn column_gap_all_variants() {
        assert_eq!(ColumnGap::Gap1.class_name(), "hi-gap-x-1");
        assert_eq!(ColumnGap::Gap2.class_name(), "hi-gap-x-2");
        assert_eq!(ColumnGap::Gap3.class_name(), "hi-gap-x-3");
        assert_eq!(ColumnGap::Gap4.class_name(), "hi-gap-x-4");
    }

    #[test]
    fn uniqueness_auto_none_hidden() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Flex::None)
            .add_typed(Display::Hidden)
            .add_typed(Flex::Auto)
            .add_typed(AlignSelf::Auto)
            .build();
        assert_eq!(classes, "hi-flex-none hi-hidden hi-flex-auto hi-self-auto");
    }

    #[test]
    fn combo_flex_layout() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Display::Flex)
            .add_typed(FlexDirection::Column)
            .add_typed(AlignItems::Center)
            .add_typed(JustifyContent::Between)
            .add_typed(Gap::Gap4)
            .build();
        assert_eq!(
            classes,
            "hi-flex hi-flex-col hi-items-center hi-justify-between hi-gap-4"
        );
    }

    #[test]
    fn combo_grid_layout() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Display::Grid)
            .add_typed(GridCols::Col3)
            .add_typed(RowGap::Gap2)
            .add_typed(ColumnGap::Gap4)
            .build();
        assert_eq!(classes, "hi-grid hi-grid-cols-3 hi-gap-y-2 hi-gap-x-4");
    }
}
