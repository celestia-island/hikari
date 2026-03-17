// hi-components/src/navigation/sidebar.rs
// Generic multi-level sidebar navigation component
//
// Design principles:
// - Support arbitrary nesting levels
// - Render details controlled via children (slot-like)
// - Fully customizable through props and classes
// - Styles via SCSS with CSS variables for theming

use crate::prelude::*;
use icons::{Icon, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, SidebarClass, UtilityClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

pub struct SidebarComponent;

#[derive(Clone, PartialEq, Props)]
pub struct SidebarProps {
    #[props(default)]
    pub active_id: String,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,
}

impl Default for SidebarProps {
    fn default() -> Self {
        Self {
            active_id: String::default(),
            class: String::default(),
            children: VNode::empty(),
        }
    }
}

///
///
///
///
///
///
///
#[component]
pub fn Sidebar(props: SidebarProps) -> Element {
    let nav_classes = ClassesBuilder::new()
        .add(SidebarClass::Sidebar)
        .add_raw(&props.class)
        .build();

    rsx! {
        nav {
            class: "{nav_classes}",
            role: "navigation",
            "aria-label": "Sidebar navigation",

            { props.children }
        }
    }
}

impl StyledComponent for SidebarComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/sidebar.css"))
    }

    fn name() -> &'static str {
        "sidebar"
    }
}

///
#[derive(Clone, PartialEq, Props)]
pub struct SidebarSectionProps {
    pub id: String,

    pub title: String,

    #[props(default)]
    pub secondary_title: Option<String>,

    #[props(default)]
    pub default_expanded: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,
}

impl Default for SidebarSectionProps {
    fn default() -> Self {
        Self {
            id: String::default(),
            title: String::default(),
            secondary_title: None,
            default_expanded: false,
            class: String::default(),
            children: VNode::empty(),
        }
    }
}

#[component]
pub fn SidebarSection(props: SidebarSectionProps) -> Element {
    let mut is_expanded = use_signal(|| props.default_expanded);

    let expanded_attr = if is_expanded() { "true" } else { "false" };

    let section_classes = ClassesBuilder::new()
        .add(SidebarClass::Section)
        .add_raw(&props.class)
        .build();

    let arrow_classes = ClassesBuilder::new()
        .add(SidebarClass::SectionArrow)
        .add_if(SidebarClass::SectionArrowRotated, move || is_expanded())
        .build();

    rsx! {
        div {
            class: "{section_classes}",
            "data-id": "{props.id}",

            // Section header (clickable to toggle) - wrapped with Glow
            Glow {
                blur: GlowBlur::Light,
                color: GlowColor::Primary,
                intensity: GlowIntensity::Dim,
                div {
                    class: "{SidebarClass::SectionHeader.as_class()}",
                    onclick: move |_| { is_expanded.toggle(); },
                    aria_expanded: expanded_attr,

                    div {
                        class: "{SidebarClass::SectionTitleGroup.as_class()}",

                        span {
                            class: "{SidebarClass::SectionTitlePrimary.as_class()}",
                            "{props.title}"
                        }

                        if let Some(secondary) = &props.secondary_title {
                            span {
                                class: "{SidebarClass::SectionTitleSecondary.as_class()}",
                                "{secondary}"
                            }
                        }
                    }

                    div {
                        class: "{arrow_classes}",
                        Icon { icon: MdiIcon::ChevronDown }
                    }
                }
            }

            // Children container (visible when expanded)
            div {
                class: "{SidebarClass::SectionChildren.as_class()}",
                "data-expanded": expanded_attr,
                aria_hidden: "{!is_expanded()}",

                { props.children }
            }
        }
    }
}

///
#[derive(Clone, PartialEq, Props)]
pub struct SidebarItemProps {
    pub id: String,

    #[props(default)]
    pub label: String,

    #[props(default)]
    pub secondary_label: Option<String>,

    #[props(default)]
    pub default_expanded: bool,

    #[props(default)]
    pub class: String,

    pub content: Option<Element>,

    #[props(default)]
    pub items: Option<Element>,
}

#[component]
pub fn SidebarItem(props: SidebarItemProps) -> Element {
    // Check if nested items are provided
    let has_items = props.items.is_some();
    let mut is_expanded = use_signal(|| props.default_expanded);

    let expanded_attr = if is_expanded() { "true" } else { "false" };

    let item_classes = ClassesBuilder::new()
        .add(SidebarClass::Item)
        .add_raw(&props.class)
        .build();

    let arrow_classes = ClassesBuilder::new()
        .add(SidebarClass::ItemArrow)
        .add_if(SidebarClass::ItemArrowRotated, move || is_expanded())
        .build();

    rsx! {
        div {
            class: "{item_classes}",
            "data-id": "{props.id}",

            // Item header (always visible)
            // Make entire header clickable when it has nested items
            Glow {
                blur: GlowBlur::Light,
                color: GlowColor::Primary,
                intensity: GlowIntensity::Dim,
                div {
                    class: "{SidebarClass::ItemHeader.as_class()}",
                    "data-has-children": "{has_items}",

                    // Add onclick handler to entire header for expand/collapse
                    // When has children, clicking anywhere on the header toggles
                    onclick: move |_| {
                        if has_items {
                            is_expanded.toggle();
                        }
                    },

                // Custom content slot - user provides Link or other content
                // If content is provided, use it; otherwise render labels
                div {
                    class: "{SidebarClass::ItemContent.as_class()}",
                    if let Some(content) = &props.content {
                        { content }
                    } else {
                        { props.label }
                        if let Some(secondary) = &props.secondary_label {
                            span { class: "{SidebarClass::ItemSecondary.as_class()}", "{secondary}" }
                        }
                    }
                }

                // Expand/collapse arrow (only if has items)
                // Visual indicator only - onclick is on the parent header
                if has_items {
                    div {
                        class: "{arrow_classes}",
                        aria_expanded: expanded_attr,
                        Icon { icon: MdiIcon::ChevronRight }
                    }
                }
                }
            }
            if let Some(items) = &props.items {
                div {
                    class: "{SidebarClass::ItemChildren.as_class()}",
                    "data-expanded": expanded_attr,
                    aria_hidden: "{!is_expanded()}",

                    // Render nested items
                    { items }
                }
            }
        }
    }
}

///
#[derive(Clone, PartialEq, Props)]
pub struct SidebarLeafProps {
    pub id: String,

    #[props(default)]
    pub secondary_label: Option<String>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,
}

impl Default for SidebarLeafProps {
    fn default() -> Self {
        Self {
            id: String::default(),
            secondary_label: None,
            class: String::default(),
            children: VNode::empty(),
        }
    }
}

#[component]
pub fn SidebarLeaf(props: SidebarLeafProps) -> Element {
    let leaf_classes = ClassesBuilder::new()
        .add(SidebarClass::Leaf)
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{leaf_classes}",
            "data-id": "{props.id}",

            div {
                class: "{SidebarClass::LeafContent.as_class()}",
                { props.children }
                if let Some(secondary) = &props.secondary_label {
                    span { class: "{SidebarClass::ItemSecondary.as_class()}", "{secondary}" }
                }
            }
        }
    }
}
