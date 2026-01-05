// hi-components/src/data/pagination.rs
// Pagination component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Pagination component wrapper (for StyledComponent)
pub struct PaginationComponent;

/// Pagination component props
#[derive(Clone, PartialEq, Props)]
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

    let total_pages = if total_items == 0 {
        1
    } else {
        ((total_items - 1) / current_size()) + 1
    };

    let start = ((current_page() - 1) * current_size()) + 1;
    let end = (current_page() * current_size()).min(total_items);

    let get_page_numbers = || {
        let mut pages = Vec::new();
        let current = current_page();
        let total = total_pages;

        if total <= 7 {
            for i in 1..=total {
                pages.push(i);
            }
        } else {
            pages.push(1);

            if current > 4 {
                pages.push(0);
            }

            let start_page = (current - 2).max(2);
            let end_page = (current + 2).min(total - 1);

            for i in start_page..=end_page {
                pages.push(i);
            }

            if current < total - 3 {
                pages.push(0);
            }

            pages.push(total);
        }

        pages
    };

    let pages = get_page_numbers();

    let mut handle_page_change = move |page: u32| {
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
            handle_page_change(current_page() - 1);
        }
    };

    let handle_next = move |_| {
        if current_page() < total_pages {
            handle_page_change(current_page() + 1);
        }
    };

    let handle_jump = move |evt: FormEvent| {
        if let Ok(page) = evt.value().parse::<u32>() {
            handle_page_change(page);
        }
    };

    let handle_size_change = move |evt: FormEvent| {
        if let Ok(size) = evt.value().parse::<u32>() {
            current_size.set(size);

            let new_total_pages = if total_items == 0 {
                1
            } else {
                ((total_items - 1) / size) + 1
            };

            if current_page() > new_total_pages {
                current_page.set(new_total_pages);
            }

            if let Some(handler) = props.on_size_change.as_ref() {
                handler.call(size);
            }
        }
    };

    rsx! {
        div { class: format!("hi-pagination {}", props.class),

            if props.show_total {
                div { class: "hi-pagination-total",
                    "{start}-{end} of {total_items}"
                }
            }

            if props.show_size_changer {
                div { class: "hi-pagination-sizer",
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

            div { class: "hi-pagination-pages",

                button {
                    class: "hi-pagination-prev",
                    disabled: current_page() <= 1,
                    onclick: handle_prev,
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke_width: 2,
                        stroke: "currentColor",
                        path { stroke_linecap: "round", stroke_linejoin: "round", d: "M15.75 19.5L8.25 12l7.5-7.5" }
                    }
                }

                {pages.iter().map(|page| {
                    let page_num = *page;
                    if page_num == 0 {
                        rsx! {
                            span { class: "hi-pagination-ellipsis", "..." }
                        }
                    } else {
                        rsx! {
                            button {
                                class: if page_num == current_page() {
                                    "hi-pagination-item hi-pagination-active"
                                } else {
                                    "hi-pagination-item"
                                },
                                onclick: move |_| handle_page_change(page_num),
                                "{page_num}"
                            }
                        }
                    }
                })}

                button {
                    class: "hi-pagination-next",
                    disabled: current_page() >= total_pages,
                    onclick: handle_next,
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke_width: 2,
                        stroke: "currentColor",
                        path { stroke_linecap: "round", stroke_linejoin: "round", d: "M8.25 4.5l7.5 7.5-7.5 7.5" }
                    }
                }
            }

            div { class: "hi-pagination-jump",
                span { class: "hi-pagination-jump-label", "Go to" }
                input {
                    class: "hi-input hi-input-sm",
                    r#type: "number",
                    min: 1,
                    max: "{total_pages}",
                    value: "{current_page}",
                    onchange: handle_jump,
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
