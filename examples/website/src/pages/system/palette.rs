// website/src/pages/system/palette.rs
// Chinese traditional color palette system page (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap,
    MarginBottom, Padding, TextColor,
};

/// Palette showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemPalette() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemPalette {},
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
                            "Chinese Traditional Colors"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "500+ traditional colors from Chinese culture and history"
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
