//! Animation examples page
//!
//! Demonstrates various animation capabilities of the hikari-animation system
//! including hover effects, focus animations, state transitions, and interactive
//! preset demos for glow, neon, tech, and transition effects.

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

use crate::{animation::AnimationId, components::demo_page::{render_demo_page, render_demo_row}, ui::{Button, Card, Input, self}};

pub fn render() -> VNode {
    render_demo_page("page-animations", "Animation Examples", "Interactive demonstrations of Hikari's animation system",
        rsx! {
            {rsx! {
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

                { render_demo_row(rsx! {
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
                }) }
            }

            // State transition animations section
            div { class: "page-section",
                h2 { "State Transitions" }
                p { "Click and interact with these buttons to see state transitions." }

                { render_demo_row(rsx! {
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
                }) }
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
<button class="hi-button hi-button-primary"
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

            // ── Interactive Preset Demos ─────────────────────────────

            div { class: "page-section preset-demo-section",
                h2 { "Preset Demos" }
                p { "Interactive animation presets from the Hikari animation system. Click to start/stop each effect." }

                // Glow Effects
                h3 { "Glow Effects" }
                p { class: "preset-demo-subtitle",
                    "Glow animations: pulse, breathe, and shimmer."
                }
                div { class: "preset-demo-controls",
                    button {
                        class: "preset-demo-btn preset-demo-btn--primary",
                        "data-anim-group": "glow",
                        "data-anim-class": "hikari-anim--pulse",
                        "data-anim-target": "glow-target",
                        r#type: "button",
                        "Pulse"
                    }
                    button {
                        class: "preset-demo-btn preset-demo-btn--secondary",
                        "data-anim-group": "glow",
                        "data-anim-class": "hikari-anim--breathing",
                        "data-anim-target": "glow-target",
                        r#type: "button",
                        "Breathe"
                    }
                    button {
                        class: "preset-demo-btn preset-demo-btn--ghost",
                        "data-anim-group": "glow",
                        "data-anim-class": "hikari-anim--shimmer",
                        "data-anim-target": "glow-target",
                        r#type: "button",
                        "Shimmer"
                    }
                }
                div { id: "glow-target",
                    class: "preset-demo-target preset-demo-target--glow",
                    "Glow Element"
                }
            }

            div { class: "page-section preset-demo-section",
                // Neon Effects
                h3 { "Neon Effects" }
                p { class: "preset-demo-subtitle",
                    "Retro neon sign effects: flicker, buzz, and scanline."
                }
                div { class: "preset-demo-controls",
                    button {
                        class: "preset-demo-btn preset-demo-btn--primary",
                        "data-anim-group": "neon",
                        "data-anim-class": "hikari-anim--neon-flicker",
                        "data-anim-target": "neon-target",
                        r#type: "button",
                        "Flicker"
                    }
                    button {
                        class: "preset-demo-btn preset-demo-btn--secondary",
                        "data-anim-group": "neon",
                        "data-anim-class": "hikari-anim--neon-buzz",
                        "data-anim-target": "neon-target",
                        r#type: "button",
                        "Buzz"
                    }
                    button {
                        class: "preset-demo-btn preset-demo-btn--ghost",
                        "data-anim-group": "neon",
                        "data-anim-class": "hikari-anim--neon-scanline",
                        "data-anim-target": "neon-target",
                        r#type: "button",
                        "Scanline"
                    }
                }
                div { id: "neon-target",
                    class: "preset-demo-target preset-demo-target--neon",
                    "Neon Element"
                }
            }

            div { class: "page-section preset-demo-section",
                // Tech Effects
                h3 { "Tech Effects" }
                p { class: "preset-demo-subtitle",
                    "Cyberpunk-inspired tech effects: glitch, typing, and data flow."
                }
                div { class: "preset-demo-controls",
                    button {
                        class: "preset-demo-btn preset-demo-btn--primary",
                        "data-anim-group": "tech",
                        "data-anim-class": "hikari-anim--tech-glitch",
                        "data-anim-target": "tech-target",
                        r#type: "button",
                        "Glitch"
                    }
                    button {
                        class: "preset-demo-btn preset-demo-btn--secondary",
                        "data-anim-group": "tech",
                        "data-anim-class": "hikari-anim--tech-typing",
                        "data-anim-target": "tech-target",
                        r#type: "button",
                        "Typing"
                    }
                    button {
                        class: "preset-demo-btn preset-demo-btn--ghost",
                        "data-anim-group": "tech",
                        "data-anim-class": "hikari-anim--tech-data-flow",
                        "data-anim-target": "tech-target",
                        r#type: "button",
                        "Data Flow"
                    }
                }
                div { id: "tech-target",
                    class: "preset-demo-target preset-demo-target--tech",
                    "Tech Element"
                }
            }

            div { class: "page-section preset-demo-section",
                // Transition Effects
                h3 { "Transition Effects" }
                p { class: "preset-demo-subtitle",
                    "Entrance transition animations: fade+slide, scale+blur, and rotate+zoom."
                }
                div { class: "preset-demo-controls",
                    button {
                        class: "preset-demo-btn preset-demo-btn--primary",
                        "data-anim-group": "transition",
                        "data-anim-class": "hikari-anim--transition-fade-slide-in",
                        "data-anim-target": "transition-target",
                        r#type: "button",
                        "Fade + Slide"
                    }
                    button {
                        class: "preset-demo-btn preset-demo-btn--secondary",
                        "data-anim-group": "transition",
                        "data-anim-class": "hikari-anim--transition-scale-blur-in",
                        "data-anim-target": "transition-target",
                        r#type: "button",
                        "Scale + Blur"
                    }
                    button {
                        class: "preset-demo-btn preset-demo-btn--ghost",
                        "data-anim-group": "transition",
                        "data-anim-class": "hikari-anim--transition-rotate-zoom-in",
                        "data-anim-target": "transition-target",
                        r#type: "button",
                        "Rotate + Zoom"
                    }
                }
                div { id: "transition-target",
                    class: "preset-demo-target preset-demo-target--transition",
                    "Transition Element"
                }
            }
            }}

            // Preset demo toggle script
            {preset_demo_js()}
        }
    )
}

