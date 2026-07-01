#[cfg(test)]
mod tests {

    use hikari_components::data::CollapseProps;
    use hikari_components::prelude::*;

    #[test]
    fn test_collapse_renders() {
        let _ = CollapseProps {
            expanded: true,
            duration: 300,
            animated: true,
            class: "test-collapse".to_string(),
            children: VNode::empty(),
            on_expand: None,
        };
    }

    #[test]
    fn test_collapse_props_default() {
        let props = CollapseProps::default();
        assert!(!props.expanded);
        assert_eq!(props.duration, 200);
        assert!(props.animated);
        assert!(props.class.is_empty());
        assert!(props.on_expand.is_none());
    }

    #[test]
    fn test_collapse_props_expanded() {
        let props = CollapseProps {
            expanded: true,
            ..Default::default()
        };
        assert!(props.expanded);
    }

    #[test]
    fn test_collapse_props_custom_duration() {
        let props = CollapseProps {
            duration: 500,
            ..Default::default()
        };
        assert_eq!(props.duration, 500);
    }

    #[test]
    fn test_collapse_props_not_animated() {
        let props = CollapseProps {
            animated: false,
            ..Default::default()
        };
        assert!(!props.animated);
    }

    #[test]
    fn test_collapse_props_with_custom_classes() {
        let props = CollapseProps {
            class: "custom-collapse".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-collapse");
    }

    #[test]
    fn test_collapse_props_with_children() {
        let children = VNode::empty();

        let _ = CollapseProps {
            children,
            ..Default::default()
        };
    }

    #[test]
    fn test_collapse_props_clone() {
        let props = CollapseProps {
            expanded: true,
            duration: 300,
            animated: true,
            class: "test-class".to_string(),
            on_expand: None,
            children: VNode::empty(),
        };

        let cloned = props.clone();
        assert!(cloned.expanded);
        assert_eq!(cloned.duration, 300);
        assert!(cloned.animated);
        assert_eq!(cloned.class, "test-class");
        assert!(cloned.on_expand.is_none());
    }

    #[test]
    fn test_collapse_props_partial_eq() {
        let props1 = CollapseProps {
            expanded: false,
            duration: 200,
            animated: true,
            class: "test".to_string(),
            on_expand: None,
            children: VNode::empty(),
        };

        let props2 = CollapseProps {
            expanded: false,
            duration: 200,
            animated: true,
            class: "test".to_string(),
            on_expand: None,
            children: VNode::empty(),
        };

        assert_eq!(props1, props2);
    }

    #[test]
    fn test_collapse_props_not_equal() {
        let props1 = CollapseProps {
            expanded: false,
            ..Default::default()
        };

        let props2 = CollapseProps {
            expanded: true,
            ..Default::default()
        };

        assert_ne!(props1, props2);
    }
}
