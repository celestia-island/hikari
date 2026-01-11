// website/src/pages/system/icons.rs
// Icons system page (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap,
    MarginBottom, Padding, TextColor,
};

/// Icons showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemIcons() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemIcons {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add(FlexDirection::Column)
                        .add(Gap::Gap6)
                        .build(),



                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h1 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X4xl)
                                .add(FontWeight::Bold)
                                .add(TextColor::Gray900)
                                .add(MarginBottom::Mb0)
                                .build(),
                            "Icons"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Powered by Lucide - 1000+ beautifully crafted icons"
                        }
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(BgColor::Gray100)
                            .add(BorderRadius::Lg)
                            .add(Padding::P6)
                            .build(),
                        p { class: ClassesBuilder::new().add(TextColor::Gray700).add(MarginBottom::Mb0).build(),
                            "This page is under construction. Check back soon for detailed documentation and examples!"
                        }
                    }
                }
            },
        }
    }
}
