//! Sizing utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Width {
    Full,
    Screen,
    Auto,
    W6,
    W8,
    W12,
    W16,
    W24,
    W64,
}

impl TypedClass for Width {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Full => "hi-w-full",
            Self::Screen => "hi-w-screen",
            Self::Auto => "hi-w-auto",
            Self::W6 => "hi-w-6",
            Self::W8 => "hi-w-8",
            Self::W12 => "hi-w-12",
            Self::W16 => "hi-w-16",
            Self::W24 => "hi-w-24",
            Self::W64 => "hi-w-64",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Height {
    Full,
    Screen,
    Auto,
    H6,
    H8,
    H10,
    H12,
}

impl TypedClass for Height {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Full => "hi-h-full",
            Self::Screen => "hi-h-screen",
            Self::Auto => "hi-h-auto",
            Self::H6 => "hi-h-6",
            Self::H8 => "hi-h-8",
            Self::H10 => "hi-h-10",
            Self::H12 => "hi-h-12",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MinWidth {
    MinW0,
}

impl TypedClass for MinWidth {
    fn class_name(&self) -> &'static str {
        match self {
            Self::MinW0 => "hi-min-w-0",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MaxWidth {
    MaxWFull,
    MaxW2xl,
    MaxW3xl,
    MaxW4xl,
    MaxWLogo,
}

impl TypedClass for MaxWidth {
    fn class_name(&self) -> &'static str {
        match self {
            Self::MaxWFull => "hi-max-w-full",
            Self::MaxW2xl => "hi-max-w-2xl",
            Self::MaxW3xl => "hi-max-w-3xl",
            Self::MaxW4xl => "hi-max-w-4xl",
            Self::MaxWLogo => "hi-max-w-logo",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ObjectFit {
    Contain,
    Cover,
    Fill,
    None,
    ScaleDown,
}

impl TypedClass for ObjectFit {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Contain => "hi-object-contain",
            Self::Cover => "hi-object-cover",
            Self::Fill => "hi-object-fill",
            Self::None => "hi-object-none",
            Self::ScaleDown => "hi-object-scale-down",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn width_all_variants() {
        assert_eq!(Width::Full.class_name(), "hi-w-full");
        assert_eq!(Width::Screen.class_name(), "hi-w-screen");
        assert_eq!(Width::Auto.class_name(), "hi-w-auto");
        assert_eq!(Width::W6.class_name(), "hi-w-6");
        assert_eq!(Width::W8.class_name(), "hi-w-8");
        assert_eq!(Width::W12.class_name(), "hi-w-12");
        assert_eq!(Width::W16.class_name(), "hi-w-16");
        assert_eq!(Width::W24.class_name(), "hi-w-24");
        assert_eq!(Width::W64.class_name(), "hi-w-64");
    }

    #[test]
    fn width_copy_equality() {
        let a = Width::Full;
        let b = a;
        assert_eq!(a, b);
        assert_ne!(Width::W6, Width::W64);
    }

    #[test]
    fn height_all_variants() {
        assert_eq!(Height::Full.class_name(), "hi-h-full");
        assert_eq!(Height::Screen.class_name(), "hi-h-screen");
        assert_eq!(Height::Auto.class_name(), "hi-h-auto");
        assert_eq!(Height::H6.class_name(), "hi-h-6");
        assert_eq!(Height::H8.class_name(), "hi-h-8");
        assert_eq!(Height::H10.class_name(), "hi-h-10");
        assert_eq!(Height::H12.class_name(), "hi-h-12");
    }

    #[test]
    fn min_width_all_variants() {
        assert_eq!(MinWidth::MinW0.class_name(), "hi-min-w-0");
        let a = MinWidth::MinW0;
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn max_width_all_variants() {
        assert_eq!(MaxWidth::MaxWFull.class_name(), "hi-max-w-full");
        assert_eq!(MaxWidth::MaxW2xl.class_name(), "hi-max-w-2xl");
        assert_eq!(MaxWidth::MaxW3xl.class_name(), "hi-max-w-3xl");
        assert_eq!(MaxWidth::MaxW4xl.class_name(), "hi-max-w-4xl");
        assert_eq!(MaxWidth::MaxWLogo.class_name(), "hi-max-w-logo");
    }

    #[test]
    fn object_fit_all_variants() {
        assert_eq!(ObjectFit::Contain.class_name(), "hi-object-contain");
        assert_eq!(ObjectFit::Cover.class_name(), "hi-object-cover");
        assert_eq!(ObjectFit::Fill.class_name(), "hi-object-fill");
        assert_eq!(ObjectFit::None.class_name(), "hi-object-none");
        assert_eq!(ObjectFit::ScaleDown.class_name(), "hi-object-scale-down");
    }

    #[test]
    fn cross_enum_collision_auto_full_screen_none() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Width::Auto)
            .add_typed(Height::Auto)
            .add_typed(Width::Full)
            .add_typed(Height::Full)
            .add_typed(Width::Screen)
            .add_typed(Height::Screen)
            .add_typed(ObjectFit::None)
            .build();
        assert_eq!(
            classes,
            "hi-w-auto hi-h-auto hi-w-full hi-h-full hi-w-screen hi-h-screen hi-object-none"
        );
    }

    #[test]
    fn combo_sizing() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Width::Full)
            .add_typed(MaxWidth::MaxW3xl)
            .add_typed(Height::Screen)
            .add_typed(ObjectFit::Cover)
            .build();
        assert_eq!(
            classes,
            "hi-w-full hi-max-w-3xl hi-h-screen hi-object-cover"
        );
    }
}
