// packages/components/src/display/calendar.rs
// Calendar component with Arknights + FUI styling

use crate::prelude::*;
use hikari_palette::classes::{CalendarClass, ClassesBuilder, UtilityClass};

use crate::styled::StyledComponent;

fn get_current_date() -> (i32, u32) {
    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        use js_sys::Date;
        let date = Date::new_0();
        let year = date.get_full_year() as i32;
        let month = (date.get_month() + 1) as u32;
        (year, month)
    }
    #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
    {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        let days = now.as_secs() / 86400;
        let years = days / 365;
        let remaining_days = days % 365;
        let month = (remaining_days / 30 + 1).min(12) as u32;
        ((1970 + years as i32), month)
    }
}

pub struct CalendarComponent;

#[define_props]
pub struct CalendarProps {
    #[default(2026)]
    pub default_year: i32,
    #[default(1)]
    pub default_month: u32,
    pub on_date_select: Option<EventHandler<(i32, u32, u32)>>,
    #[default(1970)]
    pub min_year: i32,
    #[default(2100)]
    pub max_year: i32,
    pub class: String,
    pub style: String,
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(year) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

fn first_day_of_month(year: i32, month: u32) -> u32 {
    let m = month as i32;
    let y = if m < 3 { year - 1 } else { year };
    let k = y % 100;
    let j = year / 100;
    let adjusted_m = if m < 3 { m + 12 } else { m };

    let h = (1i32 + (13 * (adjusted_m + 1)) / 5 + k + k / 4 + j / 4 + 5 * j) % 7;
    ((h + 1) % 7) as u32
}

const MONTH_NAMES: [&str; 12] = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
];

const WEEKDAY_NAMES: [&str; 7] = ["日", "一", "二", "三", "四", "五", "六"];

