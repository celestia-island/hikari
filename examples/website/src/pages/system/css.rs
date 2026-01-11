// website/src/pages/system/css.rs
// CSS utilities system page (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _palette::classes::{
    BgColor, ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, TextColor,
};

/// CSS utilities showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemCSS() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemCSS {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new().add_raw("page-container").build(),

                    div {
                        class: ClassesBuilder::new().add_raw("page-header").build(),
                        h1 {
                            class: ClassesBuilder::new().add_raw("page-title").add(FontSize::X4xl).add(FontWeight::Bold).add(MarginBottom::Mb0).build(),
                            "CSS Utilities"
                        }
                        p {
                            class: ClassesBuilder::new().add_raw("page-description").add(TextColor::Gray600).build(),
                            "Tailwind-compatible utility classes for rapid styling"
                        }
                    }

                    div {
                        class: ClassesBuilder::new().add_raw("info-box").add(BgColor::Gray50).build(),
                        p {
                            class: ClassesBuilder::new().add_raw("info-box-text").build(),
                            "This page is under construction. Check back soon for detailed documentation and examples!"
                        }
                    }
                }
            }
        }
    }
}
