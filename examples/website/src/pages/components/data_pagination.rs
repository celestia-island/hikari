// website/src/pages/components/data/pagination.rs
// Pagination component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{
    layout::{Container, Section},
    Pagination,
};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, TextColor};

#[allow(non_snake_case)]
pub fn ComponentsPagination() -> Element {
    rsx! {
        Layout {
            current_route: Route::DataPagination {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Pagination"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Pagination component for page navigation with size changer"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Pagination is used to navigate through large datasets. It supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Page navigation" }
                                " - Previous, next, and page numbers"
                            }
                            li {
                                strong { "Jump to page" }
                                " - Direct input to jump to a specific page"
                            }
                            li {
                                strong { "Page size changer" }
                                " - Select items per page"
                            }
                            li {
                                strong { "Total items info" }
                                " - Show range and total count"
                            }
                        }
                    }
                }

                // Basic Pagination
                Section {
                    title: Some("Basic Pagination".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Small Dataset"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pagination for small dataset (fewer than 7 pages)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 1,
                                total: 50,
                                page_size: 10,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Large Dataset"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pagination for large dataset (more than 7 pages)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 5,
                                total: 500,
                                page_size: 10,
                            }
                        }
                    }
                }

                // With Features
                Section {
                    title: Some("Advanced Features".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Total Info"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pagination with total items count and range"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 3,
                                total: 150,
                                page_size: 10,
                                show_total: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Page Size Changer"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pagination with selector to change items per page"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 1,
                                total: 200,
                                page_size: 10,
                                show_size_changer: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Full Features"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pagination with all features enabled"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 2,
                                total: 300,
                                page_size: 10,
                                show_size_changer: true,
                                show_total: true,
                            }
                        }
                    }
                }

                // Different Page Sizes
                Section {
                    title: Some("Different Page Sizes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Small Page Size"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "5 items per page"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 1,
                                total: 50,
                                page_size: 5,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Medium Page Size"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "20 items per page"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 1,
                                total: 200,
                                page_size: 20,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Large Page Size"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "50 items per page"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 1,
                                total: 500,
                                page_size: 50,
                            }
                        }
                    }
                }

                // Edge Cases
                Section {
                    title: Some("Edge Cases".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "First Page"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pagination on first page (previous button disabled)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 1,
                                total: 100,
                                page_size: 10,
                                show_total: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Last Page"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pagination on last page (next button disabled)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 10,
                                total: 100,
                                page_size: 10,
                                show_total: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "No Data"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Pagination with no data (shows page 1 of 1)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Pagination {
                                current: 1,
                                total: 0,
                                page_size: 10,
                                show_total: true,
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Pagination"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"Pagination {{ current: 1, total: 100, page_size: 10 }}"# }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Total and Size Changer"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Pagination {{
    current: 1,
    total: 200,
    page_size: 10,
    show_total: true,
    show_size_changer: true,
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Page Change Handler"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Pagination {{
    current: 1,
    total: 100,
    page_size: 10,
    on_change: Some(EventHandler::new(move |page| {{
        println!("Page changed to: {{page}}");
    }})),
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
