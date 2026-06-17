// packages/components/src/display/user_guide.rs
// UserGuide component

use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, TypedClass, UserGuideClass};
use tairitsu_vdom::events::MouseEvent;

use crate::basic::IconButton;
use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::utils::anim_helpers::run_ease_out;

pub struct UserGuideComponent;

const USER_GUIDE_ANIM_MS: f64 = 300.0;

#[derive(Clone, PartialEq, Debug)]
pub struct GuideStep {
    pub target: String,
    pub title: String,
    pub description: String,
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

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GuidePlacement {
    #[default]
    Top,
    Bottom,
    Left,
    Right,
}

/// Props for the UserGuide component.
#[define_props]
pub struct UserGuideProps {
    pub steps: Vec<GuideStep>,

    #[default]
    pub current: usize,

    #[default(true)]
    pub visible: bool,

    #[default(true)]
    pub show_progress: bool,

    #[default(true)]
    pub skippable: bool,

    #[default]
    pub class: String,

    pub on_step_change: Option<EventHandler<usize>>,

    pub on_finish: Option<EventHandler<()>>,

    pub on_skip: Option<EventHandler<()>>,
}

/// A step-by-step user guide overlay with navigation, progress dots, and skip support.
#[component]
pub fn UserGuide(props: UserGuideProps) -> Element {
    if !props.visible || props.steps.is_empty() {
        return VNode::empty();
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
        .add_typed(UserGuideClass::Container)
        .add_typed(placement_class)
        .add(&props.class)
        .build();

    let progress_signal = use_signal(|| 0.0_f64);

    {
        let sig = progress_signal.clone();
        use_effect(move || {
            run_ease_out(USER_GUIDE_ANIM_MS, 3, sig.clone());
        });
    }

    let progress = progress_signal.get();
    let guide_opacity = progress;
    let guide_translate_y = 8.0 * (1.0 - progress);
    let container_style =
        format!("opacity: {guide_opacity:.2}; transform: translateY({guide_translate_y:.1}px);");

    let handle_next = {
        let on_step_change = props.on_step_change.clone();
        let on_finish = props.on_finish.clone();
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
        EventHandler::new(move |_: MouseEvent| {
            if !is_first_step && let Some(handler) = on_step_change.as_ref() {
                handler.call(current_step - 1);
            }
        })
    };

    let handle_skip = {
        let on_skip = props.on_skip.clone();
        move |_| {
            if let Some(handler) = on_skip.as_ref() {
                handler.call(());
            }
        }
    };

    // Pre-compute values needed in rsx! blocks
    let counter_text = format!("{} / {}", current_step + 1, total_steps);
    let next_btn_class = format!(
        "{} {}",
        UserGuideClass::NavButton.class_name(),
        UserGuideClass::PrimaryButton.class_name()
    );

    // Pre-build progress dots as Vec<VNode>
    let progress_dots: Vec<VNode> = (0..total_steps)
        .map(|i| {
            let dot_class = if i == current_step {
                format!(
                    "{} {}",
                    UserGuideClass::ProgressDot.class_name(),
                    UserGuideClass::ProgressDotActive.class_name()
                )
            } else {
                UserGuideClass::ProgressDot.class_name().to_string()
            };
            rsx! {
                div { class: dot_class }
            }
        })
        .collect();

    // Build overlay and guide separately, then combine as fragment
    let overlay = rsx! {
        div { class: {UserGuideClass::Overlay.class_name()} }
    };

    let progress_section = if props.show_progress && total_steps > 1 {
        rsx! {
            div { class: {UserGuideClass::Progress.class_name()}, {VNode::Fragment(progress_dots)} }
        }
    } else {
        VNode::empty()
    };

    let guide_tooltip = rsx! {
        div { class: container_classes, style: container_style,
            // Arrow
            div { class: {UserGuideClass::Arrow.class_name()} }

            // Content
            div { class: {UserGuideClass::Content.class_name()},
                // Header with step counter
                div { class: {UserGuideClass::Header.class_name()},
                    span { class: {UserGuideClass::Title.class_name()}, "{step.title.clone()}" }
                    if props.show_progress {
                        span { class: {UserGuideClass::Counter.class_name()}, "{counter_text.clone()}" }
                    }
                }

                // Description
                div { class: {UserGuideClass::Description.class_name()}, "{step.description.clone()}" }

                // Footer with controls
                div { class: {UserGuideClass::Footer.class_name()},
                    // Skip button
                    if props.skippable {
                        button {
                            class: {UserGuideClass::SkipButton.class_name()},
                            onclick: handle_skip,
                            "Skip"
                        }
                    }

                    // Navigation
                    div { class: {UserGuideClass::Navigation.class_name()},
                        if !is_first_step {
                            IconButton {
                                icon: MdiIcon::ChevronLeft,
                                size: crate::basic::IconButtonSize::Small,
                                variant: crate::basic::IconButtonVariant::Ghost,
                                onclick: Some(handle_prev),
                            }
                        }

                        button {
                            class: {next_btn_class.clone()},
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
            {progress_section}
        }
    };

    VNode::Fragment(vec![overlay, guide_tooltip])
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
}

[data-theme="dark"] .hi-user-guide-container {
    background-color: var(--hi-surface);
    border-color: var(--hi-color-border);
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
