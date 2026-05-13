// Example: Dynamic level and compact mode for menu components

use dioxus::prelude::*;
use hikari_components::{Menu, MenuItem, SubMenu};

fn app() -> Element {
    rsx! {
        // Normal mode with dynamic levels
        Menu {
            mode: MenuMode::Vertical,
            compact: false,

            MenuItem {
                item_key: "root-1".to_string(),
                level: 0,
                "Root Level 0"
            }

            SubMenu {
                item_key: "submenu-1".to_string(),
                title: "Level 1 Submenu".to_string(),
                level: 1,

                MenuItem {
                    item_key: "level-1-1".to_string(),
                    level: 1,
                    "Level 1 Item"
                }

                SubMenu {
                    item_key: "submenu-2".to_string(),
                    title: "Level 2 Submenu".to_string(),
                    level: 2,

                    MenuItem {
                        item_key: "level-2-1".to_string(),
                        level: 2,
                        "Level 2 Item"
                    }

                    SubMenu {
                        item_key: "submenu-3".to_string(),
                        title: "Level 3 Submenu".to_string(),
                        level: 3,

                        MenuItem {
                            item_key: "level-3-1".to_string(),
                            level: 3,
                            "Level 3 Item"
                        }
                    }
                }
            }
        }
    }
}

fn app_compact() -> Element {
    rsx! {
        // Compact mode for deep trees
        Menu {
            mode: MenuMode::Vertical,
            compact: true,

            MenuItem {
                item_key: "root-1".to_string(),
                level: 0,
                "Root Level 0"
            }

            SubMenu {
                item_key: "submenu-1".to_string(),
                title: "Level 1 Submenu".to_string(),
                level: 1,

                MenuItem {
                    item_key: "level-1-1".to_string(),
                    level: 1,
                    "Level 1 Item"
                }

                SubMenu {
                    item_key: "submenu-2".to_string(),
                    title: "Level 2 Submenu".to_string(),
                    level: 2,

                    MenuItem {
                        item_key: "level-2-1".to_string(),
                        level: 2,
                        "Level 2 Item"
                    }

                    SubMenu {
                        item_key: "submenu-3".to_string(),
                        title: "Level 3 Submenu".to_string(),
                        level: 3,

                        MenuItem {
                            item_key: "level-3-1".to_string(),
                            level: 3,
                            "Level 3 Item"
                        }
                    }
                }
            }
        }
    }
}
