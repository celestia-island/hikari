use wasm_bindgen::prelude::*;
use web_sys::window;

use crate::app::{App, AppStates};

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
        let el = gloo::utils::document().query_selector("#ssr_data")?;
        let states = el
            .ok_or(wasm_bindgen::JsError::new("Cannot find ssr_data element"))?
            .inner_html();
        let states: AppStates = serde_json::from_str(&states).map_err(|err| {
            wasm_bindgen::JsError::new(&format!("Cannot parse ssr_data element: {}", err))
        })?;

        <App as hikari_boot::Application>::render_with_root(
            window()
                .expect("Cannot get window object")
                .document()
                .expect("Cannot get document object")
                .get_element_by_id("app")
                .expect("Cannot get root element"),
            states,
        );
        Ok(())
    }
}


