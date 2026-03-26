//! Animation examples page
//!
//! Demonstrates various animation capabilities of the hikari-animation system
//! including hover effects, focus animations, and state transitions.

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

fn txt(s: &str) -> VNode {
    use tairitsu_vdom::VText;
    VNode::Text(VText::new(s))
}

// Import UI components at module level for use in functions
use crate::ui::{self, Button, Card, Input};
use crate::animation::AnimationId;

/// Render the animation examples page
pub fn render() -> VNode {
    rsx! {
        div { id: "page-animations", class: "hikari-page",
            // Page header
            div { class: "page-header",
                h1 { class: "page-header__title", "Animation Examples" }
                p { class: "page-header__subtitle",
                    "Interactive demonstrations of Hikari's animation system"
                }
            }

            // Hover animations section
            div { class: "page-section",
                h2 { "Hover Animations" }
                p { "Move your mouse over these elements to see hover effects." }

                div { class: "demo-grid",
                    // Hover scale button
                    div { class: "demo-item",
                        div { class: "demo-item__label", "Hover Scale" }
                        { Button::new()
                            .text("Hover Me")
                            .animation(AnimationId::HoverScale)
                            .build() }
                    }

                    // Hover glow button
                    div { class: "demo-item",
                        div { class: "demo-item__label", "Hover Glow" }
                        { Button::new()
                            .text("Hover Me")
                            .animation(AnimationId::HoverGlow)
                            .build() }
                    }

                    // Hover lift card
                    div { class: "demo-item",
                        div { class: "demo-item__label", "Hover Lift" }
                        { Card::new()
                            .title("Hover Card")
                            .body("This card lifts up on hover")
                            .animation(AnimationId::HoverLift)
                            .build() }
                    }

                    // Hover shine button
                    div { class: "demo-item",
                        div { class: "demo-item__label", "Hover Shine" }
                        { Button::new()
                            .text("Hover Me")
                            .animation(AnimationId::HoverShine)
                            .variant(ui::ButtonVariant::Secondary)
                            .build() }
                    }
                }
            }

            // Focus animations section
            div { class: "page-section",
                h2 { "Focus Animations" }
                p { "Tab to or click on these inputs to see focus effects." }

                div { class: "demo-row",
                    // Focus pulse input
                    div { class: "demo-item-inline",
                        div { class: "demo-item__label", "Focus Pulse" }
                        { Input::new()
                            .placeholder("Focus me...")
                            .animation(AnimationId::FocusPulse)
                            .build() }
                    }

                    // Focus glow input
                    div { class: "demo-item-inline",
                        div { class: "demo-item__label", "Focus Glow" }
                        { Input::new()
                            .placeholder("Focus me...")
                            .animation(AnimationId::FocusGlow)
                            .build() }
                    }

                    // Focus border input
                    div { class: "demo-item-inline",
                        div { class: "demo-item__label", "Focus Border" }
                        { Input::new()
                            .placeholder("Focus me...")
                            .animation(AnimationId::FocusBorder)
                            .build() }
                    }
                }
            }

            // State transition animations section
            div { class: "page-section",
                h2 { "State Transitions" }
                p { "Click and interact with these buttons to see state transitions." }

                div { class: "demo-row",
                    // Press scale button
                    div { class: "demo-item-inline",
                        div { class: "demo-item__label", "Press Scale" }
                        { Button::new()
                            .text("Press Me")
                            .animation(AnimationId::PressScale)
                            .build() }
                    }

                    // Press glow button
                    div { class: "demo-item-inline",
                        div { class: "demo-item__label", "Press Glow" }
                        { Button::new()
                            .text("Press Me")
                            .animation(AnimationId::PressGlow)
                            .variant(ui::ButtonVariant::Danger)
                            .build() }
                    }
                }
            }

            // Continuous animations section
            div { class: "page-section",
                h2 { "Continuous Animations" }
                p { "These animations run continuously without interaction." }

                div { class: "demo-grid",
                    // Breathing card
                    div { class: "demo-item",
                        div { class: "demo-item__label", "Breathing" }
                        div {
                            class: "card hikari-anim--breathing",
                            h3 { class: "card__title", "Breathing Card" }
                            p { class: "card__body", "This card has a subtle breathing animation" }
                        }
                    }

                    // Pulse card
                    div { class: "demo-item",
                        div { class: "demo-item__label", "Pulse" }
                        div {
                            class: "card hikari-anim--pulse",
                            h3 { class: "card__title", "Pulse Card" }
                            p { class: "card__body", "This card pulses continuously" }
                        }
                    }

                    // Shimmer card
                    div { class: "demo-item",
                        div { class: "demo-item__label", "Shimmer" }
                        div {
                            class: "card hikari-anim--shimmer",
                            h3 { class: "card__title", "Shimmer Card" }
                            p { class: "card__body", "This card has a shimmer effect" }
                        }
                    }
                }
            }

            // Interactive demo section
            div { class: "page-section",
                h2 { "Interactive Demo: Animated Form" }
                p { "A complete form example with various animations applied." }

                div { class: "demo-form",
                    div { class: "demo-form__field",
                        label { class: "demo-form__label", "Name" }
                        { Input::new()
                            .placeholder("Enter your name")
                            .animation(AnimationId::FocusGlow)
                            .build() }
                    }

                    div { class: "demo-form__field",
                        label { class: "demo-form__label", "Email" }
                        { Input::new()
                            .input_type(ui::InputType::Email)
                            .placeholder("Enter your email")
                            .animation(AnimationId::FocusPulse)
                            .build() }
                    }

                    div { class: "demo-form__field",
                        label { class: "demo-form__label", "Message" }
                        textarea {
                            class: "hi-input hikari-anim--focus-glow",
                            placeholder: "Enter your message",
                            rows: "4",
                        }
                    }

                    div { class: "demo-form__actions",
                        { Button::new()
                            .text("Cancel")
                            .variant(ui::ButtonVariant::Ghost)
                            .animation(AnimationId::HoverScale)
                            .build() }
                        { Button::new()
                            .text("Submit")
                            .variant(ui::ButtonVariant::Primary)
                            .animation(AnimationId::HoverGlow)
                            .build() }
                    }
                }
            }

            // Code examples section
            div { class: "page-section",
                h2 { "Usage Examples" }

                h3 { "Rust API" }
                pre { class: "code-block",
                    code { r#"use crate::ui::{Button, AnimationId};

// Create a button with hover scale animation
let button = Button::new()
    .text("Click Me")
    .animation(AnimationId::HoverScale)
    .build();"# }
                }

                h3 { "HTML Attributes" }
                pre { class: "code-block",
                    code { r#"<!-- Add animation via data attribute -->
<button class="hi-btn hi-btn--primary"
        data-animation="hover-scale">
    Hover Me
</button>

<!-- Input with focus animation -->
<input class="hi-input"
       placeholder="Focus me..."
       data-animation="focus-glow" />"# }
                }

                h3 { "CSS Classes" }
                pre { class: "code-block",
                    code { r#"/* Apply animation via CSS class */
.card.hikari-anim--hover-lift {
    /* Hover lift animation applied */
}

.card.hikari-anim--breathing {
    /* Continuous breathing animation */
}"# }
                }
            }
        }
    }
}
