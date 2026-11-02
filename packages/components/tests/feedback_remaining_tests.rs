mod tests {

    use hikari_components::prelude::*;

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
            width: "200px".to_string(),
            height: "20px".to_string(),
            ..Default::default()
        };
        assert_eq!(props.width, "200px");
        assert_eq!(props.height, "20px");
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
    fn test_timeline_with_custom_classes() {
        let props = TimelineProps {
            class: "custom-timeline".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-timeline");
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
