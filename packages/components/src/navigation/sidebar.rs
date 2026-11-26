// hi-components/src/navigation/sidebar.rs
// Generic multi-level sidebar navigation component
//
// Design principles:
// - Support arbitrary nesting levels
// - Render details controlled via children (slot-like)
// - Fully customizable through props and classes
// - Styles via SCSS with CSS variables for theming

use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, SidebarClass, UtilityClass};

use crate::feedback::{Glow, GlowBlur, GlowColor, GlowIntensity};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SidebarComponent;

/// Selection shared with every [`SidebarLeaf`] below a [`Sidebar`].
///
/// `SidebarProps::active_id` was accepted but never read: nothing passed it down
/// and no leaf could report a click, so a sidebar could only be decorative. This
/// carries both, the way `MenuContext` carries the menu's popover state, so a
/// consumer writes `Sidebar { active_id, on_select, SidebarLeaf { id } … }` and
/// gets a working selection without hand-rolling attributes and listeners.
#[derive(Clone, Default)]
pub struct SidebarContext {
    /// The leaf id that is currently selected; `""` means none.
    pub active_id: String,
    /// Called with the leaf's `id` when that leaf is clicked.
    pub on_select: Option<Callback<String>>,
}

impl SidebarContext {
    pub fn is_active(&self, id: &str) -> bool {
        !self.active_id.is_empty() && self.active_id == id
    }
}

#[define_props]
pub struct SidebarProps {
    #[default("".to_string())]
    pub active_id: String,

    /// Called with the clicked leaf's `id`. Leaves below this sidebar report
    /// through it; see [`SidebarContext`].
    pub on_select: Option<Callback<String>>,

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
        .add(SidebarClass::Sidebar)
        .add_raw(&props.class)
        .build();

    let active_id = props.active_id.clone();
    let on_select = props.on_select.clone();
    use_context_provider(move || SidebarContext {
        active_id: active_id.clone(),
        on_select: on_select.clone(),
    });

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
        tairitsu_macros::scss! { file: "src/styles/components/sidebar.scss", no_hash }.0
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

#[component]
pub fn SidebarSection(props: SidebarSectionProps) -> Element {
    let is_expanded = use_signal(|| props.default_expanded);

    let expanded_attr = if is_expanded.get() { "true" } else { "false" };

    let section_classes = ClassesBuilder::new()
        .add(SidebarClass::Section)
        .add_raw(&props.class)
        .build();

    let is_expanded_for_arrow = is_expanded.clone();
    let arrow_classes = ClassesBuilder::new()
        .add(SidebarClass::SectionArrow)
        .add_if(SidebarClass::SectionArrowRotated, move || {
            is_expanded_for_arrow.get()
        })
        .build();

    let header_class = SidebarClass::SectionHeader.as_class();
    let title_group_class = SidebarClass::SectionTitleGroup.as_class();
    let title_primary_class = SidebarClass::SectionTitlePrimary.as_class();
    let title_secondary_class = SidebarClass::SectionTitleSecondary.as_class();
    let children_class = SidebarClass::SectionChildren.as_class();
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

#[component]
pub fn SidebarItem(props: SidebarItemProps) -> Element {
    // Check if nested items are provided
    let has_items = props.items.is_some();
    let mut is_expanded = use_signal(|| props.default_expanded);

    let expanded_attr = if is_expanded.get() { "true" } else { "false" };

    let item_classes = ClassesBuilder::new()
        .add(SidebarClass::Item)
        .add_raw(&props.class)
        .build();

    let is_expanded_for_arrow = is_expanded.clone();
    let arrow_classes = ClassesBuilder::new()
        .add(SidebarClass::ItemArrow)
        .add_if(SidebarClass::ItemArrowRotated, move || {
            is_expanded_for_arrow.get()
        })
        .build();

    let header_class = SidebarClass::ItemHeader.as_class();
    let content_class = SidebarClass::ItemContent.as_class();
    let secondary_class = SidebarClass::ItemSecondary.as_class();
    let item_children_class = SidebarClass::ItemChildren.as_class();
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

#[component]
pub fn SidebarLeaf(props: SidebarLeafProps) -> Element {
    let leaf_classes = ClassesBuilder::new()
        .add(SidebarClass::Leaf)
        .add_raw(&props.class)
        .build();

    let leaf_content_class = SidebarClass::LeafContent.as_class();
    let secondary_class = SidebarClass::ItemSecondary.as_class();

    // Selection comes from the enclosing `Sidebar`; without one a leaf is just
    // a row, which keeps the component usable on its own.
    let ctx = use_context::<SidebarContext>().map(|c| c.get().clone());
    let is_active = ctx
        .as_ref()
        .map(|c| c.is_active(&props.id))
        .unwrap_or(false);
    let leaf_id = props.id.clone();
    let active_attr = if is_active { "true" } else { "false" };
    let handle_click = move |_| {
        if let Some(cb) = ctx.as_ref().and_then(|c| c.on_select.clone()) {
            cb.call(leaf_id.clone());
        }
    };

    rsx! {
        div {
            class: leaf_classes,
            "data-id": props.id,
            "data-active": active_attr,
            role: "button",
            tabindex: "0",
            onclick: handle_click,

            div { class: leaf_content_class,
                {props.children}
                if let Some(secondary) = &props.secondary_label {
                    span { class: secondary_class, "{secondary}" }
                }
            }
        }
    }
}
