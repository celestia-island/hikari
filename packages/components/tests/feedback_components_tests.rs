mod tests {

    use hikari_components::prelude::*;

    #[test]
    fn test_alert_props_default() {
        let props = AlertProps::default();
        assert_eq!(
            props.variant,
            hikari_components::feedback::AlertVariant::Info
        );
        assert!(!props.closable);
        assert!(props.title.is_none());
        assert!(props.description.is_none());
        assert!(props.icon.is_none());
        assert!(props.on_close.is_none());
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
        let props = ToastProps::default();
        assert_eq!(
            props.variant,
            hikari_components::feedback::ToastVariant::Info
        );
        assert_eq!(
            props.position,
            hikari_components::feedback::ToastPosition::TopRight
        );
        assert!(props.closable);
        assert!(props.duration.is_none());
    }

    #[test]
    fn test_toast_props_with_variant() {
        let props = ToastProps {
            variant: hikari_components::feedback::ToastVariant::Success,
            ..Default::default()
        };
        assert_eq!(
            props.variant,
            hikari_components::feedback::ToastVariant::Success
        );
    }

    #[test]
    fn test_toast_props_with_position() {
        let props = ToastProps {
            position: hikari_components::feedback::ToastPosition::BottomLeft,
            ..Default::default()
        };
        assert_eq!(
            props.position,
            hikari_components::feedback::ToastPosition::BottomLeft
        );
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

    #[test]
    fn test_tooltip_props_default() {
        let props = TooltipProps::default();
        assert_eq!(
            props.placement,
            hikari_components::feedback::TooltipPlacement::Top
        );
        assert!(props.arrow);
        assert!(props.delay.is_none());
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

    #[test]
    fn test_modal_config_default() {
        let config = hikari_components::feedback::ModalConfig::default();
        assert_eq!(
            config.position,
            hikari_components::feedback::ModalPosition::Center
        );
        assert_eq!(
            config.mask_mode,
            hikari_components::feedback::MaskMode::Opaque
        );
        assert!(config.closable);
        assert!(config.mask_closable);
        assert_eq!(config.size, hikari_components::feedback::ModalSize::Md);
    }

    #[test]
    fn test_modal_config_custom() {
        let config = hikari_components::feedback::ModalConfig {
            position: hikari_components::feedback::ModalPosition::Top,
            mask_mode: hikari_components::feedback::MaskMode::Transparent,
            closable: false,
            mask_closable: false,
            class: "custom-modal".to_string(),
            ..Default::default()
        };
        assert_eq!(
            config.position,
            hikari_components::feedback::ModalPosition::Top
        );
        assert_eq!(
            config.mask_mode,
            hikari_components::feedback::MaskMode::Transparent
        );
        assert!(!config.closable);
        assert!(!config.mask_closable);
    }

    #[test]
    fn test_modal_position_variants() {
        use hikari_components::feedback::ModalPosition;
        let positions = [
            ModalPosition::Center,
            ModalPosition::TopLeft,
            ModalPosition::Top,
            ModalPosition::TopRight,
            ModalPosition::Right,
            ModalPosition::BottomRight,
            ModalPosition::Bottom,
            ModalPosition::BottomLeft,
            ModalPosition::Left,
        ];
        for pos in positions {
            let config = hikari_components::feedback::ModalConfig {
                position: pos,
                ..Default::default()
            };
            assert_eq!(config.position, pos);
        }
    }

    #[test]
    fn test_modal_mask_mode_opaque() {
        let config = hikari_components::feedback::ModalConfig {
            mask_mode: hikari_components::feedback::MaskMode::Opaque,
            ..Default::default()
        };
        assert_eq!(
            config.mask_mode,
            hikari_components::feedback::MaskMode::Opaque
        );
    }

    #[test]
    fn test_modal_mask_mode_transparent() {
        let config = hikari_components::feedback::ModalConfig {
            mask_mode: hikari_components::feedback::MaskMode::Transparent,
            ..Default::default()
        };
        assert_eq!(
            config.mask_mode,
            hikari_components::feedback::MaskMode::Transparent
        );
    }

    #[test]
    fn test_modal_with_custom_class() {
        let config = hikari_components::feedback::ModalConfig {
            class: "my-custom-modal-class".to_string(),
            ..Default::default()
        };
        assert_eq!(config.class, "my-custom-modal-class");
    }

    #[test]
    fn test_modal_calculate_position_center() {
        use hikari_components::feedback::{calculate_position, ModalPosition};
        let (x, y) = calculate_position(
            ModalPosition::Center,
            None,
            None,
            400.0,
            300.0,
            1200.0,
            800.0,
        );
        assert_eq!(x, 400.0);
        assert_eq!(y, 250.0);
    }

    #[test]
    fn test_modal_calculate_position_top_left() {
        use hikari_components::feedback::{calculate_position, ModalPosition};
        let (x, y) = calculate_position(
            ModalPosition::TopLeft,
            Some(100.0),
            Some(100.0),
            400.0,
            300.0,
            1200.0,
            800.0,
        );
        assert!(x < 100.0);
        assert!(y < 100.0);
    }

    #[test]
    fn test_modal_calculate_position_clamped() {
        use hikari_components::feedback::{calculate_position, ModalPosition};
        let (x, y) = calculate_position(
            ModalPosition::TopLeft,
            Some(10.0),
            Some(10.0),
            1100.0,
            700.0,
            1200.0,
            800.0,
        );
        assert!(x >= 16.0);
        assert!(y >= 16.0);
    }

    #[test]
    fn test_progress_props_default() {
        let props = ProgressProps::default();
        assert_eq!(props.value, 0.0);
        assert_eq!(props.max, 100.0);
        assert_eq!(
            props.progress_type,
            hikari_components::feedback::ProgressType::Linear
        );
        assert_eq!(
            props.status,
            hikari_components::feedback::ProgressStatus::Normal
        );
        assert!(!props.show_info);
    }

    #[test]
    fn test_progress_props_with_value() {
        let props = ProgressProps {
            value: 75.0,
            ..Default::default()
        };
        assert_eq!(props.value, 75.0);
    }

    #[test]
    fn test_progress_type_circular() {
        let props = ProgressProps {
            progress_type: hikari_components::feedback::ProgressType::Circular,
            ..Default::default()
        };
        assert_eq!(
            props.progress_type,
            hikari_components::feedback::ProgressType::Circular
        );
    }

    #[test]
    fn test_progress_status_active() {
        let props = ProgressProps {
            status: hikari_components::feedback::ProgressStatus::Active,
            ..Default::default()
        };
        assert_eq!(
            props.status,
            hikari_components::feedback::ProgressStatus::Active
        );
    }

    #[test]
    fn test_progress_props_with_show_info() {
        let props = ProgressProps {
            show_info: true,
            ..Default::default()
        };
        assert!(props.show_info);
    }

    #[test]
    fn test_progress_props_with_custom_classes() {
        let props = ProgressProps {
            class: "custom-progress".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-progress");
    }

    #[test]
    fn test_spin_props_default() {
        let props = SpinProps::default();
        assert!(!props.spinning);
        assert_eq!(props.size, hikari_components::feedback::SpinSize::Medium);
        assert_eq!(props.tip, hikari_components::feedback::SpinTip::None);
        assert!(props.custom_tip.is_none());
        assert!(props.delay.is_none());
    }

    #[test]
    fn test_spin_props_spinning() {
        let props = SpinProps {
            spinning: true,
            ..Default::default()
        };
        assert!(props.spinning);
    }

    #[test]
    fn test_spin_size_small() {
        let props = SpinProps {
            size: hikari_components::feedback::SpinSize::Small,
            ..Default::default()
        };
        assert_eq!(props.size, hikari_components::feedback::SpinSize::Small);
    }

    #[test]
    fn test_spin_size_large() {
        let props = SpinProps {
            size: hikari_components::feedback::SpinSize::Large,
            ..Default::default()
        };
        assert_eq!(props.size, hikari_components::feedback::SpinSize::Large);
    }

    #[test]
    fn test_spin_with_custom_tip() {
        let props = SpinProps {
            custom_tip: Some("Loading...".to_string()),
            ..Default::default()
        };
        assert_eq!(props.custom_tip, Some("Loading...".to_string()));
    }

    #[test]
    fn test_spin_with_custom_classes() {
        let props = SpinProps {
            class: "custom-spin".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-spin");
    }

    #[test]
    fn test_drawer_props_default() {
        let props = DrawerProps::default();
        assert!(!props.open);
        assert_eq!(
            props.placement,
            hikari_components::feedback::DrawerPlacement::Right
        );
        assert_eq!(props.size, hikari_components::feedback::DrawerSize::Medium);
        assert!(!props.mask_closable);
        assert!(props.title.is_none());
        assert!(props.footer.is_none());
        assert!(props.on_close.is_none());
    }

    #[test]
    fn test_drawer_open() {
        let props = DrawerProps {
            open: true,
            ..Default::default()
        };
        assert!(props.open);
    }

    #[test]
    fn test_drawer_placement_variants() {
        use hikari_components::feedback::DrawerPlacement;
        let placements = [
            DrawerPlacement::Right,
            DrawerPlacement::Left,
            DrawerPlacement::Top,
            DrawerPlacement::Bottom,
        ];
        for p in placements {
            let props = DrawerProps {
                placement: p,
                ..Default::default()
            };
            assert_eq!(props.placement, p);
        }
    }

    #[test]
    fn test_drawer_size_variants() {
        use hikari_components::feedback::DrawerSize;
        let sizes = [DrawerSize::Small, DrawerSize::Medium, DrawerSize::Large];
        for s in sizes {
            let props = DrawerProps {
                size: s,
                ..Default::default()
            };
            assert_eq!(props.size, s);
        }
    }

    #[test]
    fn test_drawer_mask_closable() {
        let props = DrawerProps {
            mask_closable: false,
            ..Default::default()
        };
        assert!(!props.mask_closable);
    }

    #[test]
    fn test_drawer_with_title() {
        let props = DrawerProps {
            title: Some("Settings".to_string()),
            ..Default::default()
        };
        assert_eq!(props.title, Some("Settings".to_string()));
    }

    #[test]
    fn test_drawer_with_custom_class() {
        let props = DrawerProps {
            class: "custom-drawer".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-drawer");
    }

    #[test]
    fn test_popover_props_default() {
        let props = PopoverProps::default();
        assert!(!props.open);
        assert!(props.close_on_click_outside);
        assert!(props.close_on_select);
        assert!(props.title.is_none());
        assert!(props.width.is_none());
        assert!(props.on_open_change.is_none());
        assert_eq!(props.offset, 8.0);
    }

    #[test]
    fn test_popover_positioning_default() {
        let positioning = hikari_components::feedback::PopoverPositioning::default();
        match positioning {
            hikari_components::feedback::PopoverPositioning::Relative { preferred } => {
                assert_eq!(preferred.len(), 4);
            }
            _ => panic!("expected Relative positioning"),
        }
    }

    #[test]
    fn test_popover_positioning_absolute() {
        let positioning = hikari_components::feedback::PopoverPositioning::Absolute(
            hikari_components::feedback::PopoverAbsolutePosition::Fixed { x: 100.0, y: 200.0 },
        );
        match positioning {
            hikari_components::feedback::PopoverPositioning::Absolute(
                hikari_components::feedback::PopoverAbsolutePosition::Fixed { x, y },
            ) => {
                assert_eq!(x, 100.0);
                assert_eq!(y, 200.0);
            }
            _ => panic!("expected Absolute positioning"),
        }
    }

    #[test]
    fn test_popover_placement_variants() {
        use hikari_components::feedback::PopoverPlacement;
        let placements = [
            PopoverPlacement::Bottom,
            PopoverPlacement::Top,
            PopoverPlacement::Left,
            PopoverPlacement::Right,
        ];
        for p in placements {
            let props = PopoverProps {
                positioning: hikari_components::feedback::PopoverPositioning::Relative {
                    preferred: vec![p],
                },
                ..Default::default()
            };
            if let hikari_components::feedback::PopoverPositioning::Relative { preferred } =
                props.positioning
            {
                assert_eq!(preferred[0], p);
            }
        }
    }

    #[test]
    fn test_popover_with_title() {
        let props = PopoverProps {
            title: Some("My Popover".to_string()),
            ..Default::default()
        };
        assert_eq!(props.title, Some("My Popover".to_string()));
    }

    #[test]
    fn test_popover_with_width() {
        let props = PopoverProps {
            width: Some("300px".to_string()),
            ..Default::default()
        };
        assert_eq!(props.width, Some("300px".to_string()));
    }

    #[test]
    fn test_popover_with_custom_class() {
        let props = PopoverProps {
            class: "custom-popover".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-popover");
    }
}
