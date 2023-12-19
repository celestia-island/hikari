#![allow(dead_code)]
#![allow(non_snake_case)]

#[cfg(test)]
mod test {
    use serde::{Deserialize, Serialize};

    use yew::prelude::*;
    use yew_router::prelude::*;

    use hikari_boot::{Application, DeclType, DeriveApplication, DeriveRoutes};

    #[function_component]
    fn Portal() -> yew::Html {
        html! {
            <div>{"Portal"}</div>
        }
    }

    #[derive(PartialEq, Clone, Debug, DeriveRoutes, Routable)]
    pub enum Routes {
        #[at("/")]
        #[component(Portal)]
        Portal,
    }

    #[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
    pub struct AppStates {
        pub color: String,
    }

    #[derive(Clone, Debug, DeriveApplication)]
    pub struct App;

    impl DeclType for App {
        type Routes = Routes;
        type AppStates = AppStates;
    }

    #[tokio::test]
    async fn render_on_server() -> anyhow::Result<()> {
        let html = App::render_to_string(
            "/".to_string(),
            AppStates {
                color: "#114514".to_string(),
            },
        )
        .await;
        println!("{}", html);

        Ok(())
    }

    #[cfg(all(target_arch = "wasm32", not(target_os = "wasi")))]
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
