// packages/components/src/display/qrcode.rs
// QRCode component using Canvas for rendering

use dioxus::prelude::*;
use palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, Padding, QRCodeClass, UtilityClass,
};
use qrcode::{Color, QrCode};
use wasm_bindgen::JsCast;
use web_sys::CanvasRenderingContext2d;

use crate::styled::StyledComponent;

/// QRCode component type wrapper (for StyledComponent)
pub struct QRCodeComponent;

/// QRCode component with Arknights + FUI styling
///
/// Displays a QR code for scanning with mobile devices.
/// Uses canvas-based rendering for optimal performance.
#[derive(Clone, PartialEq, Props)]
pub struct QRCodeProps {
    /// The content to encode in QR code
    pub value: String,

    /// Size of QR code in pixels
    #[props(default = 200)]
    pub size: u32,

    /// Color of the QR code (foreground)
    #[props(default = String::from("#000000"))]
    pub color: String,

    /// Background color
    #[props(default = String::from("#ffffff"))]
    pub background: String,

    /// Optional title displayed above the QR code
    #[props(default)]
    pub title: Option<String>,

    /// CSS class
    #[props(default)]
    pub class: String,

    /// Inline styles
    #[props(default)]
    pub style: String,

    /// Error correction level: "low", "medium", "quartile", "high"
    #[props(default = String::from("medium"))]
    pub error_correction: String,
}

#[component]
pub fn QRCode(props: QRCodeProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(AlignItems::Center)
        .add(Padding::P4)
        .add(QRCodeClass::Container)
        .add_raw(&props.class)
        .build();

    let size = props.size;
    let size_px = format!("{}px", props.size);
    let value = props.value.clone();
    let color = props.color.clone();
    let background = props.background.clone();
    let ec_level = props.error_correction.clone();

    let mut drawn: Signal<bool> = use_signal(|| false);

    // Generate QR code matrix
    let qr_result = QrCode::with_error_correction_level(
        &value,
        match ec_level.as_str() {
            "low" => qrcode::EcLevel::L,
            "high" => qrcode::EcLevel::H,
            "quartile" => qrcode::EcLevel::Q,
            _ => qrcode::EcLevel::M,
        },
    );

    let qr_matrix: Option<(Vec<Vec<bool>>, usize)> = qr_result.ok().map(|code| {
        let width = code.width();
        let mut matrix = vec![vec![false; width]; width];
        for y in 0..width {
            for x in 0..width {
                matrix[y][x] = code[(x, y)] == Color::Dark;
            }
        }
        (matrix, width)
    });

    rsx! {
        div {
            class: "{container_classes}",
            style: "{props.style}",

            if let Some(ref title) = props.title {
                h4 {
                    class: "{QRCodeClass::Title.as_class()}",
                    "{title}"
                }
            }

            div {
                class: "{QRCodeClass::Wrapper.as_class()}",
                style: "width: {size_px}; height: {size_px};",

                canvas {
                    class: "{QRCodeClass::Image.as_class()}",
                    width: "{size}",
                    height: "{size}",

                    onmounted: move |evt| {
                        if drawn() { return; }

                        if let Some(canvas) = evt.data().downcast::<web_sys::HtmlCanvasElement>() {
                            if let Ok(Some(ctx)) = canvas.get_context("2d") {
                                if let Ok(ctx) = ctx.dyn_into::<CanvasRenderingContext2d>() {
                                    let canvas_size = size as f64;

                                    ctx.set_fill_style_str(&background);
                                    ctx.fill_rect(0.0, 0.0, canvas_size, canvas_size);

                                    if let Some((matrix, modules)) = &qr_matrix {
                                        let cell_size = canvas_size / *modules as f64;
                                        let gap = cell_size * 0.02;
                                        let cell_with_gap = cell_size - gap;

                                        ctx.set_fill_style_str(&color);

                                        for y in 0..*modules {
                                            for x in 0..*modules {
                                                if matrix[y][x] {
                                                    ctx.fill_rect(
                                                        x as f64 * cell_size + gap / 2.0,
                                                        y as f64 * cell_size + gap / 2.0,
                                                        cell_with_gap,
                                                        cell_with_gap,
                                                    );
                                                }
                                            }
                                        }
                                    }

                                    drawn.set(true);
                                }
                            }
                        }
                    },
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
