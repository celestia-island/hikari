mod tests {

    use hikari_components::prelude::*;

    #[test]
    fn test_qrcode_props_default() {
        let props = QRCodeProps::default();
        assert_eq!(props.value, "");
        assert_eq!(props.size, 200);
        assert_eq!(props.color, "#000000");
        assert_eq!(props.background, "#ffffff");
        assert!(props.title.is_none());
        assert_eq!(props.error_correction, "medium");
    }

    #[test]
    fn test_qrcode_props_with_value() {
        let props = QRCodeProps {
            value: "https://example.com".to_string(),
            ..Default::default()
        };
        assert_eq!(props.value, "https://example.com");
    }

    #[test]
    fn test_qrcode_props_with_size() {
        let props = QRCodeProps {
            size: 300,
            ..Default::default()
        };
        assert_eq!(props.size, 300);
    }

    #[test]
    fn test_qrcode_props_with_colors() {
        let props = QRCodeProps {
            color: "#ff0000".to_string(),
            background: "#00ff00".to_string(),
            ..Default::default()
        };
        assert_eq!(props.color, "#ff0000");
        assert_eq!(props.background, "#00ff00");
    }

    #[test]
    fn test_qrcode_props_with_title() {
        let props = QRCodeProps {
            title: Some("Scan me".to_string()),
            ..Default::default()
        };
        assert_eq!(props.title, Some("Scan me".to_string()));
    }

    #[test]
    fn test_qrcode_props_error_correction_levels() {
        let levels = ["low", "medium", "quartile", "high"];
        for level in levels {
            let props = QRCodeProps {
                error_correction: level.to_string(),
                ..Default::default()
            };
            assert_eq!(props.error_correction, level);
        }
    }

    #[test]
    fn test_qrcode_props_with_custom_classes() {
        let props = QRCodeProps {
            class: "custom-qrcode".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-qrcode");
    }

    #[test]
    fn test_skeleton_props_default() {
        let props = SkeletonProps::default();
        assert_eq!(
            props.variant,
            hikari_components::display::SkeletonVariant::Text
        );
        assert_eq!(props.size, hikari_components::display::SkeletonSize::Medium);
        assert!(props.animation);
        assert!(props.rows.is_none());
        assert!(props.width.is_none());
        assert!(props.height.is_none());
    }

    #[test]
    fn test_skeleton_variant_circular() {
        let props = SkeletonProps {
            variant: hikari_components::display::SkeletonVariant::Circular,
            ..Default::default()
        };
        assert_eq!(
            props.variant,
            hikari_components::display::SkeletonVariant::Circular
        );
    }

    #[test]
    fn test_skeleton_variant_rectangular() {
        let props = SkeletonProps {
            variant: hikari_components::display::SkeletonVariant::Rectangular,
            ..Default::default()
        };
        assert_eq!(
            props.variant,
            hikari_components::display::SkeletonVariant::Rectangular
        );
    }

    #[test]
    fn test_skeleton_variant_rounded() {
        let props = SkeletonProps {
            variant: hikari_components::display::SkeletonVariant::Rounded,
            ..Default::default()
        };
        assert_eq!(
            props.variant,
            hikari_components::display::SkeletonVariant::Rounded
        );
    }

    #[test]
    fn test_skeleton_size_small() {
        let props = SkeletonProps {
            size: hikari_components::display::SkeletonSize::Small,
            ..Default::default()
        };
        assert_eq!(props.size, hikari_components::display::SkeletonSize::Small);
    }

    #[test]
    fn test_skeleton_size_large() {
        let props = SkeletonProps {
            size: hikari_components::display::SkeletonSize::Large,
            ..Default::default()
        };
        assert_eq!(props.size, hikari_components::display::SkeletonSize::Large);
    }

    #[test]
    fn test_skeleton_with_rows() {
        let props = SkeletonProps {
            rows: Some(3),
            ..Default::default()
        };
        assert_eq!(props.rows, Some(3));
    }

    #[test]
    fn test_skeleton_with_custom_dimensions() {
        let props = SkeletonProps {
            width: Some("200px".to_string()),
            height: Some("20px".to_string()),
            ..Default::default()
        };
        assert_eq!(props.width, Some("200px".to_string()));
        assert_eq!(props.height, Some("20px".to_string()));
    }

    #[test]
    fn test_skeleton_with_custom_classes() {
        let props = SkeletonProps {
            class: "custom-skeleton".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-skeleton");
    }

    #[test]
    fn test_skeleton_card_props_default() {
        let props = SkeletonCardProps::default();
        assert!(props.show_header);
        assert!(props.show_avatar);
        assert_eq!(props.rows, 3);
    }

    #[test]
    fn test_skeleton_card_props_custom() {
        let props = SkeletonCardProps {
            show_header: false,
            show_avatar: false,
            rows: 5,
            ..Default::default()
        };
        assert!(!props.show_header);
        assert!(!props.show_avatar);
        assert_eq!(props.rows, 5);
    }

    #[test]
    fn test_skeleton_table_props_default() {
        let props = SkeletonTableProps::default();
        assert_eq!(props.columns, 0);
        assert_eq!(props.rows, 0);
    }

    #[test]
    fn test_skeleton_table_props_custom() {
        let props = SkeletonTableProps {
            columns: 5,
            rows: 10,
            ..Default::default()
        };
        assert_eq!(props.columns, 5);
        assert_eq!(props.rows, 10);
    }

    #[test]
    fn test_tag_props_default() {
        let props = TagProps::default();
        assert_eq!(
            props.variant,
            hikari_components::display::TagVariant::Default
        );
        assert!(!props.closable);
        assert!(props.on_close.is_none());
    }

    #[test]
    fn test_tag_variant_variants() {
        use hikari_components::display::TagVariant;
        let variants = [
            TagVariant::Default,
            TagVariant::Primary,
            TagVariant::Success,
            TagVariant::Warning,
            TagVariant::Danger,
            TagVariant::Info,
        ];
        for v in variants {
            let props = TagProps {
                variant: v,
                ..Default::default()
            };
            assert_eq!(props.variant, v);
        }
    }

    #[test]
    fn test_tag_closable() {
        let props = TagProps {
            closable: true,
            ..Default::default()
        };
        assert!(props.closable);
    }

    #[test]
    fn test_tag_with_custom_classes() {
        let props = TagProps {
            class: "custom-tag".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-tag");
    }

    #[test]
    fn test_timeline_props_default() {
        let props = TimelineProps::default();
        assert_eq!(
            props.position,
            hikari_components::display::TimelinePosition::Alternate
        );
        assert!(props.line);
    }

    #[test]
    fn test_timeline_position_variants() {
        use hikari_components::display::TimelinePosition;
        let positions = [
            TimelinePosition::Alternate,
            TimelinePosition::Left,
            TimelinePosition::Right,
        ];
        for p in positions {
            let props = TimelineProps {
                position: p,
                ..Default::default()
            };
            assert_eq!(props.position, p);
        }
    }

    #[test]
    fn test_timeline_no_line() {
        let props = TimelineProps {
            line: false,
            ..Default::default()
        };
        assert!(!props.line);
    }

    #[test]
    fn test_timeline_with_custom_classes() {
        let props = TimelineProps {
            class: "custom-timeline".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-timeline");
    }

    #[test]
    fn test_timeline_item_props_default() {
        let props = TimelineItemProps::default();
        assert_eq!(props.time, "");
        assert_eq!(props.title, "");
        assert!(!props.last);
        assert!(props.icon.is_none());
        assert_eq!(props.color, "");
    }

    #[test]
    fn test_timeline_item_with_fields() {
        let props = TimelineItemProps {
            time: "2024-01-01".to_string(),
            title: "Event".to_string(),
            color: "#ff0000".to_string(),
            last: true,
            ..Default::default()
        };
        assert_eq!(props.time, "2024-01-01");
        assert_eq!(props.title, "Event");
        assert_eq!(props.color, "#ff0000");
        assert!(props.last);
    }

    #[test]
    fn test_user_guide_props_default() {
        let props = UserGuideProps::default();
        assert!(props.steps.is_empty());
        assert_eq!(props.current, 0);
        assert!(props.visible);
        assert!(props.show_progress);
        assert!(props.skippable);
        assert!(props.on_step_change.is_none());
        assert!(props.on_finish.is_none());
        assert!(props.on_skip.is_none());
    }

    #[test]
    fn test_user_guide_with_steps() {
        let steps = vec![
            hikari_components::display::GuideStep {
                target: "#step1".to_string(),
                title: "First Step".to_string(),
                description: "Welcome".to_string(),
                placement: hikari_components::display::GuidePlacement::Bottom,
            },
            hikari_components::display::GuideStep {
                target: "#step2".to_string(),
                title: "Second Step".to_string(),
                description: "Done".to_string(),
                placement: hikari_components::display::GuidePlacement::Top,
            },
        ];
        let props = UserGuideProps {
            steps: steps.clone(),
            current: 1,
            ..Default::default()
        };
        assert_eq!(props.steps.len(), 2);
        assert_eq!(props.current, 1);
        assert_eq!(props.steps[0].title, "First Step");
    }

    #[test]
    fn test_user_guide_step_default() {
        let step = hikari_components::display::GuideStep::default();
        assert_eq!(step.target, "");
        assert_eq!(step.title, "");
        assert_eq!(step.description, "");
        assert_eq!(
            step.placement,
            hikari_components::display::GuidePlacement::Bottom
        );
    }

    #[test]
    fn test_user_guide_placement_variants() {
        use hikari_components::display::GuidePlacement;
        let placements = [
            GuidePlacement::Top,
            GuidePlacement::Bottom,
            GuidePlacement::Left,
            GuidePlacement::Right,
        ];
        for p in placements {
            let step = hikari_components::display::GuideStep {
                placement: p,
                ..Default::default()
            };
            assert_eq!(step.placement, p);
        }
    }

    #[test]
    fn test_user_guide_not_visible() {
        let steps = vec![hikari_components::display::GuideStep::default()];
        let props = UserGuideProps {
            steps,
            visible: false,
            ..Default::default()
        };
        assert!(!props.visible);
    }

    #[test]
    fn test_empty_props_default() {
        let props = EmptyProps::default();
        assert!(props.image.is_none());
        assert!(props.title.is_none());
        assert_eq!(props.description, "");
        assert!(props.action.is_none());
    }

    #[test]
    fn test_empty_with_title() {
        let props = EmptyProps {
            title: Some("No data".to_string()),
            description: "There is nothing here".to_string(),
            ..Default::default()
        };
        assert_eq!(props.title, Some("No data".to_string()));
        assert_eq!(props.description, "There is nothing here");
    }

    #[test]
    fn test_empty_with_image() {
        let props = EmptyProps {
            image: Some("https://example.com/empty.png".to_string()),
            ..Default::default()
        };
        assert_eq!(
            props.image,
            Some("https://example.com/empty.png".to_string())
        );
    }

    #[test]
    fn test_empty_with_custom_classes() {
        let props = EmptyProps {
            class: "custom-empty".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-empty");
    }

    #[test]
    fn test_comment_props_default() {
        let props = CommentProps::default();
        assert!(props.author.is_none());
        assert!(props.avatar.is_none());
        assert_eq!(props.content, "");
        assert!(props.datetime.is_none());
        assert!(props.actions.is_none());
        assert!(props.nested.is_none());
    }

    #[test]
    fn test_comment_with_fields() {
        let props = CommentProps {
            author: Some("Alice".to_string()),
            avatar: Some("avatar.png".to_string()),
            content: "Hello world".to_string(),
            datetime: Some("2024-01-01".to_string()),
            ..Default::default()
        };
        assert_eq!(props.author, Some("Alice".to_string()));
        assert_eq!(props.avatar, Some("avatar.png".to_string()));
        assert_eq!(props.content, "Hello world");
        assert_eq!(props.datetime, Some("2024-01-01".to_string()));
    }

    #[test]
    fn test_comment_with_custom_classes() {
        let props = CommentProps {
            class: "custom-comment".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-comment");
    }

    #[test]
    fn test_zoom_controls_props_default() {
        let props = ZoomControlsProps::default();
        assert_eq!(props.zoom, 100);
        assert_eq!(props.min_zoom, 25);
        assert_eq!(props.max_zoom, 400);
        assert_eq!(props.step, 25);
        assert!(props.show_percentage);
        assert!(!props.show_slider);
        assert!(props.on_zoom_change.is_none());
    }

    #[test]
    fn test_zoom_controls_with_custom_values() {
        let props = ZoomControlsProps {
            zoom: 50,
            min_zoom: 10,
            max_zoom: 200,
            step: 10,
            show_percentage: false,
            show_slider: true,
            ..Default::default()
        };
        assert_eq!(props.zoom, 50);
        assert_eq!(props.min_zoom, 10);
        assert_eq!(props.max_zoom, 200);
        assert_eq!(props.step, 10);
        assert!(!props.show_percentage);
        assert!(props.show_slider);
    }

    #[test]
    fn test_zoom_controls_with_custom_classes() {
        let props = ZoomControlsProps {
            class: "custom-zoom".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-zoom");
    }
}
