// Unit tests for Layer 2 navigation components

#[cfg(test)]
mod tests {

    use hikari_components::navigation::{
        {MenuItemHeight, MenuItemProps, MenuMode, MenuProps, SubMenuProps},
        {StepItemProps, StepStatus, StepsDirection, StepsProps},
        {TabPaneProps, TabPosition, TabsProps},
    };

    // ==================== Menu Tests ====================

    #[test]
    fn test_menu_props_default() {
        let props = MenuProps::default();

        assert_eq!(props.default_active, String::new());
        assert!(!props.inline);
        assert_eq!(props.mode, MenuMode::Vertical);
        assert!(!props.compact);
    }

    #[test]
    fn test_menu_with_inline() {
        let props = MenuProps {
            inline: true,
            ..Default::default()
        };

        assert!(props.inline);
    }

    #[test]
    fn test_menu_with_compact() {
        let props = MenuProps {
            compact: true,
            ..Default::default()
        };

        assert!(props.compact);
    }

    #[test]
    fn test_menu_with_default_active() {
        let props = MenuProps {
            default_active: "2".to_string(),
            ..Default::default()
        };

        assert_eq!(props.default_active, "2");
    }

    #[test]
    fn test_menu_vertical_mode() {
        let props = MenuProps {
            mode: MenuMode::Vertical,
            ..Default::default()
        };

        assert_eq!(props.mode, MenuMode::Vertical);
    }

    #[test]
    fn test_menu_horizontal_mode() {
        let props = MenuProps {
            mode: MenuMode::Horizontal,
            ..Default::default()
        };

        assert_eq!(props.mode, MenuMode::Horizontal);
    }

    #[test]
    fn test_menu_item_props_default() {
        let props = MenuItemProps::default();

        assert_eq!(props.item_key, String::new());
        assert!(!props.disabled);
        assert!(props.icon.is_none());
        assert!(!props.glow);
        assert_eq!(props.level, 0);
        assert_eq!(props.height, MenuItemHeight::Default);
    }

    #[test]
    fn test_menu_item_with_disabled() {
        let props = MenuItemProps {
            disabled: true,
            ..Default::default()
        };

        assert!(props.disabled);
    }

    #[test]
    fn test_menu_item_with_glow() {
        let props = MenuItemProps {
            glow: true,
            ..Default::default()
        };

        assert!(props.glow);
    }

    #[test]
    fn test_menu_item_with_height_compact() {
        let props = MenuItemProps {
            height: MenuItemHeight::Compact,
            ..Default::default()
        };

        assert_eq!(props.height, MenuItemHeight::Compact);
    }

    #[test]
    fn test_menu_item_with_height_extra_compact() {
        let props = MenuItemProps {
            height: MenuItemHeight::ExtraCompact,
            ..Default::default()
        };

        assert_eq!(props.height, MenuItemHeight::ExtraCompact);
    }

    #[test]
    fn test_submenu_props_default() {
        let props = SubMenuProps::default();

        assert_eq!(props.item_key, String::new());
        assert_eq!(props.title, String::new());
        assert!(!props.disabled);
        assert!(!props.default_expanded);
        assert_eq!(props.level, 0);
        assert_eq!(props.height, MenuItemHeight::Default);
    }

    #[test]
    fn test_submenu_with_title() {
        let props = SubMenuProps {
            title: "My Submenu".to_string(),
            ..Default::default()
        };

        assert_eq!(props.title, "My Submenu");
    }

    #[test]
    fn test_submenu_with_default_expanded() {
        let props = SubMenuProps {
            default_expanded: true,
            ..Default::default()
        };

        assert!(props.default_expanded);
    }

    #[test]
    fn test_submenu_disabled() {
        let props = SubMenuProps {
            disabled: true,
            ..Default::default()
        };

        assert!(props.disabled);
    }

    // ==================== Tabs Tests ====================

    #[test]
    fn test_tabs_props_default() {
        let props = TabsProps::default();

        assert_eq!(props.default_active, String::new());
        assert_eq!(props.tab_position, TabPosition::Top);
        assert!(props.animated);
    }

    #[test]
    fn test_tabs_with_default_active() {
        let props = TabsProps {
            default_active: "2".to_string(),
            ..Default::default()
        };

        assert_eq!(props.default_active, "2");
    }

    #[test]
    fn test_tabs_top_position() {
        let props = TabsProps {
            tab_position: TabPosition::Top,
            ..Default::default()
        };

        assert_eq!(props.tab_position, TabPosition::Top);
    }

    #[test]
    fn test_tabs_right_position() {
        let props = TabsProps {
            tab_position: TabPosition::Right,
            ..Default::default()
        };

        assert_eq!(props.tab_position, TabPosition::Right);
    }

    #[test]
    fn test_tabs_bottom_position() {
        let props = TabsProps {
            tab_position: TabPosition::Bottom,
            ..Default::default()
        };

        assert_eq!(props.tab_position, TabPosition::Bottom);
    }

