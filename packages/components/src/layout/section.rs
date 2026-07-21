// hikari-components/src/layout/section.rs
//! Section component - Content section with optional header
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::Section;
//! use crate::prelude::*;
//!
//! rsx! {
//!     Section {
//!         title: "Section Title".to_string(),
//!         description: "Optional description".to_string(),
//!         p { "Section content goes here" }
//!     }
//! }
//! ```

use hikari_palette::classes::{ClassesBuilder, SectionClass, UtilityClass};

use crate::prelude::*;

///
///
#[component]
pub fn Section(
    children: Element,

    #[props(optional)] title: Option<String>,

    #[props(optional)] description: Option<String>,

    #[props(default = "md".to_string())] size: String,

    #[props(default)] class: String,
) -> Element {
    let size_class = match size.as_str() {
        "sm" => SectionClass::SectionSm,
        "lg" => SectionClass::SectionLg,
        _ => SectionClass::SectionMd, // md (default)
    };

    let section_classes = ClassesBuilder::new()
        .add(SectionClass::Section)
        .add(size_class)
        .add_raw(&class)
        .build();

    let section_classes_str = section_classes.as_str();

    rsx! {
        section { class: section_classes_str,

            // Optional header
            if title.is_some() || description.is_some() {
                div { class: SectionClass::SectionHeader.as_class(),
                    if let Some(t) = title {
                        h2 { class: SectionClass::SectionTitle.as_class(), "{t}" }
                    }
                    if let Some(d) = description {
                        p { class: SectionClass::SectionDescription.as_class(), "{d}" }
                    }
                }
            }

            // Section content
            div { class: SectionClass::SectionBody.as_class(), {children} }
        }
    }
}

///
///
#[component]
pub fn Spacer(
    #[props(default = "vertical".to_string())] orientation: String,

    #[props(default = "md".to_string())] size: String,

    #[props(default)] class: String,
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

    let classes = ClassesBuilder::new()
        .add(SectionClass::Spacer)
        .add_raw(&class)
        .build();

    let classes_str = classes.as_str();

    rsx! {
        div { class: classes_str, style }
    }
}

pub struct SectionComponent;

impl crate::styled::StyledComponent for SectionComponent {
    fn styles() -> &'static str {
        r#"
.hk-section {
  margin-bottom: 2rem;
}

.hk-section-sm {
  margin-bottom: 1rem;
}

.hk-section-md {
  margin-bottom: 2rem;
}

.hk-section-lg {
  margin-bottom: 3rem;
}

.hk-section-header {
  margin-bottom: 1rem;
}

.hk-section-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--hi-color-text-primary);
  margin: 0 0 0.5rem 0;
}

.hk-section-description {
  font-size: 0.875rem;
  color: var(--hi-color-text-secondary);
  margin: 0;
}

.hk-section-body {
  /* Content styles */
}

.hk-spacer {
  display: block;
}
"#
    }

    fn name() -> &'static str {
        "section"
    }
}
