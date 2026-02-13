// hi-components/src/data/pagination.rs
// Pagination component with Arknights + FUI styling

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, PaginationClass};

use crate::{
    basic::{Arrow, ArrowDirection, IconButton, IconButtonSize, Input, InputSize},
    feedback::{
        Dropdown, DropdownMask, DropdownPosition, DropdownPositioning, Glow, GlowBlur, GlowColor,
        GlowIntensity,
    },
    styled::StyledComponent,
};

/// Pagination component wrapper (for StyledComponent)
pub struct PaginationComponent;

/// Pagination component props
#[derive(Clone, PartialEq, Props, Debug)]
pub struct PaginationProps {
    /// Current page number (1-based)
    #[props(default = 1)]
    pub current: u32,

    /// Total number of items
    pub total: u32,

    /// Number of items per page
    #[props(default = 10)]
    pub page_size: u32,

    /// Show page size selector
    #[props(default = false)]
    pub show_size_changer: bool,

    /// Show total items info (e.g., "1-50 of 500")
    #[props(default = false)]
    pub show_total: bool,

    /// Page size options
    #[props(default)]
    pub page_size_options: Vec<u32>,

    /// Custom CSS classes
    #[props(default)]
    pub class: String,

    /// Page change handler - called with new page number
    pub on_change: Option<EventHandler<u32>>,

    /// Page size change handler - called with new page size
    pub on_size_change: Option<EventHandler<u32>>,
}

impl Default for PaginationProps {
    fn default() -> Self {
        Self {
            current: 1,
            total: 0,
            page_size: 10,
            show_size_changer: false,
            show_total: false,
            page_size_options: vec![10, 20, 50, 100],
            class: String::default(),
            on_change: None,
            on_size_change: None,
        }
    }
}

