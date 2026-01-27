// Minimal icon reproduction test
// This test will help isolate why MdiIcon::Alert triggers fallback

use dioxus::prelude::*;

use _icons::{Icon, LucideIcon, MdiIcon};

fn main() {
    launch(app);
}

fn app() -> Element {
    rsx! {
        div {
            // Test 1: Direct MdiIcon::Alert usage (what's currently failing)
            h3 { "Test 1: Direct MdiIcon::Alert (Currently showing triangle)" }
            div {
                Icon {
                    icon: MdiIcon::Alert,
                    size: 24,
                    color: "red"
                }
                " - This should show alert icon (triangle with !)"
            }

            // Test 2: Other known working icons for comparison
            h3 { "Test 2: Known working icons for comparison" }
            div {
                Icon {
                    icon: MdiIcon::Home,
                    size: 24,
                    color: "blue"
                }
                " - Home icon (should work)"
            }

            div {
                Icon {
                    icon: MdiIcon::Settings,
                    size: 24,
                    color: "green"
                }
                " - Settings icon (should work)"
            }

            // Test 3: Try LucideIcon for comparison
            h3 { "Test 3: LucideIcon Alert for comparison" }
            div {
                Icon {
                    icon: LucideIcon::AlertTriangle,
                    size: 24,
                    color: "orange"
                }
                " - Lucide AlertTriangle (should work)"
            }

            // Test 4: Test icon name resolution
            h3 { "Test 4: Icon name debugging" }
            div {
                p { "MdiIcon::Alert as string: " }
                code { "{format_args!(\"{}\", MdiIcon::Alert)}" }
            }

            div {
                p { "Checking if icon exists in system..." }
                // This will help debug if the icon is actually available
            }
        }
    }
}
