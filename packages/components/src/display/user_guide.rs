// packages/components/src/display/user_guide.rs
// UserGuide component with Arknights + FUI styling

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, UserGuideClass, UtilityClass};

use crate::styled::StyledComponent;

/// UserGuide component type wrapper (for StyledComponent)
pub struct UserGuideComponent;

/// Single guide step
#[derive(Clone, PartialEq, Debug)]
pub struct GuideStep {
    /// Target element selector (CSS selector)
    pub target: String,
    /// Step title
    pub title: String,
    /// Step description
    pub description: String,
    /// Optional placement
    pub placement: GuidePlacement,
}

impl Default for GuideStep {
    fn default() -> Self {
        Self {
            target: String::new(),
            title: String::new(),
            description: String::new(),
            placement: GuidePlacement::Bottom,
        }
    }
}

/// Guide tooltip placement
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GuidePlacement {
    #[default]
    Top,
    Bottom,
    Left,
    Right,
}

/// UserGuide component props
#[derive(Clone, PartialEq, Props)]
pub struct UserGuideProps {
    /// Guide steps
    pub steps: Vec<GuideStep>,

    /// Current step index (0-based)
    #[props(default)]
    pub current: usize,

    /// Whether guide is visible
    #[props(default = true)]
    pub visible: bool,

    /// Show progress indicator
    #[props(default = true)]
    pub show_progress: bool,

    /// Allow skipping the guide
    #[props(default = true)]
    pub skippable: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Callback when step changes
    pub on_step_change: Option<EventHandler<usize>>,

    /// Callback when guide completes
    pub on_finish: Option<EventHandler<()>>,

    /// Callback when guide is skipped
    pub on_skip: Option<EventHandler<()>>,
}