/// Pagination component
#[component]
pub fn Pagination(props: PaginationProps) -> Element {
    let mut current_page = use_signal(|| props.current);
    let mut current_size = use_signal(|| props.page_size);
    let total_items = props.total;

    // Modal state for jump to page
    let mut show_jump_modal = use_signal(|| false);
    let mut jump_to = use_signal(|| props.current.to_string());

    // Handle modal close
    let handle_modal_close = move |is_open: bool| {
        show_jump_modal.set(is_open);
    };

    let total_pages = if total_items == 0 {
        1
    } else {
        (total_items.saturating_sub(1) / current_size()) + 1
    };

    let start = (current_page().saturating_sub(1) * current_size()) + 1;
    let end = (current_page() * current_size()).min(total_items);

    let _handle_page_change = move |page: u32| {
        let total_pages = if total_items == 0 {
            1
        } else {
            (total_items.saturating_sub(1) / current_size()) + 1
        };

        if page < 1 || page > total_pages || page == current_page() {
            return;
        }

        current_page.set(page);

        if let Some(handler) = props.on_change.as_ref() {
            handler.call(page);
        }
    };

    let handle_prev = move |_| {
        if current_page() > 1 {
            let new_page = current_page() - 1;
            current_page.set(new_page);
            if let Some(handler) = props.on_change.as_ref() {
                handler.call(new_page);
            }
        }
    };

    let handle_next = move |_| {
        if current_page() < total_pages {
            let new_page = current_page() + 1;
            current_page.set(new_page);
            if let Some(handler) = props.on_change.as_ref() {
                handler.call(new_page);
            }
        }
    };

    // Handle page jump from modal
    let mut handle_modal_jump = move |page: u32| {
        current_page.set(page);
        if let Some(handler) = props.on_change.as_ref() {
            handler.call(page);
        }
        show_jump_modal.set(false);
    };

    // Create jump modal content (function to avoid ownership issues)
    let create_jump_modal_content = move || {
        rsx! {
            div {
                style: "padding: 20px; min-width: 200px;",
                div {
                    style: "font-weight: 600; margin-bottom: 16px; font-size: 14px;",
                    "Jump to Page"
                }

                div {
                    style: "display: flex; gap: 8px; margin-bottom: 12px;",

                    Input {
                        size: InputSize::Medium,
                        input_type: Some("number".to_string()),
                        value: Some(jump_to()),
                        placeholder: Some("Page".to_string()),
                        autofocus: true,
                        oninput: Some(EventHandler::new(move |val: String| {
                            if let Ok(v) = val.parse::<u32>()
                                && v <= total_pages * 2 {
                                    jump_to.set(val.to_string());
                                }
                        })),
                        glow: true,
                        glow_blur: GlowBlur::Medium,
                        glow_color: GlowColor::Ghost,
                        glow_intensity: GlowIntensity::Thirty,
                    }

                    IconButton {
                        icon: MdiIcon::ArrowRight,
                        size: IconButtonSize::Medium,
                        glow: true,
                        glow_color: GlowColor::Ghost,
                        onclick: move |_| {
                            if let Ok(page) = jump_to().parse::<u32>()
                                && page >= 1 && page <= total_pages {
                                    handle_modal_jump(page);
                                }
                        },
                    }
                }

                div {
                    style: "font-size: 12px; color: var(--hi-color-text-secondary);",
                    "Page 1 to {total_pages}"
                }
            }
        }
    };

    let handle_size_change = move |evt: FormEvent| {
        if let Ok(size) = evt.value().parse::<u32>() {
            current_size.set(size);

            let new_total_pages = if total_items == 0 {
                1
            } else {
                (total_items.saturating_sub(1) / size) + 1
            };

            if current_page() > new_total_pages {
                current_page.set(new_total_pages);
            }

            if let Some(handler) = props.on_size_change.as_ref() {
                handler.call(size);
            }
        }
    };

    // Build container classes
    let container_classes = ClassesBuilder::new()
        .add(PaginationClass::Pagination)
        .add_raw(&props.class)
        .build();

    // Build total display classes
    let total_classes = ClassesBuilder::new()
        .add(PaginationClass::PaginationTotal)
        .build();

    // Build size selector classes
    let size_selector_classes = ClassesBuilder::new()
        .add(PaginationClass::PaginationSizer)
        .build();

    // Build pages container classes
    let pages_container_classes = ClassesBuilder::new()
        .add(PaginationClass::PaginationPages)
        .build();

    // Build navigation button classes
    let prev_classes = ClassesBuilder::new()
        .add(PaginationClass::PaginationItem)
        .add(PaginationClass::PaginationPrev)
        .build();

    let next_classes = ClassesBuilder::new()
        .add(PaginationClass::PaginationItem)
        .add(PaginationClass::PaginationNext)
        .build();

    // Build page item classes
    let _page_item_classes = |page_num: u32| {
        ClassesBuilder::new()
            .add(PaginationClass::PaginationItem)
            .add_if(PaginationClass::PaginationActive, || {
                page_num == current_page()
            })
            .build()
    };

    // Helper function for page button click handlers
    let make_page_handler = move |page_num: u32| {
        let total_pages_calc = if total_items == 0 {
            1
        } else {
            (total_items.saturating_sub(1) / current_size()) + 1
        };

        move |_| {
            if page_num < 1 || page_num > total_pages_calc || page_num == current_page() {
                return;
            }
            current_page.set(page_num);
            if let Some(handler) = props.on_change.as_ref() {
                handler.call(page_num);
            }
        }
    };

    rsx! {
        div { class: "{container_classes}",

            if props.show_total {
                div { class: "{total_classes}",
                    "{start}-{end} of {total_items}"
                }
            }

            if props.show_size_changer {
                div { class: "{size_selector_classes}",
                    select {
                        class: "hi-select hi-select-sm",
                        value: "{current_size}",
                        onchange: handle_size_change,
                        for size in props.page_size_options.iter() {
                            option { value: "{size}", "{size} / page" }
                        }
                    }
                }
            }

            div { class: "{pages_container_classes}",

                // Previous button
                Glow {
                    blur: GlowBlur::Medium,
                    color: GlowColor::Primary,
                    intensity: GlowIntensity::Thirty,
                    button {
                        class: "{prev_classes}",
                        disabled: current_page() <= 1,
                        onclick: handle_prev,
                        Arrow {
                            direction: ArrowDirection::Left,
                            size: 16,
                        }
                    }
                }

                // Simple page numbers - just handle the basic case for now
                    if total_pages <= 7 {
                        for i in 1..=total_pages {
                            Glow {
                                blur: GlowBlur::Medium,
                                color: GlowColor::Primary,
                                intensity: GlowIntensity::Thirty,
                                button {
                                    class: ClassesBuilder::new()
                                        .add(PaginationClass::PaginationItem)
                                        .add_if(PaginationClass::PaginationActive, || i == current_page())
                                        .build(),
                                    onclick: make_page_handler(i),
                                    "{i}"
                                }
                            }
                        }
                } else {
                    // First page
                    Glow {
                        blur: GlowBlur::Medium,
                        color: GlowColor::Primary,
                        intensity: GlowIntensity::Thirty,
                        button {
                            class: ClassesBuilder::new()
                                .add(PaginationClass::PaginationItem)
                                .add_if(PaginationClass::PaginationActive, || 1 == current_page())
                                .build(),
                            onclick: make_page_handler(1),
                            "1"
                        }
                    }

                    // Ellipsis if needed - clickable with icon
                    if current_page() > 4 {
                        Dropdown {
                            positioning: DropdownPositioning::TriggerBased,
                            position: DropdownPosition::Top,
                            mask: DropdownMask::Transparent,
                            close_on_click_outside: true,
                            close_on_select: false,
                            on_open_change: handle_modal_close,
                            trigger: rsx! {
                                Glow {
                                    blur: GlowBlur::Medium,
                                    color: GlowColor::Primary,
                                    intensity: GlowIntensity::Thirty,
                                    button {
                                        class: ClassesBuilder::new()
                                            .add(PaginationClass::PaginationItem)
                                            .build(),
                                        Icon {
                                            icon: MdiIcon::DotsHorizontal,
                                            size: 16,
                                            color: "var(--hi-color-text-secondary)",
                                        }
                                    }
                                }
                            },
                            {create_jump_modal_content()}
                        }
                    }

                    // Current page and surrounding pages
                    for i in [
                        current_page().saturating_sub(1).max(2),
                        current_page(),
                        current_page() + 1,
                    ].iter()
                    .copied()
                    .filter(|&i| i >= 2 && i <= total_pages.saturating_sub(1))
                    {
                        Glow {
                            blur: GlowBlur::Medium,
                            color: GlowColor::Primary,
                            intensity: GlowIntensity::Thirty,
                            button {
                                class: ClassesBuilder::new()
                                    .add(PaginationClass::PaginationItem)
                                    .add_if(PaginationClass::PaginationActive, || i == current_page())
                                    .build(),
                                onclick: make_page_handler(i),
                                "{i}"
                            }
                        }
                    }

                    // Ellipsis if needed - clickable with icon
                    if current_page() < total_pages - 3 {
                        Dropdown {
                            positioning: DropdownPositioning::TriggerBased,
                            position: DropdownPosition::Top,
                            mask: DropdownMask::Transparent,
                            close_on_click_outside: true,
                            close_on_select: false,
                            on_open_change: handle_modal_close,
                            trigger: rsx! {
                                Glow {
                                    blur: GlowBlur::Medium,
                                    color: GlowColor::Primary,
                                    intensity: GlowIntensity::Thirty,
                                    button {
                                        class: ClassesBuilder::new()
                                            .add(PaginationClass::PaginationItem)
                                            .build(),
                                        Icon {
                                            icon: MdiIcon::DotsHorizontal,
                                            size: 16,
                                            color: "var(--hi-color-text-secondary)",
                                        }
                                    }
                                }
                            },
                            {create_jump_modal_content()}
                        }
                    }

                    // Last page
                    if total_pages > 1 {
                        Glow {
                            blur: GlowBlur::Medium,
                            color: GlowColor::Primary,
                            intensity: GlowIntensity::Thirty,
                        button {
                            class: ClassesBuilder::new()
                                .add(PaginationClass::PaginationItem)
                                .add_if(PaginationClass::PaginationActive, || total_pages == current_page())
                                .build(),
                            onclick: make_page_handler(total_pages),
                            "{total_pages}"
                        }
                        }
                    }
                }

                // Next button
                Glow {
                    blur: GlowBlur::Medium,
                    color: GlowColor::Primary,
                    intensity: GlowIntensity::Thirty,
                    button {
                        class: "{next_classes}",
                        disabled: current_page() >= total_pages,
                        onclick: handle_next,
                        Arrow {
                            direction: ArrowDirection::Right,
                            size: 16,
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for PaginationComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/pagination.css"))
    }

    fn name() -> &'static str {
        "pagination"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pagination_props_default() {
        let props = PaginationProps::default();
        assert_eq!(props.current, 1);
        assert_eq!(props.page_size, 10);
        assert_eq!(props.total, 0);
        assert!(!props.show_size_changer);
        assert!(!props.show_total);
    }

    #[test]
    fn test_pagination_props_current() {
        let props1 = PaginationProps {
            current: 5,
            ..Default::default()
        };

        let props2 = PaginationProps {
            current: 10,
            ..Default::default()
        };

        assert_eq!(props1.current, 5);
        assert_eq!(props2.current, 10);
    }

    #[test]
    fn test_pagination_props_page_size() {
        let props1 = PaginationProps {
            page_size: 20,
            ..Default::default()
        };

        let props2 = PaginationProps {
            page_size: 50,
            ..Default::default()
        };

        assert_eq!(props1.page_size, 20);
        assert_eq!(props2.page_size, 50);
    }

    #[test]
    fn test_pagination_props_total() {
        let props = PaginationProps {
            total: 100,
            ..Default::default()
        };
        assert_eq!(props.total, 100);
    }

    #[test]
    fn test_pagination_props_show_size_changer() {
        let props1 = PaginationProps {
            show_size_changer: true,
            ..Default::default()
        };

        let props2 = PaginationProps {
            show_size_changer: false,
            ..Default::default()
        };

        assert!(props1.show_size_changer);
        assert!(!props2.show_size_changer);
    }

    #[test]
    fn test_pagination_props_show_total() {
        let props1 = PaginationProps {
            show_total: true,
            ..Default::default()
        };

        let props2 = PaginationProps {
            show_total: false,
            ..Default::default()
        };

        assert!(props1.show_total);
        assert!(!props2.show_total);
    }

    #[test]
    fn test_pagination_props_clone() {
        let props = PaginationProps {
            current: 5,
            page_size: 20,
            total: 100,
            show_size_changer: true,
            show_total: true,
            page_size_options: vec![10, 20, 50],
            class: "test-class".to_string(),
            on_change: None,
            on_size_change: None,
        };

        let cloned = props.clone();
        assert_eq!(cloned.current, 5);
        assert_eq!(cloned.page_size, 20);
        assert_eq!(cloned.total, 100);
        assert!(cloned.show_size_changer);
        assert!(cloned.show_total);
    }

    #[test]
    fn test_pagination_props_partial_eq() {
        let props1 = PaginationProps {
            current: 5,
            page_size: 20,
            total: 100,
            show_size_changer: true,
            show_total: true,
            page_size_options: vec![10, 20, 50],
            class: "test-class".to_string(),
            on_change: None,
            on_size_change: None,
        };

        let props2 = PaginationProps {
            current: 5,
            page_size: 20,
            total: 100,
            show_size_changer: true,
            show_total: true,
            page_size_options: vec![10, 20, 50],
            class: "test-class".to_string(),
            on_change: None,
            on_size_change: None,
        };

        assert_eq!(props1, props2);
    }

    #[test]
    fn test_pagination_props_not_equal() {
        let props1 = PaginationProps {
            current: 5,
            page_size: 20,
            ..Default::default()
        };

        let props2 = PaginationProps {
            current: 10,
            page_size: 20,
            ..Default::default()
        };

        assert_ne!(props1, props2);
    }

    #[test]
    fn test_pagination_component_name() {
        assert_eq!(PaginationComponent::name(), "pagination");
    }
}
