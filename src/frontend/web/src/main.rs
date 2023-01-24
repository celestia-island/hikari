mod app;
mod components;
mod pages;

use yew::Renderer;

use app::App;

fn main() {
    wasm_logger::init(wasm_logger::Config::default());

    #[cfg(feature = "web_env")]
    {
        Renderer::<App>::new().hydrate();
    }

    #[cfg(not(feature = "web_env"))]
    {
        Renderer::<App>::new().render();
    }
}
