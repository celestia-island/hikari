#[cfg(test)]
mod tests {
    use hikari_components::prelude::*;
    use tairitsu_macros::rsx;
    use hikari_components::navigation::{
        AnchorItem,
        SidebarProps,
        SidebarSectionProps,
        SidebarItemProps,
        SidebarLeafProps,
    };

    // ── Anchor ─────────────────────────────────────────────────

    #[test]
    fn test_anchor_item_default() {
        let item = AnchorItem {
            href: "#section1".to_string(),
            title: "Section 1".to_string(),
        };
        assert_eq!(item.href, "#section1");
        assert_eq!(item.title, "Section 1");
    }

    #[test]
    fn test_anchor_with_items() {
        let items = [
            AnchorItem { href: "#intro".to_string(), title: "Intro".to_string() },
            AnchorItem { href: "#body".to_string(), title: "Body".to_string() },
            AnchorItem { href: "#conclusion".to_string(), title: "Conclusion".to_string() },
        ];
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].href, "#intro");
        assert_eq!(items[2].title, "Conclusion");
    }

    // ── Sidebar ────────────────────────────────────────────────

    #[test]
    fn test_sidebar_props_default() {
        let props = SidebarProps::default();
        assert_eq!(props.active_id, "");
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_sidebar_with_active_id() {
        let props = SidebarProps {
            active_id: "nav-home".to_string(),
            class: "my-sidebar".to_string(),
            ..Default::default()
        };
        assert_eq!(props.active_id, "nav-home");
        assert_eq!(props.class, "my-sidebar");
    }

    // ── SidebarSection ─────────────────────────────────────────

    #[test]
    fn test_sidebar_section_props_default() {
        let props = SidebarSectionProps::default();
        assert_eq!(props.id, "");
        assert_eq!(props.title, "");
        assert!(props.secondary_title.is_none());
        assert!(!props.default_expanded);
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_sidebar_section_expanded() {
        let props = SidebarSectionProps {
            id: "section-1".to_string(),
            title: "Settings".to_string(),
            secondary_title: Some("3 items".to_string()),
            default_expanded: true,
            class: "settings-section".to_string(),
            ..Default::default()
        };
        assert_eq!(props.id, "section-1");
        assert_eq!(props.title, "Settings");
        assert!(props.default_expanded);
        assert_eq!(props.secondary_title.as_deref().unwrap(), "3 items");
    }

    // ── SidebarItem ───────────────────────────────────────────

    #[test]
    fn test_sidebar_item_props_default() {
        let props = SidebarItemProps::default();
        assert_eq!(props.id, "");
        assert_eq!(props.label, "");
        assert!(props.secondary_label.is_none());
        assert!(!props.default_expanded);
        assert_eq!(props.class, "");
        assert!(props.content.is_none());
        assert!(props.items.is_none());
    }

    #[test]
    fn test_sidebar_item_with_children() {
        let props = SidebarItemProps {
            id: "item-1".to_string(),
            label: "Parent Item".to_string(),
            secondary_label: Some("Sub-items".to_string()),
            default_expanded: true,
            items: Some(VNode::empty()),
            ..Default::default()
        };
        assert_eq!(props.id, "item-1");
        assert!(props.items.is_some());
        assert!(props.default_expanded);
    }

    // ── SidebarLeaf ───────────────────────────────────────────

    #[test]
    fn test_sidebar_leaf_props_default() {
        let props = SidebarLeafProps::default();
        assert_eq!(props.id, "");
        assert!(props.secondary_label.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_sidebar_leaf_with_content() {
        let props = SidebarLeafProps {
            id: "leaf-1".to_string(),
            secondary_label: Some("v1.0".to_string()),
            class: "leaf-item".to_string(),
            children: rsx! { a { "Link" } },
        };
        assert_eq!(props.id, "leaf-1");
        assert_eq!(props.secondary_label.as_deref().unwrap(), "v1.0");
    }
}
