// hi-extra-components/src/extra/user_guide.rs
// UserGuide component with Arknights + FUI styling

use dioxus::prelude::*;
use hikari_components::{Badge, Button, ButtonVariant};

/// UserGuide component type wrapper
pub struct UserGuideComponent;

/// Guide step position
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GuidePosition {
    #[default]
    Center,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

#[derive(Clone, PartialEq, Props)]
pub struct GuideStep {
    /// Step title
    #[props(into)]
    pub title: String,

    /// Step description
    #[props(into)]
    pub description: String,

    /// Step icon (optional emoji or SVG)
    #[props(into, default)]
    pub icon: String,

    /// Whether step is completed
    #[props(default)]
    pub completed: bool,

    /// Step content to highlight (CSS selector)
    #[props(into, default)]
    pub target_selector: String,
}

#[derive(Clone, PartialEq, Props)]
pub struct UserGuideProps {
    /// Guide title
    #[props(into)]
    pub title: String,

    /// Guide description
    #[props(into)]
    pub description: String,

    /// Guide steps
    #[props(into)]
    pub steps: Vec<GuideStep>,

    /// Whether to show guide
    #[props(default)]
    pub visible: bool,

    /// Guide position
    #[props(default)]
    pub position: GuidePosition,

    /// Whether to allow skip
    #[props(default = true)]
    pub allow_skip: bool,

    /// Whether to allow close
    #[props(default = true)]
    pub allow_close: bool,

    /// Callback when guide is dismissed
    #[props(default)]
    pub on_dismiss: EventHandler<()>,
}

impl Default for UserGuideProps {
    fn default() -> Self {
        Self {
            title: String::new(),
            description: String::new(),
            steps: Vec::new(),
            visible: false,
            position: GuidePosition::default(),
            allow_skip: true,
            allow_close: true,
            on_dismiss: EventHandler::new(|_| {}),
        }
    }
}

/// UserGuide component
///
/// Provides step-by-step user onboarding with highlighting of target elements.
/// Supports multiple steps, completion tracking, and dismissible guides.
///
/// # Example
///
/// ```rust,ignore
/// use hikari_extra_components::UserGuide;
///
/// rsx! {
///     UserGuide {
///         title: "Welcome to Hikari!",
///         description: "Let's get you started with a quick tour.",
///         steps: vec![
///             GuideStep {
///                 title: "Step 1",
///                 description: "Learn about components",
///                 icon: "🎨",
///                 target_selector: ".hi-button",
///             }
///         ],
///         visible: true,
///     }
/// }
/// ```
#[component]
pub fn UserGuide(props: UserGuideProps) -> Element {
    let mut current_step = use_signal(|| 0);
    let mut show_guide = use_signal(|| props.visible);

    let total_steps = props.steps.len();
    let current_step_data = props.steps.get(current_step()).cloned();

    let next_step = move |_| {
        if current_step() < total_steps - 1 {
            current_step.set(current_step() + 1);
        } else {
            show_guide.set(false);
        }
    };

    let prev_step = move |_| {
        if current_step() > 0 {
            current_step.set(current_step() - 1);
        }
    };

    let dismiss = move |_| {
        show_guide.set(false);
        props.on_dismiss.call(());
    };

    let position_class = match props.position {
        GuidePosition::Center => "hi-user-guide-position-center",
        GuidePosition::TopLeft => "hi-user-guide-position-top-left",
        GuidePosition::TopRight => "hi-user-guide-position-top-right",
        GuidePosition::BottomLeft => "hi-user-guide-position-bottom-left",
        GuidePosition::BottomRight => "hi-user-guide-position-bottom-right",
    };

    // Pre-compute conditional values to avoid Signal dereferencing in rsx!
    let step = current_step();
    let show_previous = step > 0;
    let is_last_step = step >= total_steps - 1;
    let progress_count = (step + 1) as i32;

    rsx! {
        if show_guide() {
            if let Some(step_data) = current_step_data {
                div {
                    class: format!("hi-user-guide {}", position_class),

                    // Backdrop
                    div {
                        class: "hi-user-guide-backdrop",
                        onclick: dismiss
                    }

                    // Guide content
                    div {
                        class: "hi-user-guide-content",

                        // Header
                        div {
                            class: "hi-user-guide-header",

                            // Close button
                            if props.allow_close {
                                button {
                                    class: "hi-user-guide-close",
                                    onclick: dismiss,
                                    "×"
                                }
                            }

                            // Title
                            h3 {
                                class: "hi-user-guide-title",
                                "{props.title}"
                            }

                            // Progress badge
                            Badge {
                                count: Some(progress_count),
                            }
                        }

                        // Description
                        p {
                            class: "hi-user-guide-description",
                            "{props.description}"
                        }

                        // Step icon
                        div {
                            class: "hi-user-guide-icon",
                            "{step_data.icon}"
                        }

                        // Step content
                        div {
                            class: "hi-user-guide-step",

                            // Step title
                            h4 {
                                class: "hi-user-guide-step-title",
                                "{step_data.title}"
                            }

                            // Step description
                            p {
                                class: "hi-user-guide-step-description",
                                "{step_data.description}"
                            }
                        }

                        // Navigation buttons
                        div {
                            class: "hi-user-guide-navigation",

                            // Previous button
                            if show_previous {
                                Button {
                                    variant: ButtonVariant::Secondary,
                                    onclick: prev_step,
                                    "Previous"
                                }
                            }

                             // Next/Finish button
                            Button {
                                variant: ButtonVariant::Primary,
                                onclick: next_step,
                             if is_last_step {
                                 "Finish"
                                } else {
                                    "Next"
                                }
                            }

                            // Skip button
                            if props.allow_skip {
                                Button {
                                    variant: ButtonVariant::Ghost,
                                    onclick: dismiss,
                                    "Skip"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

impl UserGuideComponent {
    pub fn styles() -> &'static str {
        r#"
.hi-user-guide {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.hi-user-guide-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  pointer-events: auto;
}

.hi-user-guide-content {
  position: relative;
  pointer-events: auto;
  background-color: var(--hi-color-surface, #ffffff);
  border: 1px solid var(--hi-color-border, #e0e0e0);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  padding: 1.5rem;
  animation: hi-user-guide-slide-in 0.3s ease-out;
}

.hi-user-guide-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--hi-color-border, #e0e0e0);
}

.hi-user-guide-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--hi-color-text-secondary, #666);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.hi-user-guide-close:hover {
  background-color: var(--hi-color-background-hover, #f5f5f5);
  color: var(--hi-color-text-primary, #333);
}

.hi-user-guide-title {
  flex: 1;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--hi-color-text-primary, #333);
}

.hi-user-guide-description {
  margin: 0 0 1.5rem 0;
  font-size: 0.875rem;
  color: var(--hi-color-text-secondary, #666);
  line-height: 1.5;
}

.hi-user-guide-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  font-size: 3rem;
  margin-bottom: 1.5rem;
  border-radius: 50%;
  background-color: var(--hi-color-primary-alpha10, rgba(0, 160, 233, 0.1));
  border: 2px solid var(--hi-color-primary, #00A0E9);
}

.hi-user-guide-step {
  margin-bottom: 1.5rem;
}

.hi-user-guide-step-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--hi-color-text-primary, #333);
}

.hi-user-guide-step-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--hi-color-text-secondary, #666);
  line-height: 1.5;
}

.hi-user-guide-navigation {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.hi-user-guide-position-center {
  align-items: center;
  justify-content: center;
}

.hi-user-guide-position-top-left {
  align-items: flex-start;
  justify-content: flex-start;
}

.hi-user-guide-position-top-right {
  align-items: flex-start;
  justify-content: flex-end;
}

.hi-user-guide-position-bottom-left {
  align-items: flex-end;
  justify-content: flex-start;
}

.hi-user-guide-position-bottom-right {
  align-items: flex-end;
  justify-content: flex-end;
}

@keyframes hi-user-guide-slide-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

[data-theme="tairitsu"] {
  .hi-user-guide-content {
    background-color: #1a1a1a;
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  }

  .hi-user-guide-header {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  .hi-user-guide-title {
    color: rgba(255, 255, 255, 0.95);
  }

  .hi-user-guide-description {
    color: rgba(255, 255, 255, 0.7);
  }

  .hi-user-guide-icon {
    background-color: var(--hi-color-primary-alpha20, rgba(26, 35, 126, 0.2));
    border-color: #1a237e;
  }

  .hi-user-guide-step-title {
    color: rgba(255, 255, 255, 0.95);
  }

  .hi-user-guide-step-description {
    color: rgba(255, 255, 255, 0.7);
  }

  .hi-user-guide-close {
    color: rgba(255, 255, 255, 0.6);
  }

  .hi-user-guide-close:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.95);
  }
}

.hi-user-guide-icon {
  box-shadow: 0 0 30px var(--hi-color-primary-glow, rgba(0, 160, 233, 0.2));
}

[data-theme="tairitsu"] .hi-user-guide-icon {
  box-shadow: 0 0 30px rgba(26, 35, 126, 0.3);
}
"#
    }

    pub fn name() -> &'static str {
        "user_guide"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guide_position() {
        let center = GuidePosition::Center;
        assert_eq!(center, GuidePosition::default());
    }

    #[test]
    fn test_user_guide_name() {
        assert_eq!(UserGuideComponent::name(), "user_guide");
    }
}