fn preset_demo_js() -> VNode {
    use tairitsu_vdom::{VElement, VText};
    VNode::Element(
        VElement::new("script")
            .attr("type", "module")
            .child(VNode::Text(VText::new(PRESET_DEMO_JS))),
    )
}

const PRESET_DEMO_JS: &str = r#"
(function() {
    'use strict';

    var activeAnimations = {};

    function clearGroupAnimations(group) {
        if (activeAnimations[group]) {
            var target = document.getElementById(activeAnimations[group].targetId);
            if (target) {
                target.classList.remove(activeAnimations[group].animClass);
                target.style.animationPlayState = '';
            }
            delete activeAnimations[group];
        }
        var btns = document.querySelectorAll('[data-anim-group="' + group + '"]');
        btns.forEach(function(btn) {
            btn.classList.remove('is-active');
            var originalText = btn.getAttribute('data-anim-label') || btn.textContent;
            btn.textContent = originalText;
        });
    }

    function handlePresetDemoClick(e) {
        var btn = e.target.closest('[data-anim-group]');
        if (!btn) return;

        var group = btn.getAttribute('data-anim-group');
        var animClass = btn.getAttribute('data-anim-class');
        var targetId = btn.getAttribute('data-anim-target');
        var label = btn.getAttribute('data-anim-label') || btn.textContent;

        if (activeAnimations[group] && activeAnimations[group].animClass === animClass) {
            clearGroupAnimations(group);
            return;
        }

        clearGroupAnimations(group);

        var target = document.getElementById(targetId);
        if (target) {
            target.classList.remove(animClass);
            void target.offsetWidth;
            target.classList.add(animClass);
        }

        activeAnimations[group] = {
            animClass: animClass,
            targetId: targetId,
        };

        btn.classList.add('is-active');
    }

    function storeOriginalLabels() {
        var btns = document.querySelectorAll('[data-anim-group]');
        btns.forEach(function(btn) {
            if (!btn.getAttribute('data-anim-label')) {
                btn.setAttribute('data-anim-label', btn.textContent);
            }
        });
    }

    function init() {
        storeOriginalLabels();
        document.addEventListener('click', handlePresetDemoClick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    setTimeout(init, 200);
})();
"#;
