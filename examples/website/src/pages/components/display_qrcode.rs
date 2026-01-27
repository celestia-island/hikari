// website/src/pages/components/display/qrcode.rs
// QRCode component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{QRCode, layout::{Container, Section}};
use _palette::classes::{ ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor, };

#[allow(non_snake_case)]
pub fn ComponentsQRCode() -> Element {
    rsx! {
        Layout {
            current_route: Route::DisplayQRCode {},

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
                        "QRCode"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "QR code display component for scanning with mobile devices"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "QRCode components display scannable QR codes. They support:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Custom content" }
                                " - Encode any text or URL"
                            }
                            li {
                                strong { "Flexible sizing" }
                                " - Custom size in pixels"
                            }
                            li {
                                strong { "Custom colors" }
                                " - Foreground and background colors"
                            }
                            li {
                                strong { "Optional title" }
                                " - Label above QR code"
                            }
                        }
                    }
                }

                // Basic QR Codes
                Section {
                    title: Some("Basic QR Codes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Default QR Code"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Standard QR code with default settings (200px, black on white)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            QRCode {
                                value: "https://hikari.example.com".to_string(),
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
                            "With Title"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "QR code with descriptive title"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            QRCode {
                                value: "https://hikari.example.com".to_string(),
                                title: Some("Scan to Visit".to_string()),
                            }
                        }
                    }
                }

                // QR Code Sizes
                Section {
                    title: Some("QR Code Sizes".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Size Variants"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "QR codes in different sizes"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap6).add(Padding::P6).build(),
                            QRCode {
                                value: "https://hikari.example.com/small".to_string(),
                                size: 100,
                                title: Some("100px".to_string()),
                            }
                            QRCode {
                                value: "https://hikari.example.com/medium".to_string(),
                                size: 150,
                                title: Some("150px".to_string()),
                            }
                            QRCode {
                                value: "https://hikari.example.com/large".to_string(),
                                size: 200,
                                title: Some("200px".to_string()),
                            }
                            QRCode {
                                value: "https://hikari.example.com/xlarge".to_string(),
                                size: 250,
                                title: Some("250px".to_string()),
                            }
                        }
                    }
                }

                // Custom Colors
                Section {
                    title: Some("Custom Colors".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Color Variants"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "QR codes with custom foreground and background colors"
                        }
                        div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap6).add(Padding::P6).build(),
                            QRCode {
                                value: "https://hikari.example.com/blue".to_string(),
                                size: 150,
                                color: "#00A0E9".to_string(),
                                background: "#ffffff".to_string(),
                                title: Some("Blue".to_string()),
                            }
                            QRCode {
                                value: "https://hikari.example.com/red".to_string(),
                                size: 150,
                                color: "#E94B35".to_string(),
                                background: "#ffffff".to_string(),
                                title: Some("Red".to_string()),
                            }
                            QRCode {
                                value: "https://hikari.example.com/green".to_string(),
                                size: 150,
                                color: "#22c55e".to_string(),
                                background: "#ffffff".to_string(),
                                title: Some("Green".to_string()),
                            }
                            QRCode {
                                value: "https://hikari.example.com/dark".to_string(),
                                size: 150,
                                color: "#ffffff".to_string(),
                                background: "#1a1a1a".to_string(),
                                title: Some("Dark Mode".to_string()),
                            }
                        }
                    }
                }

                // Use Cases
                Section {
                    title: Some("Common Use Cases".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Website URL"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "QR code for sharing website URL"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            QRCode {
                                value: "https://hikari.example.com".to_string(),
                                size: 200,
                                title: Some("Scan to Visit".to_string()),
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
                            "WiFi Credentials"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "QR code for easy WiFi connection"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            QRCode {
                                value: "WIFI:T:WPA;S:MyNetwork;P:password;;".to_string(),
                                size: 200,
                                title: Some("Scan to Connect WiFi".to_string()),
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
                            "Contact Info (vCard)"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "QR code for sharing contact information"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            QRCode {
                                value: "BEGIN:VCARD\\nVERSION:3.0\\nN:Doe;John\\nFN:John Doe\\nORG:Company\\nTITLE:Developer\\nTEL;TYPE=WORK,VOICE:+1234567890\\nEMAIL:john@example.com\\nEND:VCARD".to_string(),
                                size: 200,
                                title: Some("Scan to Add Contact".to_string()),
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
                            "Payment Request"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "QR code for payment (UPI/BTC/etc)"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            QRCode {
                                value: "upi://pay?pa=example@upi&pn=John Doe&am=10.00".to_string(),
                                size: 200,
                                title: Some("Scan to Pay ₹10.00".to_string()),
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
                            "Basic QR Code"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code { r#"QRCode {{ value: "https://example.com".to_string() }}"# }
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
                            "Custom Size and Colors"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r##"QRCode {{
    value: "https://example.com".to_string(),
    size: 250,
    color: "#00A0E9".to_string(),
    background: "#ffffff".to_string(),
    title: Some("Scan Me".to_string()),
}}"##
                            }
                        }
                    }
                }
            }
        }
    }
}
