// packages/components/src/display/qrcode.rs
// QRCode component using Canvas for rendering

use hikari_palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, Padding, QRCodeClass, UtilityClass,
};
use qrcode::{Color, QrCode};

use crate::{prelude::*, styled::StyledComponent};

pub struct QRCodeComponent;

///
#[define_props]
pub struct QRCodeProps {
    pub value: String,
    #[default(200)]
    pub size: u32,
    #[default(String::from("#000000"))]
    pub color: String,
    #[default(String::from("#ffffff"))]
    pub background: String,
    pub title: Option<String>,
    pub class: String,
    pub style: String,
    #[default(String::from("medium"))]
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

    let drawn: Signal<bool> = use_signal(|| false);

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

    let canvas_id = format!("qrcode-canvas-{}", crate::platform::now_timestamp() as u64);

    #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
    {
        let canvas_id_for_effect = canvas_id.clone();
        let drawn_for_effect = drawn.clone();
        let qr_matrix_for_effect = qr_matrix.clone();
        let color_for_effect = color.clone();
        let background_for_effect = background.clone();

        use_effect(move || {
            if drawn_for_effect.get() {
                return;
            }

            if let Some((matrix, modules)) = &qr_matrix_for_effect {
                if crate::platform::draw_qrcode_on_canvas_by_id(
                    &canvas_id_for_effect,
                    matrix,
                    *modules,
                    &color_for_effect,
                    &background_for_effect,
                ) {
                    drawn_for_effect.set(true);
                }
            }
        });
    }

    rsx! {
        div {
            class: container_classes,
            style: props.style,

            if let Some(ref title) = props.title {
                h4 {
                    class: QRCodeClass::Title.as_class(),
                    "{title}"
                }
            }

            div {
                class: QRCodeClass::Wrapper.as_class(),
                style: "width: {size_px}; height: {size_px};",

                canvas {
                    id: canvas_id,
                    class: QRCodeClass::Image.as_class(),
                    width: size,
                    height: size,
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
