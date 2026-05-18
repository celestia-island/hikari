//! Interactive component examples page.
//!
//! Demonstrates the reactive state management system with live interactive examples.

use tairitsu_macros::rsx;
use tairitsu_vdom::{Signal, VNode};

use crate::{components::demo_page::render_demo_page, reactive::{button_counter, interactive_input, signal_button_counter, signal_input, signal_switch, switch}};

fn render_reactive_counter() -> VNode {
    let count = Signal::new(0i32);
    let count_display = count.clone();
    let count_increment = count.clone();
    let count_decrement = count.clone();
    let count_reset = count.clone();

    rsx! {
        div { class: "hi-reactive-counter-demo",
            h3 { "Signal-Driven Counter (DynamicText)" }
            p { "This counter uses Tairitsu's Signal + DynamicText system. "
                "The count display updates via create_effect, bypassing VDOM diff." }
            div { class: "hi-reactive-counter-controls",
                button {
                    class: "hi-button hi-button-secondary",
                    r#type: "button",
                    onclick: move |_e| {
                        let v = count_decrement.get();
                        count_decrement.set(v - 1);
                    },
                    "-1"
                }
                span { class: "hi-reactive-counter-value", {count_display} }
                button {
                    class: "hi-button hi-button-primary",
                    r#type: "button",
                    onclick: move |_e| {
                        let v = count_increment.get();
                        count_increment.set(v + 1);
                    },
                    "+1"
                }
                button {
                    class: "hi-button hi-button-ghost",
                    r#type: "button",
                    onclick: move |_e| {
                        count_reset.set(0);
                    },
                    "Reset"
                }
            }
        }
    }
}

fn render_switches() -> VNode {
    rsx! {
        {switch(false, Some("Notifications")).1}
        {switch(true, Some("Dark Mode")).1}
        {switch(false, Some("Auto-save")).1}
    }
}

fn render_counters() -> VNode {
    rsx! {
        {button_counter(0, Some("Counter A")).1}
        {button_counter(5, Some("Counter B")).1}
        {button_counter(10, Some("Counter C")).1}
    }
}

fn render_inputs() -> VNode {
    rsx! {
        {interactive_input("", "Type something...", Some("Name")).1}
        {interactive_input("Hello, World!", "Enter text...", Some("Greeting")).1}
    }
}

/// Render the interactive examples page.
pub fn render() -> VNode {
    render_demo_page("page-interactive", "Interactive Examples", "Live reactive component demonstrations with state persistence.",
        rsx! {
            div { class: "page-section",
                h2 { "Reactive Signal Counter" }
                p {
                    "A counter powered by Tairitsu's Signal system and DynamicText VNodes. "
                    "The displayed number updates directly via create_effect — no VDOM diff involved."
                }
                {render_reactive_counter()}
            }

            div { class: "page-section",
                h2 { "Signal-Driven Components" }
                p {
                    "These components use Tairitsu's Signal<T> for state instead of JS bridge. "
                    "Each Signal automatically creates DynamicText/DynamicAttr VNodes — "
                    "updates bypass VDOM diff entirely."
                }
                h3 { "Signal Switch" }
                {signal_switch(false, "Toggle me (Signal)")}
                h3 { "Signal Counter" }
                {signal_button_counter(0)}
                h3 { "Signal Input" }
                {signal_input("Type here (Signal)...")}
            }

            div { class: "page-section",
                h2 { "Switch Component (JS Bridge)" }
                p {
                    "A boolean toggle control that maintains its state across page navigation. "
                    "Try toggling the switches below and then navigate away and back - the state will be preserved!"
                }
                {render_switches()}
                div { class: "code-example",
                    pre { class: "hi-code-block",
                        code { class: "hi-code-content",
                            "```markdown\n_interactive switch|label:Notifications|initial:false\n\n_interactive switch|label:Dark Mode|initial:true\n```"
                        }
                    }
                }
            }

            div { class: "page-section",
                h2 { "Button Counter" }
                p {
                    "A click counter that increments with each button press. "
                    "Each counter maintains its own independent state."
                }
                {render_counters()}
                div { class: "code-example",
                    pre { class: "hi-code-block",
                        code { class: "hi-code-content",
                            "```markdown\n_interactive counter|label:Counter A|initial:0\n\n_interactive counter|label:Counter B|initial:5\n```"
                        }
                    }
                }
            }

            div { class: "page-section",
                h2 { "Input Component" }
                p {
                    "A text input with live value display. The input value is stored and "
                    "restored when you return to this page."
                }
                {render_inputs()}
                div { class: "code-example",
                    pre { class: "hi-code-block",
                        code { class: "hi-code-content",
                            "```markdown\n_interactive input|label:Name|placeholder:Type something...|initial:\n\n_interactive input|label:Greeting|placeholder:Enter text...|initial:Hello, World!\n```"
                        }
                    }
                }
            }

            div { class: "page-section",
                h2 { "State Persistence" }
                p {
                    "All interactive components automatically persist their state to localStorage. "
                    "This means:"
                }
                ul { class: "feature-list",
                    li { "State is preserved when navigating between pages" }
                    li { "State survives browser refresh" }
                    li { "Each component instance has isolated state" }
                    li { "State is cleared when you explicitly reset it" }
                }
                p { "Open your browser's developer console and use the global API:" }
                div { class: "code-example",
                    pre { class: "hi-code-block",
                        code { class: "hi-code-content",
                            "// Get all component states\nhikariReactive.getAllStates()\n\n// Get a specific component state\nhikariReactive.getState('switch-0')\n\n// Clear all states\nhikariReactive.clearAllStates()"
                        }
                    }
                }
            }

            div { class: "page-section",
                h2 { "Usage in Markdown" }
                p {
                    "You can embed interactive components directly in markdown documentation "
                    "using the special code block syntax:"
                }
                div { class: "code-example",
                    pre { class: "hi-code-block",
                        code { class: "hi-code-content",
                            "```_interactive component_name|param1:value1|param2:value2\n```\n\nAvailable components:\n- switch: initial (true/false)\n- counter/button-counter: initial (number)\n- input: initial (text), placeholder (text)"
                        }
                    }
                }
            }
        }
    )
}
