// hikari-components/src/basic/image.rs
//! Image component with configurable sizing and fit modes

use dioxus::prelude::*;
use animation::style::{StyleStringBuilder, CssProperty};

/// Image fit mode - how the image scales to fit its container
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ImageFit {
    /// Image is scaled to maintain its aspect ratio while fitting within the container
    Contain,
    /// Image is scaled to maintain its aspect ratio while filling the container
    Cover,
    /// Image is stretched to fill the container (may distort)
    Fill,
    /// Image is not scaled
    None,
    /// Image is scaled as if none or contain were specified
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

/// Image component with configurable sizing and fit modes
///
/// Similar to Material UI's Image/Img component - displays images
/// with various scaling options and responsive behavior.
///
/// # Example
///
/// ```rust
/// use hikari_components::basic::{Image, ImageFit};
/// use dioxus::prelude::*;
///
/// rsx! {
///     Image {
///         src: "/images/photo.jpg".to_string(),
///         alt: "Description".to_string(),
///         fit: ImageFit::Cover,
///     }
/// }
/// ```
#[component]
pub fn Image(
    /// Image source URL
    src: String,

    /// Alt text for accessibility
    #[props(default = "Image".to_string())]
    alt: String,

    /// How the image should fit its container
    #[props(default = ImageFit::Cover)]
    fit: ImageFit,

    /// Width in pixels (optional)
    #[props(default)]
    width: Option<u32>,

    /// Height in pixels (optional)
    #[props(default)]
    height: Option<u32>,

    /// Max width in pixels (optional)
    #[props(default)]
    max_width: Option<u32>,

    /// Whether to make image responsive (100% width)
    #[props(default = false)]
    responsive: bool,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    // Build inline styles using StyleStringBuilder
    let mut builder = StyleStringBuilder::new()
        .add(CssProperty::ObjectFit, fit.as_str());

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

    // Build class name
    let classes = if class.is_empty() {
        "hi-image".to_string()
    } else {
        format!("hi-image {}", class)
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

/// Logo preset - convenient component for app logos
///
/// # Example
///
/// ```rust
/// use hikari_components::basic::Logo;
/// use dioxus::prelude::*;
///
/// rsx! {
///     Logo {
///         src: "/images/logo.png".to_string(),
///         alt: "App Logo".to_string(),
///     }
/// }
/// ```
#[component]
pub fn Logo(
    /// Image source URL
    src: String,

    /// Alt text for accessibility
    #[props(default = "Logo".to_string())]
    alt: String,

    /// Logo height in pixels (width is auto)
    #[props(default = 40)]
    height: u32,

    /// Max width in pixels
    #[props(default = 160)]
    max_width: u32,

    /// Custom CSS classes
    #[props(default)]
    class: String,
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
