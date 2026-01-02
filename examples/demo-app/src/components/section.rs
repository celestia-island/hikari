// demo-app/src/components/section.rs
// Section wrapper component

use dioxus::prelude::*;

#[component]
pub fn Section(title: String, children: Element) -> Element {
    rsx! {
        div { style: "margin-bottom: 48px;",
            h2 { style: "font-size: 24px; margin-bottom: 16px; color: #1a1a2e; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;",
                "{title}"
            }
            { children }
        }
    }
}
