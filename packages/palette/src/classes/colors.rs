//! Color utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextColor {
    White,
    Black,
    Primary,
    Secondary,
    Muted,
    Accent,
}

impl TypedClass for TextColor {
    fn class_name(&self) -> &'static str {
        match self {
            Self::White => "hi-text-white",
            Self::Black => "hi-text-black",
            Self::Primary => "hi-text-primary",
            Self::Secondary => "hi-text-secondary",
            Self::Muted => "hi-text-muted",
            Self::Accent => "hi-text-accent",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BgColor {
    White,
    Black,
    Transparent,
    Surface,
    Primary,
    Secondary,
    Accent,
}

impl TypedClass for BgColor {
    fn class_name(&self) -> &'static str {
        match self {
            Self::White => "hi-bg-white",
            Self::Black => "hi-bg-black",
            Self::Transparent => "hi-bg-transparent",
            Self::Surface => "hi-bg-surface",
            Self::Primary => "hi-bg-primary",
            Self::Secondary => "hi-bg-secondary",
            Self::Accent => "hi-bg-accent",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BorderColor {
    Transparent,
}

impl TypedClass for BorderColor {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Transparent => "hi-border-transparent",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_color_all_variants() {
        assert_eq!(TextColor::White.class_name(), "hi-text-white");
        assert_eq!(TextColor::Black.class_name(), "hi-text-black");
        assert_eq!(TextColor::Primary.class_name(), "hi-text-primary");
        assert_eq!(TextColor::Secondary.class_name(), "hi-text-secondary");
        assert_eq!(TextColor::Muted.class_name(), "hi-text-muted");
        assert_eq!(TextColor::Accent.class_name(), "hi-text-accent");
    }

    #[test]
    fn text_color_copy_equality() {
        let a = TextColor::Primary;
        let b = a;
        assert_eq!(a, b);
        assert_eq!(a, TextColor::Primary);
        assert_ne!(TextColor::White, TextColor::Black);
    }

    #[test]
    fn bg_color_all_variants() {
        assert_eq!(BgColor::White.class_name(), "hi-bg-white");
        assert_eq!(BgColor::Black.class_name(), "hi-bg-black");
        assert_eq!(BgColor::Transparent.class_name(), "hi-bg-transparent");
        assert_eq!(BgColor::Surface.class_name(), "hi-bg-surface");
        assert_eq!(BgColor::Primary.class_name(), "hi-bg-primary");
        assert_eq!(BgColor::Secondary.class_name(), "hi-bg-secondary");
        assert_eq!(BgColor::Accent.class_name(), "hi-bg-accent");
    }

    #[test]
    fn bg_color_copy_equality() {
        let a = BgColor::Surface;
        let b = a;
        assert_eq!(a, b);
        assert_ne!(BgColor::Transparent, BgColor::White);
    }

    #[test]
    fn border_color_all_variants() {
        assert_eq!(
            BorderColor::Transparent.class_name(),
            "hi-border-transparent"
        );
        let a = BorderColor::Transparent;
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn cross_enum_collision_check() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(TextColor::White)
            .add_typed(BgColor::White)
            .add_typed(TextColor::Black)
            .add_typed(BgColor::Black)
            .add_typed(TextColor::Primary)
            .add_typed(BgColor::Primary)
            .add_typed(TextColor::Secondary)
            .add_typed(BgColor::Secondary)
            .add_typed(TextColor::Accent)
            .add_typed(BgColor::Accent)
            .add_typed(BgColor::Transparent)
            .add_typed(BorderColor::Transparent)
            .build();
        assert_eq!(
            classes,
            "hi-text-white hi-bg-white hi-text-black hi-bg-black \
             hi-text-primary hi-bg-primary hi-text-secondary hi-bg-secondary \
             hi-text-accent hi-bg-accent hi-bg-transparent hi-border-transparent"
        );
    }

    #[test]
    fn combo_text_and_bg() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(TextColor::Muted)
            .add_typed(BgColor::Surface)
            .build();
        assert_eq!(classes, "hi-text-muted hi-bg-surface");
    }
}
