//! Interactive component examples page.
//!
//! Demonstrates the reactive state management system with live interactive examples.

use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode, VText};
use crate::reactive::{switch, button_counter, interactive_input};

/// Render the interactive examples page.
pub fn render() -> VNode {
    rsx! {
        div { id: "page-interactive", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Interactive Examples" }
                p { class: "page-header__subtitle",
                    "Live reactive component demonstrations with state persistence."
                }
            }

            div { class: "page-section",
                h2 { "Switch Component" }
                p {
                    "A boolean toggle control that maintains its state across page navigation. "
                    "Try toggling the switches below and then navigate away and back - the state will be preserved!"
                }

                div { class: "demo-row",
                    // Switch 1 - unchecked by default
                    {
                        let (_id, vnode) = switch(false, Some("Notifications"));
                        vnode
                    }
                    // Switch 2 - checked by default
                    {
                        let (_id, vnode) = switch(true, Some("Dark Mode"));
                        vnode
                    }
                    // Switch 3 - unchecked by default
                    {
                        let (_id, vnode) = switch(false, Some("Auto-save"));
                        vnode
                    }
                }

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

                div { class: "demo-row",
                    // Counter 1 - starts at 0
                    {
                        let (_id, vnode) = button_counter(0, Some("Counter A"));
                        vnode
                    }
                    // Counter 2 - starts at 5
                    {
                        let (_id, vnode) = button_counter(5, Some("Counter B"));
                        vnode
                    }
                    // Counter 3 - starts at 10
                    {
                        let (_id, vnode) = button_counter(10, Some("Counter C"));
                        vnode
                    }
                }

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

                div { class: "demo-row",
                    // Input 1 - empty by default
                    {
                        let (_id, vnode) = interactive_input("", "Type something...", Some("Name"));
                        vnode
                    }
                    // Input 2 - with initial value
                    {
                        let (_id, vnode) = interactive_input("Hello, World!", "Enter text...", Some("Greeting"));
                        vnode
                    }
                }

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
                p {
                    "Open your browser's developer console and use the global API:"
                }
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
    }
}
