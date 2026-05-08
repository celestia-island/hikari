use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use crate::components::icon_utils::icon_el;
use hikari_icons::MdiIcon;
use hikari_i18n::t;
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

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
            {render_demo_block("Empty with Action",
                rsx! {
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon",
                            {icon_el(MdiIcon::FileEdit, 48)}
                        }
                        div { class: "hi-empty__description", "You have no projects yet" }
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
                        div { class: "hi-empty__description", "No results found for \"quantum computing\"" }
                        div { class: "hi-empty__hint", "Try adjusting your search terms or filters" }
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
                                        div { class: "hi-empty__description", "No records to display" }
                                    }
                                }
                            }
                        }
                    }
                }
            )}
            {render_demo_block("Skeleton Loading",
                rsx! {
                    div { style: "display:flex;flex-direction:column;gap:16px;",
                        div { style: "display:flex;align-items:center;gap:12px;",
                            div { class: "hi-skeleton hi-skeleton--circle", style: "width:48px;height:48px;" }
                            div { style: "display:flex;flex-direction:column;gap:8px;flex:1;",
                                div { class: "hi-skeleton", style: "width:40%;height:16px;" }
                                div { class: "hi-skeleton", style: "width:60%;height:12px;" }
                            }
                        }
                        div { class: "hi-skeleton", style: "width:100%;height:120px;" }
                        div { style: "display:flex;gap:8px;",
                            div { class: "hi-skeleton", style: "width:80px;height:32px;" }
                            div { class: "hi-skeleton", style: "width:80px;height:32px;" }
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
