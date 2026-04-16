//! Component documentation pages.

pub mod overview;

use crate::components::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn render_layer1() -> VNode {
    let btn_submit = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary", "Submit" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );

    let btn_primary = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary", "Primary" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );
    let btn_secondary = glow_wrap(
        rsx! { button { class: "hi-button hi-button-secondary", "Secondary" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Secondary,
            ..Default::default()
        },
    );
    let btn_danger = glow_wrap(
        rsx! { button { class: "hi-button hi-button-danger", "Danger" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Danger,
            ..Default::default()
        },
    );
    let btn_ghost = glow_wrap(
        rsx! { button { class: "hi-button hi-button-ghost", "Ghost" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let btn_small = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary hi-button-sm", "Small" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );
    let btn_large = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary hi-button-lg", "Large" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );

    let input_default = glow_wrap(
        rsx! { input { class: "hi-input", placeholder: "Default input", r#type: "text" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );
    let input_error = glow_wrap(
        rsx! { input { class: "hi-input hi-input-error", placeholder: "Error state", r#type: "text" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Danger,
            ..Default::default()
        },
    );
    let input_disabled = glow_wrap(
        rsx! { input { class: "hi-input", placeholder: "Disabled", r#type: "text", disabled: "true" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Ghost,
            ..Default::default()
        },
    );

    rsx! {
        div { id: "page-components-layer1", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Layer 1 — Base Components" }
                p { class: "page-header__subtitle",
                    "Atomic UI primitives: buttons, inputs, tags, avatars, and more."
                }
            }
            div { class: "page-section",
                h2 { "Button" }
                p {
                    "The Button component supports primary, secondary, danger, and ghost variants in three sizes."
                }
                div { class: "demo-row",
                    {btn_primary}
                    {btn_secondary}
                    {btn_danger}
                    {btn_ghost}
                    {btn_small}
                    {btn_large}
                }
                h2 { "Input" }
                p { "Text input fields with placeholder, disabled, and error states." }
                div { class: "demo-row",
                    {input_default}
                    {input_error}
                    {input_disabled}
                }
                h2 { "Switch" }
                p { "Boolean toggle control." }
                div { class: "demo-row",
                    label { class: "hi-switch",
                        input { r#type: "checkbox", class: "hi-switch__input" }
                        span { class: "hi-switch__rail" }
                    }
                }
                h2 { "Tag" }
                p { "Compact label for status or categorisation." }
                div { class: "demo-row",
                    span { class: "hi-tag hi-tag--primary", "Primary" }
                    span { class: "hi-tag hi-tag--success", "Success" }
                    span { class: "hi-tag hi-tag--danger", "Danger" }
                    span { class: "hi-tag hi-tag--warning", "Warning" }
                }
                h2 { "Avatar" }
                p { "User or entity representation with size variants and initials fallback." }
                div { class: "demo-row",
                    div { class: "hi-avatar hi-avatar--sm", "A" }
                    div { class: "hi-avatar", "B" }
                    div { class: "hi-avatar hi-avatar--lg", "C" }
                }
                h2 { "Form" }
                p { "Complete form with labels, various input types, and submission." }
                div { class: "demo-row",
                    form { class: "hi-form",
                        div { class: "hi-form-item",
                            label { class: "hi-label", "Name" },
                            {glow_wrap(
                                rsx! { input { class: "hi-input", placeholder: "Enter name", r#type: "text" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                        div { class: "hi-form-item",
                            label { class: "hi-label", "Email" },
                            {glow_wrap(
                                rsx! { input { class: "hi-input", placeholder: "Enter email", r#type: "email" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                        div { class: "hi-form-item",
                            label { class: "hi-label", "Message" },
                            {glow_wrap(
                                rsx! { textarea { class: "hi-textarea", placeholder: "Enter message" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                        {btn_submit}
                    }
                }
                h2 { "Display" }
                p { "Badges, dividers, and other display primitives." }
                div { class: "demo-row",
                    span { class: "hi-badge", "New" }
                    span { class: "hi-badge hi-badge--dot", "" }
                    hr { class: "hi-divider" }
                }
                h2 { "Feedback" }
                p { "Alerts, progress bars, and spinners." }
                div { class: "demo-row",
                    div { class: "hi-alert hi-alert--info", "ℹ  Info alert" }
                    div { class: "hi-alert hi-alert--success", "✓  Success alert" }
                    div { class: "hi-alert hi-alert--danger", "✗  Danger alert" }
                }
                div { class: "demo-row",
                    div { class: "hi-progress",
                        div { class: "hi-progress__bar", style: "width: 60%;" }
                    }
                    div { class: "hi-spin" }
                }
                h2 { "Image" }
                p { "Responsive image display with fallback support." }
                div { class: "demo-row",
                    img { class: "hi-image", src: "https://picsum.photos/200/200", alt: "demo" }
                }
                h2 { "Comment" }
                p { "User comment display with author, time, and content." }
                div { class: "demo-row",
                    div { class: "hi-comment",
                        div { class: "hi-comment__author", "User" }
                        div { class: "hi-comment__content", "This is a comment." }
                        div { class: "hi-comment__time", "2 hours ago" }
                    }
                }
                h2 { "Number Input" }
                p { "Numeric field with increment and decrement controls." }
                div { class: "demo-row",
                    {glow_wrap(
                        rsx! {
                            div { class: "hi-number-input",
                                button { class: "hi-number-input__btn", "-" }
                                input { class: "hi-number-input__input", r#type: "number", value: "0" }
                                button { class: "hi-number-input__btn", "+" }
                            }
                        },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                    )}
                }
                h2 { "Search" }
                p { "Search input with instant filtering support." }
                div { class: "demo-row",
                    {glow_wrap(
                        rsx! {
                            div { class: "hi-search",
                                input { class: "hi-search__input", placeholder: "Search...", r#type: "search" }
                            }
                        },
                        GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                    )}
                }
                h2 { "Empty / Skeleton" }
                p { "Empty state placeholder and content skeleton loading indicators." }
                div { class: "demo-row",
                    div { class: "hi-empty",
                        div { class: "hi-empty__icon", "∅" }
                        div { class: "hi-empty__description", "No data" }
                    }
                }
                div { class: "demo-row",
                    div { class: "hi-skeleton", style: "width: 200px; height: 20px;" }
                    div { class: "hi-skeleton hi-skeleton--circle", style: "width: 40px; height: 40px;" }
                }
                h2 { "FlexBox / Layout" }
                p { "Flex container and spacing utilities for layout composition." }
                div { class: "demo-row",
                    div { class: "hi-flex hi-gap-4",
                        div { class: "hi-p-4", style: "background: var(--hi-color-surface);", "Item 1" }
                        div { class: "hi-p-4", style: "background: var(--hi-color-surface);", "Item 2" }
                        div { class: "hi-p-4", style: "background: var(--hi-color-surface);", "Item 3" }
                    }
                }
            }
        }
    }
}

fn render_layer2() -> VNode {
    let btn_signin = glow_wrap(
        rsx! { button { class: "hi-button hi-button-primary", "Sign In" } },
        GlowConfig {
            intensity: GlowIntensity::Soft,
            color: GlowColor::Primary,
            ..Default::default()
        },
    );

    rsx! {
        div { id: "page-components-layer2", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Layer 2 — Composed Components" }
                p { class: "page-header__subtitle",
                    "Pattern-level components built from Layer 1 primitives."
                }
            }
            div { class: "page-section",
                h2 { "Navigation" }
                p { "Tabs, breadcrumbs, steps, and menu components." }
                div { class: "demo-row",
                    nav { class: "hi-tabs",
                        button { class: "hi-tab hi-tab--active", "Tab 1" }
                        button { class: "hi-tab", "Tab 2" }
                        button { class: "hi-tab", "Tab 3" }
                    }
                }
                div { class: "demo-row",
                    nav { class: "hi-breadcrumb",
                        a { class: "hi-breadcrumb__item", href: "/", "Home" }
                        span { class: "hi-breadcrumb__separator", "/" }
                        a { class: "hi-breadcrumb__item", href: "/components", "Components" }
                        span { class: "hi-breadcrumb__separator", "/" }
                        span { class: "hi-breadcrumb__item hi-breadcrumb__item--active", "Current" }
                    }
                }
                div { class: "demo-row",
                    div { class: "hi-steps",
                        div { class: "hi-steps__item hi-steps__item--active",
                            div { class: "hi-steps__icon", "1" }
                            div { class: "hi-steps__title", "Step 1" }
                        }
                        div { class: "hi-steps__item",
                            div { class: "hi-steps__icon", "2" }
                            div { class: "hi-steps__title", "Step 2" }
                        }
                        div { class: "hi-steps__item",
                            div { class: "hi-steps__icon", "3" }
                            div { class: "hi-steps__title", "Step 3" }
                        }
                    }
                }
                h2 { "Data" }
                p { "Tables, lists, and data grids with sorting and filtering." }
                div { class: "demo-row",
                    table { class: "hi-table hi-table--striped",
                        thead { tr { th { "Name" } th { "Age" } th { "Role" } } }
                        tbody {
                            tr { td { "Alice" } td { "28" } td { "Engineer" } }
                            tr { td { "Bob" } td { "35" } td { "Designer" } }
                            tr { td { "Carol" } td { "42" } td { "Manager" } }
                        }
                    }
                }
                h2 { "Pagination" }
                p { "Page navigation control." }
                div { class: "demo-row",
                    div { class: "hi-pagination",
                        button { class: "hi-pagination__btn", "‹" }
                        button { class: "hi-pagination__btn hi-pagination__btn--active", "1" }
                        button { class: "hi-pagination__btn", "2" }
                        button { class: "hi-pagination__btn", "3" }
                        button { class: "hi-pagination__btn", "›" }
                    }
                }
                h2 { "Tree" }
                p { "Hierarchical tree view with expand and collapse." }
                div { class: "demo-row",
                    div { class: "hi-tree",
                        div { class: "hi-tree__item",
                            span { class: "hi-tree__arrow", "▶" }
                            span { class: "hi-tree__label", "Parent 1" }
                        }
                        div { class: "hi-tree__item hi-tree__item--indent",
                            span { class: "hi-tree__arrow", "▶" }
                            span { class: "hi-tree__label", "Child 1.1" }
                        }
                        div { class: "hi-tree__item",
                            span { class: "hi-tree__arrow", "▶" }
                            span { class: "hi-tree__label", "Parent 2" }
                        }
                    }
                }
                h2 { "Form" }
                p { "Form builder with validation, layout, and submission handling." }
                div { class: "demo-row",
                    form { class: "hi-form",
                        div { class: "hi-form-item",
                            label { class: "hi-label", "Username" },
                            {glow_wrap(
                                rsx! { input { class: "hi-input", placeholder: "Enter username", r#type: "text" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                        div { class: "hi-form-item",
                            label { class: "hi-label", "Password" },
                            {glow_wrap(
                                rsx! { input { class: "hi-input", placeholder: "Enter password", r#type: "password" } },
                                GlowConfig { intensity: GlowIntensity::Soft, color: GlowColor::Ghost, ..Default::default() },
                            )}
                        }
                        div { class: "hi-form-item",
                            label { class: "hi-switch",
                                input { r#type: "checkbox", class: "hi-switch__input" }
                                span { class: "hi-switch__rail" }
                            }
                            span { "Remember me" }
                        }
                        {btn_signin}
                    }
                }
                h2 { "Feedback" }
                p { "Toast notifications, alerts, and progress indicators." }
                div { class: "demo-row",
                    div { class: "hi-alert hi-alert--info", "ℹ  This is an informational alert." }
                    div { class: "hi-alert hi-alert--success", "✓  Operation completed successfully." }
                    div { class: "hi-alert hi-alert--danger",
                        "✗  An error occurred. Please try again."
                    }
                }
                h2 { "Transfer" }
                p { "Dual-panel transfer widget for moving items between lists." }
                div { class: "demo-row",
                    div { class: "hi-transfer",
                        div { class: "hi-transfer__panel",
                            div { class: "hi-transfer__header", "Available" }
                            div { class: "hi-transfer__list",
                                label { class: "hi-transfer__item", input { r#type: "checkbox" } " Item A" }
                                label { class: "hi-transfer__item", input { r#type: "checkbox" } " Item B" }
                                label { class: "hi-transfer__item", input { r#type: "checkbox" } " Item C" }
                            }
                        }
                        div { class: "hi-transfer__actions",
                            button { class: "hi-button", "→" }
                        }
                        div { class: "hi-transfer__panel",
                            div { class: "hi-transfer__header", "Selected" }
                            div { class: "hi-transfer__list" }
                        }
                    }
                }
                h2 { "Collapsible" }
                p { "Accordion and collapse panels with animation." }
                div { class: "demo-row",
                    div { class: "hi-collapse",
                        div { class: "hi-collapse__item",
                            div { class: "hi-collapse__header", "Section 1" }
                            div { class: "hi-collapse__content", "Content for section 1." }
                        }
                        div { class: "hi-collapse__item",
                            div { class: "hi-collapse__header", "Section 2" }
                            div { class: "hi-collapse__content", "Content for section 2." }
                        }
                    }
                }
                h2 { "Timeline" }
                p { "Chronological event display." }
                div { class: "demo-row",
                    div { class: "hi-timeline",
                        div { class: "hi-timeline__item",
                            div { class: "hi-timeline__dot" }
                            div { class: "hi-timeline__content",
                                div { class: "hi-timeline__title", "Event 1" }
                                div { class: "hi-timeline__time", "2025-01-01" }
                            }
                        }
                        div { class: "hi-timeline__item",
                            div { class: "hi-timeline__dot" }
                            div { class: "hi-timeline__content",
                                div { class: "hi-timeline__title", "Event 2" }
                                div { class: "hi-timeline__time", "2025-02-01" }
                            }
                        }
                    }
                }
                h2 { "QRCode" }
                p { "Static QR code placeholder." }
                div { class: "demo-row",
                    div { class: "hi-qrcode",
                        canvas { class: "hi-qrcode__canvas", width: "128", height: "128" }
                    }
                }
            }
        }
    }
}

fn render_layer3() -> VNode {
    rsx! {
        div { id: "page-components-layer3", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Layer 3 — Complex Components" }
                p { class: "page-header__subtitle",
                    "Advanced widgets: rich editor, media player, visualisation, and interactive guides."
                }
            }
            div { class: "page-section",
                p {
                    "Layer 3 components are high-complexity, domain-specific widgets that integrate multiple Layer 1 and Layer 2 components."
                }
                h2 { "Media Player" }
                p { "Video and audio player with custom controls." }
                div { class: "demo-row",
                    div { class: "hi-media-player",
                        div { class: "hi-media-player__poster", "▶" }
                        div { class: "hi-media-player__controls",
                            button { class: "hi-media-player__btn", "▶" }
                            div { class: "hi-media-player__progress" }
                            span { class: "hi-media-player__time", "0:00" }
                        }
                    }
                }
                h2 { "Editor" }
                p { "Rich text and markdown editor with formatting toolbar." }
                div { class: "demo-row",
                    div { class: "hi-editor",
                        div { class: "hi-editor__toolbar",
                            button { class: "hi-editor__btn", "B" }
                            button { class: "hi-editor__btn", "I" }
                            button { class: "hi-editor__btn", "U" }
                        }
                        div { class: "hi-editor__content",
                            textarea { class: "hi-editor__textarea", placeholder: "Start writing..." }
                        }
                    }
                }
                h2 { "Visualization" }
                p { "Charts, graphs, and data visualisation primitives." }
                div { class: "demo-row",
                    div { class: "hi-chart",
                        div { class: "hi-chart__bars",
                            div { class: "hi-chart__bar", style: "height: 40%;", "Mon" }
                            div { class: "hi-chart__bar", style: "height: 70%;", "Tue" }
                            div { class: "hi-chart__bar", style: "height: 55%;", "Wed" }
                            div { class: "hi-chart__bar", style: "height: 85%;", "Thu" }
                            div { class: "hi-chart__bar", style: "height: 60%;", "Fri" }
                        }
                    }
                }
                h2 { "Zoom Controls" }
                p { "Zoom in, zoom out, and reset controls for canvas or viewer." }
                div { class: "demo-row",
                    div { class: "hi-zoom-controls",
                        button { class: "hi-zoom-controls__btn", "+" }
                        button { class: "hi-zoom-controls__btn", "-" }
                        button { class: "hi-zoom-controls__btn", "⟲" }
                    }
                }
                div { class: "card-grid",
                    div { class: "card",
                        h3 { class: "card__title", "Rich Editor" }
                        p { class: "card__body",
                            "Full-featured rich text editing with formatting, code blocks, and media embedding."
                        }
                    }
                    div { class: "card",
                        h3 { class: "card__title", "Visualisation" }
                        p { class: "card__body", "Charts, graphs, and data visualisation primitives." }
                    }
                    div { class: "card",
                        h3 { class: "card__title", "Media Player" }
                        p { class: "card__body", "Video and audio player with custom controls." }
                    }
                    div { class: "card",
                        h3 { class: "card__title", "User Guide" }
                        p { class: "card__body",
                            "Interactive onboarding and feature discovery overlay."
                        }
                    }
                }
            }
        }
    }
}

/// Returns all component pages as a Vec for inclusion in the full page tree.
pub fn render_all() -> Vec<VNode> {
    vec![
        overview::render(),
        render_layer1(),
        render_layer2(),
        render_layer3(),
    ]
}
