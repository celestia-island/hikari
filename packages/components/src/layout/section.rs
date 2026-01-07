// hikari-components/src/layout/section.rs
//! Section component - Content section with optional header
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::Section;
//! use dioxus::prelude::*;
//!
//! rsx! {
//!     Section {
//!         title: "Section Title".to_string(),
//!         description: "Optional description".to_string(),
//!         p { "Section content goes here" }
//!     }
//! }
//! ```

use dioxus::prelude::*;

/// Section component - Content section with optional header
///
/// Provides a semantic section element with optional title and description.
/// Perfect for grouping related content.
///
/// # Features
/// - Optional title and description
/// - Semantic HTML5 section element
/// - Responsive spacing
/// - Clean typography
#[component]
pub fn Section(
    /// Section content
    children: Element,

    /// Section title (optional)
    #[props(optional)]
    title: Option<String>,

    /// Section description/subtitle (optional)
    #[props(optional)]
    description: Option<String>,

    /// Section size (default: md)
    #[props(default = "md".to_string())]
    size: String,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    let size_class = match size.as_str() {
        "sm" => "hi-section-sm",
        "lg" => "hi-section-lg",
        _ => "hi-section-md", // md (default)
    };

    rsx! {
        section {
            class: format!("hi-section {size_class} {class}"),

            // Optional header
            if title.is_some() || description.is_some() {
                div {
                    class: "hi-section-header",
                    if let Some(t) = title {
                        h2 {
                            class: "hi-section-title",
                            "{t}"
                        }
                    }
                    if let Some(d) = description {
                        p {
                            class: "hi-section-description",
                            "{d}"
                        }
                    }
                }
            }

            // Section content
            div {
                class: "hi-section-body",
                { children }
            }
        }
    }
}

/// Spacer component - Vertical or horizontal spacing
///
/// Provides consistent spacing within layouts.
///
/// # Features
/// - Vertical or horizontal orientation
/// - Multiple size presets
/// - Zero-height component
#[component]
pub fn Spacer(
    /// Spacer orientation (default: vertical)
    #[props(default = "vertical".to_string())]
    orientation: String,

    /// Spacer size (xs/sm/md/lg/xl, default: md)
    #[props(default = "md".to_string())]
    size: String,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    let size_value = match size.as_str() {
        "xs" => "0.5rem",
        "sm" => "1rem",
        "lg" => "2rem",
        "xl" => "3rem",
        _ => "1.5rem", // md (default)
    };

    let style = if orientation == "horizontal" {
        format!("display: inline-block; width: {size_value};")
    } else {
        format!("height: {size_value};")
    };

    rsx! {
        div {
            class: format!("hi-spacer {class}"),
            style: style,
        }
    }
}
