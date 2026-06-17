//! Effects utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BorderRadius {
    None,
    Sm,
    Rounded,
    Lg,
    Xl,
    Full,
}

impl TypedClass for BorderRadius {
    fn class_name(&self) -> &'static str {
        match self {
            Self::None => "hi-rounded-none",
            Self::Sm => "hi-rounded-sm",
            Self::Rounded => "hi-rounded",
            Self::Lg => "hi-rounded-lg",
            Self::Xl => "hi-rounded-xl",
            Self::Full => "hi-rounded-full",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shadow {
    Md,
    Lg,
}

impl TypedClass for Shadow {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Md => "hi-shadow-md",
            Self::Lg => "hi-shadow-lg",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Opacity {
    O0,
    O50,
    O100,
}

impl TypedClass for Opacity {
    fn class_name(&self) -> &'static str {
        match self {
            Self::O0 => "hi-opacity-0",
            Self::O50 => "hi-opacity-50",
            Self::O100 => "hi-opacity-100",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cursor {
    Pointer,
    NotAllowed,
}

impl TypedClass for Cursor {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Pointer => "hi-cursor-pointer",
            Self::NotAllowed => "hi-cursor-not-allowed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PointerEvents {
    None,
    Auto,
}

impl TypedClass for PointerEvents {
    fn class_name(&self) -> &'static str {
        match self {
            Self::None => "hi-pointer-events-none",
            Self::Auto => "hi-pointer-events-auto",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserSelect {
    None,
    Text,
    All,
}

impl TypedClass for UserSelect {
    fn class_name(&self) -> &'static str {
        match self {
            Self::None => "hi-select-none",
            Self::Text => "hi-select-text",
            Self::All => "hi-select-all",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn border_radius_all_variants() {
        assert_eq!(BorderRadius::None.class_name(), "hi-rounded-none");
        assert_eq!(BorderRadius::Sm.class_name(), "hi-rounded-sm");
        assert_eq!(BorderRadius::Rounded.class_name(), "hi-rounded");
        assert_eq!(BorderRadius::Lg.class_name(), "hi-rounded-lg");
        assert_eq!(BorderRadius::Xl.class_name(), "hi-rounded-xl");
        assert_eq!(BorderRadius::Full.class_name(), "hi-rounded-full");
    }

    #[test]
    fn border_radius_copy_equality() {
        let a = BorderRadius::Lg;
        let b = a;
        assert_eq!(a, b);
        assert_ne!(BorderRadius::None, BorderRadius::Full);
    }

    #[test]
    fn shadow_all_variants() {
        assert_eq!(Shadow::Md.class_name(), "hi-shadow-md");
        assert_eq!(Shadow::Lg.class_name(), "hi-shadow-lg");
    }

    #[test]
    fn opacity_all_variants() {
        assert_eq!(Opacity::O0.class_name(), "hi-opacity-0");
        assert_eq!(Opacity::O50.class_name(), "hi-opacity-50");
        assert_eq!(Opacity::O100.class_name(), "hi-opacity-100");
    }

    #[test]
    fn cursor_all_variants() {
        assert_eq!(Cursor::Pointer.class_name(), "hi-cursor-pointer");
        assert_eq!(Cursor::NotAllowed.class_name(), "hi-cursor-not-allowed");
    }

    #[test]
    fn pointer_events_all_variants() {
        assert_eq!(PointerEvents::None.class_name(), "hi-pointer-events-none");
        assert_eq!(PointerEvents::Auto.class_name(), "hi-pointer-events-auto");
    }

    #[test]
    fn user_select_all_variants() {
        assert_eq!(UserSelect::None.class_name(), "hi-select-none");
        assert_eq!(UserSelect::Text.class_name(), "hi-select-text");
        assert_eq!(UserSelect::All.class_name(), "hi-select-all");
    }

    #[test]
    fn none_collision_check() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(BorderRadius::None)
            .add_typed(PointerEvents::None)
            .add_typed(UserSelect::None)
            .build();
        assert_eq!(
            classes,
            "hi-rounded-none hi-pointer-events-none hi-select-none"
        );
    }

    #[test]
    fn combo_card_effect() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(BorderRadius::Lg)
            .add_typed(Shadow::Md)
            .add_typed(Cursor::Pointer)
            .build();
        assert_eq!(classes, "hi-rounded-lg hi-shadow-md hi-cursor-pointer");
    }

    #[test]
    fn combo_disabled_state() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Opacity::O50)
            .add_typed(Cursor::NotAllowed)
            .add_typed(PointerEvents::None)
            .build();
        assert_eq!(
            classes,
            "hi-opacity-50 hi-cursor-not-allowed hi-pointer-events-none"
        );
    }
}