    #[test]
    fn test_tabs_left_position() {
        let props = TabsProps {
            tab_position: TabPosition::Left,
            ..Default::default()
        };

        assert_eq!(props.tab_position, TabPosition::Left);
    }

    #[test]
    fn test_tabs_animated() {
        let props = TabsProps {
            animated: true,
            ..Default::default()
        };

        assert!(props.animated);
    }

    #[test]
    fn test_tabs_not_animated() {
        let props = TabsProps {
            animated: false,
            ..Default::default()
        };

        assert!(!props.animated);
    }

    #[test]
    fn test_tab_pane_props_default() {
        let props = TabPaneProps::default();

        assert_eq!(props.item_key, String::new());
        assert_eq!(props.tab, String::new());
        assert!(!props.disabled);
        assert!(props.icon.is_none());
    }

    #[test]
    fn test_tab_pane_with_key_and_tab() {
        let props = TabPaneProps {
            item_key: "1".to_string(),
            tab: "Tab 1".to_string(),
            ..Default::default()
        };

        assert_eq!(props.item_key, "1");
        assert_eq!(props.tab, "Tab 1");
    }

    #[test]
    fn test_tab_pane_disabled() {
        let props = TabPaneProps {
            disabled: true,
            ..Default::default()
        };

        assert!(props.disabled);
    }

    // ==================== Steps Tests ====================

    #[test]
    fn test_steps_props_default() {
        let props = StepsProps::default();

        assert_eq!(props.current, 0);
        assert_eq!(props.direction, StepsDirection::Horizontal);
        assert!(props.steps.is_empty());
    }

    #[test]
    fn test_steps_with_current() {
        let props = StepsProps {
            current: 2,
            steps: vec![StepItemProps {
                title: "Step 1".to_string(),
                description: None,
                icon: None,
                status: StepStatus::default(),
                class: String::new(),
            }],
            ..Default::default()
        };

        assert_eq!(props.current, 2);
    }

    #[test]
    fn test_steps_horizontal_direction() {
        let props = StepsProps {
            direction: StepsDirection::Horizontal,
            ..Default::default()
        };

        assert_eq!(props.direction, StepsDirection::Horizontal);
    }

    #[test]
    fn test_steps_vertical_direction() {
        let props = StepsProps {
            direction: StepsDirection::Vertical,
            ..Default::default()
        };

        assert_eq!(props.direction, StepsDirection::Vertical);
    }

    #[test]
    fn test_steps_with_steps() {
        let props = StepsProps {
            steps: vec![
                StepItemProps {
                    title: "Step 1".to_string(),
                    description: None,
                    icon: None,
                    status: StepStatus::default(),
                    class: String::new(),
                },
                StepItemProps {
                    title: "Step 2".to_string(),
                    description: None,
                    icon: None,
                    status: StepStatus::default(),
                    class: String::new(),
                },
            ],
            ..Default::default()
        };

        assert_eq!(props.steps.len(), 2);
    }

    #[test]
    fn test_steps_with_custom_class() {
        let props = StepsProps {
            class: "custom-steps".to_string(),
            ..Default::default()
        };

        assert_eq!(props.class, "custom-steps");
    }

    #[test]
    fn test_steps_item_props_with_description() {
        let props = StepItemProps {
            title: "Step 1".to_string(),
            description: Some("Description 1".to_string()),
            icon: None,
            status: StepStatus::default(),
            class: String::new(),
        };

        assert_eq!(props.title, "Step 1");
        assert_eq!(props.description, Some("Description 1".to_string()));
    }

    #[test]
    fn test_steps_item_props_with_icon() {
        let props = StepItemProps {
            title: "Step 1".to_string(),
            description: None,
            icon: Some("icon-name".to_string()),
            status: StepStatus::default(),
            class: String::new(),
        };

        assert_eq!(props.icon, Some("icon-name".to_string()));
    }

    #[test]
    fn test_steps_item_status_wait() {
        let props = StepItemProps {
            title: "Step 1".to_string(),
            description: None,
            icon: None,
            status: StepStatus::Wait,
            class: String::new(),
        };

        assert_eq!(props.status, StepStatus::Wait);
    }

    #[test]
    fn test_steps_item_status_process() {
        let props = StepItemProps {
            title: "Step 1".to_string(),
            description: None,
            icon: None,
            status: StepStatus::Process,
            class: String::new(),
        };

        assert_eq!(props.status, StepStatus::Process);
    }

    #[test]
    fn test_steps_item_status_finish() {
        let props = StepItemProps {
            title: "Step 1".to_string(),
            description: None,
            icon: None,
            status: StepStatus::Finish,
            class: String::new(),
        };

        assert_eq!(props.status, StepStatus::Finish);
    }

    #[test]
    fn test_steps_item_status_error() {
        let props = StepItemProps {
            title: "Step 1".to_string(),
            description: None,
            icon: None,
            status: StepStatus::Error,
            class: String::new(),
        };

        assert_eq!(props.status, StepStatus::Error);
    }
}
