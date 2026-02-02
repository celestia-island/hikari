// hi-components/tests/feedback_components_tests.rs
// Layer 1 feedback components unit tests

#[cfg(test)]
mod tests {

    use hikari_components::{
        AlertProps, AlertVariant, ToastPosition, ToastProps, ToastVariant, TooltipPlacement,
        TooltipProps,
    };

    // ============= Alert Tests =============

    #[test]
    fn test_alert_props_default() {
        let props = AlertProps::default();

        assert_eq!(props.variant, AlertVariant::Info);
        assert_eq!(props.closable, false);
    }

    #[test]
    fn test_alert_props_with_variant() {
        let props = AlertProps {
            variant: AlertVariant::Error,
            ..Default::default()
        };

        assert_eq!(props.variant, AlertVariant::Error);
    }

    #[test]
    fn test_alert_props_with_title() {
        let props = AlertProps {
            title: Some("Title".to_string()),
            ..Default::default()
        };

        assert_eq!(props.title, Some("Title".to_string()));
    }

    #[test]
    fn test_alert_props_closable() {
        let props = AlertProps {
            closable: true,
            ..Default::default()
        };

        assert!(props.closable);
    }

    #[test]
    fn test_alert_props_with_custom_classes() {
        let props = AlertProps {
            class: "custom-alert".to_string(),
            ..Default::default()
        };

        assert_eq!(props.class, "custom-alert");
    }

    // ============= Toast Tests =============

    #[test]
    fn test_toast_props_default() {
        let props = ToastProps::default();

        assert_eq!(props.variant, ToastVariant::Info);
        assert_eq!(props.position, ToastPosition::TopRight);
        assert_eq!(props.closable, true);
    }

    #[test]
    fn test_toast_props_with_variant() {
        let props = ToastProps {
            variant: ToastVariant::Success,
            ..Default::default()
        };

        assert_eq!(props.variant, ToastVariant::Success);
    }

    #[test]
    fn test_toast_props_with_position() {
        let props = ToastProps {
            position: ToastPosition::BottomLeft,
            ..Default::default()
        };

        assert_eq!(props.position, ToastPosition::BottomLeft);
    }

    #[test]
    fn test_toast_props_with_duration() {
        let props = ToastProps {
            duration: Some(3000),
            ..Default::default()
        };

        assert_eq!(props.duration, Some(3000));
    }

    #[test]
    fn test_toast_props_with_custom_classes() {
        let props = ToastProps {
            class: "custom-toast".to_string(),
            ..Default::default()
        };

        assert_eq!(props.class, "custom-toast");
    }

    // ============= Tooltip Tests =============

    #[test]
    fn test_tooltip_props_default() {
        let props = TooltipProps::default();

        assert_eq!(props.placement, TooltipPlacement::Top);
        assert_eq!(props.arrow, true);
    }

    #[test]
    fn test_tooltip_props_with_placement() {
        let props = TooltipProps {
            placement: TooltipPlacement::Bottom,
            ..Default::default()
        };

        assert_eq!(props.placement, TooltipPlacement::Bottom);
    }

    #[test]
    fn test_tooltip_props_with_delay() {
        let props = TooltipProps {
            delay: Some(500),
            ..Default::default()
        };

        assert_eq!(props.delay, Some(500));
    }

    #[test]
    fn test_tooltip_props_with_custom_classes() {
        let props = TooltipProps {
            class: "custom-tooltip".to_string(),
            ..Default::default()
        };

        assert_eq!(props.class, "custom-tooltip");
    }
}
