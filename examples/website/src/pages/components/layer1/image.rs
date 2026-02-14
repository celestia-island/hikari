// website/src/pages/components/display/image.rs
// Image component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{
    basic::{Image as ImageComponent, ImageFit},
    layout::{Container, Section},
};
use _palette::classes::{
    ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor,
};

#[allow(non_snake_case)]
pub fn Image() -> Element {
    rsx! {
        Layout {
            current_route: Route::Image {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Image"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Responsive images with configurable fit modes"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Images are fundamental for displaying visual content. They support:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Multiple fit modes" }
                                " - Contain, Cover, Fill, None, ScaleDown"
                            }
                            li {
                                strong { "Flexible sizing" }
                                " - Width, height, max-width, responsive"
                            }
                            li {
                                strong { "Accessibility" }
                                " - Alt text support for screen readers"
                            }
                            li {
                                strong { "Responsive design" }
                                " - Automatic scaling for different screen sizes"
                            }
                        }
                    }
                }

                // Image Fit Modes
                Section {
                    title: Some("Image Fit Modes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Cover"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Scales image to fill container while maintaining aspect ratio (default)"
                        }
                        div {
                            style: "width: 400px; height: 250px; overflow: hidden; border: 1px solid var(--hi-color-border);",
                            ImageComponent {
                                src: "https://picsum.photos/800/600?random=1".to_string(),
                                alt: "Landscape".to_string(),
                                fit: ImageFit::Cover,
                                width: Some(400),
                                height: Some(250),
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Contain"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Scales image to fit within container while maintaining aspect ratio"
                        }
                        div {
                            style: "width: 400px; height: 250px; overflow: hidden; border: 1px solid var(--hi-color-border);",
                            ImageComponent {
                                src: "https://picsum.photos/800/600?random=2".to_string(),
                                alt: "Landscape".to_string(),
                                fit: ImageFit::Contain,
                                width: Some(400),
                                height: Some(250),
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Fill"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Stretches image to fill container (may distort aspect ratio)"
                        }
                        div {
                            style: "width: 400px; height: 250px; overflow: hidden; border: 1px solid var(--hi-color-border);",
                            ImageComponent {
                                src: "https://picsum.photos/600/400?random=3".to_string(),
                                alt: "Portrait".to_string(),
                                fit: ImageFit::Fill,
                                width: Some(400),
                                height: Some(250),
                            }
                        }
                    }
                }

                // Responsive Images
                Section {
                    title: Some("Responsive Images".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Full Width"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Images that adapt to container width with responsive: true"
                        }
                        div {
                            style: "width: 100%; max-width: 600px;",
                            ImageComponent {
                                src: "https://picsum.photos/1200/600?random=4".to_string(),
                                alt: "Responsive image".to_string(),
                                fit: ImageFit::Cover,
                                responsive: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Max Width"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Limit maximum width while maintaining responsive behavior"
                        }
                        div {
                            style: "width: 100%;",
                            ImageComponent {
                                src: "https://picsum.photos/1200/600?random=5".to_string(),
                                alt: "Responsive image".to_string(),
                                fit: ImageFit::Cover,
                                max_width: Some(400),
                                responsive: true,
                            }
                        }
                    }
                }

                // Fixed Sizes
                Section {
                    title: Some("Fixed Sizes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Fixed Width and Height"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Images with explicit dimensions"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap6).add(Padding::P6).build(),
                            ImageComponent {
                                src: "https://picsum.photos/200/200?random=6".to_string(),
                                alt: "Square".to_string(),
                                fit: ImageFit::Cover,
                                width: Some(150),
                                height: Some(150),
                            }
                            ImageComponent {
                                src: "https://picsum.photos/300/200?random=7".to_string(),
                                alt: "Landscape".to_string(),
                                fit: ImageFit::Cover,
                                width: Some(200),
                                height: Some(150),
                            }
                            ImageComponent {
                                src: "https://picsum.photos/200/300?random=8".to_string(),
                                alt: "Portrait".to_string(),
                                fit: ImageFit::Cover,
                                width: Some(150),
                                height: Some(200),
                            }
                        }
                    }
                }

                // Logo Component
                Section {
                    title: Some("Logo Component".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Application Logo"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Convenient component for app logos with aspect ratio preservation"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap6).add(Padding::P6).build(),
                            div {
                                style: "display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid var(--hi-color-border);",
                                _components::basic::Logo {
                                    src: "https://via.placeholder.com/160x40/00A0E9/ffffff?text=Hikari".to_string(),
                                    alt: "Hikari Logo".to_string(),
                                    height: 40,
                                    max_width: 160,
                                }
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Image"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"ImageComponent {{ src: "/photo.jpg".to_string(), alt: "Description".to_string() }}"# }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Cover Fit with Fixed Size"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"ImageComponent {{
    src: "/photo.jpg".to_string(),
    alt: "Description".to_string(),
    fit: ImageFit::Cover,
    width: Some(400),
    height: Some(300),
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Responsive Image"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"ImageComponent {{
    src: "/photo.jpg".to_string(),
    alt: "Description".to_string(),
    fit: ImageFit::Cover,
    responsive: true,
    max_width: Some(600),
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
