use hikari_icons::MdiIcon;
use tairitsu_web::t;
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

use crate::components::{demo_page::{render_api_table, render_demo_block, render_demo_page}, icon_utils::icon_el};

pub fn render() -> VNode {
    let no_data = t!("empty.no_data");
    let no_projects = t!("empty.no_projects");
    let create_project = t!("empty.create_project");
    let search_not_found = t!("empty.search_not_found");
    let search_hint = t!("empty.search_hint");
    let no_records = t!("empty.no_records");

    render_demo_page(
        "page-component-empty",
        "Empty",
        "Placeholder states for when no data is available, including search-not-found and empty table views.",
        rsx! {
            {render_demo_block("Basic Empty State",
                rsx! {
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon",
                            {icon_el(MdiIcon::Magnify, 48)}
                        }
                        div { class: "hi-empty__description", no_data }
                    }
                }
            )}
            {render_demo_block("Empty with Action",
                rsx! {
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon",
                            {icon_el(MdiIcon::FileEdit, 48)}
                        }
                        div { class: "hi-empty__description", no_projects }
                        button { class: "hi-button hi-button-primary", attr: "type", "button", "Create Project" }
                    }
                }
            )}
            {render_demo_block("Search Not Found",
                rsx! {
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon",
                            {icon_el(MdiIcon::Magnify, 48)}
                        }
                        div { class: "hi-empty__description", search_not_found }
                        div { class: "hi-empty__hint", search_hint }
                    }
                }
            )}
            {render_demo_block("Empty Table",
                rsx! {
                    table { class: "hi-table",
                        thead { tr { th { "Name" } th { "Status" } th { "Updated" } } }
                        tbody {
                            tr {
                                td { colspan: "3",
                                    div { class: "hi-empty",
                                        div { class: "hi-empty__icon",
                                            {icon_el(MdiIcon::FileEdit, 48)}
                                        }
                                        div { class: "hi-empty__description", no_records }
                                    }
                                }
                            }
                        }
                    }
                }
            )}
            {render_demo_block("Skeleton Loading",
                rsx! {
                    div { class: "hi-skeleton-stack",
                        div { class: "hi-skeleton-row hi-skeleton-row--avatar",
                            div { class: "hi-skeleton hi-skeleton--circle hi-skeleton--avatar" }
                            div { class: "hi-skeleton-col",
                                div { class: "hi-skeleton hi-skeleton--text-short" }
                                div { class: "hi-skeleton hi-skeleton--text-long" }
                            }
                        }
                        div { class: "hi-skeleton hi-skeleton--banner" }
                        div { class: "hi-skeleton-row hi-skeleton-row--actions",
                            div { class: "hi-skeleton hi-skeleton--btn" }
                            div { class: "hi-skeleton hi-skeleton--btn" }
                        }
                    }
                }
            )}
            {render_demo_block("API",
                render_api_table(&[
                    ("icon", "string", "MdiIcon", "Icon or emoji displayed (MdiIcon or Unicode)"),
                    ("description", "string", "No data", "Primary description text"),
                    ("hint", "string", "-", "Secondary helper text"),
                    ("action", "VNode", "-", "Optional action button"),
                    ("image", "string", "-", "Custom illustration URL"),
                ])
            )}
        }
    )
}
