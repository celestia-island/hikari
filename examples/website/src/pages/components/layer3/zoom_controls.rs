// website/src/pages/components/extra/zoom_controls_doc.rs
// ZoomControls component documentation page

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::layout::{Container, Section};
use _extra_components::extra::{ZoomControls as ZoomControlsComponent, ZoomPosition};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, TextColor};

// Code examples as constants
const CODE_BASIC: &str = r#"let mut zoom = use_signal(|| 1.0);

ZoomControlsComponent {
    zoom: zoom(),
    on_zoom_change: move |z| zoom.set(z),
}"#;

const CODE_MIN_MAX: &str = r#"let mut zoom = use_signal(|| 1.0);

ZoomControlsComponent {
    zoom: zoom(),
    min_zoom: 0.5,
    max_zoom: 3.0,
    zoom_step: 0.25,
    on_zoom_change: move |z| zoom.set(z),
}"#;

const CODE_POSITIONS: &str = r#"ZoomControlsComponent {
    zoom: 1.0,
    position: ZoomPosition::TopLeft,
    on_zoom_change: move |z| println!("Zoom: {}", z),
}"#;

const CODE_NO_FIT: &str = r#"ZoomControlsComponent {
    zoom: 1.0,
    show_fit: false,
    on_zoom_change: move |z| println!("Zoom: {}", z),
}"#;

#[allow(non_snake_case)]
pub fn ZoomControls() -> Element {
    let mut zoom1 = use_signal(|| 1.0);
    let mut zoom2 = use_signal(|| 0.5);
    let mut zoom3 = use_signal(|| 1.0);
    let mut zoom4 = use_signal(|| 1.0);

    rsx! {
        Layout {
            current_route: Route::ZoomControls {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "ZoomControls"
                    }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        "Zoom controls component with keyboard shortcuts"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "ZoomControls is a zoom control component that supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").build(),
                            li { "Keyboard shortcuts (+, -, 0)" }
                            li { "Configurable min/max zoom" }
                            li { "Custom zoom step" }
                            li { "Multiple positions" }
                            li { "Optional fit to screen button" }
                        }
                    }
                }

                // Basic ZoomControls
                Section {
                    title: Some("Basic Usage".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Simple ZoomControls"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic zoom controls with default settings"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").add_raw("relative").build(),
                            ZoomControlsComponent {
                                zoom: zoom1(),
                                on_zoom_change: move |z| zoom1.set(z),
                            }
                        }
                        div { class: ClassesBuilder::new().add_raw("mt-4").add(TextColor::Secondary).build(),
                            "Current zoom: {zoom1()}"
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
                            "Custom Min/Max and Step"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Zoom controls with custom zoom range and step"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").add_raw("relative").build(),
                            ZoomControlsComponent {
                                zoom: zoom2(),
                                min_zoom: 0.5,
                                max_zoom: 2.0,
                                zoom_step: 0.25,
                                on_zoom_change: move |z| zoom2.set(z),
                            }
                        }
                        div { class: ClassesBuilder::new().add_raw("mt-4").add(TextColor::Secondary).build(),
                            "Current zoom: {zoom2()} (range: 0.5 - 2.0, step: 0.25)"
                        }
                    }
                }

                // Different Positions
                Section {
                    title: Some("Positions".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Top Left"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Zoom controls positioned at top left"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").add_raw("relative").add_raw("h-48").build(),
                            ZoomControlsComponent {
                                zoom: zoom3(),
                                position: ZoomPosition::TopLeft,
                                on_zoom_change: move |z| zoom3.set(z),
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
                            "Bottom Right"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Zoom controls positioned at bottom right"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").add_raw("relative").add_raw("h-48").build(),
                            ZoomControlsComponent {
                                zoom: zoom4(),
                                position: ZoomPosition::BottomRight,
                                on_zoom_change: move |z| zoom4.set(z),
                            }
                        }
                    }
                }

                // Without Fit Button
                Section {
                    title: Some("Options".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Without Fit to Screen"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Zoom controls without fit to screen button"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").add_raw("border").add_raw("rounded-lg").add_raw("relative").build(),
                            ZoomControlsComponent {
                                zoom: 1.0,
                                show_fit: false,
                                on_zoom_change: |_| {},
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
                            "Basic ZoomControls"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_BASIC}" }
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
                            "Custom Min/Max and Step"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_MIN_MAX}" }
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
                            "Different Positions"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_POSITIONS}" }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb0).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Without Fit Button"
                        }
                        div { class: ClassesBuilder::new().add_raw("p-6").build(),
                            code { "{CODE_NO_FIT}" }
                        }
                    }
                }
            }
        }
    }
}
