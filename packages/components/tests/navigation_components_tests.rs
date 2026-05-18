#[cfg(test)]
mod tests {

    use hikari_components::navigation::{
        self, AnchorItem, BreadcrumbItemProps, BreadcrumbProps, MenuItemHeight, MenuItemProps,
        MenuMode, MenuProps, SidebarLeafProps, SidebarProps, SidebarSectionProps, StepData,
        StepperDirection, StepperProps, StepsDirection, StepsProps, SubMenuProps, TabPaneProps,
        TabPosition, TabsProps,
    };
    use hikari_components::prelude::*;

    #[test]
    fn test_menu_renders() {
        let _props = MenuProps {
            default_active: "1".to_string(),
            inline: true,
            mode: MenuMode::Vertical,
            compact: false,
            class: "test-menu".to_string(),
            children: VNode::empty(),
            on_select: None,
            in_popover: false,
            glow: false,
            request_close: None,
        };
    }

    #[test]
    fn test_menu_props_default() {
        let props = MenuProps::default();
        assert_eq!(props.default_active, String::new());
        assert!(!props.inline);
        assert_eq!(props.mode, MenuMode::Vertical);
        assert!(!props.compact);
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
    fn test_menu_with_compact() {
        let props = MenuProps {
            compact: true,
            ..Default::default()
        };
        assert!(props.compact);
    }

    #[test]
    fn test_submenu_renders() {
        let _props = SubMenuProps {
            item_key: "sub1".to_string(),
            title: "Sub Menu".to_string(),
            icon: None,
            disabled: false,
            default_expanded: true,
            level: 0,
            height: MenuItemHeight::Default,
            children: VNode::empty(),
            class: String::new(),
        };
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

    #[test]
    fn test_menu_item_renders() {
        let _props = MenuItemProps {
            item_key: "item1".to_string(),
            disabled: false,
            icon: None,
            children: VNode::empty(),
            class: String::new(),
            level: 0,
            height: MenuItemHeight::Default,
            onclick: None,
            glow: false,
        };
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
    fn test_menu_item_height_compact() {
        let props = MenuItemProps {
            height: MenuItemHeight::Compact,
            ..Default::default()
        };
        assert_eq!(props.height, MenuItemHeight::Compact);
    }

    #[test]
    fn test_menu_item_height_extra_compact() {
        let props = MenuItemProps {
            height: MenuItemHeight::ExtraCompact,
            ..Default::default()
        };
        assert_eq!(props.height, MenuItemHeight::ExtraCompact);
    }

    #[test]
    fn test_sidebar_renders() {
        let _props = SidebarProps {
            active_id: "section1".to_string(),
            class: "test-sidebar".to_string(),
            children: VNode::empty(),
        };
    }

    #[test]
    fn test_sidebar_props_default() {
        let props = SidebarProps::default();
        assert_eq!(props.active_id, String::new());
        assert_eq!(props.class, String::new());
    }

    #[test]
    fn test_sidebar_section_renders() {
        let _props = SidebarSectionProps {
            id: "sec1".to_string(),
            title: "Section 1".to_string(),
            secondary_title: Some("Subtitle".to_string()),
            default_expanded: true,
            class: String::new(),
            children: VNode::empty(),
        };
    }

    #[test]
    fn test_sidebar_section_props_default() {
        let props = SidebarSectionProps::default();
        assert_eq!(props.id, String::new());
        assert_eq!(props.title, String::new());
        assert!(props.secondary_title.is_none());
        assert!(!props.default_expanded);
    }

    #[test]
    fn test_sidebar_leaf_renders() {
        let _props = SidebarLeafProps {
            id: "leaf1".to_string(),
            secondary_label: Some("badge".to_string()),
            class: String::new(),
            children: VNode::empty(),
        };
    }

    #[test]
    fn test_sidebar_leaf_props_default() {
        let props = SidebarLeafProps::default();
        assert_eq!(props.id, String::new());
        assert!(props.secondary_label.is_none());
        assert_eq!(props.class, String::new());
    }

    #[test]
    fn test_tabs_renders() {
        let _props = TabsProps {
            default_active: "1".to_string(),
            tab_position: TabPosition::Top,
            animated: true,
            class: String::new(),
            children: VNode::empty(),
            on_change: None,
        };
    }

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
    fn test_tabs_not_animated() {
        let props = TabsProps {
            animated: false,
            ..Default::default()
        };
        assert!(!props.animated);
    }

    #[test]
    fn test_tab_pane_renders() {
        let _props = TabPaneProps {
            item_key: "1".to_string(),
            tab: "Tab 1".to_string(),
            disabled: false,
            icon: None,
            children: VNode::empty(),
            class: String::new(),
        };
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

    #[test]
    fn test_breadcrumb_renders() {
        let _props = BreadcrumbProps {
            separator: "/".to_string(),
            class: "test-breadcrumb".to_string(),
            children: VNode::empty(),
        };
    }

    #[test]
    fn test_breadcrumb_props_default() {
        let props = BreadcrumbProps::default();
        assert_eq!(props.separator, "/".to_string());
        assert_eq!(props.class, String::new());
    }

    #[test]
    fn test_breadcrumb_item_renders() {
        let _props = BreadcrumbItemProps {
            item_key: "home".to_string(),
            href: Some("/home".to_string()),
            children: VNode::empty(),
            class: String::new(),
            onclick: None,
        };
    }

    #[test]
    fn test_breadcrumb_item_props_default() {
        let props = BreadcrumbItemProps::default();
        assert_eq!(props.item_key, String::new());
        assert!(props.href.is_none());
        assert!(props.onclick.is_none());
    }

    #[test]
    fn test_anchor_renders() {
        let item = AnchorItem {
            href: "#section1".to_string(),
            title: "Section 1".to_string(),
        };
        assert_eq!(item.href, "#section1");
        assert_eq!(item.title, "Section 1");
    }

    #[test]
    fn test_anchor_item_equality() {
        let a = AnchorItem {
            href: "#s1".to_string(),
            title: "S1".to_string(),
        };
        let b = AnchorItem {
            href: "#s1".to_string(),
            title: "S1".to_string(),
        };
        assert_eq!(a, b);
    }

    #[test]
    fn test_anchor_item_clone() {
        let item = AnchorItem {
            href: "#s1".to_string(),
            title: "S1".to_string(),
        };
        let cloned = item.clone();
        assert_eq!(item, cloned);
    }

    #[test]
    fn test_stepper_renders() {
        let _props = StepperProps {
            current: 2,
            total: 5,
            direction: StepperDirection::Horizontal,
            class: "test-stepper".to_string(),
        };
    }

    #[test]
    fn test_stepper_props_default() {
        let props = StepperProps::default();
        assert_eq!(props.current, 0);
        assert_eq!(props.total, 5);
        assert_eq!(props.direction, StepperDirection::Horizontal);
    }

    #[test]
    fn test_stepper_direction_vertical() {
        let props = StepperProps {
            direction: StepperDirection::Vertical,
            ..Default::default()
        };
        assert_eq!(props.direction, StepperDirection::Vertical);
    }

    #[test]
    fn test_steps_renders() {
        let _props = StepsProps {
            current: 1,
            direction: StepsDirection::Horizontal,
            steps: vec![
                StepData {
                    title: "Step 1".to_string(),
                    description: None,
                    icon: None,
                    status: navigation::steps::StepStatus::default(),
                    class: String::new(),
                },
                StepData {
                    title: "Step 2".to_string(),
                    description: Some("Desc".to_string()),
                    icon: Some("icon".to_string()),
                    status: navigation::steps::StepStatus::Finish,
                    class: String::new(),
                },
            ],
            class: "test-steps".to_string(),
            style: String::new(),
            on_change: None,
        };
    }

    #[test]
    fn test_steps_props_default() {
        let props = StepsProps::default();
        assert_eq!(props.current, 0);
        assert_eq!(props.direction, StepsDirection::Horizontal);
        assert!(props.steps.is_empty());
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
    fn test_steps_with_current() {
        let props = StepsProps {
            current: 2,
            steps: vec![StepData {
                title: "Step 1".to_string(),
                ..Default::default()
            }],
            ..Default::default()
        };
        assert_eq!(props.current, 2);
        assert_eq!(props.steps.len(), 1);
    }

    #[test]
    fn test_steps_with_multiple_steps() {
        let props = StepsProps {
            steps: vec![
                StepData {
                    title: "Step 1".to_string(),
                    ..Default::default()
                },
                StepData {
                    title: "Step 2".to_string(),
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        assert_eq!(props.steps.len(), 2);
    }

    #[test]
    fn test_step_data_with_description() {
        let step = StepData {
            title: "Step 1".to_string(),
            description: Some("Description".to_string()),
            ..Default::default()
        };
        assert_eq!(step.description, Some("Description".to_string()));
    }

    #[test]
    fn test_step_data_with_icon() {
        let step = StepData {
            title: "Step 1".to_string(),
            icon: Some("icon-name".to_string()),
            ..Default::default()
        };
        assert_eq!(step.icon, Some("icon-name".to_string()));
    }

    #[test]
    fn test_step_status_wait() {
        let step = StepData {
            title: "S1".to_string(),
            status: navigation::steps::StepStatus::Wait,
            ..Default::default()
        };
        assert_eq!(step.status, navigation::steps::StepStatus::Wait);
    }

    #[test]
    fn test_step_status_process() {
        let step = StepData {
            title: "S1".to_string(),
            status: navigation::steps::StepStatus::Process,
            ..Default::default()
        };
        assert_eq!(step.status, navigation::steps::StepStatus::Process);
    }

    #[test]
    fn test_step_status_finish() {
        let step = StepData {
            title: "S1".to_string(),
            status: navigation::steps::StepStatus::Finish,
            ..Default::default()
        };
        assert_eq!(step.status, navigation::steps::StepStatus::Finish);
    }

    #[test]
    fn test_step_status_error() {
        let step = StepData {
            title: "S1".to_string(),
            status: navigation::steps::StepStatus::Error,
            ..Default::default()
        };
        assert_eq!(step.status, navigation::steps::StepStatus::Error);
    }
}
