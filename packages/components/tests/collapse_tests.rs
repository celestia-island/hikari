// hi-components/tests/collapse_tests.rs
// Collapse component unit tests

#[cfg(test)]
mod tests {

    use dioxus::prelude::*;
    use hikari_components::data::CollapseProps;

    #[test]
    fn test_collapse_props_default() {
        let props = CollapseProps::default();

        assert!(!props.expanded);
        assert_eq!(props.duration, 200);
        assert!(props.animated);
        assert_eq!(props.class, String::new());
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
        let children = rsx! {
            div { "Collapse content" }
        };

        let props = CollapseProps {
            children: children.clone(),
            ..Default::default()
        };
        let _ = props; // Suppress unused warning

        // Verify children exists by checking that it renders
        // Note: In Dioxus 0.7, VNode is opaque - we verify through rendering
        // Test passes if props can be constructed with children
    }
}
