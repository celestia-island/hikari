// packages/components/src/display/calendar.rs
// Calendar component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, CalendarClass, UtilityClass};

use crate::styled::StyledComponent;

/// Calendar component type wrapper (for StyledComponent)
pub struct CalendarComponent;

/// Calendar component with Arknights + FUI styling
///
/// A simple calendar grid component for date selection.
/// Supports month/year navigation without external date dependencies.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Calendar;
///
/// fn app() -> Element {
///     let mut selected = use_signal(|| None);
///     let mut current_month = use_signal(|| (2024, 1));
///
///     rsx! {
///         Calendar {
///             value: selected,
///             on_change: move |date| selected.set(Some(date)),
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct CalendarProps {
    /// Currently selected date as (year, month, day)
    #[props(default)]
    pub value: Option<(i32, u32, u8)>,

    /// Callback when date is selected
    pub on_change: Option<Callback<(i32, u32, u8)>>,

    /// Initially displayed year and month
    #[props(default)]
    pub default_year: i32,
    #[props(default)]
    pub default_month: u32,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Additional inline style
    #[props(default)]
    pub style: String,
}

impl Default for CalendarProps {
    fn default() -> Self {
        Self {
            value: None,
            on_change: None,
            default_year: 2024,
            default_month: 1,
            class: String::default(),
            style: String::default(),
        }
    }
}

#[component]
pub fn Calendar(props: CalendarProps) -> Element {
    let mut current_year = use_signal(|| props.default_year);
    let mut current_month = use_signal(|| props.default_month);

    let get_days_in_month = |year: u32, month: u32| -> u32 {
        match month {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
            2 => 29,
            _ => 28,
        }
    };

    rsx! {
        div {
            class: "hi-calendar",
            style: "{props.style}",

            // Header with year navigation
            div { class: "hi-calendar-header",
                div { class: "hi-calendar-nav hi-calendar-year-nav",
                    button {
                        class: "hi-calendar-nav-button",
                        onclick: move |_| {
                            let year = *current_year();
                            if year > 1970 {
                                current_year.set(year - 1);
                            }
                        },
                        disabled: *current_year() <= 1970,
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            "path" { d: "M15 19l-7-7 7" }
                        }
                    }
                    span { class: "hi-calendar-title",
                        "{current_year} 年"
                    }
                    button {
                        class: "hi-calendar-nav-button",
                        onclick: move |_| {
                            let year = *current_year();
                            if year < 2100 {
                                current_year.set(year + 1);
                            }
                        },
                        disabled: *current_year() >= 2100,
                        svg {
                            view_box: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            stroke_width: "2",
                            "path" { d: "M9 5l7 7" }
                        }
                    }
                }
            }

            // Month navigation
            div { class: "hi-calendar-nav hi-calendar-month-nav",
                button {
                    class: "hi-calendar-nav-button",
                    onclick: move |_| {
                        let month = *current_month();
                        let year = *current_year();
                        let new_month = if month == 1 {
                            (year - 1, 12)
                        } else {
                            (year, month - 1)
                        };
                        current_month.set(new_month);
                    },
                    svg {
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2",
                        "path" { d: "M15 19l-7-7 7" }
                    }
                }
                span { class: "hi-calendar-month-title",
                    "{["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"][current_month - 1]}"
                }
                button {
                    class: "hi-calendar-nav-button",
                    onclick: move |_| {
                        let month = *current_month();
                        let year = *current_year();
                        let new_month = if month == 12 {
                            (year + 1, 1)
                        } else {
                            (year, month + 1)
                        };
                        current_month.set(new_month);
                    },
                    svg {
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2",
                        "path" { d: "M9 5l7 7" }
                    }
                }
            }

            // Calendar grid
            div { class: "hi-calendar-grid",
                for day in 1..=get_days_in_month(current_year(), current_month()) {
                    div {
                        key: "{day}",
                        class: "hi-calendar-day",
                        onclick: move |_| {
                            if let Some(handler) = props.on_change.as_ref() {
                                handler.call((current_year(), current_month(), day));
                            }
                        },
                        "{day}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for CalendarComponent {
    fn styles() -> &'static str {
        r#"
.hi-calendar {
    display: inline-block;
    font-family: var(--hi-font-family);
    background: var(--hi-background);
    border: 1px solid var(--hi-border);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.hi-calendar-header {
    padding: 16px;
    border-bottom: 1px solid var(--hi-border);
}

.hi-calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
}

.hi-calendar-year-nav {
    gap: 16px;
}

.hi-calendar-month-nav {
    display: flex;
    align-items: center;
    gap: 8px;
}

.hi-calendar-nav-button {
    background: transparent;
    border: 1px solid var(--hi-border);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    color: var(--hi-text-primary);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.hi-calendar-nav-button:hover:not(:disabled) {
    background: var(--hi-color-hover);
    border-color: var(--hi-color-primary);
}

.hi-calendar-nav-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.hi-calendar-nav-button svg {
    width: 16px;
    height: 16px;
}

.hi-calendar-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--hi-text-primary);
}

.hi-calendar-month-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--hi-text-secondary);
}

.hi-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
}

.hi-calendar-day {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
}

.hi-calendar-day:hover {
    background: var(--hi-color-hover);
    border-color: var(--hi-border);
}

.hi-calendar-day-selected {
    background: var(--hi-color-primary) !important;
    color: var(--hi-text-on-primary) !important;
    border-color: var(--hi-color-primary) !important;
}

[data-theme="dark"] .hi-calendar {
    background: var(--hi-surface);
    border-color: var(--hi-border);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .hi-calendar-day-selected {
    background: var(--hi-color-primary) !important;
    color: var(--hi-text-on-primary) !important;
}
"#
    }

    fn name() -> &'static str {
        "calendar"
    }
}
