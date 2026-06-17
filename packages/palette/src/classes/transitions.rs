//! Transition utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Transition {
    All,
    Colors,
    Transform,
}

impl TypedClass for Transition {
    fn class_name(&self) -> &'static str {
        match self {
            Self::All => "hi-transition-all",
            Self::Colors => "hi-transition-colors",
            Self::Transform => "hi-transition-transform",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Duration {
    D150,
    D300,
    D500,
}

impl TypedClass for Duration {
    fn class_name(&self) -> &'static str {
        match self {
            Self::D150 => "hi-duration-150",
            Self::D300 => "hi-duration-300",
            Self::D500 => "hi-duration-500",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ease {
    InOut,
}

impl TypedClass for Ease {
    fn class_name(&self) -> &'static str {
        match self {
            Self::InOut => "hi-ease-in-out",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Transform {
    TranslateX0,
    TranslateXFull,
    TranslateY0,
}

impl TypedClass for Transform {
    fn class_name(&self) -> &'static str {
        match self {
            Self::TranslateX0 => "hi-translate-x-0",
            Self::TranslateXFull => "hi-translate-x-full",
            Self::TranslateY0 => "hi-translate-y-0",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transition_all_variants() {
        assert_eq!(Transition::All.class_name(), "hi-transition-all");
        assert_eq!(Transition::Colors.class_name(), "hi-transition-colors");
        assert_eq!(
            Transition::Transform.class_name(),
            "hi-transition-transform"
        );
    }

    #[test]
    fn transition_copy_equality() {
        let a = Transition::All;
        let b = a;
        assert_eq!(a, b);
        assert_ne!(Transition::All, Transition::Colors);
    }

    #[test]
    fn duration_all_variants() {
        assert_eq!(Duration::D150.class_name(), "hi-duration-150");
        assert_eq!(Duration::D300.class_name(), "hi-duration-300");
        assert_eq!(Duration::D500.class_name(), "hi-duration-500");
    }

    #[test]
    fn ease_all_variants() {
        assert_eq!(Ease::InOut.class_name(), "hi-ease-in-out");
        let a = Ease::InOut;
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn transform_all_variants() {
        assert_eq!(Transform::TranslateX0.class_name(), "hi-translate-x-0");
        assert_eq!(
            Transform::TranslateXFull.class_name(),
            "hi-translate-x-full"
        );
        assert_eq!(Transform::TranslateY0.class_name(), "hi-translate-y-0");
    }

    #[test]
    fn combo_full_transition() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Transition::All)
            .add_typed(Duration::D300)
            .add_typed(Ease::InOut)
            .build();
        assert_eq!(classes, "hi-transition-all hi-duration-300 hi-ease-in-out");
    }

    #[test]
    fn combo_slide_in() {
        let classes = crate::ClassesBuilder::new()
            .add_typed(Transition::Transform)
            .add_typed(Duration::D150)
            .add_typed(Transform::TranslateX0)
            .build();
        assert_eq!(
            classes,
            "hi-transition-transform hi-duration-150 hi-translate-x-0"
        );
    }
}
