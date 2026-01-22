// packages/components/src/display/qrcode.rs
// QRCode component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{AlignItems, ClassesBuilder, Display, FlexDirection, Padding};

use crate::styled::StyledComponent;

/// QRCode component type wrapper (for StyledComponent)
pub struct QRCodeComponent;

/// QRCode component with Arknights + FUI styling
///
/// Displays a QR code for scanning with mobile devices.
/// Uses a QR code generation library to render the code.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::QRCode;
///
/// fn app() -> Element {
///     rsx! {
///         QRCode {
///             value: "https://hikari.example.com",
///             size: 200,
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct QRCodeProps {
    /// The content to encode in QR code
    pub value: String,

    /// Size of QR code in pixels
    #[props(default = 200)]
    pub size: u32,

    /// Color of the QR code (foreground)
    #[props(default = "#000000".to_string())]
    pub color: String,

    /// Background color
    #[props(default = "#ffffff".to_string())]
    pub background: String,

    #[props(default)]
    pub title: Option<String>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

impl Default for QRCodeProps {
    fn default() -> Self {
        Self {
            value: String::default(),
            size: 200,
            color: String::from("#000000"),
            background: String::from("#ffffff"),
            title: None,
            class: String::default(),
            style: String::default(),
        }
    }
}

#[component]
pub fn QRCode(props: QRCodeProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(AlignItems::Center)
        .add(Padding::P4)
        .add_raw("hi-qrcode-container")
        .add_raw(&props.class)
        .build();

    let size_px = format!("{}px", props.size);

    let data = props.value.clone();
    let color = props.color.replace('#', "");
    let bg = props.background.replace('#', "");
    let size_str = props.size.to_string();

    rsx! {
        div {
            class: "{container_classes}",
            style: "{props.style}",

            if let Some(ref title) = props.title {
                h4 {
                    class: "hi-qrcode-title",
                    "{title}"
                }
            }

            div {
                class: "hi-qrcode-wrapper",
                style: "width: {size_px}; height: {size_px};",

                img {
                    class: "hi-qrcode-image",
                    src: "https://api.qrserver.com/v1/create-qr-code/?size={size_str}x{size_str}&data={data}&color={color}&bgcolor={bg}",
                    alt: "QR Code",
                    style: "width: 100%; height: 100%; object-fit: contain;",
                }
            }
        }
    }
}

impl StyledComponent for QRCodeComponent {
    fn styles() -> &'static str {
        r#"
.hi-qrcode-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    border-radius: 8px;
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}

.hi-qrcode-title {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--hi-color-text-primary);
    text-align: center;
}

.hi-qrcode-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    overflow: hidden;
}

.hi-qrcode-image {
    display: block;
    border: 1px solid var(--hi-color-border);
    border-radius: 4px;
}
"#
    }

    fn name() -> &'static str {
        "qrcode"
    }
}
