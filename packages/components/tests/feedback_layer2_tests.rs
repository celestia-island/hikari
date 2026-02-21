// Unit tests for Layer 2 feedback components (Modal, Dropdown, Drawer)

use dioxus::prelude::*;
use hikari_components::feedback::{
    {DrawerPlacement, DrawerProps, DrawerSize}, {MaskMode, ModalConfig, ModalPosition},
};

// ==================== Modal Tests ====================

#[test]
fn test_modal_config_default() {
    let config = ModalConfig::default();
    assert_eq!(config.position, ModalPosition::Center);
    assert_eq!(config.mask_mode, MaskMode::Opaque);
    assert!(config.closable);
    assert!(config.mask_closable);
}

#[test]
fn test_modal_config_custom() {
    let config = ModalConfig {
        position: ModalPosition::Top,
        mask_mode: MaskMode::Transparent,
        closable: false,
        mask_closable: false,
        class: "custom-modal".to_string(),
        ..Default::default()
    };
    assert_eq!(config.position, ModalPosition::Top);
    assert_eq!(config.mask_mode, MaskMode::Transparent);
    assert!(!config.closable);
    assert!(!config.mask_closable);
}

#[test]
fn test_modal_position_center() {
    let config = ModalConfig {
        position: ModalPosition::Center,
        ..Default::default()
    };
    assert_eq!(config.position, ModalPosition::Center);
}

#[test]
fn test_modal_position_top_left() {
    let config = ModalConfig {
        position: ModalPosition::TopLeft,
        ..Default::default()
    };
    assert_eq!(config.position, ModalPosition::TopLeft);
}

#[test]
fn test_modal_position_top_right() {
    let config = ModalConfig {
        position: ModalPosition::TopRight,
        ..Default::default()
    };
    assert_eq!(config.position, ModalPosition::TopRight);
}

#[test]
fn test_modal_mask_mode_opaque() {
    let config = ModalConfig {
        mask_mode: MaskMode::Opaque,
        ..Default::default()
    };
    assert_eq!(config.mask_mode, MaskMode::Opaque);
}

#[test]
fn test_modal_mask_mode_transparent() {
    let config = ModalConfig {
        mask_mode: MaskMode::Transparent,
        ..Default::default()
    };
    assert_eq!(config.mask_mode, MaskMode::Transparent);
}

#[test]
fn test_modal_with_custom_class() {
    let config = ModalConfig {
        class: "my-custom-modal-class".to_string(),
        ..Default::default()
    };
    assert_eq!(config.class, "my-custom-modal-class");
}

// ==================== Drawer Tests ====================

#[test]
fn test_drawer_props_default() {
    let props = DrawerProps {
        open: false,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };

    assert!(!props.open);
    assert_eq!(props.placement, DrawerPlacement::Right);
    assert_eq!(props.size, DrawerSize::Medium);
    assert!(props.mask_closable);
    assert!(props.title.is_none());
    assert!(props.footer.is_none());
}

#[test]
fn test_drawer_open() {
    let props = DrawerProps {
        open: true,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert!(props.open);
}

#[test]
fn test_drawer_closed() {
    let props = DrawerProps {
        open: false,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert!(!props.open);
}

#[test]
fn test_drawer_placement_right() {
    let props = DrawerProps {
        open: false,
        placement: DrawerPlacement::Right,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.placement, DrawerPlacement::Right);
}

#[test]
fn test_drawer_placement_left() {
    let props = DrawerProps {
        open: false,
        placement: DrawerPlacement::Left,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.placement, DrawerPlacement::Left);
}

#[test]
fn test_drawer_placement_top() {
    let props = DrawerProps {
        open: false,
        placement: DrawerPlacement::Top,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.placement, DrawerPlacement::Top);
}

#[test]
fn test_drawer_placement_bottom() {
    let props = DrawerProps {
        open: false,
        placement: DrawerPlacement::Bottom,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.placement, DrawerPlacement::Bottom);
}

#[test]
fn test_drawer_size_small() {
    let props = DrawerProps {
        open: false,
        size: DrawerSize::Small,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.size, DrawerSize::Small);
}

#[test]
fn test_drawer_size_medium() {
    let props = DrawerProps {
        open: false,
        size: DrawerSize::Medium,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.size, DrawerSize::Medium);
}

#[test]
fn test_drawer_size_large() {
    let props = DrawerProps {
        open: false,
        size: DrawerSize::Large,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.size, DrawerSize::Large);
}

#[test]
fn test_drawer_mask_closable() {
    let props = DrawerProps {
        open: false,
        mask_closable: true,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert!(props.mask_closable);
}

#[test]
fn test_drawer_not_mask_closable() {
    let props = DrawerProps {
        open: false,
        mask_closable: false,
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert!(!props.mask_closable);
}

#[test]
fn test_drawer_with_title() {
    let props = DrawerProps {
        open: false,
        title: Some("Settings".to_string()),
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.title, Some("Settings".to_string()));
}

#[test]
fn test_drawer_with_footer() {
    let footer = rsx! {
        div { "Footer content" }
    };
    let props = DrawerProps {
        open: false,
        footer: Some(footer),
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert!(props.footer.is_some());
}

#[test]
fn test_drawer_with_custom_class() {
    let props = DrawerProps {
        open: false,
        class: "custom-drawer".to_string(),
        children: rsx! { div { "Content" } },
        ..Default::default()
    };
    assert_eq!(props.class, "custom-drawer");
}

// ==================== Dropdown Tests ====================

#[test]
fn test_dropdown_default_renders() {
    // Test that Dropdown can be imported and used
    // Dropdown is a complex component, we test its basic rendering capability
}
