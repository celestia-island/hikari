mod tests {

    use hikari_components::prelude::*;

    #[test]
    fn test_glow_props_default() {
        let props = GlowProps::default();
        assert_eq!(props.blur, hikari_components::GlowBlur::Medium);
        assert_eq!(props.color, hikari_components::GlowColor::Ghost);
        assert_eq!(props.intensity, hikari_components::GlowIntensity::Soft);
        assert!(!props.block);
        assert!(props.active_intensity.is_none());
        assert_eq!(props.preset, hikari_components::GlowPreset::None);
        assert_eq!(props.transition_duration, "100");
    }

    #[test]
    fn test_glow_blur_variants() {
        use hikari_components::GlowBlur;
        let blurs = [
            GlowBlur::None,
            GlowBlur::Light,
            GlowBlur::Medium,
            GlowBlur::Heavy,
        ];
        for b in blurs {
            let props = GlowProps {
                blur: b,
                ..Default::default()
            };
            assert_eq!(props.blur, b);
        }
    }

    #[test]
    fn test_glow_color_variants() {
        use hikari_components::GlowColor;
        let colors = [
            GlowColor::Ghost,
            GlowColor::Primary,
            GlowColor::Secondary,
            GlowColor::Danger,
            GlowColor::Success,
            GlowColor::Warning,
            GlowColor::Info,
        ];
        for c in colors {
            let props = GlowProps {
                color: c,
                ..Default::default()
            };
            assert_eq!(props.color, c);
        }
    }

    #[test]
    fn test_glow_intensity_variants() {
        use hikari_components::GlowIntensity;
        let intensities = [
            GlowIntensity::Dim,
            GlowIntensity::Soft,
            GlowIntensity::Bright,
        ];
        for i in intensities {
            let props = GlowProps {
                intensity: i,
                ..Default::default()
            };
            assert_eq!(props.intensity, i);
        }
    }

    #[test]
    fn test_glow_preset_variants() {
        use hikari_components::GlowPreset;
        let presets = [
            GlowPreset::None,
            GlowPreset::Pulse,
            GlowPreset::Breathe,
            GlowPreset::Shimmer,
        ];
        for p in presets {
            let props = GlowProps {
                preset: p,
                ..Default::default()
            };
            assert_eq!(props.preset, p);
        }
    }

    #[test]
    fn test_glow_with_active_intensity() {
        let props = GlowProps {
            active_intensity: Some(hikari_components::GlowIntensity::Bright),
            ..Default::default()
        };
        assert_eq!(
            props.active_intensity,
            Some(hikari_components::GlowIntensity::Bright)
        );
    }

    #[test]
    fn test_glow_with_block() {
        let props = GlowProps {
            block: true,
            ..Default::default()
        };
        assert!(props.block);
    }

    #[test]
    fn test_glow_with_custom_class() {
        let props = GlowProps {
            class: "custom-glow".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-glow");
    }

    #[test]
    fn test_glow_blur_display() {
        use hikari_components::GlowBlur;
        use tairitsu_vdom::IntoAttrValue;
        assert_eq!(GlowBlur::None.into_attr_value(), Some("none".to_string()));
        assert_eq!(GlowBlur::Light.into_attr_value(), Some("light".to_string()));
        assert_eq!(
            GlowBlur::Medium.into_attr_value(),
            Some("medium".to_string())
        );
        assert_eq!(GlowBlur::Heavy.into_attr_value(), Some("heavy".to_string()));
    }

    #[test]
    fn test_glow_color_display() {
        use hikari_components::GlowColor;
        use tairitsu_vdom::IntoAttrValue;
        assert_eq!(
            GlowColor::Ghost.into_attr_value(),
            Some("ghost".to_string())
        );
        assert_eq!(
            GlowColor::Primary.into_attr_value(),
            Some("primary".to_string())
        );
        assert_eq!(
            GlowColor::Danger.into_attr_value(),
            Some("danger".to_string())
        );
    }

    #[test]
    fn test_glow_preset_display() {
        use hikari_components::GlowPreset;
        use tairitsu_vdom::IntoAttrValue;
        assert_eq!(GlowPreset::None.into_attr_value(), None);
        assert_eq!(
            GlowPreset::Pulse.into_attr_value(),
            Some("pulse".to_string())
        );
        assert_eq!(
            GlowPreset::Breathe.into_attr_value(),
            Some("breathe".to_string())
        );
        assert_eq!(
            GlowPreset::Shimmer.into_attr_value(),
            Some("shimmer".to_string())
        );
    }

    #[test]
    fn test_portal_id_counter_increments() {
        use hikari_components::portal::generate_portal_id;
        let id1 = generate_portal_id();
        let id2 = generate_portal_id();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_portal_positioning_strategies() {
        use hikari_components::portal::PortalPositionStrategy;
        let _ = PortalPositionStrategy::Fixed(100.0, 200.0);
        let _ = PortalPositionStrategy::TriggerBased {
            placement: hikari_components::portal::TriggerPlacement::Bottom,
        };
    }

    #[test]
    fn test_portal_mask_modes() {
        use hikari_components::portal::PortalMaskMode;
        let modes = [PortalMaskMode::Dimmed, PortalMaskMode::Transparent];
        for m in modes {
            let _ = m;
        }
    }

    #[test]
    fn test_portal_trigger_placements() {
        use hikari_components::portal::TriggerPlacement;
        let placements = [
            TriggerPlacement::Bottom,
            TriggerPlacement::Top,
            TriggerPlacement::Left,
            TriggerPlacement::Right,
            TriggerPlacement::BottomLeft,
            TriggerPlacement::BottomRight,
            TriggerPlacement::TopLeft,
            TriggerPlacement::TopRight,
            TriggerPlacement::LeftTop,
            TriggerPlacement::LeftBottom,
            TriggerPlacement::RightTop,
            TriggerPlacement::RightBottom,
            TriggerPlacement::Center,
        ];
        for p in placements {
            let _ = p;
        }
    }
}
