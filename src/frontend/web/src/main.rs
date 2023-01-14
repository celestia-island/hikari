mod app;
mod components;
mod pages;

use app::App;

fn main() {
    wasm_logger::init(wasm_logger::Config::default());
    yew::Renderer::<App>::new().hydrate();
    // yew::Renderer::<App>::new().render();
}
