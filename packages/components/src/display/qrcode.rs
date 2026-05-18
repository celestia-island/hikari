// packages/components/src/display/qrcode.rs
// QRCode component using inline SVG for rendering

use hikari_palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, Padding, QRCodeClass, TypedClass,
};
use qrcode::{Color, QrCode};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct QRCodeComponent;

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

fn build_svg(matrix: &[Vec<bool>], modules: usize, color: &str, background: &str) -> String {
    let mut rects = String::with_capacity(modules * modules * 32);
    for (y, row) in matrix.iter().enumerate().take(modules) {
        for (x, &cell) in row.iter().enumerate().take(modules) {
            if cell {
                rects.push_str(&format!(
                    "<rect x=\"{x}\" y=\"{y}\" width=\"1\" height=\"1\" fill=\"{color}\"/>"
                ));
            }
        }
    }
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {modules} {modules}" width="100%" height="100%" shape-rendering="crispEdges"><rect width="{modules}" height="{modules}" fill="{background}"/>{rects}</svg>"#
    )
}

#[component]
pub fn QRCode(props: QRCodeProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add_typed(Display::Flex)
        .add_typed(FlexDirection::Column)
        .add_typed(AlignItems::Center)
        .add_typed(Padding::P4)
        .add_typed(QRCodeClass::Container)
        .add(&props.class)
        .build();

    let size_px = format!("{}px", props.size);
    let value = props.value.clone();
    let color = props.color.clone();
    let background = props.background.clone();
    let ec_level = props.error_correction.clone();

    let qr_result = QrCode::with_error_correction_level(
        &value,
        match ec_level.as_str() {
            "low" => qrcode::EcLevel::L,
            "high" => qrcode::EcLevel::H,
            "quartile" => qrcode::EcLevel::Q,
            _ => qrcode::EcLevel::M,
        },
    );

    let svg_html = qr_result.ok().map(|code| {
        let width = code.width();
        let mut matrix = vec![vec![false; width]; width];
        for y in 0..width {
            for x in 0..width {
                matrix[y][x] = code[(x, y)] == Color::Dark;
            }
        }
        build_svg(&matrix, width, &color, &background)
    });

    rsx! {
        div { class: container_classes, style: props.style,

            if let Some(ref title) = props.title {
                h4 { class: QRCodeClass::Title.class_name(), "{title}" }
            }

            div {
                class: QRCodeClass::Wrapper.class_name(),
                style: "width: {size_px}; height: {size_px};",

                if let Some(ref svg) = svg_html {
                    div {
                        class: QRCodeClass::Image.class_name(),
                        dangerous_inner_html: svg,
                    }
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