/// UserGuide component - Step-by-step user onboarding
///
/// A guide component for introducing new features to users.
/// Displays tooltips with navigation controls.
#[component]
pub fn UserGuide(props: UserGuideProps) -> Element {
    if !props.visible || props.steps.is_empty() {
        return rsx! {};
    }

    let current_step = props.current.min(props.steps.len() - 1);
    let total_steps = props.steps.len();
    let is_last_step = current_step == total_steps - 1;
    let is_first_step = current_step == 0;

    let step = &props.steps[current_step];

    let placement_class = match step.placement {
        GuidePlacement::Top => UserGuideClass::PlacementTop,
        GuidePlacement::Bottom => UserGuideClass::PlacementBottom,
        GuidePlacement::Left => UserGuideClass::PlacementLeft,
        GuidePlacement::Right => UserGuideClass::PlacementRight,
    };

    let container_classes = ClassesBuilder::new()
        .add(UserGuideClass::Container)
        .add(placement_class)
        .add_raw(&props.class)
        .build();

    let handle_next = {
        let on_step_change = props.on_step_change.clone();
        let on_finish = props.on_finish.clone();
        let _total = total_steps;
        move |_| {
            if is_last_step {
                if let Some(handler) = on_finish.as_ref() {
                    handler.call(());
                }
            } else if let Some(handler) = on_step_change.as_ref() {
                handler.call(current_step + 1);
            }
        }
    };

    let handle_prev = {
        let on_step_change = props.on_step_change.clone();
        move |_| {
            if !is_first_step {
                if let Some(handler) = on_step_change.as_ref() {
                    handler.call(current_step - 1);
                }
            }
        }
    };

    let handle_skip = {
        let on_skip = props.on_skip.clone();
        move |_| {
            if let Some(handler) = on_skip.as_ref() {
                handler.call(());
            }
        }
    };

    rsx! {
        // Overlay mask
        div { class: "{UserGuideClass::Overlay.as_class()}" }

        // Guide tooltip
        div { class: "{container_classes}",
            // Arrow
            div { class: "{UserGuideClass::Arrow.as_class()}" }

            // Content
            div { class: "{UserGuideClass::Content.as_class()}",
                // Header with step counter
                div { class: "{UserGuideClass::Header.as_class()}",
                    span { class: "{UserGuideClass::Title.as_class()}",
                        "{step.title}"
                    }
                    if props.show_progress {
                        span { class: "{UserGuideClass::Counter.as_class()}",
                            "{current_step + 1} / {total_steps}"
                        }
                    }
                }

                // Description
                div { class: "{UserGuideClass::Description.as_class()}",
                    "{step.description}"
                }

                // Footer with controls
                div { class: "{UserGuideClass::Footer.as_class()}",
                    // Skip button
                    if props.skippable {
                        button {
                            class: "{UserGuideClass::SkipButton.as_class()}",
                            onclick: handle_skip,
                            "Skip"
                        }
                    }

                    // Navigation
                    div { class: "{UserGuideClass::Navigation.as_class()}",
                        if !is_first_step {
                            button {
                                class: "{UserGuideClass::NavButton.as_class()}",
                                onclick: handle_prev,
                                Icon { icon: MdiIcon::ChevronLeft, size: 18 }
                            }
                        }

                        button {
                            class: "{UserGuideClass::NavButton.as_class()} {UserGuideClass::PrimaryButton.as_class()}",
                            onclick: handle_next,
                            if is_last_step {
                                "Finish"
                            } else {
                                "Next"
                            }
                            if !is_last_step {
                                Icon { icon: MdiIcon::ChevronRight, size: 18 }
                            }
                        }
                    }
                }
            }

            // Progress dots
            if props.show_progress && total_steps > 1 {
                div { class: "{UserGuideClass::Progress.as_class()}",
                    for i in 0..total_steps {
                        div {
                            class: if i == current_step {
                                "{UserGuideClass::ProgressDot.as_class()} {UserGuideClass::ProgressDotActive.as_class()}"
                            } else {
                                "{UserGuideClass::ProgressDot.as_class()}"
                            },
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for UserGuideComponent {
    fn styles() -> &'static str {
        r#"
.hi-user-guide-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.45);
    z-index: 1000;
    pointer-events: none;
}

.hi-user-guide-container {
    position: fixed;
    z-index: 1001;
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 320px;
    animation: hi-user-guide-fade-in 0.3s ease;
}

[data-theme="dark"] .hi-user-guide-container {
    background-color: var(--hi-surface);
    border-color: var(--hi-color-border);
}

@keyframes hi-user-guide-fade-in {
    from {
        opacity: 0;
        transform: translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.hi-user-guide-arrow {
    position: absolute;
    width: 12px;
    height: 12px;
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-right: none;
    border-bottom: none;
    transform: rotate(45deg);
}

[data-theme="dark"] .hi-user-guide-arrow {
    background-color: var(--hi-surface);
}

.hi-user-guide-placement-top .hi-user-guide-arrow {
    bottom: -7px;
    left: 50%;
    transform: translateX(-50%) rotate(-135deg);
}

.hi-user-guide-placement-bottom .hi-user-guide-arrow {
    top: -7px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
}

.hi-user-guide-placement-left .hi-user-guide-arrow {
    right: -7px;
    top: 50%;
    transform: translateY(-50%) rotate(135deg);
}

.hi-user-guide-placement-right .hi-user-guide-arrow {
    left: -7px;
    top: 50%;
    transform: translateY(-50%) rotate(-45deg);
}

.hi-user-guide-content {
    padding: 16px;
}

.hi-user-guide-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.hi-user-guide-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--hi-text-primary);
}

.hi-user-guide-counter {
    font-size: 12px;
    color: var(--hi-text-secondary);
    background-color: var(--hi-color-bg-elevated);
    padding: 2px 8px;
    border-radius: 10px;
}

.hi-user-guide-description {
    font-size: 14px;
    color: var(--hi-text-secondary);
    line-height: 1.6;
    margin-bottom: 16px;
}

.hi-user-guide-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.hi-user-guide-skip-button {
    background: transparent;
    border: none;
    color: var(--hi-text-secondary);
    font-size: 14px;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 6px;
    transition: all 0.2s ease;
}

.hi-user-guide-skip-button:hover {
    background-color: var(--hi-color-hover);
    color: var(--hi-text-primary);
}

.hi-user-guide-navigation {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
}

.hi-user-guide-nav-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--hi-color-border);
    background-color: transparent;
    color: var(--hi-text-primary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-user-guide-nav-button:hover {
    background-color: var(--hi-color-hover);
}

.hi-user-guide-primary-button {
    background-color: var(--hi-color-primary);
    border-color: var(--hi-color-primary);
    color: white;
}

.hi-user-guide-primary-button:hover {
    background-color: var(--hi-color-primary-hover);
    border-color: var(--hi-color-primary-hover);
}

.hi-user-guide-progress {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px 12px;
}

.hi-user-guide-progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--hi-color-border);
    transition: all 0.2s ease;
}

.hi-user-guide-progress-dot-active {
    background-color: var(--hi-color-primary);
    transform: scale(1.25);
}
"#
    }

    fn name() -> &'static str {
        "user-guide"
    }
}
