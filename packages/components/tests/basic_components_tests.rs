// hi-components/tests/basic_components_tests.rs
// Layer 1 basic components unit tests

#[cfg(test)]
mod tests {
    // Note: Using full paths for type imports
    use hikari_components::basic::badge::{BadgeProps, BadgeVariant};
    use hikari_components::basic::button::{ButtonProps, ButtonSize, ButtonVariant, ButtonWidth};
    use hikari_components::basic::card::CardProps;
    use hikari_components::basic::input::{InputProps, InputSize};

    // ============= Button Tests =============

    #[test]
    fn test_button_props_default() {
        let props = ButtonProps::default();

        assert_eq!(props.variant, ButtonVariant::Primary);
        assert_eq!(props.size, ButtonSize::Medium);
        assert_eq!(props.width, ButtonWidth::Auto);
        assert_eq!(props.disabled, false);
        assert_eq!(props.loading, false);
    }

    #[test]
    fn test_button_props_with_variant() {
        let props = ButtonProps {
            variant: ButtonVariant::Danger,
            ..Default::default()
        };

        assert_eq!(props.variant, ButtonVariant::Danger);
    }

    #[test]
    fn test_button_props_disabled() {
        let props = ButtonProps {
            disabled: true,
            ..Default::default()
        };

        assert!(props.disabled);
    }

    // ============= Input Tests =============

    #[test]
    fn test_input_props_default() {
        let props = InputProps::default();

        assert_eq!(props.size, InputSize::Medium);
        assert_eq!(props.disabled, false);
        assert_eq!(props.readonly, false);
    }

    #[test]
    fn test_input_props_with_placeholder() {
        let props = InputProps {
            placeholder: Some("Enter text".to_string()),
            ..Default::default()
        };

        assert_eq!(props.placeholder, Some("Enter text".to_string()));
    }

    #[test]
    fn test_input_props_disabled() {
        let props = InputProps {
            disabled: true,
            ..Default::default()
        };

        assert!(props.disabled);
    }

    // ============= Card Tests =============

    #[test]
    fn test_card_props_default() {
        let props = CardProps::default();

        assert_eq!(props.bordered, false);
        assert_eq!(props.hoverable, false);
    }

    #[test]
    fn test_card_props_bordered() {
        let props = CardProps {
            bordered: true,
            ..Default::default()
        };

        assert!(props.bordered);
    }

    // ============= Badge Tests =============

    #[test]
    fn test_badge_props_default() {
        let props = BadgeProps::default();

        assert_eq!(props.variant, BadgeVariant::Default);
        assert_eq!(props.dot, false);
    }

    #[test]
    fn test_badge_props_with_variant() {
        let props = BadgeProps {
            variant: BadgeVariant::Success,
            ..Default::default()
        };

        assert_eq!(props.variant, BadgeVariant::Success);
    }

    #[test]
    fn test_badge_props_with_count() {
        let props = BadgeProps {
            count: Some(5),
            ..Default::default()
        };

        assert_eq!(props.count, Some(5));
    }
}
