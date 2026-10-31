mod tests {

    use hikari_components::prelude::*;
    use hikari_icons::MdiIcon;

    #[test]
    fn test_alert_props_default() {
        let props = AlertProps::default();
        // Vue default variant is "error" (the legacy Rust default was "info").
        assert_eq!(
            props.variant,
            hikari_components::feedback::AlertVariant::Error
        );
        assert!(!props.closable);
        assert!(!props.banner);
        assert_eq!(props.message, "");
        assert!(props.title.is_none());
        assert!(props.body.is_none());
        assert!(props.icon.is_none());
        assert!(props.on_close.is_none());
    }

    #[test]
    fn test_alert_props_banner() {
        let props = AlertProps {
            banner: true,
            ..Default::default()
        };
        assert!(props.banner);
    }

    #[test]
    fn test_alert_props_body_slot() {
        let props = AlertProps {
            body: Some(hikari_components::prelude::empty_vnode()),
            ..Default::default()
        };
        assert!(props.body.is_some());
    }

    #[test]
    fn test_alert_props_with_variant() {
        let props = AlertProps {
            variant: hikari_components::feedback::AlertVariant::Error,
            ..Default::default()
        };
        assert_eq!(
            props.variant,
            hikari_components::feedback::AlertVariant::Error
        );
    }

    #[test]
    fn test_alert_props_with_title() {
        let props = AlertProps {
            title: Some("Test Alert".to_string()),
            ..Default::default()
        };
        assert_eq!(props.title, Some("Test Alert".to_string()));
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

    #[test]
    fn test_alert_size_variants() {
        let sm = AlertProps {
            size: hikari_components::feedback::AlertSize::Sm,
            ..Default::default()
        };
        let lg = AlertProps {
            size: hikari_components::feedback::AlertSize::Lg,
            ..Default::default()
        };
        assert_eq!(sm.size, hikari_components::feedback::AlertSize::Sm);
        assert_eq!(lg.size, hikari_components::feedback::AlertSize::Lg);
    }

    #[test]
    fn test_toast_props_default() {
        // The mirror replaces the legacy variant/position props: the host
        // reads the module store and takes only the clipboard sink + class.
        let props = ToastProps::default();
        assert!(props.on_copy.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_toast_type_tokens() {
        use hikari_components::feedback::ToastType;
        assert_eq!(ToastType::Info.class_name(), "hk-toast-info");
        assert_eq!(ToastType::Error.class_name(), "hk-toast-error");
        assert_eq!(
            ToastType::Info.default_icon(),
            Some(hikari_icons::MdiIcon::Information)
        );
    }

    #[test]
    fn test_toast_copy_text_joins_with_blank_line() {
        use hikari_components::feedback::{ToastMessage, toast_copy_text};
        let messages = vec![
            ToastMessage {
                id: 1,
                text: "first".to_string(),
            },
            ToastMessage {
                id: 2,
                text: "second".to_string(),
            },
        ];
        assert_eq!(toast_copy_text(&messages), "first\n\nsecond");
    }

    #[test]
    fn test_toast_aggregation_cap_matches_vue() {
        assert_eq!(hikari_components::feedback::MAX_TOASTS_PER_SLOT, 5);
    }

    #[test]
    fn test_toast_props_with_custom_classes() {
        let props = ToastProps {
            class: "custom-toast".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-toast");
    }

    #[test]
    fn test_tooltip_props_default() {
        let props = TooltipProps::default();
        assert_eq!(
            props.placement,
            hikari_components::feedback::TooltipPlacement::Top
        );
        assert_eq!(
            props.delay,
            hikari_components::feedback::TOOLTIP_DEFAULT_DELAY_MS
        );
        assert!(props.max_width.is_none());
        assert_eq!(props.text, "");
    }

    #[test]
    fn test_tooltip_props_with_placement() {
        let props = TooltipProps {
            placement: hikari_components::feedback::TooltipPlacement::Bottom,
            ..Default::default()
        };
        assert_eq!(
            props.placement,
            hikari_components::feedback::TooltipPlacement::Bottom
        );
    }

    #[test]
    fn test_tooltip_position_geometry() {
        // The mirrored helper takes the trigger rect (Vue: DOMRect) and
        // reproduces runtime/tooltipPosition.ts placement numbers.
        use hikari_components::feedback::{TooltipPlacement, tooltip_position_style};
        let rect = (200.0, 100.0, 100.0, 40.0);
        let top = tooltip_position_style(rect, TooltipPlacement::Top, None);
        assert!(top.contains("top:92px"), "top placement: {top}");
        assert!(top.contains("left:250px"), "top placement: {top}");
        assert!(
            top.contains("translate(-50%, -100%)"),
            "top placement: {top}"
        );
        let right = tooltip_position_style(rect, TooltipPlacement::Right, Some("200px"));
        assert!(right.contains("left:308px"), "right placement: {right}");
        assert!(
            right.contains("max-width:200px"),
            "right placement: {right}"
        );
    }

    #[test]
    fn test_modal_width_presets_via_public_api() {
        use hikari_components::feedback::{modal_frame_max_width, resolve_modal_width};
        assert_eq!(resolve_modal_width("md"), "40rem");
        assert_eq!(resolve_modal_width("560px"), "560px");
        assert_eq!(
            modal_frame_max_width("40rem"),
            "min(40rem, calc(100% - 2 * var(--viewport-gutter, 16px)))"
        );
    }

    #[test]
    fn test_modal_props_default() {
        let props = ModalProps::default();
        assert!(!props.open);
        assert!(props.closable);
        assert_eq!(props.width, "32rem");
        assert!(props.footer_actions.is_none());
    }

    #[test]
    fn test_modal_action_defaults() {
        let action = hikari_components::feedback::ModalAction::default();
        assert_eq!(
            action.variant,
            hikari_components::feedback::ModalActionVariant::Secondary
        );
        assert!(!action.loading);
        assert!(!action.disabled);
    }

    #[test]
    fn test_popover_props_default() {
        let props = PopoverProps::default();
        assert!(!props.open);
        assert_eq!(
            props.placement,
            hikari_components::feedback::PopoverPlacement::Bottom
        );
        assert_eq!(props.offset, 4.0);
        assert!(props.backdrop);
        assert!(props.close_on_backdrop);
        assert!(props.close_on_escape);
        assert!(props.glass);
        assert!(props.anchor.is_none());
        assert!(!props.sheet_on_mobile);
        assert!(props.on_open_change.is_none());
    }

    #[test]
    fn test_popover_placement_class_names() {
        use hikari_components::feedback::PopoverPlacement;
        assert_eq!(PopoverPlacement::Top.class_name(), "hk-popover-top");
        assert_eq!(
            PopoverPlacement::BottomStart.class_name(),
            "hk-popover-bottom-start"
        );
        assert_eq!(
            PopoverPlacement::RightEnd.class_name(),
            "hk-popover-right-end"
        );
    }

    #[test]
    fn test_popover_geometry_bottom_center() {
        use hikari_components::feedback::{
            PopoverAnchorRect, PopoverPlacement, popover_position_style,
        };
        let anchor = PopoverAnchorRect {
            x: 100.0,
            y: 50.0,
            width: 40.0,
            height: 20.0,
        };
        assert_eq!(
            popover_position_style(PopoverPlacement::Bottom, anchor, 4.0),
            "left:120px;top:74px;transform:translate(-50%, 0)"
        );
    }
}
