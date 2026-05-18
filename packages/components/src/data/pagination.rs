// hi-components/src/data/pagination.rs
// Pagination component

use hikari_icons::Icon;
use hikari_icons::mdi_minimal::MdiIcon;
use hikari_palette::classes::PaginationClass;
use tairitsu_style::ClassesBuilder;

use crate::basic::{Arrow, ArrowDirection, IconButton, IconButtonSize, Input, InputSize};
use crate::feedback::{
    Glow, GlowBlur, GlowColor, GlowIntensity, Popover, PopoverPlacement, PopoverPositioning,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct PaginationComponent;

#[define_props]
pub struct PaginationProps {
    #[default(1)]
    pub current: u32,

    pub total: u32,

    #[default(10)]
    pub page_size: u32,

    #[default(false)]
    pub show_size_changer: bool,

    #[default(false)]
    pub show_total: bool,

    #[default(vec![10, 20, 50, 100])]
    pub page_size_options: Vec<u32>,

    pub class: String,

    pub on_change: Option<EventHandler<u32>>,

    pub on_size_change: Option<EventHandler<u32>>,

    pub aria_label: Option<String>,
}

#[component]
pub fn Pagination(props: PaginationProps) -> Element {
    let current_page = use_signal(|| props.current);
    let current_size = use_signal(|| props.page_size);
    let total_items = props.total;

    // Modal state for jump to page
    let show_jump_modal = use_signal(|| false);
    let jump_to = use_signal(|| props.current.to_string());

    // Extract on_change for use in multiple closures
    let on_change = props.on_change.clone();
    let on_size_change = props.on_size_change.clone();

    // Handle modal close
    let show_jump_modal_for_close = show_jump_modal.clone();
    let handle_modal_close = Callback::new(move |is_open: bool| {
        show_jump_modal_for_close.set(is_open);
    });

    let total_pages = if total_items == 0 {
        1
    } else {
        (total_items.saturating_sub(1) / current_size.get()) + 1
    };

    let _start = (current_page.get().saturating_sub(1) * current_size.get()) + 1;
    let _end = (current_page.get() * current_size.get()).min(total_items);

    // Handler for prev button
    let current_page_for_prev = current_page.clone();
    let on_change_for_prev = on_change.clone();
    let handle_prev = move |_| {
        if current_page_for_prev.get() > 1 {
            let new_page = current_page_for_prev.get() - 1;
            current_page_for_prev.set(new_page);
            if let Some(handler) = on_change_for_prev.as_ref() {
                handler.call(new_page);
            }
        }
    };

    // Handler for next button
    let current_page_for_next = current_page.clone();
    let on_change_for_next = on_change.clone();
    let handle_next = move |_| {
        if current_page_for_next.get() < total_pages {
            let new_page = current_page_for_next.get() + 1;
            current_page_for_next.set(new_page);
            if let Some(handler) = on_change_for_next.as_ref() {
                handler.call(new_page);
            }
        }
    };

    // Handler for size change
    let current_size_for_size_change = current_size.clone();
    let current_page_for_size_change = current_page.clone();
    let on_size_change_for_handler = on_size_change.clone();
    let handle_size_change = move |evt: ChangeEvent| {
        if let Ok(size) = evt.value.parse::<u32>() {
            current_size_for_size_change.set(size);

            let new_total_pages = if total_items == 0 {
                1
            } else {
                (total_items.saturating_sub(1) / size) + 1
            };

            if current_page_for_size_change.get() > new_total_pages {
                current_page_for_size_change.set(new_total_pages);
            }

            if let Some(handler) = on_size_change_for_handler.as_ref() {
                handler.call(size);
            }
        }
    };

    // Build container classes
    let container_classes = ClassesBuilder::new()
        .add_typed(PaginationClass::Pagination)
        .add(&props.class)
        .build();

    // Build total display classes
    let total_classes = ClassesBuilder::new()
        .add_typed(PaginationClass::PaginationTotal)
        .build();

    // Build size selector classes
    let size_selector_classes = ClassesBuilder::new()
        .add_typed(PaginationClass::PaginationSizer)
        .build();

    // Build pages container classes
    let pages_container_classes = ClassesBuilder::new()
        .add_typed(PaginationClass::PaginationPages)
        .build();

    // Build navigation button classes
    let prev_classes = ClassesBuilder::new()
        .add_typed(PaginationClass::PaginationItem)
        .add_typed(PaginationClass::PaginationPrev)
        .build();

    let next_classes = ClassesBuilder::new()
        .add_typed(PaginationClass::PaginationItem)
        .add_typed(PaginationClass::PaginationNext)
        .build();

    // Build page size options outside rsx!
    let page_size_option_elements: Vec<Element> = props
        .page_size_options
        .iter()
        .map(|size| {
            rsx! {
                option { value: size.to_string(), "{size} / page" }
            }
        })
        .collect();

    // Build simple page numbers for total_pages <= 7
    let simple_page_elements: Vec<Element> = if total_pages <= 7 {
        (1..=total_pages)
            .map(|i| {
                let current_page_for_class = current_page.clone();
                let current_page_for_handler = current_page.clone();
                let on_change_for_handler = on_change.clone();
                let is_active = i == current_page_for_class.get();
                let page_class = ClassesBuilder::new()
                    .add_typed(PaginationClass::PaginationItem)
                    .add_typed_if(PaginationClass::PaginationActive, is_active)
                    .build();
                let handler = move |_| {
                    if i != current_page_for_handler.get() {
                        current_page_for_handler.set(i);
                        if let Some(h) = on_change_for_handler.as_ref() {
                            h.call(i);
                        }
                    }
                };
                rsx! {
                    Glow {
                        blur: GlowBlur::Medium,
                        color: GlowColor::Primary,
                        intensity: GlowIntensity::Dim,
                        button {
                            class: page_class,
                            onclick: handler,
                            "aria-current": if is_active { "page" } else { "false" },
                            "{i}"
                        }
                    }
                }
            })
            .collect()
    } else {
        vec![]
    };

    // Build middle page elements for total_pages > 7
    let middle_page_elements: Vec<Element> = if total_pages > 7 {
        let current = current_page.get();
        [current.saturating_sub(1).max(2), current, current + 1]
            .into_iter()
            .filter(|&i| i >= 2 && i <= total_pages.saturating_sub(1))
            .map(|i| {
                let current_page_for_class = current_page.clone();
                let current_page_for_handler = current_page.clone();
                let on_change_for_handler = on_change.clone();
                let is_active = i == current_page_for_class.get();
                let page_class = ClassesBuilder::new()
                    .add_typed(PaginationClass::PaginationItem)
                    .add_typed_if(PaginationClass::PaginationActive, is_active)
                    .build();
                let handler = move |_| {
                    if i != current_page_for_handler.get() {
                        current_page_for_handler.set(i);
                        if let Some(h) = on_change_for_handler.as_ref() {
                            h.call(i);
                        }
                    }
                };
                rsx! {
                    Glow {
                        blur: GlowBlur::Medium,
                        color: GlowColor::Primary,
                        intensity: GlowIntensity::Dim,
                        button {
                            class: page_class,
                            onclick: handler,
                            "aria-current": if is_active { "page" } else { "false" },
                            "{i}"
                        }
                    }
                }
            })
            .collect()
    } else {
        vec![]
    };

    // Handler for first page button
    let current_page_for_first = current_page.clone();
    let on_change_for_first = on_change.clone();
    let first_page_handler = move |_| {
        if 1 != current_page_for_first.get() {
            current_page_for_first.set(1);
            if let Some(h) = on_change_for_first.as_ref() {
                h.call(1);
            }
        }
    };

    // Handler for last page button
    let current_page_for_last = current_page.clone();
    let on_change_for_last = on_change.clone();
    let last_page_handler = move |_| {
        if total_pages != current_page_for_last.get() {
            current_page_for_last.set(total_pages);
            if let Some(h) = on_change_for_last.as_ref() {
                h.call(total_pages);
            }
        }
    };

    // Create jump modal content for first ellipsis
    let jump_to_for_modal1 = jump_to.clone();
    let show_jump_modal_for_modal1 = show_jump_modal.clone();
    let current_page_for_modal1 = current_page.clone();
    let on_change_for_modal1 = on_change.clone();
    let create_jump_modal_content_1 = move || {
        let jump_to_for_input = jump_to_for_modal1.clone();
        let jump_to_for_button = jump_to_for_modal1.clone();
        let current_page_for_jump = current_page_for_modal1.clone();
        let show_jump_modal_for_jump = show_jump_modal_for_modal1.clone();
        let on_change_for_jump = on_change_for_modal1.clone();
        let handle_modal_jump = move |page: u32| {
            current_page_for_jump.set(page);
            if let Some(h) = on_change_for_jump.as_ref() {
                h.call(page);
            }
            show_jump_modal_for_jump.set(false);
        };
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
                        value: Some(jump_to_for_modal1.get()),
                        placeholder: Some("Page".to_string()),
                        autofocus: true,
                        oninput: Some(EventHandler::new(move |val: String| {
                            if let Ok(v) = val.parse::<u32>()
                                && v <= total_pages * 2 {
                                    jump_to_for_input.set(val.to_string());
                                }
                        })),
                        glow: true,
                        glow_blur: GlowBlur::Medium,
                        glow_color: GlowColor::Ghost,
                        glow_intensity: GlowIntensity::Dim,
                    }

                    IconButton {
                        icon: MdiIcon::ArrowRight,
                        size: IconButtonSize::Medium,
                        glow: true,
                        glow_color: GlowColor::Ghost,
                        onclick: Some(EventHandler::new(move |_| {
                            if let Ok(page) = jump_to_for_button.get().parse::<u32>()
                                && page >= 1 && page <= total_pages {
                                    handle_modal_jump(page);
                                }
                        })),
                    }
                }

                div {
                    style: "font-size: 12px; color: var(--hi-color-text-secondary);",
                    "Page 1 to {total_pages}"
                }
            }
        }
    };

    // Create jump modal content for second ellipsis
    let jump_to_for_modal2 = jump_to.clone();
    let show_jump_modal_for_modal2 = show_jump_modal.clone();
    let current_page_for_modal2 = current_page.clone();
    let on_change_for_modal2 = on_change.clone();
    let create_jump_modal_content_2 = move || {
        let jump_to_for_input = jump_to_for_modal2.clone();
        let jump_to_for_button = jump_to_for_modal2.clone();
        let current_page_for_jump = current_page_for_modal2.clone();
        let show_jump_modal_for_jump = show_jump_modal_for_modal2.clone();
        let on_change_for_jump = on_change_for_modal2.clone();
        let handle_modal_jump = move |page: u32| {
            current_page_for_jump.set(page);
            if let Some(h) = on_change_for_jump.as_ref() {
                h.call(page);
            }
            show_jump_modal_for_jump.set(false);
        };
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
                        value: Some(jump_to_for_modal2.get()),
                        placeholder: Some("Page".to_string()),
                        autofocus: true,
                        oninput: Some(EventHandler::new(move |val: String| {
                            if let Ok(v) = val.parse::<u32>()
                                && v <= total_pages * 2 {
                                    jump_to_for_input.set(val.to_string());
                                }
                        })),
                        glow: true,
                        glow_blur: GlowBlur::Medium,
                        glow_color: GlowColor::Ghost,
                        glow_intensity: GlowIntensity::Dim,
                    }

                    IconButton {
                        icon: MdiIcon::ArrowRight,
                        size: IconButtonSize::Medium,
                        glow: true,
                        glow_color: GlowColor::Ghost,
                        onclick: Some(EventHandler::new(move |_| {
                            if let Ok(page) = jump_to_for_button.get().parse::<u32>()
                                && page >= 1 && page <= total_pages {
                                    handle_modal_jump(page);
                                }
                        })),
                    }
                }

                div {
                    style: "font-size: 12px; color: var(--hi-color-text-secondary);",
                    "Page 1 to {total_pages}"
                }
            }
        }
    };

    rsx! {
        div { class: container_classes,
            "aria-label": props.aria_label.clone().unwrap_or_else(|| "Pagination".to_string()),

            if props.show_total {
                div { class: total_classes,
                    "{_start}-{_end} of {total_items}"
                }
            }

            if props.show_size_changer {
                div { class: size_selector_classes,
                    select {
                        class: "hi-select hi-select-sm",
                        value: current_size.get().to_string(),
                        onchange: handle_size_change,
                        ..page_size_option_elements
                    }
                }
            }

            div { class: pages_container_classes,

                // Previous button
                Glow {
                    blur: GlowBlur::Medium,
                    color: GlowColor::Primary,
                    intensity: GlowIntensity::Dim,
                    button {
                        class: prev_classes,
                        disabled: current_page.get() <= 1,
                        onclick: handle_prev,
                        "aria-label": "Previous page",
                        "aria-disabled": if current_page.get() <= 1 { "true" } else { "false" },
                        Arrow {
                            direction: ArrowDirection::Left,
                            size: 16,
                        }
                    }
                }

                // Simple page numbers - just handle the basic case for now
                    if total_pages <= 7 {
                        ..simple_page_elements
                } else {
                    // First page
                    Glow {
                        blur: GlowBlur::Medium,
                        color: GlowColor::Primary,
                        intensity: GlowIntensity::Dim,
                        button {
                            class: ClassesBuilder::new()
                                .add_typed(PaginationClass::PaginationItem)
                                .add_typed_if(PaginationClass::PaginationActive, 1 == current_page.get())
                                .build(),
                            onclick: first_page_handler,
                            "aria-current": if 1 == current_page.get() { "page" } else { "false" },
                            "1"
                        }
                    }

                    // Ellipsis if needed - clickable with icon
                    if current_page.get() > 4 {
                        Popover {
                            positioning: PopoverPositioning::Relative {
                                preferred: vec![PopoverPlacement::Top, PopoverPlacement::Bottom],
                            },
                            close_on_click_outside: true,
                            on_open_change: Some(handle_modal_close.clone()),
                            trigger: rsx! {
                                Glow {
                                    blur: GlowBlur::Medium,
                                    color: GlowColor::Primary,
                                    intensity: GlowIntensity::Dim,
                                    button {
                                        class: ClassesBuilder::new()
                                            .add_typed(PaginationClass::PaginationItem)
                                            .build(),
                                        Icon {
                                            icon: MdiIcon::DotsHorizontal,
                                            size: 16,
                                            color: "var(--hi-color-text-secondary)".to_string(),
                                        }
                                    }
                                }
                            },
                            {create_jump_modal_content_1()}
                        }
                    }

                    // Current page and surrounding pages
                    ..middle_page_elements

                    // Ellipsis if needed - clickable with icon
                    if current_page.get() < total_pages - 3 {
                        Popover {
                            positioning: PopoverPositioning::Relative {
                                preferred: vec![PopoverPlacement::Top, PopoverPlacement::Bottom],
                            },
                            close_on_click_outside: true,
                            on_open_change: Some(handle_modal_close.clone()),
                            trigger: rsx! {
                                Glow {
                                    blur: GlowBlur::Medium,
                                    color: GlowColor::Primary,
                                    intensity: GlowIntensity::Dim,
                                    button {
                                        class: ClassesBuilder::new()
                                            .add_typed(PaginationClass::PaginationItem)
                                            .build(),
                                        Icon {
                                            icon: MdiIcon::DotsHorizontal,
                                            size: 16,
                                            color: "var(--hi-color-text-secondary)".to_string(),
                                        }
                                    }
                                }
                            },
                            {create_jump_modal_content_2()}
                        }
                    }

                    // Last page
                    if total_pages > 1 {
                        Glow {
                            blur: GlowBlur::Medium,
                            color: GlowColor::Primary,
                            intensity: GlowIntensity::Dim,
                        button {
                            class: ClassesBuilder::new()
                                .add_typed(PaginationClass::PaginationItem)
                                .add_typed_if(PaginationClass::PaginationActive, total_pages == current_page.get())
                                .build(),
                            onclick: last_page_handler,
                            "aria-current": if total_pages == current_page.get() { "page" } else { "false" },
                            "{total_pages}"
                        }
                        }
                    }
                }

                // Next button
                Glow {
                    blur: GlowBlur::Medium,
                    color: GlowColor::Primary,
                    intensity: GlowIntensity::Dim,
                    button {
                        class: next_classes,
                        disabled: current_page.get() >= total_pages,
                        onclick: handle_next,
                        "aria-label": "Next page",
                        "aria-disabled": if current_page.get() >= total_pages { "true" } else { "false" },
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
            aria_label: None,
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
            aria_label: None,
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
            aria_label: None,
        };

        assert!(props1.current == props2.current);
        assert!(props1.page_size == props2.page_size);
        assert!(props1.total == props2.total);
        assert!(props1.show_size_changer == props2.show_size_changer);
        assert!(props1.show_total == props2.show_total);
        assert!(props1.page_size_options == props2.page_size_options);
        assert!(props1.class == props2.class);
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

        assert!(props1.current != props2.current);
    }

    #[test]
    fn test_pagination_component_name() {
        assert_eq!(PaginationComponent::name(), "pagination");
    }
}
