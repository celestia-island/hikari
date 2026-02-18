// display/carousel.rs
// Carousel component - Image/content slider with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{CarouselClass, ClassesBuilder, UtilityClass};

use crate::styled::StyledComponent;

/// CarouselComponent type wrapper
pub struct CarouselComponent;

/// Carousel indicator position
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CarouselIndicatorPosition {
    #[default]
    Bottom,
    Top,
    Left,
    Right,
}

/// Carousel variant
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CarouselIndicatorType {
    #[default]
    Dots,
    Line,
    Hidden,
}

/// Carousel props
#[derive(Props, Clone, PartialEq, Debug)]
pub struct CarouselProps {
    #[props(default)]
    pub children: Element,

    #[props(default = 5000)]
    pub autoplay: u64,

    #[props(default = true)]
    pub show_arrows: bool,

    #[props(default = CarouselIndicatorPosition::Bottom)]
    pub indicator_position: CarouselIndicatorPosition,

    #[props(default = CarouselIndicatorType::Dots)]
    pub indicator_type: CarouselIndicatorType,

    #[props(default = true)]
    pub show_pause: bool,

    #[props(default = false)]
    pub infinite: bool,

    #[props(default = false)]
    pub initial_paused: bool,
}

/// Carousel component - Image/content slider with navigation
#[component]
pub fn Carousel(props: CarouselProps) -> Element {
    let mut current_index = use_signal(|| 0);
    let is_paused = use_signal(|| props.initial_paused);
    let children_count = use_memo(move || {
        let mut count = 0;
        if let Some(children) = props.children.as_vnode() {
            if let dioxus::core::VNode::Fragment(fragment) = &*children {
                count = fragment.children.len();
            }
        }
        count
    });

    let total = children_count.read();

    let handle_prev = move |_| {
        if total == 0 {
            return;
        }
        let mut idx = current_index.write();
        *idx = if *idx == 0 { total - 1 } else { *idx - 1 };
    };

    let handle_next = move |_| {
        if total == 0 {
            return;
        }
        let mut idx = current_index.write();
        *idx = (*idx + 1) % total;
    };

    let handle_dot_click = move |index: usize| {
        *current_index.write() = index;
    };

    let toggle_pause = move |_| {
        *is_paused.write() = !is_paused();
    };

    let index_for_autoplay = current_index;
    use_effect(move || {
        if props.autoplay == 0 || is_paused() || total <= 1 {
            return;
        }

        let index_signal = index_for_autoplay;
        async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(props.autoplay)).await;
                if total == 0 {
                    break;
                }
                let mut idx = index_signal.write();
                *idx = (*idx + 1) % total;
            }
        }
    });

    let track_transform = format!(
        "transform: translateX(-{}%);",
        current_index() as f64 * 100.0
    );

    let indicator_classes = ClassesBuilder::new()
        .add(CarouselClass::Indicators)
        .add(match props.indicator_position {
            CarouselIndicatorPosition::Bottom | CarouselIndicatorPosition::Top => CarouselClass::IndicatorsDots,
            CarouselIndicatorPosition::Left | CarouselIndicatorPosition::Right => CarouselClass::IndicatorsHidden,
        })
        .add(match props.indicator_type {
            CarouselIndicatorType::Dots => CarouselClass::IndicatorsDots,
            CarouselIndicatorType::Line => CarouselClass::IndicatorsLine,
            CarouselIndicatorType::Hidden => CarouselClass::IndicatorsHidden,
        })
        .build();

    let prev_arrow_classes = ClassesBuilder::new()
        .add(CarouselClass::Arrow)
        .add(CarouselClass::ArrowPrev)
        .build();

    let next_arrow_classes = ClassesBuilder::new()
        .add(CarouselClass::Arrow)
        .add(CarouselClass::ArrowNext)
        .build();

    rsx! {
        div {
            class: "{CarouselClass::Container.as_class()}",
            
            // Track
            div {
                class: "{CarouselClass::Track.as_class()}",
                style: "{track_transform}",
                {props.children}
            }

            // Navigation arrows
            if props.show_arrows {
                button {
                    class: "{prev_arrow_classes}",
                    onclick: handle_prev,
                    disabled: total <= 1,
                    "‹"
                }

                button {
                    class: "{next_arrow_classes}",
                    onclick: handle_next,
                    disabled: total <= 1,
                    "›"
                }
            }

            // Indicator dots
            if props.indicator_type != CarouselIndicatorType::Hidden && total > 1 {
                div {
                    class: "{indicator_classes}",
                    for i in 0..total {
                        {
                            let dot_classes = ClassesBuilder::new()
                                .add(CarouselClass::Dot)
                                .add_if(CarouselClass::DotActive, move || i == current_index())
                                .build();

                            rsx! {
                                button {
                                    class: "{dot_classes}",
                                    onclick: move |_| handle_dot_click(i),
                                    aria_label: format!("Slide {}", i + 1),
                                    disabled: total <= 1,
                                }
                            }
                        }
                    }
                }
            }

            // Pause button
            if props.show_pause && props.autoplay > 0 && total > 1 {
                button {
                    class: "{CarouselClass::Pause.as_class()}",
                    onclick: toggle_pause,
                    aria_label: if is_paused() { "Play" } else { "Pause" },
                    if is_paused() { "▶" } else { "⏸" }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_carousel_indicator_position_default() {
        let position = CarouselIndicatorPosition::default();
        assert_eq!(position, CarouselIndicatorPosition::Bottom);
    }

    #[test]
    fn test_carousel_indicator_type_default() {
        let indicator = CarouselIndicatorType::default();
        assert_eq!(indicator, CarouselIndicatorType::Dots);
    }

    #[test]
    fn test_carousel_indicator_position_variants() {
        assert!(matches!(CarouselIndicatorPosition::Bottom, _));
        assert!(matches!(CarouselIndicatorPosition::Top, _));
        assert!(matches!(CarouselIndicatorPosition::Left, _));
        assert!(matches!(CarouselIndicatorPosition::Right, _));
    }

    #[test]
    fn test_carousel_indicator_type_variants() {
        assert!(matches!(CarouselIndicatorType::Dots, _));
        assert!(matches!(CarouselIndicatorType::Line, _));
        assert!(matches!(CarouselIndicatorType::Hidden, _));
    }

    #[test]
    fn test_carousel_props_default() {
        let props = CarouselProps::default();
        assert_eq!(props.autoplay, 5000);
        assert!(props.show_arrows);
        assert_eq!(props.indicator_position, CarouselIndicatorPosition::Bottom);
        assert_eq!(props.indicator_type, CarouselIndicatorType::Dots);
        assert!(props.show_pause);
        assert!(!props.infinite);
        assert!(!props.initial_paused);
    }

    #[test]
    fn test_carousel_props_clone() {
        let props = CarouselProps {
            autoplay: 3000,
            show_arrows: false,
            indicator_position: CarouselIndicatorPosition::Top,
            indicator_type: CarouselIndicatorType::Line,
            show_pause: false,
            infinite: true,
            initial_paused: true,
            children: VNode::empty(),
        };

        let cloned = props.clone();
        assert_eq!(cloned.autoplay, 3000);
        assert_eq!(cloned.infinite, true);
    }

    #[test]
    fn test_carousel_props_partial_eq() {
        let props1 = CarouselProps {
            autoplay: 5000,
            show_arrows: true,
            indicator_position: CarouselIndicatorPosition::Bottom,
            indicator_type: CarouselIndicatorType::Dots,
            show_pause: true,
            infinite: false,
            initial_paused: false,
            children: VNode::empty(),
        };

        let props2 = CarouselProps {
            autoplay: 5000,
            show_arrows: true,
            indicator_position: CarouselIndicatorPosition::Bottom,
            indicator_type: CarouselIndicatorType::Dots,
            show_pause: true,
            infinite: false,
            initial_paused: false,
            children: VNode::empty(),
        };

        assert_eq!(props1, props2);
    }

    #[test]
    fn test_carousel_props_not_equal() {
        let props1 = CarouselProps {
            autoplay: 1000,
            show_arrows: false,
            ..Default::default()
        };

        let props2 = CarouselProps {
            autoplay: 2000,
            show_arrows: false,
            ..Default::default()
        };

        assert_ne!(props1, props2);
    }
}

impl StyledComponent for CarouselComponent {
    fn styles() -> &'static str {
        r#"
.hi-carousel {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: 8px;
    background-color: var(--hi-color-bg-container);
}

[data-theme="dark"] .hi-carousel {
    background-color: var(--hi-surface);
}

.hi-carousel-track {
    display: flex;
    transition: transform 0.3s ease-in-out;
}

.hi-carousel-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    z-index: 10;
}

.hi-carousel-arrow:hover {
    background-color: rgba(0, 0, 0, 0.7);
}

.hi-carousel-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.hi-carousel-arrow-prev {
    left: 16px;
}

.hi-carousel-arrow-next {
    right: 16px;
}

.hi-carousel-indicators {
    position: absolute;
    display: flex;
    gap: 8px;
    z-index: 10;
}

.hi-carousel-indicators-dots {
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
}

.hi-carousel-indicators-line {
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background-color: rgba(0, 0, 0, 0.2);
}

.hi-carousel-indicators-hidden {
    display: none;
}

.hi-carousel-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.5);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-carousel-dot:hover {
    background-color: rgba(255, 255, 255, 0.8);
}

.hi-carousel-dot-active {
    background-color: var(--hi-color-primary);
    transform: scale(1.2);
}

.hi-carousel-pause {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    z-index: 10;
}

.hi-carousel-pause:hover {
    background-color: rgba(0, 0, 0, 0.7);
}
"#
    }

    fn name() -> &'static str {
        "carousel"
    }
}
