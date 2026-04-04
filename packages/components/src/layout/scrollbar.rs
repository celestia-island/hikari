// hikari-components/src/layout/scrollbar.rs
//! Custom Scrollbar Container component
//!
//! A Dioxus component wrapper that uses the script-based scrollbar system.
//! The component renders a container that's initialized by the script.

use crate::prelude::*;

///
///
///
///
#[component]
pub fn ScrollbarContainer(
    children: Element,

    #[props(default = "100%".to_string())] height: String,

    #[props(default = "100%".to_string())] width: String,

    #[props(default)] class: String,
) -> Element {
    rsx! {
        div {
            class: format!("custom-scrollbar-container-vdom {}", class),
            style: "position: relative; display: flex; width: {width}; height: {height}; overflow: hidden;",

            div {
                class: "custom-scrollbar-content-vdom",
                "data-custom-scrollbar": "content",
                style: "overflow-y: auto; overflow-x: hidden; flex: 1; min-width: 0; -ms-overflow-style: none; scrollbar-width: none;",

                {children}
            }
        }
    }
}

pub struct ScrollbarContainerComponent;

impl crate::styled::StyledComponent for ScrollbarContainerComponent {
    fn styles() -> &'static str {
        r#"
.custom-scrollbar-container-vdom {
  position: relative;
  display: flex;
}

.custom-scrollbar-container-vdom .custom-scrollbar-wrapper {
  position: relative;
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
}

.custom-scrollbar-container-vdom .custom-scrollbar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.custom-scrollbar-container-vdom .custom-scrollbar-content::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.custom-scrollbar-container-vdom .custom-scrollbar-content {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
"#
    }

    fn name() -> &'static str {
        "scrollbar"
    }
}
