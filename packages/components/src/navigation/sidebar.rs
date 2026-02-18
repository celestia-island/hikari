// hi-components/src/navigation/sidebar.rs
// Generic multi-level sidebar navigation component
//
// Design principles:
// - Support arbitrary nesting levels
// - Render details controlled via children (slot-like)
// - Fully customizable through props and classes
// - Styles via SCSS with CSS variables for theming

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, SidebarClass, UtilityClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

/// Sidebar component type wrapper (for StyledComponent)
pub struct SidebarComponent;

/// Container props for the Sidebar
#[derive(Clone, PartialEq, Props)]
pub struct SidebarProps {
    /// Currently active item ID (for highlighting)
    #[props(default)]
    pub active_id: String,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Child elements (SidebarSection, SidebarItem, etc.)
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

/// Sidebar - Main container component
///
/// A flexible, multi-level sidebar navigation component.
/// Supports arbitrary nesting through recursive components.
///
/// # Features
/// - **Arbitrary Nesting**: Support for unlimited levels through recursion
/// - **Custom Rendering**: Children provide full control over content
/// - **Active States**: Visual indication for selected items
/// - **Collapsible Sections**: Sections can be expanded/collapsed
/// - **Theme Support**: CSS variables for easy theming
///
/// # Examples
///
/// ## Basic Sidebar
/// ```rust,ignore
/// use dioxus::prelude::*;
/// use hikari_components::{Sidebar, SidebarItem};
/// use dioxus_router::components::Link;
///
/// fn app() -> Element {
///     rsx! {
///         Sidebar {
///             active_id: "home".to_string(),
///             SidebarItem {
///                 id: "home".to_string(),
///                 label: "Home".to_string(),
///                 Link { to: "/", "Home" }
///             }
///             SidebarItem {
///                 id: "settings".to_string(),
///                 label: "Settings".to_string(),
///                 Link { to: "/settings", "Settings" }
///             }
///         }
///     }
/// }
/// ```
///
/// ## Nested Sections
/// ```rust,ignore
/// use dioxus::prelude::*;
/// use hikari_components::{Sidebar, SidebarSection, SidebarItem};
///
/// fn app() -> Element {
///     rsx! {
///         Sidebar {
///             active_id: "overview".to_string(),
///             SidebarSection {
///                 id: "components".to_string(),
///                 title: "Components".to_string(),
///                 secondary_title: Some("组件".to_string()),
///                 default_expanded: true,
///                 SidebarItem {
///                     id: "basic".to_string(),
///                     label: "Basic".to_string(),
///                     Link { to: "/components/basic", "Basic" }
///                 }
///             }
///         }
///     }
/// }
/// ```
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

/// Sidebar Section - Collapsible category/section
///
/// A non-clickable header that can be expanded/collapsed to show children.
/// Typically used as the top-level categorization in a sidebar.
#[derive(Clone, PartialEq, Props)]
pub struct SidebarSectionProps {
    /// Unique identifier for this section
    pub id: String,

    /// Primary title (e.g., "Components")
    pub title: String,

    /// Secondary title (e.g., "组件" for Chinese)
    #[props(default)]
    pub secondary_title: Option<String>,

    /// Whether the section is expanded by default
    #[props(default)]
    pub default_expanded: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Child elements (shown when expanded)
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

/// Sidebar Section component
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
                intensity: GlowIntensity::Thirty,
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

/// Sidebar Item - Clickable navigation item
///
/// A clickable navigation item that can have optional nested items.
/// Can be used as a leaf node or as a parent for nested items.
#[derive(Clone, PartialEq, Props)]
pub struct SidebarItemProps {
    /// Unique identifier for this item
    pub id: String,

    /// Primary label (e.g., "Basic")
    #[props(default)]
    pub label: String,

    /// Secondary label (e.g., "基础" for Chinese)
    #[props(default)]
    pub secondary_label: Option<String>,

    /// Whether this item is expanded by default (when it has items)
    #[props(default)]
    pub default_expanded: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Header content (optional, overrides label rendering)
    /// If provided, this will be rendered in the item header instead of labels
    pub content: Option<Element>,

    /// Nested items (optional, rendered in the children container when provided)
    #[props(default)]
    pub items: Option<Element>,
}

/// Sidebar Item component
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
                intensity: GlowIntensity::Thirty,
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

/// Sidebar Leaf - Terminal navigation item without children
///
/// A simplified item component for leaf nodes (no children).
/// More ergonomic than SidebarItem when you don't need nesting.
#[derive(Clone, PartialEq, Props)]
pub struct SidebarLeafProps {
    /// Unique identifier for this item
    pub id: String,

    /// Secondary label (e.g., "基础" for Chinese)
    #[props(default)]
    pub secondary_label: Option<String>,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Content (typically a Link component)
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

/// Sidebar Leaf component
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