#[component]
pub fn Calendar(props: CalendarProps) -> Element {
    let current_year = use_signal(|| props.default_year);
    let current_month = use_signal(|| props.default_month);
    let selected_day = use_signal(|| 1u32);

    let month = current_month.read();
    let year = current_year.read();
    let sel_day = selected_day.read();

    let days_count = days_in_month(year, month);
    let first_day = first_day_of_month(year, month);

    let cal_class = CalendarClass::Calendar.as_class();
    let header_class = CalendarClass::CalendarHeader.as_class();
    let nav_class = CalendarClass::CalendarNav.as_class();
    let nav_btn_class = CalendarClass::CalendarNavButton.as_class();
    let title_class = CalendarClass::CalendarTitle.as_class();
    let weekdays_class = CalendarClass::CalendarWeekdays.as_class();
    let weekday_class = CalendarClass::CalendarWeekday.as_class();
    let grid_class = CalendarClass::CalendarGrid.as_class();
    let day_cell_class = CalendarClass::CalendarDayCell.as_class();
    let day_class = CalendarClass::CalendarDay.as_class();
    let selected_day_class = CalendarClass::CalendarDaySelected.as_class();

    let calendar_classes = ClassesBuilder::new()
        .add(CalendarClass::Calendar)
        .add_raw(&props.class)
        .build();

    // Build weekday headers outside rsx!
    let weekday_headers: Vec<VNode> = WEEKDAY_NAMES
        .iter()
        .map(|weekday| {
            VNode::Element(
                VElement::new("div")
                    .class(weekday_class.clone())
                    .child(VNode::Text(VText::new(weekday)))
            )
        })
        .collect();

    // Build empty cells for days before the 1st
    let empty_cells: Vec<VNode> = (0..first_day)
        .map(|_| {
            VNode::Element(
                VElement::new("div").class(day_cell_class.clone())
            )
        })
        .collect();

    // Build day cells
    let day_cells: Vec<VNode> = (1..=days_count)
        .map(|day| {
            let is_selected = day == sel_day;
            let day_cell_cls = day_cell_class.clone();
            let inner_class = if is_selected {
                format!("{} {}", day_class.clone(), selected_day_class.clone())
            } else {
                day_class.clone()
            };

            let cy = current_year.clone();
            let cm = current_month.clone();
            let sd = selected_day.clone();
            let on_date_select = props.on_date_select.clone();
            let y = year;
            let m = month;

            VNode::Element(
                VElement::new("div")
                    .class(day_cell_cls)
                    .on_event("click", move |_e: Box<dyn EventData>| {
                        *sd.write() = day;
                        if let Some(ref handler) = on_date_select {
                            handler.call((y, m, day));
                        }
                    })
                    .child(VNode::Element(
                        VElement::new("div")
                            .class(inner_class)
                            .child(VNode::Text(VText::new(&day.to_string())))
                    ))
            )
        })
        .collect();

    // Build nav buttons
    let cy_prev = current_year.clone();
    let cm_prev = current_month.clone();
    let min_yr = props.min_year;
    let prev_btn = VNode::Element(
        VElement::new("button")
            .class(nav_btn_class.clone())
            .attr("disabled", year <= min_yr && month == 1)
            .on_event("click", move |_e: Box<dyn EventData>| {
                let ny = if month == 1 { year - 1 } else { year };
                let nm = if month == 1 { 12 } else { month - 1 };
                if ny >= min_yr {
                    *cy_prev.write() = ny;
                    *cm_prev.write() = nm;
                }
            })
            .child(VNode::Text(VText::new("‹")))
    );

    let cy_prev2 = current_year.clone();
    let cm_prev2 = current_month.clone();
    let prev_btn2 = VNode::Element(
        VElement::new("button")
            .class(nav_btn_class.clone())
            .on_event("click", move |_e: Box<dyn EventData>| {
                let ny = if month == 1 { year - 1 } else { year };
                let nm = if month == 1 { 12 } else { month - 1 };
                if ny >= min_yr {
                    *cy_prev2.write() = ny;
                    *cm_prev2.write() = nm;
                }
            })
            .child(VNode::Text(VText::new("◀")))
    );

    let cy_today = current_year.clone();
    let cm_today = current_month.clone();
    let today_btn = VNode::Element(
        VElement::new("button")
            .class(nav_btn_class.clone())
            .on_event("click", move |_e: Box<dyn EventData>| {
                let (today_year, today_month) = get_current_date();
                if today_year >= min_yr && today_year <= props.max_year {
                    *cy_today.write() = today_year;
                    *cm_today.write() = today_month;
                }
            })
            .child(VNode::Text(VText::new("今天")))
    );

    let cy_next = current_year.clone();
    let cm_next = current_month.clone();
    let max_yr = props.max_year;
    let next_btn = VNode::Element(
        VElement::new("button")
            .class(nav_btn_class.clone())
            .on_event("click", move |_e: Box<dyn EventData>| {
                let ny = if month == 12 { year + 1 } else { year };
                let nm = if month == 12 { 1 } else { month + 1 };
                if ny <= max_yr {
                    *cy_next.write() = ny;
                    *cm_next.write() = nm;
                }
            })
            .child(VNode::Text(VText::new("▶")))
    );

    let cy_next2 = current_year.clone();
    let cm_next2 = current_month.clone();
    let next_btn2 = VNode::Element(
        VElement::new("button")
            .class(nav_btn_class.clone())
            .attr("disabled", year >= max_yr && month == 12)
            .on_event("click", move |_e: Box<dyn EventData>| {
                let ny = if month == 12 { year + 1 } else { year };
                let nm = if month == 12 { 1 } else { month + 1 };
                if ny <= max_yr {
                    *cy_next2.write() = ny;
                    *cm_next2.write() = nm;
                }
            })
            .child(VNode::Text(VText::new("›")))
    );

    let title_text = format!("{}年 {}", year, MONTH_NAMES[(month - 1) as usize]);

    // Combine all grid cells
    let mut all_day_cells = empty_cells;
    all_day_cells.extend(day_cells);

    rsx! {
        div {
            class: calendar_classes,
            style: props.style,
            div {
                class: cal_class,
                div {
                    class: header_class,
                    div {
                        class: nav_class,
                        {prev_btn}
                        {prev_btn2}
                        {today_btn}
                        {next_btn}
                        {next_btn2}
                    }
                    div {
                        class: title_class,
                        "{title_text}"
                    }
                }
                div {
                    class: weekdays_class,
                    ..weekday_headers
                }
                div {
                    class: grid_class,
                    ..all_day_cells
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
    padding: 1rem;
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.hi-calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding: 0.5rem;
}

.hi-calendar-nav {
    display: flex;
    gap: 0.25rem;
}

.hi-calendar-nav-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 0.5rem;
    background-color: var(--hi-color-bg-elevated);
    border: 1px solid var(--hi-color-border);
    border-radius: 4px;
    color: var(--hi-color-text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-calendar-nav-button:hover:not(:disabled) {
    background-color: var(--hi-color-primary);
    color: white;
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 8px var(--hi-color-primary-glow);
}

.hi-calendar-nav-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.hi-calendar-title {
    font-size: 1rem;
    font-weight: 500;
    color: var(--hi-color-text-primary);
}

.hi-calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
    margin-bottom: 0.5rem;
}

.hi-calendar-weekday {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--hi-color-text-secondary);
    padding: 0.5rem 0;
}

.hi-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
}

.hi-calendar-day-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.hi-calendar-day {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    color: var(--hi-color-text-primary);
    transition: all 0.2s ease;
}

.hi-calendar-day:hover {
    background-color: var(--hi-color-primary-bg);
    color: var(--hi-color-primary);
}

.hi-calendar-day.hi-calendar-day-selected {
    background-color: var(--hi-color-primary);
    color: white;
    box-shadow: 0 0 12px var(--hi-color-primary-glow);
}

.hi-calendar-day-today {
    border: 1px solid var(--hi-color-primary);
}

.hi-calendar-day-disabled {
    opacity: 0.3;
    cursor: not-allowed;
}
"#
    }

    fn name() -> &'static str {
        "calendar"
    }
}
