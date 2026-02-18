// packages/components/src/display/calendar.rs
// Calendar component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{CalendarClass, ClassesBuilder, UtilityClass};

use crate::styled::StyledComponent;

/// Get current year and month
fn get_current_date() -> (i32, u32) {
    #[cfg(target_arch = "wasm32")]
    {
        use js_sys::Date;
        let date = Date::new_0();
        let year = date.get_full_year() as i32;
        let month = (date.get_month() + 1) as u32;
        (year, month)
    }
    #[cfg(not(target_arch = "wasm32"))]
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

/// Calendar component type wrapper (for StyledComponent)
pub struct CalendarComponent;

/// Calendar component with Arknights + FUI styling
#[derive(Clone, PartialEq, Props)]
pub struct CalendarProps {
    #[props(default = 2026)]
    pub default_year: i32,

    #[props(default = 1)]
    pub default_month: u32,

    #[props(default)]
    pub on_date_select: Option<EventHandler<(i32, u32, u32)>>,

    #[props(default = 1970)]
    pub min_year: i32,

    #[props(default = 2100)]
    pub max_year: i32,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

impl Default for CalendarProps {
    fn default() -> Self {
        Self {
            default_year: 2026,
            default_month: 1,
            on_date_select: None,
            min_year: 1970,
            max_year: 2100,
            class: String::default(),
            style: String::default(),
        }
    }
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
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
];

const WEEKDAY_NAMES: [&str; 7] = ["日", "一", "二", "三", "四", "五", "六"];

#[component]
pub fn Calendar(props: CalendarProps) -> Element {
    let mut current_year = use_signal(|| props.default_year);
    let mut current_month = use_signal(|| props.default_month);
    let mut selected_day = use_signal(|| 1u32);

    let month = current_month();
    let year = current_year();

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

    let calendar_classes = ClassesBuilder::new()
        .add(CalendarClass::Calendar)
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{calendar_classes}",
            style: "{props.style}",

            div {
                class: "{cal_class}",

                div {
                    class: "{header_class}",

                    div {
                        class: "{nav_class}",

                        button {
                            class: "{nav_btn_class}",
                            disabled: year <= props.min_year && month == 1,
                            onclick: move |_| {
                                let ny = if month == 1 { year - 1 } else { year };
                                let nm = if month == 1 { 12 } else { month - 1 };
                                if ny >= props.min_year {
                                    *current_year.write() = ny;
                                    *current_month.write() = nm;
                                }
                            },
                            "‹"
                        }

                        button {
                            class: "{nav_btn_class}",
                            onclick: move |_| {
                                let ny = if month == 1 { year - 1 } else { year };
                                let nm = if month == 1 { 12 } else { month - 1 };
                                if ny >= props.min_year {
                                    *current_year.write() = ny;
                                    *current_month.write() = nm;
                                }
                            },
                            "◀"
                        }

                        button {
                            class: "{nav_btn_class}",
                            onclick: move |_| {
                                let (today_year, today_month) = get_current_date();
                                if today_year >= props.min_year && today_year <= props.max_year {
                                    *current_year.write() = today_year;
                                    *current_month.write() = today_month;
                                }
                            },
                            "今天"
                        }

                        button {
                            class: "{nav_btn_class}",
                            onclick: move |_| {
                                let ny = if month == 12 { year + 1 } else { year };
                                let nm = if month == 12 { 1 } else { month + 1 };
                                if ny <= props.max_year {
                                    *current_year.write() = ny;
                                    *current_month.write() = nm;
                                }
                            },
                            "▶"
                        }

                        button {
                            class: "{nav_btn_class}",
                            disabled: year >= props.max_year && month == 12,
                            onclick: move |_| {
                                let ny = if month == 12 { year + 1 } else { year };
                                let nm = if month == 12 { 1 } else { month + 1 };
                                if ny <= props.max_year {
                                    *current_year.write() = ny;
                                    *current_month.write() = nm;
                                }
                            },
                            "›"
                        }
                    }

                    div {
                        class: "{title_class}",
                        "{year}年 {MONTH_NAMES[(month - 1) as usize]}"
                    }
                }

                div {
                    class: "{weekdays_class}",
                    for weekday in WEEKDAY_NAMES {
                        div {
                            class: "{weekday_class}",
                            "{weekday}"
                        }
                    }
                }

                div {
                    class: "{grid_class}",

                    for _ in 0..first_day {
                        div {
                            class: "{day_cell_class}",
                        }
                    }

                    for day in 1..=days_count {
                        CalendarDayCell {
                            day,
                            year,
                            month,
                            selected_day: selected_day(),
                            onclick: move |d: u32| {
                                *selected_day.write() = d;
                                if let Some(ref cb) = props.on_date_select {
                                    cb.call((year, month, d));
                                }
                            },
                        }
                    }
                }
            }
        }
    }
}

#[derive(Clone, PartialEq, Props)]
struct CalendarDayCellProps {
    day: u32,
    year: i32,
    month: u32,
    selected_day: u32,
    onclick: EventHandler<u32>,
}

#[component]
fn CalendarDayCell(props: CalendarDayCellProps) -> Element {
    let day_cls = CalendarClass::CalendarDay.as_class();
    let day_sel_cls = CalendarClass::CalendarDaySelected.as_class();
    let cell_cls = CalendarClass::CalendarDayCell.as_class();

    let is_sel = props.selected_day == props.day;
    let day_classes = if is_sel {
        format!("{} {}", day_cls, day_sel_cls)
    } else {
        day_cls
    };

    rsx! {
        div {
            class: "{cell_cls}",
            onclick: move |_| props.onclick.call(props.day),
            div {
                class: "{day_classes}",
                "{props.day}"
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
