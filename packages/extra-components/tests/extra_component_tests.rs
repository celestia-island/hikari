// Extra component data model tests
// These test the pure Rust data structures

mod tests {

    use hikari_extra_components::extra::*;

    #[test]
    fn test_collapsible_state() {
        let state = CollapsibleState::new("Test Panel".to_string());
        assert_eq!(state.title, "Test Panel");
        assert!(!state.expanded);
    }

    #[test]
    fn test_drag_layer_constraints() {
        let constraints = DragConstraints {
            min_x: Some(0.0),
            max_x: Some(500.0),
            min_y: Some(0.0),
            max_y: Some(500.0),
        };
        assert_eq!(constraints.min_x, Some(0.0));
        assert_eq!(constraints.max_x, Some(500.0));
    }

    #[test]
    fn test_zoom_controls_state() {
        let state = ZoomControlsState::new();
        assert_eq!(state.zoom, 1.0);
    }

    #[test]
    fn test_timeline_item() {
        let item = TimelineItem::new("test", "Test Event");
        assert_eq!(item.id, "test");
        assert_eq!(item.title, "Test Event");
    }

    #[test]
    fn test_user_guide_step() {
        let step = GuideStep::new("step1", "Welcome").with_description("Welcome to the app");
        assert_eq!(step.id, "step1");
        assert_eq!(step.description, "Welcome to the app");
    }
}
