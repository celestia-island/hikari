#![allow(dead_code)]
#![allow(non_snake_case)]

#[cfg(test)]
mod test {
    use serde::{Deserialize, Serialize};
    use yew::prelude::*;
    use yew_router::prelude::*;

    use hikari_boot::{
        DeriveAppProps, DeriveAppStates, DeriveApplication, DeriveApplicationType, DeriveRoutes,
    };

    #[function_component]
    fn Portal() -> yew::Html {
        html! {
            <div>{"Portal"}</div>
        }
    }

    #[derive(Properties, Clone, PartialEq, Debug, Serialize, Deserialize)]
    pub struct ThreadProps {
        pub id: String,
    }

    #[function_component]
    fn Thread(props: &ThreadProps) -> yew::Html {
        html! {
            <div>{format!("Thread {}", props.id)}</div>
        }
    }

    #[derive(PartialEq, Clone, Debug, DeriveRoutes, Routable)]
    pub enum Routes {
        #[at("/")]
        Portal,

        #[at("/t/:id")]
        Thread { id: String },
    }

    #[derive(PartialEq, Clone, Debug, DeriveAppStates, Serialize, Deserialize)]
    pub struct AppStates {
        pub color: String,
    }

    #[derive(PartialEq, Clone, Debug, DeriveAppProps, Serialize, Deserialize)]
    pub enum AppProps {
        #[component(Portal)]
        Portal,

        #[component(Thread)]
        Thread(ThreadProps),
    }

    #[derive(Clone, Debug, DeriveApplication)]
    pub struct App;

    impl DeriveApplicationType for App {
        type Routes = Routes;
        type AppProps = AppProps;
        type AppStates = AppStates;
    }

    #[test]
    fn render_on_server() {
        let html = App.ServerApp("/", AppProps::Portal);

        assert_eq!(
            html,
            yew::html! {
                <div>{"Portal"}</div>
            }
        );
    }

    #[wasm_bindgen_test::wasm_bindgen_test]
    fn render_on_client() {
        let html = App.App();

        assert_eq!(
            html,
            yew::html! {
                <div>{"Portal"}</div>
            }
        );
    }
}
