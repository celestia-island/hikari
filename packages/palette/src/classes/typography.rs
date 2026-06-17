//! Typography utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FontSize {
    Xs,
    Sm,
    Base,
    Lg,
    Xl,
    X2xl,
    X3xl,
    X4xl,
}

impl TypedClass for FontSize {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Xs => "hi-text-xs",
            Self::Sm => "hi-text-sm",
            Self::Base => "hi-text-base",
            Self::Lg => "hi-text-lg",
            Self::Xl => "hi-text-xl",
            Self::X2xl => "hi-text-2xl",
            Self::X3xl => "hi-text-3xl",
            Self::X4xl => "hi-text-4xl",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FontWeight {
    Normal,
    Medium,
    Semibold,
    Bold,
}

impl TypedClass for FontWeight {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Normal => "hi-font-normal",
            Self::Medium => "hi-font-medium",
            Self::Semibold => "hi-font-semibold",
            Self::Bold => "hi-font-bold",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

impl TypedClass for TextAlign {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Left => "hi-text-left",
            Self::Center => "hi-text-center",
            Self::Right => "hi-text-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextTransform {
    Uppercase,
    Lowercase,
    Capitalize,
}

impl TypedClass for TextTransform {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Uppercase => "hi-uppercase",
            Self::Lowercase => "hi-lowercase",
            Self::Capitalize => "hi-capitalize",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn font_size_all_variants() {
        assert_eq!(FontSize::Xs.class_name(), "hi-text-xs");
        assert_eq!(FontSize::Sm.class_name(), "hi-text-sm");
        assert_eq!(FontSize::Base.class_name(), "hi-text-base");
        assert_eq!(FontSize::Lg.class_name(), "hi-text-lg");
        assert_eq!(FontSize::Xl.class_name(), "hi-text-xl");
        assert_eq!(FontSize::X2xl.class_name(), "hi-text-2xl");
        assert_eq!(FontSize::X3xl.class_name(), "hi-text-3xl");
        assert_eq!(FontSize::X4xl.class_name(), "hi-text-4xl");
    }

    #[test]
    fn font_size_copy_equality() {
        let a = FontSize::Base;
        let b = a;
        assert_eq!(a, b);
        assert_ne!(FontSize::Xs, FontSize::X4xl);
    }

    #[test]
    fn font_weight_all_variants() {
        assert_eq!(FontWeight::Normal.class_name(), "hi-font-normal");
        assert_eq!(FontWeight::Medium.class_name(), "hi-font-medium");
        assert_eq!(FontWeight::Semibold.class_name(), "hi-font-semibold");
        assert_eq!(FontWeight::Bold.class_name(), "hi-font-bold");
    }

    #[test]
    fn text_align_all_variants() {
        assert_eq!(TextAlign::Left.class_name(), "hi-text-left");
        assert_eq!(TextAlign::Center.class_name(), "hi-text-center");
        assert_eq!(TextAlign::Right.class_name(), "hi-text-right");
    }

    #[test]
    fn text_transform_all_variants() {
        assert_eq!(TextTransform::Uppercase.class_name(), "hi-uppercase");
        assert_eq!(TextTransform::Lowercase.class_name(), "hi-lowercase");
        assert_eq!(TextTransform::Capitalize.class_name(), "hi-capitalize");
    }

    #[test]
    fn cross_enum_collision_center() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(TextAlign::Center)
            .build();
        assert_eq!(classes, "hi-text-center");
    }

    #[test]
    fn combo_heading() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(FontSize::X2xl)
            .add_typed(FontWeight::Bold)
            .add_typed(TextAlign::Center)
            .build();
        assert_eq!(classes, "hi-text-2xl hi-font-bold hi-text-center");
    }

    #[test]
    fn combo_body_text() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(FontSize::Sm)
            .add_typed(FontWeight::Normal)
            .add_typed(TextTransform::Uppercase)
            .build();
        assert_eq!(classes, "hi-text-sm hi-font-normal hi-uppercase");
    }
}
