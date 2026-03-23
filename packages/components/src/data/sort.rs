// hi-components/src/data/sort.rs
// Sort component with Arknights + FUI styling

use crate::prelude::*;
use hikari_palette::classes::{ClassesBuilder, SortClass, UtilityClass};

pub use super::column::ColumnDef;
use crate::styled::StyledComponent;

pub struct SortComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SortDirection {
    #[default]
    None,
    Ascending,
    Descending,
}

impl SortDirection {
    pub fn toggle(&self) -> Self {
        match self {
            SortDirection::None => SortDirection::Ascending,
            SortDirection::Ascending => SortDirection::Descending,
            SortDirection::Descending => SortDirection::None,
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            SortDirection::None => "⇅",
            SortDirection::Ascending => "↑",
            SortDirection::Descending => "↓",
        }
    }

    pub fn class(&self) -> &'static str {
        match self {
            SortDirection::None => "",
            SortDirection::Ascending => "hi-sort-asc",
            SortDirection::Descending => "hi-sort-desc",
        }
    }
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct SortConfig {
    pub column: String,
    pub direction: SortDirection,
}

impl SortConfig {
    pub fn new(column: impl Into<String>, direction: SortDirection) -> Self {
        Self {
            column: column.into(),
            direction,
        }
    }
}

#[define_props]
pub struct SortProps {
    #[default]
    pub column: String,

    #[default]
    pub direction: SortDirection,

    #[default]
    pub columns: Vec<ColumnDef>,

    #[default]
    pub class: String,

    pub on_sort_change: Option<EventHandler<SortConfig>>,
}

#[component]
pub fn Sort(props: SortProps) -> Element {
    // Clone props for use in closures
    let current_column = props.column.clone();
    let current_direction = props.direction;
    let on_sort_handler = props.on_sort_change.clone();

    let has_active_sort = props.direction != SortDirection::None;

    let container_classes = ClassesBuilder::new()
        .add(SortClass::Sort)
        .add_raw(&props.class)
        .build();

    // Build sort buttons using VElement directly
    let mut children: Vec<VNode> = props.columns.iter().filter(|column| column.sortable).map(|column| {
        let column_key = column.column_key.clone();
        let is_active = props.column == column.column_key && props.direction != SortDirection::None;
        let column_title = column.title.clone();
        let direction_icon = if is_active { props.direction.icon().to_string() } else { "⇅".to_string() };

        // Clone captured variables for this iteration
        let sort_column = current_column.clone();
        let sort_direction = current_direction;
        let sort_handler = on_sort_handler.clone();
        let col_key = column_key.clone();

        let button_classes = ClassesBuilder::new()
            .add(SortClass::SortButton)
            .add_if(SortClass::SortActive, || is_active)
            .build();

        let title_class = SortClass::SortTitle.as_class();
        let indicator_class = SortClass::SortIndicator.as_class();

        VNode::Element(
            VElement::new("button")
                .class(button_classes)
                .on_event("click", move |_e: Box<dyn EventData>| {
                    let new_direction = if sort_column == col_key {
                        sort_direction.toggle()
                    } else {
                        SortDirection::Ascending
                    };

                    if let Some(handler) = sort_handler.as_ref() {
                        handler.call(SortConfig {
                            column: col_key.clone(),
                            direction: new_direction,
                        });
                    }
                })
                .child(VNode::Element(
                    VElement::new("span")
                        .class(title_class)
                        .child(VNode::Text(VText::new(&column_title)))
                ))
                .child(VNode::Element(
                    VElement::new("span")
                        .class(indicator_class)
                        .child(VNode::Text(VText::new(&direction_icon)))
                ))
        )
    }).collect();

    // Add clear button if there's an active sort
    if has_active_sort {
        let clear_class = SortClass::SortClear.as_class();
        let text_class = SortClass::SortClearText.as_class();
        let icon_class = SortClass::SortClearIcon.as_class();

        let sort_handler = on_sort_handler.clone();

        let clear_button = VNode::Element(
            VElement::new("button")
                .class(clear_class)
                .on_event("click", move |_e: Box<dyn EventData>| {
                    if let Some(handler) = sort_handler.as_ref() {
                        handler.call(SortConfig {
                            column: String::new(),
                            direction: SortDirection::None,
                        });
                    }
                })
                .child(VNode::Element(
                    VElement::new("span")
                        .class(text_class)
                        .child(VNode::Text(VText::new("Clear")))
                ))
                .child(VNode::Element(
                    VElement::new("svg")
                        .attr("xmlns", "http://www.w3.org/2000/svg")
                        .class(icon_class)
                        .attr("fill", "none")
                        .attr("viewBox", "0 0 24 24")
                        .attr("stroke-width", "2")
                        .attr("stroke", "currentColor")
                        .child(VNode::Element(
                            VElement::new("path")
                                .attr("stroke-linecap", "round")
                                .attr("stroke-linejoin", "round")
                                .attr("d", "M6 18L18 6M6 6l12 12")
                        ))
                ))
        );
        children.push(clear_button);
    }

    VNode::Element(
        VElement::new("div")
            .class(container_classes)
            .children(children)
    )
}

impl StyledComponent for SortComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/sort.css"))
    }

    fn name() -> &'static str {
        "sort"
    }
}
