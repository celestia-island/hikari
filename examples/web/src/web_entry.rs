use wasm_bindgen::prelude::*;
use web_sys::window;

use crate::{
    app::{App, AppStates},
    utils::rgb_to_dec,
};

#[derive(Clone)]
#[wasm_bindgen]
pub struct WebHandle {}

#[wasm_bindgen]
impl WebHandle {
    #[allow(clippy::new_without_default)]
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_log::init_with_level(log::Level::Debug).unwrap();
        Self {}
    }

    #[wasm_bindgen]
    pub async fn start(&self) -> Result<(), wasm_bindgen::JsValue> {
        <App as hikari_boot::Application>::render_with_root(
            window()
                .expect("Cannot get window object")
                .document()
                .expect("Cannot get document object")
                .get_element_by_id("app")
                .expect("Cannot get root element"),
            AppStates {
                primary_color: rgb_to_dec(0x4c8dae),
                secondary_color: rgb_to_dec(0x065279),

                error_color: rgb_to_dec(0xc3272b),
                warning_color: rgb_to_dec(0xca6924),
                success_color: rgb_to_dec(0x0aa344),
                info_color: rgb_to_dec(0xbacac6),

                primary_text_color: rgb_to_dec(0x161823),
                secondary_text_color: rgb_to_dec(0x50616d),
                button_text_color: rgb_to_dec(0xf0f0f4),
                disabled_text_color: rgb_to_dec(0xe0f0e9),
                placeholder_text_color: rgb_to_dec(0xc2ccd0),

                shadow_color_rgba: "rgba(0, 0, 0, 0.6)".into(),
                background_color: rgb_to_dec(0xf2fdff),

                large_text_size: "18px".into(),
                medium_text_size: "16px".into(),
                small_text_size: "14px".into(),
            },
        );
        Ok(())
    }
}
