mod app;
mod components;
mod pages;
mod utils;

use web_sys::window;
use yew::Renderer;

use app::App;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    wasm_logger::init(wasm_logger::Config::default());

    #[cfg(feature = "web_env")]
    {
        Renderer::<App>::with_root(
            window()
                .ok_or("Cannot get window object")?
                .document()
                .ok_or("Cannot get document object")?
                .get_element_by_id("app")
                .ok_or("Cannot get root element")?,
        )
        .hydrate();
    }

    #[cfg(not(feature = "web_env"))]
    {
        console_log::init_with_level(log::Level::Debug).unwrap();
        Renderer::<App>::with_root(
            window()
                .ok_or("Cannot get window object")?
                .document()
                .ok_or("Cannot get document object")?
                .get_element_by_id("app")
                .ok_or("Cannot get root element")?,
        )
        .render();
    }

    Ok(())
}
