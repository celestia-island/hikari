// demo-app/src/app.rs
// Main application component

use dioxus::prelude::*;
use dioxus_router::components::Router;

use crate::pages::*;

#[derive(Clone, Routable, Debug, PartialEq)]
pub enum Route {
    #[route("/")]
    Home {},
    #[route("/basic")]
    BasicComponents {},
    #[route("/feedback")]
    FeedbackComponents {},
    #[route("/navigation")]
    NavigationComponents {},
    #[route("/data")]
    DataComponents {},
}

#[allow(non_snake_case)]
pub fn App() -> Element {
    rsx! {
        Router::<Route> {}
    }
}
