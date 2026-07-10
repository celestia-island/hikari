// hikari-components/src/layout/scrollbar.rs
//! Custom Scrollbar Container component
//!
//! A tairitsu component wrapper that uses the script-based scrollbar system.
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
            class: format!("custom-scrollbar-wrapper-vdom {}", class),
            style: "position: relative; display: flex; width: {width}; height: {height}; overflow: hidden;",

            // Content area - will be wrapped by the script
            div {
                class: "custom-scrollbar-content-vdom",
                style: "flex: 1; overflow-y: auto; overflow-x: hidden; min-width: 0;",
                "data-custom-scrollbar": "content",

                {children}
            }
        }
    }
}

pub struct ScrollbarContainerComponent;

impl crate::styled::StyledComponent for ScrollbarContainerComponent {
    fn styles() -> &'static str {
        r#"
.custom-scrollbar-wrapper-vdom {
  position: relative;
  display: flex;
}

.custom-scrollbar-content-vdom {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.custom-scrollbar-content-vdom::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.custom-scrollbar-content-vdom {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
"#
    }

    fn name() -> &'static str {
        "scrollbar"
    }
}
