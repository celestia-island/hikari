//! Build script for hikari-icons
//!
//! Generates selected MDI icons at build time.

use hikari_builder::icons::{IconConfig, IconSelection, MdiStyle};

fn main() {
    println!("cargo:warning=🎨 hikari-icons: Building selected MDI icons...");

    // Only include filled icons to reduce WASM size
    // Outline icons are only included where explicitly needed
    let config = IconConfig {
        selection: IconSelection::ByName(vec![
            // Navigation
            "chevron-left".into(),
            "chevron-right".into(),
            "chevron-up".into(),
            "chevron-down".into(),
            "chevron-double-right".into(),
            "menu".into(),
            "close".into(),
            // Actions
            "magnify".into(),
            "cog".into(),
            "check".into(),
            // Status / Feedback
            "alert".into(),
            "information".into(),
            "bell".into(),
            "bell-outline".into(),
            // Layout
            "home".into(),
            "view-column".into(),
            "image".into(),
            "cube-outline".into(),
            // Content
            "account".into(),
            "calendar".into(),
            "clock-outline".into(),
            "book".into(),
            "credit-card".into(),
            "text-box-edit".into(),
            "format-list-bulleted".into(),
            // Theme
            "moon-waning-crescent".into(),
            "white-balance-sunny".into(),
            // Other
            "gesture-tap".into(),
            "graph".into(),
            "heart".into(),
            "star".into(),
            "trophy-award".into(),
        ]),
        styles: vec![MdiStyle::Filled], // Only filled style to reduce WASM size
        output_file: "src/generated/mdi_selected.rs".into(),
        ..Default::default()
    };

    match hikari_builder::icons::build_selected_icons(&config) {
        Ok(()) => println!("cargo:warning=✅ MDI icons built successfully"),
        Err(e) => {
            println!("cargo:warning=⚠️  Failed to build MDI icons: {}", e);
            println!("cargo:warning=   Run: python scripts/icons/fetch_mdi_icons.py");
        }
    }

    println!("cargo:rerun-if-changed=../../packages/builder/generated/mdi_svgs");
    println!("cargo:rerun-if-changed=../../packages/builder/generated/mdi_styles.json");
}
