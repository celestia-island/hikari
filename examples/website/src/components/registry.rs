use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode, VText};

fn demo_container(label: &str, children: Vec<VNode>) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class("demo-section")
            .child(VNode::Element(
                VElement::new("div")
                    .class("demo-section__label")
                    .child(VNode::Text(VText::new(label))),
            ))
            .child(VNode::Element(
                VElement::new("div").class("demo-row").children(children),
            )),
    )
}

fn demo_container_full(label: &str, children: Vec<VNode>) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class("demo-section")
            .child(VNode::Element(
                VElement::new("div")
                    .class("demo-section__label")
                    .child(VNode::Text(VText::new(label))),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("demo-row-full")
                    .children(children),
            )),
    )
}

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn btn(class: &str, label: &str) -> VNode {
    VNode::Element(VElement::new("button").class(class).child(txt(label)))
}

pub fn render_component_demo(component_id: &str) -> Option<VNode> {
    match component_id {
        // ============================================================
        // Layer 1 — Basic
        // ============================================================

        // ---------- button ----------
        "button" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Variants" }
                div { class: "demo-row",
                    button { class: "hi-btn hi-btn--primary", "Primary" }
                    button { class: "hi-btn hi-btn--secondary", "Secondary" }
                    button { class: "hi-btn hi-btn--ghost", "Ghost" }
                    button { class: "hi-btn hi-btn--danger", "Danger" }
                }
                div { class: "demo-section__label", "Sizes" }
                div { class: "demo-row",
                    button { class: "hi-btn hi-btn--primary hi-btn--sm", "Small" }
                    button { class: "hi-btn hi-btn--primary", "Medium" }
                    button { class: "hi-btn hi-btn--primary hi-btn--lg", "Large" }
                }
                div { class: "demo-section__label", "Disabled" }
                div { class: "demo-row",
                    button { class: "hi-btn hi-btn--primary", disabled: "true", "Disabled" }
                    button { class: "hi-btn hi-btn--secondary", disabled: "true", "Disabled" }
                }
                div { class: "demo-section__label", "With Icon" }
                div { class: "demo-row",
                    button { class: "hi-btn hi-btn--primary hi-icon-btn",
                        span { class: "mdi mdi-cog" }
                        " Settings"
                    }
                }
            }
        }),

        // ---------- input ----------
        "input" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Default" }
                div { class: "demo-row",
                    input { class: "hi-input", placeholder: "Enter text", r#type: "text" }
                }
                div { class: "demo-section__label", "Placeholder" }
                div { class: "demo-row",
                    input { class: "hi-input", placeholder: "Search...", r#type: "text" }
                    input { class: "hi-input", placeholder: "Email", r#type: "email" }
                }
                div { class: "demo-section__label", "Disabled" }
                div { class: "demo-row",
                    input { class: "hi-input", placeholder: "Disabled", r#type: "text", disabled: "true" }
                }
                div { class: "demo-section__label", "Sizes" }
                div { class: "demo-row",
                    input { class: "hi-input hi-input-sm", placeholder: "Small", r#type: "text" }
                    input { class: "hi-input", placeholder: "Medium", r#type: "text" }
                    input { class: "hi-input hi-input-lg", placeholder: "Large", r#type: "text" }
                }
                div { class: "demo-section__label", "Status" }
                div { class: "demo-row",
                    input { class: "hi-input hi-input--error", placeholder: "Error", r#type: "text" }
                    input { class: "hi-input hi-input--success", placeholder: "Success", r#type: "text" }
                }
            }
        }),

        // ---------- checkbox ----------
        "checkbox" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "States" }
                div { class: "demo-row",
                    label { class: "hi-checkbox-label",
                        input { r#type: "checkbox", class: "hi-checkbox-input" }
                        div { class: "hi-checkbox-label",
                            svg { class: "hi-checkbox-icon", view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round", stroke_linejoin: "round", polyline { points: "20 6 9 17 4 12" } }
                        }
                        span { class: "hi-checkbox-text", "Unchecked" }
                    }
                    label { class: "hi-checkbox-label",
                        input { r#type: "checkbox", class: "hi-checkbox-input", checked: "true" }
                        div { class: "hi-checkbox-label hi-checkbox-checked",
                            svg { class: "hi-checkbox-icon", view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round", stroke_linejoin: "round", polyline { points: "20 6 9 17 4 12" } }
                        }
                        span { class: "hi-checkbox-text", "Checked" }
                    }
                    label { class: "hi-checkbox-label",
                        input { r#type: "checkbox", class: "hi-checkbox-input", disabled: "true" }
                        div { class: "hi-checkbox-label hi-checkbox-disabled",
                            svg { class: "hi-checkbox-icon", view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round", stroke_linejoin: "round", polyline { points: "20 6 9 17 4 12" } }
                        }
                        span { class: "hi-checkbox-text", "Disabled" }
                    }
                }
            }
        }),

        // ---------- radio_group ----------
        "radio_group" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Options" }
                div { class: "demo-row",
                    div { class: "hi-radio-group hi-radio-group-horizontal",
                        label { class: "hi-radio-label",
                            input { r#type: "radio", name: "demo-radio", value: "a", checked: "true" }
                            div { class: "hi-radio-indicator",
                                div { class: "hi-radio-dot" }
                            }
                            span { class: "hi-radio-text", "Option A" }
                        }
                        label { class: "hi-radio-label",
                            input { r#type: "radio", name: "demo-radio", value: "b" }
                            div { class: "hi-radio-indicator",
                                div { class: "hi-radio-dot" }
                            }
                            span { class: "hi-radio-text", "Option B" }
                        }
                        label { class: "hi-radio-label",
                            input { r#type: "radio", name: "demo-radio", value: "c", disabled: "true" }
                            div { class: "hi-radio-indicator",
                                div { class: "hi-radio-dot" }
                            }
                            span { class: "hi-radio-text", "Disabled" }
                        }
                    }
                }
            }
        }),

        // ---------- switch ----------
        "switch" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Toggle" }
                div { class: "demo-row",
                    label { class: "hi-switch-label",
                        div { class: "hi-switch",
                            div { class: "hi-switch-track",
                                div { class: "hi-switch-thumb",
                                    div { class: "hi-switch-thumb-dot" }
                                }
                            }
                        }
                        span { class: "hi-switch-text", "Off" }
                    }
                    label { class: "hi-switch-label",
                        div { class: "hi-switch hi-switch-checked",
                            div { class: "hi-switch-track",
                                div { class: "hi-switch-thumb",
                                    div { class: "hi-switch-thumb-dot" }
                                }
                            }
                        }
                        span { class: "hi-switch-text", "On" }
                    }
                }
                div { class: "demo-section__label", "Icon Variant" }
                div { class: "demo-row",
                    label { class: "hi-switch-label",
                        div { class: "hi-switch hi-switch-icon-variant",
                            div { class: "hi-switch-track",
                                div { class: "hi-switch-thumb",
                                    span { class: "hi-switch-thumb-icon",
                                        svg { view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round", path { d: "M18 6L6 18M6 6l12 12" } }
                                    }
                                }
                            }
                        }
                    }
                    label { class: "hi-switch-label",
                        div { class: "hi-switch hi-switch-checked hi-switch-icon-variant",
                            div { class: "hi-switch-track",
                                div { class: "hi-switch-thumb",
                                    span { class: "hi-switch-thumb-icon",
                                        svg { view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "3", stroke_linecap: "round", path { d: "M20 6L9 17l-5-5" } }
                                    }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-section__label", "Sizes" }
                div { class: "demo-row",
                    div { class: "hi-switch hi-switch-sm", div { class: "hi-switch-track", div { class: "hi-switch-thumb", div { class: "hi-switch-thumb-dot" } } } }
                    div { class: "hi-switch hi-switch-md", div { class: "hi-switch-track", div { class: "hi-switch-thumb", div { class: "hi-switch-thumb-dot" } } } }
                    div { class: "hi-switch hi-switch-lg", div { class: "hi-switch-track", div { class: "hi-switch-thumb", div { class: "hi-switch-thumb-dot" } } } }
                }
            }
        }),

        // ---------- badge ----------
        "badge" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Variants" }
                div { class: "demo-row",
                    span { class: "hi-badge", "Default" }
                    span { class: "hi-badge hi-badge-primary", "Primary" }
                    span { class: "hi-badge hi-badge-secondary", "Secondary" }
                    span { class: "hi-badge hi-badge-success", "Success" }
                    span { class: "hi-badge hi-badge-warning", "Warning" }
                    span { class: "hi-badge hi-badge-danger", "Danger" }
                    span { class: "hi-badge hi-badge-info", "Info" }
                }
                div { class: "demo-section__label", "Dot Badge" }
                div { class: "demo-row",
                    div { class: "hi-badge-wrapper",
                        span { class: "hi-badge", "5" }
                        span { class: "hi-badge-dot", span { class: "hi-badge-dot-inner" } }
                    }
                }
            }
        }),

        // ---------- card ----------
        "card" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-card",
                        h3 { class: "hi-card-title", "Card Title" }
                        p { class: "hi-card-body", "Card content goes here." }
                    }
                }
                div { class: "demo-section__label", "With Header" }
                div { class: "demo-row",
                    div { class: "hi-card",
                        div { class: "hi-card-header",
                            div { class: "hi-card-title", "Featured" }
                        }
                        p { class: "hi-card-body", "This card has a header section." }
                    }
                }
                div { class: "demo-section__label", "Bordered Hoverable" }
                div { class: "demo-row",
                    div { class: "hi-card hi-card-bordered hi-card-hoverable",
                        h3 { class: "hi-card-title", "Interactive" }
                        p { class: "hi-card-body", "Hover to see the effect." }
                    }
                }
            }
        }),

        // ---------- divider ----------
        "divider" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Horizontal" }
                div { class: "demo-row-full",
                    p { "Content above" }
                    div { class: "hi-divider hi-divider-horizontal",
                        div { class: "hi-divider-line" }
                    }
                    p { "Content below" }
                }
                div { class: "demo-section__label", "With Text" }
                div { class: "demo-row-full",
                    div { class: "hi-divider hi-divider-horizontal hi-divider-with-text hi-divider-text-center",
                        div { class: "hi-divider-line" }
                        span { class: "hi-divider-text", "Or" }
                        div { class: "hi-divider-line" }
                    }
                }
                div { class: "demo-section__label", "Vertical" }
                div { class: "demo-row",
                    span { "Left" }
                    div { class: "hi-divider hi-divider-vertical",
                        div { class: "hi-divider-line" }
                    }
                    span { "Right" }
                }
            }
        }),

        // ---------- image ----------
        "image" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-image-container",
                        img { class: "hi-image", src: "/images/logo.png", alt: "Demo", style: "width: 100px; height: 100px; object-fit: cover;" }
                    }
                }
                div { class: "demo-section__label", "With Fallback" }
                div { class: "demo-row",
                    div { class: "hi-image-container",
                        div { class: "hi-image-placeholder hi-image-skeleton", style: "width: 100px; height: 100px;" }
                    }
                }
            }
        }),

        // ---------- slider ----------
        "slider" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Default" }
                div { class: "demo-row-full",
                    div { class: "hi-slider",
                        div { class: "hi-slider-rail" }
                        div { class: "hi-slider-track", style: "width: 50%;" }
                        div { class: "hi-slider-handle", style: "left: 50%;" }
                        input { r#type: "range", class: "hi-slider-input", value: "50", min: "0", max: "100" }
                    }
                }
                div { class: "demo-section__label", "With Marks" }
                div { class: "demo-row-full",
                    div { class: "hi-slider",
                        div { class: "hi-slider-rail" }
                        div { class: "hi-slider-track", style: "width: 30%;" }
                        div { class: "hi-slider-handle", style: "left: 30%;" }
                        input { r#type: "range", class: "hi-slider-input", value: "30", min: "0", max: "100" }
                    }
                }
            }
        }),

        // ---------- select ----------
        "select" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { style: "position: relative; display: inline-block;",
                        div { class: "hi-select-trigger",
                            span { class: "hi-select-placeholder", "Select an option" }
                            span { class: "hi-select-arrow" }
                        }
                    }
                }
            }
        }),

        // ---------- textarea ----------
        "textarea" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Default" }
                div { class: "demo-row-full",
                    textarea { class: "hi-input", placeholder: "Enter text here...", rows: "3" }
                }
                div { class: "demo-section__label", "Disabled" }
                div { class: "demo-row-full",
                    textarea { class: "hi-input hi-input-disabled", placeholder: "Disabled textarea", rows: "2", disabled: "true" }
                }
            }
        }),

        // ---------- file_upload ----------
        "file_upload" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-file-upload-wrapper",
                        div { class: "hi-file-upload",
                            input { r#type: "file", style: "position: absolute; width: 100%; height: 100%; top: 0; left: 0; opacity: 0; cursor: pointer;" }
                            div { class: "hi-file-upload-area", style: "pointer-events: none;",
                                svg { class: "hi-file-upload-icon", view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "2",
                                    path { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }
                                    polyline { points: "17 8 12 3 7 8" }
                                    line { x1: "12", y1: "3", x2: "12", y2: "15" }
                                }
                                p { class: "hi-file-upload-text", "Click or drag file to upload" }
                            }
                        }
                    }
                }
            }
        }),

        // ---------- date_picker ----------
        "date_picker" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-date-picker-wrapper",
                        input { class: "hi-date-picker", r#type: "date", placeholder: "Select date" }
                        svg { class: "hi-date-picker-icon", view_box: "0 0 24 24", fill: "none", stroke: "currentColor", stroke_width: "2",
                            rect { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }
                            line { x1: "16", y1: "2", x2: "16", y2: "6" }
                            line { x1: "8", y1: "2", x2: "8", y2: "6" }
                            line { x1: "3", y1: "10", x2: "21", y2: "10" }
                        }
                    }
                }
            }
        }),

        // ---------- canvas ----------
        "canvas" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    canvas { class: "hi-canvas", width: "300", height: "150", style: "border: 1px solid var(--hi-border); border-radius: 4px;" }
                }
            }
        }),

        // ---------- form_field ----------
        "form_field" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "With Label" }
                div { class: "demo-row-full",
                    div { class: "hi-form-field",
                        label { class: "hi-form-field-label", "Username" }
                        input { class: "hi-input", placeholder: "Enter username", r#type: "text" }
                    }
                    div { class: "hi-form-field",
                        label { class: "hi-form-field-label", "Password" }
                        input { class: "hi-input", placeholder: "Enter password", r#type: "password" }
                        div { class: "hi-form-field-help", "Must be at least 8 characters" }
                    }
                }
            }
        }),

        // ---------- avatar ----------
        "avatar" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Sizes" }
                div { class: "demo-row",
                    div { class: "hi-avatar hi-avatar--xs", "A" }
                    div { class: "hi-avatar hi-avatar--sm", "B" }
                    div { class: "hi-avatar", "C" }
                    div { class: "hi-avatar hi-avatar--lg", "D" }
                }
                div { class: "demo-section__label", "Variants" }
                div { class: "demo-row",
                    div { class: "hi-avatar hi-avatar--lg", "Circle" }
                    div { class: "hi-avatar hi-avatar--lg hi-avatar--rounded", "Rounded" }
                    div { class: "hi-avatar hi-avatar--lg hi-avatar--square", "Square" }
                }
            }
        }),

        // ---------- tag ----------
        "tag" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Variants" }
                div { class: "demo-row",
                    span { class: "hi-tag hi-tag--primary", "Primary" }
                    span { class: "hi-tag hi-tag--success", "Success" }
                    span { class: "hi-tag hi-tag--danger", "Danger" }
                    span { class: "hi-tag hi-tag--warning", "Warning" }
                }
                div { class: "demo-section__label", "Closable" }
                div { class: "demo-row",
                    span { class: "hi-tag hi-tag--primary hi-tag-closable", "Tag 1" }
                    span { class: "hi-tag hi-tag--success hi-tag-closable", "Tag 2" }
                }
            }
        }),

        // ---------- comment ----------
        "comment" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-comment",
                        div { class: "hi-comment__author", "User" }
                        div { class: "hi-comment__content", "This is a comment with some content." }
                        div { class: "hi-comment__time", "2 hours ago" }
                    }
                }
            }
        }),

        // ============================================================
        // Layer 2 — Navigation + Data
        // ============================================================

        // ---------- menu ----------
        "menu" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Vertical" }
                div { class: "demo-row",
                    ul { class: "hi-menu hi-menu-vertical", role: "menu",
                        li { class: "hi-menu-item", role: "menuitem",
                            div { class: "hi-menu-item-inner",
                                span { class: "hi-menu-item-content", "Dashboard" }
                            }
                        }
                        li { class: "hi-menu-item", role: "menuitem",
                            div { class: "hi-menu-item-inner",
                                span { class: "hi-menu-item-content", "Settings" }
                            }
                        }
                        li { class: "hi-menu-item", role: "menuitem", aria_disabled: "true",
                            div { class: "hi-menu-item-inner",
                                span { class: "hi-menu-item-content", "Disabled" }
                            }
                        }
                    }
                }
                div { class: "demo-section__label", "Horizontal" }
                div { class: "demo-row",
                    ul { class: "hi-menu hi-menu-horizontal", role: "menu",
                        li { class: "hi-menu-item", role: "menuitem",
                            div { class: "hi-menu-item-inner",
                                span { class: "hi-menu-item-content", "Home" }
                            }
                        }
                        li { class: "hi-menu-item", role: "menuitem",
                            div { class: "hi-menu-item-inner",
                                span { class: "hi-menu-item-content", "About" }
                            }
                        }
                    }
                }
            }
        }),

        // ---------- tabs ----------
        "tabs" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Horizontal" }
                div { class: "demo-row-full",
                    div { class: "hi-tabs hi-tabs-top",
                        div { class: "hi-tabs-nav",
                            div { class: "hi-tabs-nav-list", role: "tablist",
                                div { class: "hi-tabs-tab hi-tabs-tab-active", role: "tab", "data-key": "1", "aria-selected": "true",
                                    span { class: "hi-tabs-tab-label", "Tab 1" }
                                }
                                div { class: "hi-tabs-tab", role: "tab", "data-key": "2", "aria-selected": "false",
                                    span { class: "hi-tabs-tab-label", "Tab 2" }
                                }
                                div { class: "hi-tabs-tab", role: "tab", "data-key": "3", "aria-selected": "false",
                                    span { class: "hi-tabs-tab-label", "Tab 3" }
                                }
                            }
                        }
                        div { class: "hi-tabs-content", role: "tabpanel",
                            div { class: "hi-tabs-tabpane hi-tabpane-active", "Content of Tab 1" }
                        }
                    }
                }
            }
        }),

        // ---------- breadcrumb ----------
        "breadcrumb" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    nav { class: "hi-breadcrumb", "aria-label": "Breadcrumb",
                        div { class: "hi-breadcrumb-item",
                            a { class: "hi-breadcrumb-link", href: "/", "Home" }
                            span { class: "hi-breadcrumb-separator", "/" }
                        }
                        div { class: "hi-breadcrumb-item",
                            a { class: "hi-breadcrumb-link", href: "/components", "Components" }
                            span { class: "hi-breadcrumb-separator", "/" }
                        }
                        div { class: "hi-breadcrumb-item",
                            span { class: "hi-breadcrumb-current", "Current Page" }
                        }
                    }
                }
            }
        }),

        // ---------- sidebar ----------
        "sidebar" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    nav { class: "hi-sidebar", role: "navigation", style: "width: 240px; border: 1px solid var(--hi-border); border-radius: 8px; padding: 8px;",
                        div { class: "hi-sidebar-section",
                            div { class: "hi-sidebar-section-header",
                                div { class: "hi-sidebar-section-title-group",
                                    span { class: "hi-sidebar-section-title-primary", "Navigation" }
                                }
                            }
                            div { class: "hi-sidebar-leaf",
                                div { class: "hi-sidebar-leaf-content", "Dashboard" }
                            }
                            div { class: "hi-sidebar-leaf",
                                div { class: "hi-sidebar-leaf-content", "Settings" }
                            }
                        }
                    }
                }
            }
        }),

        // ---------- table ----------
        "table" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    table { class: "hi-table hi-table-bordered hi-table-striped",
                        thead { tr { th { "Name" } th { "Role" } th { "Level" } } }
                        tbody {
                            tr { td { "Amiya" } td { "Guard" } td { "6" } }
                            tr { td { "SilverAsh" } td { "Guard" } td { "6" } }
                            tr { td { "Exusiai" } td { "Sniper" } td { "6" } }
                            tr { td { "Eyjafjalla" } td { "Caster" } td { "6" } }
                        }
                    }
                }
            }
        }),

        // ---------- tree ----------
        "tree" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-tree", style: "width: 260px;",
                        div { class: "hi-tree-item",
                            span { class: "hi-tree-arrow", "▶" }
                            span { class: "hi-tree-label", "Parent 1" }
                        }
                        div { class: "hi-tree-item hi-tree-item--indent",
                            span { class: "hi-tree-arrow", "▶" }
                            span { class: "hi-tree-label", "Child 1-1" }
                        }
                        div { class: "hi-tree-item hi-tree-item--indent",
                            span { class: "hi-tree-arrow", "▶" }
                            span { class: "hi-tree-label", "Child 1-2" }
                        }
                        div { class: "hi-tree-item",
                            span { class: "hi-tree-arrow", "▶" }
                            span { class: "hi-tree-label", "Parent 2" }
                        }
                    }
                }
            }
        }),

        // ---------- pagination ----------
        "pagination" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-pagination",
                        button { class: "hi-pagination__btn", "‹" }
                        button { class: "hi-pagination__btn", "1" }
                        button { class: "hi-pagination__btn hi-pagination__btn--active", "2" }
                        button { class: "hi-pagination__btn", "3" }
                        button { class: "hi-pagination__btn", "4" }
                        button { class: "hi-pagination__btn", "5" }
                        button { class: "hi-pagination__btn", "›" }
                    }
                }
            }
        }),

        // ---------- collapse ----------
        "collapse" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Accordion" }
                div { class: "demo-row-full",
                    div { style: "width: 100%; max-width: 400px;",
                        div { class: "hi-collapse",
                            div { class: "hi-collapse-item",
                                div { class: "hi-collapse-header", "Section 1" }
                                div { class: "hi-collapse-content", "Content for section 1." }
                            }
                        }
                        div { class: "hi-collapse",
                            div { class: "hi-collapse-item",
                                div { class: "hi-collapse-header", "Section 2" }
                                div { class: "hi-collapse-content", "Content for section 2." }
                            }
                        }
                        div { class: "hi-collapse",
                            div { class: "hi-collapse-item",
                                div { class: "hi-collapse-header", "Section 3" }
                                div { class: "hi-collapse-content", "Content for section 3." }
                            }
                        }
                    }
                }
            }
        }),

        // ---------- anchor ----------
        "anchor" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-anchor-wrapper",
                        div { class: "hi-anchor hi-anchor-right",
                            button { class: "hi-anchor-link hi-anchor-active", "Section 1" }
                            button { class: "hi-anchor-link", "Section 2" }
                            button { class: "hi-anchor-link", "Section 3" }
                        }
                    }
                }
            }
        }),

        // ---------- stepper ----------
        "stepper" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-stepper hi-stepper-horizontal",
                        div { class: "hi-step hi-step-pending",
                            div { class: "hi-step-number", "1" }
                            div { class: "hi-step-connector" }
                        }
                        div { class: "hi-step hi-step-active",
                            div { class: "hi-step-number", "2" }
                            div { class: "hi-step-connector" }
                        }
                        div { class: "hi-step hi-step-finished",
                            div { class: "hi-step-number", "3" }
                        }
                    }
                }
            }
        }),

        // ---------- steps ----------
        "steps" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-steps-wrapper hi-steps-horizontal",
                        div { class: "hi-step-item hi-step-finish",
                            div { class: "hi-step-icon",
                                span { class: "hi-step-number", "1" }
                            }
                            div { class: "hi-step-content",
                                div { class: "hi-step-title", "Finished" }
                            }
                        }
                        div { class: "hi-step-item hi-step-process",
                            div { class: "hi-step-icon",
                                span { class: "hi-step-number", "2" }
                            }
                            div { class: "hi-step-content",
                                div { class: "hi-step-title", "In Progress" }
                            }
                        }
                        div { class: "hi-step-item hi-step-wait",
                            div { class: "hi-step-icon",
                                span { class: "hi-step-number", "3" }
                            }
                            div { class: "hi-step-content",
                                div { class: "hi-step-title", "Waiting" }
                            }
                        }
                    }
                }
            }
        }),

        // ============================================================
        // Layer 2 — Feedback + Entry
        // ============================================================

        // ---------- alert ----------
        "alert" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Variants" }
                div { class: "demo-row-full",
                    div { class: "hi-alert hi-alert--info", "ℹ  Information alert." }
                    div { class: "hi-alert hi-alert--success", "✓  Operation completed successfully." }
                    div { class: "hi-alert hi-alert--warning", "⚠  Please review before proceeding." }
                    div { class: "hi-alert hi-alert--danger", "✗  Something went wrong." }
                }
            }
        }),

        // ---------- toast ----------
        "toast" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Variants" }
                div { class: "demo-row-full",
                    div { class: "hi-toast hi-toast-info",
                        div { class: "hi-toast-icon-wrapper", "ℹ" }
                        div { class: "hi-toast-content",
                            div { class: "hi-toast-title", "Info" }
                            div { class: "hi-toast-message", "This is an informational toast." }
                        }
                    }
                    div { class: "hi-toast hi-toast-success",
                        div { class: "hi-toast-icon-wrapper", "✓" }
                        div { class: "hi-toast-content",
                            div { class: "hi-toast-title", "Success" }
                            div { class: "hi-toast-message", "Operation successful!" }
                        }
                    }
                    div { class: "hi-toast hi-toast-warning",
                        div { class: "hi-toast-icon-wrapper", "⚠" }
                        div { class: "hi-toast-content",
                            div { class: "hi-toast-message", "Please check your input." }
                        }
                    }
                    div { class: "hi-toast hi-toast-error",
                        div { class: "hi-toast-icon-wrapper", "✗" }
                        div { class: "hi-toast-content",
                            div { class: "hi-toast-message", "Failed to save changes." }
                        }
                    }
                }
            }
        }),

        // ---------- tooltip ----------
        "tooltip" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    p { "Tooltip wraps any element and shows content on hover." }
                    p { "Use data-tooltip attribute or the Tooltip component." }
                    div { class: "hi-tooltip-wrapper",
                        div { class: "hi-tooltip-trigger",
                            button { class: "hi-btn hi-btn--primary", "Hover me" }
                        }
                        div { class: "hi-tooltip-content hi-tooltip-top", "Tooltip on top" }
                    }
                    div { class: "hi-tooltip-wrapper",
                        div { class: "hi-tooltip-trigger",
                            button { class: "hi-btn hi-btn--secondary", "Hover me" }
                        }
                        div { class: "hi-tooltip-content hi-tooltip-bottom", "Tooltip on bottom" }
                    }
                }
            }
        }),

        // ---------- modal ----------
        "modal" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    p { "Modal dialogs are rendered via the Portal system." }
                    button { class: "hi-btn hi-btn--primary", "Open Modal" }
                }
            }
        }),

        // ---------- drawer ----------
        "drawer" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    p { "Drawer panels slide in from the edge of the viewport." }
                    button { class: "hi-btn hi-btn--primary", "Open Drawer" }
                }
            }
        }),

        // ---------- popover ----------
        "popover" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    p { "Popover displays content in a floating panel near the trigger." }
                    div { class: "hi-popover-trigger",
                        button { class: "hi-btn hi-btn--secondary", "Click me" }
                    }
                }
            }
        }),

        // ---------- progress ----------
        "progress" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Linear" }
                div { class: "demo-row-full",
                    div { class: "hi-progress-wrapper",
                        div { class: "hi-progress-outer",
                            div { class: "hi-progress-inner",
                                div { class: "hi-progress-bg", style: "width: 30%;" }
                            }
                            span { class: "hi-progress-text", "30%" }
                        }
                    }
                    div { class: "hi-progress-wrapper",
                        div { class: "hi-progress-outer",
                            div { class: "hi-progress-inner",
                                div { class: "hi-progress-bg", style: "width: 70%;" }
                            }
                            span { class: "hi-progress-text", "70%" }
                        }
                    }
                }
                div { class: "demo-section__label", "Circular" }
                div { class: "demo-row",
                    div { class: "hi-progress-wrapper",
                        div { class: "hi-progress-circle-wrapper",
                            svg { class: "hi-progress-circle", width: "120", height: "120", view_box: "0 0 120 120",
                                circle { class: "hi-progress-circle-trail", cx: "60", cy: "60", r: "54", stroke_width: "6", fill: "none" }
                                circle { class: "hi-progress-circle-path", cx: "60", cy: "60", r: "54", stroke_width: "6", fill: "none", stroke_linecap: "round", stroke_dasharray: "339.292", stroke_dashoffset: "169.646", transform: "rotate(-90 60 60)" }
                            }
                            span { class: "hi-progress-circle-text", "50%" }
                        }
                    }
                }
            }
        }),

        // ---------- spin ----------
        "spin" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Sizes" }
                div { class: "demo-row",
                    div { class: "hi-spin hi-spin-sm",
                        div { class: "hi-spin-spinner" }
                    }
                    div { class: "hi-spin hi-spin-md",
                        div { class: "hi-spin-spinner" }
                    }
                    div { class: "hi-spin hi-spin-lg",
                        div { class: "hi-spin-spinner" }
                    }
                }
            }
        }),

        // ---------- glow ----------
        "glow" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Effect" }
                div { class: "demo-row",
                    p { "Glow effect wraps elements with a mouse-following spotlight." }
                    div { class: "hi-glow-wrapper hi-glow-soft",
                        button { class: "hi-btn hi-btn--primary", "Hover for glow" }
                    }
                    div { class: "hi-glow-wrapper hi-glow-bright",
                        button { class: "hi-btn hi-btn--secondary", "Bright glow" }
                    }
                }
            }
        }),

        // ---------- auto_complete ----------
        "auto_complete" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { style: "position: relative;",
                        input { class: "hi-input", placeholder: "Type to search...", r#type: "text" }
                    }
                }
            }
        }),

        // ---------- number_input ----------
        "number_input" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-number-input",
                        button { class: "hi-number-input__btn", "-" }
                        input { class: "hi-number-input__input", r#type: "number", value: "0" }
                        button { class: "hi-number-input__btn", "+" }
                    }
                }
            }
        }),

        // ---------- search ----------
        "search" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-search",
                        input { class: "hi-search__input", placeholder: "Search...", r#type: "search" }
                    }
                }
            }
        }),

        // ---------- transfer ----------
        "transfer" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-transfer",
                        div { class: "hi-transfer-panel",
                            div { class: "hi-transfer-header", "Available" }
                            div { class: "hi-transfer-list",
                                label { class: "hi-transfer-item", input { r#type: "checkbox" } " Item A" }
                                label { class: "hi-transfer-item", input { r#type: "checkbox" } " Item B" }
                                label { class: "hi-transfer-item", input { r#type: "checkbox" } " Item C" }
                            }
                        }
                        div { class: "hi-transfer-actions",
                            button { class: "hi-btn", "→" }
                        }
                        div { class: "hi-transfer-panel",
                            div { class: "hi-transfer-header", "Selected" }
                            div { class: "hi-transfer-list" }
                        }
                    }
                }
            }
        }),

        // ---------- cascader ----------
        "cascader" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    p { "Cascader provides hierarchical multi-level selection." }
                    div { style: "position: relative; display: inline-block;",
                        div { class: "hi-select-trigger",
                            span { class: "hi-select-placeholder", "Select location" }
                            span { class: "hi-select-arrow" }
                        }
                    }
                }
            }
        }),

        // ============================================================
        // Layer 3 — Production + Display
        // ============================================================

        // ---------- qrcode ----------
        "qrcode" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-qrcode",
                        canvas { class: "hi-qrcode__canvas", width: "128", height: "128" }
                    }
                }
            }
        }),

        // ---------- skeleton ----------
        "skeleton" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Text" }
                div { class: "demo-row",
                    div { class: "hi-skeleton", style: "width: 200px; height: 20px;" }
                    div { class: "hi-skeleton", style: "width: 160px; height: 20px;" }
                    div { class: "hi-skeleton", style: "width: 180px; height: 20px;" }
                }
                div { class: "demo-section__label", "Circle" }
                div { class: "demo-row",
                    div { class: "hi-skeleton hi-skeleton--circle", style: "width: 40px; height: 40px;" }
                    div { class: "hi-skeleton hi-skeleton--circle", style: "width: 56px; height: 56px;" }
                }
            }
        }),

        // ---------- timeline ----------
        "timeline" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-timeline",
                        div { class: "hi-timeline-item",
                            div { class: "hi-timeline-dot" }
                            div { class: "hi-timeline-content",
                                div { class: "hi-timeline-title", "Project Started" }
                                div { class: "hi-timeline-time", "2024-01-01" }
                            }
                        }
                        div { class: "hi-timeline-item",
                            div { class: "hi-timeline-dot" }
                            div { class: "hi-timeline-content",
                                div { class: "hi-timeline-title", "First Milestone" }
                                div { class: "hi-timeline-time", "2024-02-15" }
                            }
                        }
                        div { class: "hi-timeline-item",
                            div { class: "hi-timeline-dot" }
                            div { class: "hi-timeline-content",
                                div { class: "hi-timeline-title", "Beta Release" }
                                div { class: "hi-timeline-time", "2024-03-20" }
                            }
                        }
                    }
                }
            }
        }),

        // ---------- user_guide ----------
        "user_guide" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    p { "User Guide provides step-by-step onboarding overlay." }
                    div { style: "padding: 16px; border: 1px solid var(--hi-border); border-radius: 8px; max-width: 360px;",
                        div { style: "font-weight: 600; margin-bottom: 8px;", "Step 1 of 3: Welcome" }
                        p { "This is a step-by-step guide to introduce new features." }
                        div { style: "display: flex; gap: 8px; margin-top: 12px;",
                            button { class: "hi-btn hi-btn--primary hi-btn--sm", "Next" }
                            button { class: "hi-btn hi-btn--ghost hi-btn--sm", "Skip" }
                        }
                    }
                }
            }
        }),

        // ---------- empty ----------
        "empty" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon", "∅" }
                        div { class: "hi-empty__description", "No data" }
                    }
                }
            }
        }),

        // ---------- zoom_controls ----------
        "zoom_controls" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row",
                    div { class: "hi-zoom-controls",
                        button { class: "hi-zoom-controls__btn", "+" }
                        span { class: "hi-zoom-controls__percentage", "100%" }
                        button { class: "hi-zoom-controls__btn", "-" }
                        button { class: "hi-zoom-controls__btn", "⟲" }
                    }
                }
            }
        }),

        // ---------- code_highlight ----------
        "code_highlight" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-code-highlight", style: "max-width: 500px;",
                        pre { style: "margin: 0; padding: 16px; background: var(--hi-surface); border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 13px; line-height: 1.6;",
                            code { "fn main() {\n    println!(\"Hello, World!\");\n}" }
                        }
                    }
                }
            }
        }),

        // ---------- markdown_editor ----------
        "markdown_editor" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-editor", style: "max-width: 500px; height: 200px;",
                        div { class: "hi-editor__toolbar",
                            button { class: "hi-editor__btn", "B" }
                            button { class: "hi-editor__btn", "I" }
                            button { class: "hi-editor__btn", "H1" }
                            button { class: "hi-editor__btn", "H2" }
                        }
                        div { class: "hi-editor__content",
                            textarea { class: "hi-editor__textarea", placeholder: "Write markdown here...", style: "width: 100%; height: 100%; border: none; resize: none; font-family: monospace;" }
                        }
                    }
                }
            }
        }),

        // ---------- rich_text_editor ----------
        "rich_text_editor" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-editor", style: "max-width: 500px; height: 200px;",
                        div { class: "hi-editor__toolbar",
                            button { class: "hi-editor__btn", "B" }
                            button { class: "hi-editor__btn", "I" }
                            button { class: "hi-editor__btn", "U" }
                            button { class: "hi-editor__btn", "S" }
                        }
                        div { class: "hi-editor__content",
                            textarea { class: "hi-editor__textarea", placeholder: "Start typing...", style: "width: 100%; height: 100%; border: none; resize: none;" }
                        }
                    }
                }
            }
        }),

        // ---------- video_player ----------
        "video_player" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-media-player", style: "max-width: 480px;",
                        div { class: "hi-media-player__poster", "▶" }
                        div { class: "hi-media-player__controls",
                            button { class: "hi-media-player__btn", "▶" }
                            div { class: "hi-media-player__progress" }
                            span { class: "hi-media-player__time", "0:00" }
                        }
                    }
                }
            }
        }),

        // ---------- audio_waveform ----------
        "audio_waveform" => Some(rsx! {
            div { class: "demo-group",
                div { class: "demo-section__label", "Basic" }
                div { class: "demo-row-full",
                    div { class: "hi-media-player", style: "max-width: 400px;",
                        div { class: "hi-media-player__controls",
                            button { class: "hi-media-player__btn", "▶" }
                            div { class: "hi-media-player__progress" }
                            span { class: "hi-media-player__time", "0:00 / 3:45" }
                        }
                    }
                }
            }
        }),

        _ => None,
    }
}
