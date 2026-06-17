//! Layout utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Position {
    Static,
    Relative,
    Absolute,
    Fixed,
    Sticky,
}

impl TypedClass for Position {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Static => "hi-static",
            Self::Relative => "hi-relative",
            Self::Absolute => "hi-absolute",
            Self::Fixed => "hi-fixed",
            Self::Sticky => "hi-sticky",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Overflow {
    Hidden,
    Auto,
    Scroll,
}

impl TypedClass for Overflow {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Hidden => "hi-overflow-hidden",
            Self::Auto => "hi-overflow-auto",
            Self::Scroll => "hi-overflow-scroll",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverflowX {
    Hidden,
    Auto,
    Scroll,
}

impl TypedClass for OverflowX {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Hidden => "hi-overflow-x-hidden",
            Self::Auto => "hi-overflow-x-auto",
            Self::Scroll => "hi-overflow-x-scroll",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverflowY {
    Hidden,
    Auto,
    Scroll,
}

impl TypedClass for OverflowY {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Hidden => "hi-overflow-y-hidden",
            Self::Auto => "hi-overflow-y-auto",
            Self::Scroll => "hi-overflow-y-scroll",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZIndex {
    Z0,
    Z10,
    Z20,
    Z30,
    Z40,
    Z50,
    Auto,
}

impl TypedClass for ZIndex {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Z0 => "hi-z-0",
            Self::Z10 => "hi-z-10",
            Self::Z20 => "hi-z-20",
            Self::Z30 => "hi-z-30",
            Self::Z40 => "hi-z-40",
            Self::Z50 => "hi-z-50",
            Self::Auto => "hi-z-auto",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn position_all_variants() {
        assert_eq!(Position::Static.class_name(), "hi-static");
        assert_eq!(Position::Relative.class_name(), "hi-relative");
        assert_eq!(Position::Absolute.class_name(), "hi-absolute");
        assert_eq!(Position::Fixed.class_name(), "hi-fixed");
        assert_eq!(Position::Sticky.class_name(), "hi-sticky");
    }

    #[test]
    fn position_copy_equality() {
        let a = Position::Absolute;
        let b = a;
        assert_eq!(a, b);
        assert_ne!(Position::Static, Position::Fixed);
    }

    #[test]
    fn overflow_all_variants() {
        assert_eq!(Overflow::Hidden.class_name(), "hi-overflow-hidden");
        assert_eq!(Overflow::Auto.class_name(), "hi-overflow-auto");
        assert_eq!(Overflow::Scroll.class_name(), "hi-overflow-scroll");
    }

    #[test]
    fn overflow_x_all_variants() {
        assert_eq!(OverflowX::Hidden.class_name(), "hi-overflow-x-hidden");
        assert_eq!(OverflowX::Auto.class_name(), "hi-overflow-x-auto");
        assert_eq!(OverflowX::Scroll.class_name(), "hi-overflow-x-scroll");
    }

    #[test]
    fn overflow_y_all_variants() {
        assert_eq!(OverflowY::Hidden.class_name(), "hi-overflow-y-hidden");
        assert_eq!(OverflowY::Auto.class_name(), "hi-overflow-y-auto");
        assert_eq!(OverflowY::Scroll.class_name(), "hi-overflow-y-scroll");
    }

    #[test]
    fn z_index_all_variants() {
        assert_eq!(ZIndex::Z0.class_name(), "hi-z-0");
        assert_eq!(ZIndex::Z10.class_name(), "hi-z-10");
        assert_eq!(ZIndex::Z20.class_name(), "hi-z-20");
        assert_eq!(ZIndex::Z30.class_name(), "hi-z-30");
        assert_eq!(ZIndex::Z40.class_name(), "hi-z-40");
        assert_eq!(ZIndex::Z50.class_name(), "hi-z-50");
        assert_eq!(ZIndex::Auto.class_name(), "hi-z-auto");
    }

    #[test]
    fn cross_enum_collision_hidden_auto_scroll() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Overflow::Hidden)
            .add_typed(OverflowX::Hidden)
            .add_typed(OverflowY::Hidden)
            .add_typed(Overflow::Auto)
            .add_typed(OverflowX::Auto)
            .add_typed(OverflowY::Auto)
            .add_typed(Overflow::Scroll)
            .add_typed(OverflowX::Scroll)
            .add_typed(OverflowY::Scroll)
            .build();
        assert_eq!(
            classes,
            "hi-overflow-hidden hi-overflow-x-hidden hi-overflow-y-hidden \
             hi-overflow-auto hi-overflow-x-auto hi-overflow-y-auto \
             hi-overflow-scroll hi-overflow-x-scroll hi-overflow-y-scroll"
        );
    }

    #[test]
    fn cross_enum_collision_auto_zindex() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Overflow::Auto)
            .add_typed(ZIndex::Auto)
            .build();
        assert_eq!(classes, "hi-overflow-auto hi-z-auto");
    }

    #[test]
    fn combo_position_and_zindex() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Position::Absolute)
            .add_typed(ZIndex::Z50)
            .build();
        assert_eq!(classes, "hi-absolute hi-z-50");
    }
}
