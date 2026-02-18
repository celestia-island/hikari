// hikari-components/src/basic/image.rs
//! Image component with configurable sizing and fit modes

use animation::style::{CssProperty, StyleStringBuilder};
use dioxus::prelude::*;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ImageFit {
    Contain,
    Cover,
    Fill,
    None,
    ScaleDown,
}

impl ImageFit {
    pub fn as_str(&self) -> &'static str {
        match self {
            ImageFit::Contain => "contain",
            ImageFit::Cover => "cover",
            ImageFit::Fill => "fill",
            ImageFit::None => "none",
            ImageFit::ScaleDown => "scale-down",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub enum ImagePlaceholder {
    #[default]
    Skeleton,
    Icon,
    None,
}

#[component]
pub fn Image(
    src: String,

    #[props(default = "Image".to_string())] alt: String,

    #[props(default = ImageFit::Cover)] fit: ImageFit,

    #[props(default)] width: Option<u32>,

    #[props(default)] height: Option<u32>,

    #[props(default)] max_width: Option<u32>,

    #[props(default = false)] responsive: bool,

    #[props(default)] placeholder: ImagePlaceholder,

    #[props(default = true)] show_loading: bool,

    #[props(default)] class: String,
) -> Element {
    let mut loaded = use_signal(|| false);
    let mut has_error = use_signal(|| false);

    let mut builder = StyleStringBuilder::new().add(CssProperty::ObjectFit, fit.as_str());

    if let Some(w) = width {
        builder = builder.add_px(CssProperty::Width, w);
    }
    if let Some(h) = height {
        builder = builder.add_px(CssProperty::Height, h);
    }
    if let Some(mw) = max_width {
        builder = builder.add_px(CssProperty::MaxWidth, mw);
    }
    if responsive {
        builder = builder
            .add(CssProperty::Width, "100%")
            .add(CssProperty::Height, "auto");
    }

    let style = builder.build_clean();

    let classes = if class.is_empty() {
        "hi-image".to_string()
    } else {
        format!("hi-image {}", class)
    };

    let container_style = if responsive {
        "width: 100%; position: relative; display: inline-block;".to_string()
    } else if let (Some(w), Some(h)) = (width, height) {
        format!(
            "width: {}px; height: {}px; position: relative; display: inline-block;",
            w, h
        )
    } else {
        "position: relative; display: inline-block;".to_string()
    };

    let show_placeholder = !*loaded.read() || *has_error.read();
    let placeholder_type = placeholder;

    let handle_load = move |_| {
        loaded.set(true);
    };

    let handle_error = move |_| {
        has_error.set(true);
    };

    rsx! {
        div {
            class: "hi-image-container",
            style: "{container_style}",

            if show_placeholder && show_loading {
                {
                    match placeholder_type {
                        ImagePlaceholder::Skeleton => rsx! {
                            div {
                                class: "hi-image-placeholder hi-image-skeleton",
                                style: "width: 100%; height: 100%; min-height: 100px;",
                            }
                        },
                        ImagePlaceholder::Icon => rsx! {
                            div {
                                class: "hi-image-placeholder hi-image-icon-placeholder",
                                style: "width: 100%; height: 100%; min-height: 100px; display: flex; align-items: center; justify-content: center; background: var(--hi-color-surface);",
                                svg {
                                    width: "48",
                                    height: "48",
                                    view_box: "0 0 24 24",
                                    fill: "none",
                                    stroke: "var(--hi-color-text-secondary)",
                                    stroke_width: "1.5",
                                    rect {
                                        x: "3",
                                        y: "3",
                                        width: "18",
                                        height: "18",
                                        rx: "2",
                                        ry: "2"
                                    }
                                    circle { cx: "8.5", cy: "8.5", r: "1.5" }
                                    polyline { points: "21 15 16 10 5 21" }
                                }
                            }
                        },
                        ImagePlaceholder::None => rsx! {},
                    }
                }
            }

            img {
                class: "{classes}",
                src: "{src}",
                alt: "{alt}",
                style: "{style}",
                onload: handle_load,
                onerror: handle_error,
            }
        }
    }
}

#[component]
pub fn Logo(
    src: String,

    #[props(default = "Logo".to_string())] alt: String,

    #[props(default = 40)] height: u32,

    #[props(default = 160)] max_width: u32,

    #[props(default)] class: String,
) -> Element {
    let style = StyleStringBuilder::new()
        .add_px(CssProperty::Height, height)
        .add_px(CssProperty::MaxWidth, max_width)
        .add(CssProperty::Width, "auto")
        .add(CssProperty::ObjectFit, "contain")
        .build_clean();

    let classes = if class.is_empty() {
        "hi-logo".to_string()
    } else {
        format!("hi-logo {}", class)
    };

    rsx! {
        img {
            class: "{classes}",
            src: "{src}",
            alt: "{alt}",
            style: "{style}",
        }
    }
}
