// hi-components/src/navigation/sidebar.rs
// Generic multi-level sidebar navigation component
//
// Design principles:
// - Support arbitrary nesting levels
// - Render details controlled via children (slot-like)
// - Fully customizable through props and classes
// - Styles via SCSS with CSS variables for theming

use hikari_icons::Icon;
use hikari_icons::mdi_minimal::MdiIcon;
use hikari_palette::classes::{ClassesBuilder, SidebarClass, TypedClass};

use crate::feedback::{Glow, GlowBlur, GlowColor, GlowIntensity};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SidebarComponent;

/// Props for the [`Sidebar`] component.
#[define_props]
pub struct SidebarProps {
    #[default("".to_string())]
    pub active_id: String,

    #[default("".to_string())]
    pub class: String,

    #[default(VNode::empty())]
    pub children: Element,
}

/// Sidebar navigation component
///
/// A multi-level sidebar navigation component with support for
/// nested sections, items, and leaf nodes.
#[component]
pub fn Sidebar(props: SidebarProps) -> Element {
    let nav_classes = ClassesBuilder::new()
        .add_typed(SidebarClass::Sidebar)
        .add(&props.class)
        .build();

    rsx! {
        nav {
            class: nav_classes,
            role: "navigation",
            "aria-label": "Sidebar navigation",

            {props.children}
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

/// Props for the SidebarSection component
#[define_props]
pub struct SidebarSectionProps {
    #[default("".to_string())]
    pub id: String,

    #[default("".to_string())]
    pub title: String,

    pub secondary_title: Option<String>,

    #[default(false)]
    pub default_expanded: bool,

    #[default("".to_string())]
    pub class: String,

    #[default(VNode::empty())]
    pub children: Element,
}

/// A collapsible section within a sidebar containing nested items.
#[component]
pub fn SidebarSection(props: SidebarSectionProps) -> Element {
    let is_expanded = use_signal(|| props.default_expanded);

    let expanded_attr = if is_expanded.get() { "true" } else { "false" };

    let section_classes = ClassesBuilder::new()
        .add_typed(SidebarClass::Section)
        .add(&props.class)
        .build();

    let is_expanded_for_arrow = is_expanded.clone();
    let arrow_classes = ClassesBuilder::new()
        .add_typed(SidebarClass::SectionArrow)
        .add_typed_if(SidebarClass::SectionArrowRotated, {
            is_expanded_for_arrow.get()
        })
        .build();

    let header_class = SidebarClass::SectionHeader.class_name();
    let title_group_class = SidebarClass::SectionTitleGroup.class_name();
    let title_primary_class = SidebarClass::SectionTitlePrimary.class_name();
    let title_secondary_class = SidebarClass::SectionTitleSecondary.class_name();
    let children_class = SidebarClass::SectionChildren.class_name();
    let aria_hidden_val = (!is_expanded.get()).to_string();

    let is_expanded_for_click = is_expanded.clone();
    let handle_click = move |_| {
        is_expanded_for_click.set(!is_expanded_for_click.get());
    };

    rsx! {
        div { class: section_classes, "data-id": props.id,

            // Section header (clickable to toggle) - wrapped with Glow
            Glow {
                blur: GlowBlur::Light,
                color: GlowColor::Primary,
                intensity: GlowIntensity::Dim,
                div {
                    class: header_class,
                    onclick: handle_click,
                    aria_expanded: expanded_attr,

                    div { class: title_group_class,

                        span { class: title_primary_class, "{props.title}" }

                        if let Some(secondary) = &props.secondary_title {
                            span { class: title_secondary_class, "{secondary}" }
                        }
                    }

                    div { class: arrow_classes,
                        Icon { icon: MdiIcon::ChevronDown }
                    }
                }
            }

            // Children container (visible when expanded)
            div {
                class: children_class,
                "data-expanded": expanded_attr,
                aria_hidden: aria_hidden_val,

                {props.children}
            }
        }
    }
}

/// Props for the SidebarItem component
#[define_props]
pub struct SidebarItemProps {
    #[default("".to_string())]
    pub id: String,

    #[default("".to_string())]
    pub label: String,

    pub secondary_label: Option<String>,

    #[default(false)]
    pub default_expanded: bool,

    #[default("".to_string())]
    pub class: String,

    pub content: Option<Element>,

    pub items: Option<Element>,
}

/// A sidebar item with optional nested children and expand/collapse support.
#[component]
pub fn SidebarItem(props: SidebarItemProps) -> Element {
    // Check if nested items are provided
    let has_items = props.items.is_some();
    let mut is_expanded = use_signal(|| props.default_expanded);

    let expanded_attr = if is_expanded.get() { "true" } else { "false" };

    let item_classes = ClassesBuilder::new()
        .add_typed(SidebarClass::Item)
        .add(&props.class)
        .build();

    let is_expanded_for_arrow = is_expanded.clone();
    let arrow_classes = ClassesBuilder::new()
        .add_typed(SidebarClass::ItemArrow)
        .add_typed_if(SidebarClass::ItemArrowRotated, {
            is_expanded_for_arrow.get()
        })
        .build();

    let header_class = SidebarClass::ItemHeader.class_name();
    let content_class = SidebarClass::ItemContent.class_name();
    let secondary_class = SidebarClass::ItemSecondary.class_name();
    let item_children_class = SidebarClass::ItemChildren.class_name();
    let aria_hidden_val = (!is_expanded.get()).to_string();

    let is_expanded_for_click = is_expanded.clone();

    rsx! {
        div { class: {item_classes}, "data-id": props.id,

            // Item header (always visible)
            // Make entire header clickable when it has nested items
            Glow {
                blur: GlowBlur::Light,
                color: GlowColor::Primary,
                intensity: GlowIntensity::Dim,
                div {
                    class: {header_class},
                    "data-has-children": has_items,

                    // Add onclick handler to entire header for expand/collapse
                    // When has children, clicking anywhere on the header toggles
                    onclick: move |_| {
                        if has_items {
                            is_expanded_for_click.set(!is_expanded_for_click.get());
                        }
                    },

                    // Custom content slot - user provides Link or other content
                    // If content is provided, use it; otherwise render labels
                    div { class: {content_class},
                        if let Some(content) = &props.content {
                            {content.clone()}
                        } else {
                            "{props.label}"
                            if let Some(secondary) = &props.secondary_label {
                                span { class: {secondary_class}, "{secondary}" }
                            }
                        }
                    }

                    // Expand/collapse arrow (only if has items)
                    // Visual indicator only - onclick is on the parent header
                    {
                        if has_items {
                            rsx! {
                                div { class: arrow_classes.clone(), aria_expanded: expanded_attr,
                                    Icon { icon: MdiIcon::ChevronRight }
                                }
                            }
                        } else {
                            VNode::empty()
                        }
                    }
                }
            }

            if let Some(items) = &props.items {
                div {
                    class: item_children_class,
                    "data-expanded": expanded_attr,
                    aria_hidden: aria_hidden_val,

                    // Render nested items
                    {items.clone()}
                }
            }
        }
    }
}

/// Props for the SidebarLeaf component
#[define_props]
pub struct SidebarLeafProps {
    #[default("".to_string())]
    pub id: String,

    pub secondary_label: Option<String>,

    #[default("".to_string())]
    pub class: String,

    #[default(VNode::empty())]
    pub children: Element,
}

/// A terminal leaf node in the sidebar with no nested children.
#[component]
pub fn SidebarLeaf(props: SidebarLeafProps) -> Element {
    let leaf_classes = ClassesBuilder::new()
        .add_typed(SidebarClass::Leaf)
        .add(&props.class)
        .build();

    let leaf_content_class = SidebarClass::LeafContent.class_name();
    let secondary_class = SidebarClass::ItemSecondary.class_name();

    rsx! {
        div { class: leaf_classes, "data-id": props.id,

            div { class: leaf_content_class,
                {props.children}
                if let Some(secondary) = &props.secondary_label {
                    span { class: secondary_class, "{secondary}" }
                }
            }
        }
    }
}
