// packages/components/src/display/description_list.rs
// DescriptionList component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, DescriptionListClass, UtilityClass};

use crate::styled::StyledComponent;

/// DescriptionList component type wrapper (for StyledComponent)
pub struct DescriptionListComponent;

/// DescriptionList component with Arknights + FUI styling
///
/// A key-value list component for displaying structured information.
/// Useful for showing configuration details, specifications, or metadata.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::DescriptionList;
///
/// fn app() -> Element {
///     rsx! {
///         DescriptionList {
///             items: vec![
///                 ("Name".to_string(), "Hikari".to_string()),
///                 ("Version".to_string(), "0.1.0".to_string()),
///                 ("License".to_string(), "MIT".to_string()),
///             ]
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct DescriptionListProps {
    pub items: Vec<(String, String)>,

    #[props(default)]
    pub column: u8,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

impl Default for DescriptionListProps {
    fn default() -> Self {
        Self {
            items: Vec::new(),
            column: 1,
            class: String::default(),
            style: String::default(),
        }
    }
}

#[component]
pub fn DescriptionList(props: DescriptionListProps) -> Element {
    let grid_style = format!(
        "grid-template-columns: repeat({}, minmax(0, 1fr));",
        props.column * 2
    );

    let container_classes = ClassesBuilder::new()
        .add(DescriptionListClass::List)
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{container_classes}",
            style: "{props.style} display: grid; {grid_style} gap: 1rem;",

            for (label, value) in props.items.iter() {
                dt {
                    class: "{DescriptionListClass::Term.as_class()}",
                    "{label}"
                }
                dd {
                    class: "{DescriptionListClass::Detail.as_class()}",
                    "{value}"
                }
            }
        }
    }
}

impl StyledComponent for DescriptionListComponent {
    fn styles() -> &'static str {
        r#"
.hi-description-list {
    display: grid;
    gap: 1rem;
}

.hi-description-list-term {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--hi-color-text-secondary);
}

.hi-description-list-detail {
    margin: 0;
    font-size: 0.875rem;
    color: var(--hi-color-text-primary);
    line-height: 1.5;
}
"#
    }

    fn name() -> &'static str {
        "description-list"
    }
}
