#![allow(dead_code)]
#![allow(non_snake_case)]

#[cfg(test)]
mod test {
    use serde::{Deserialize, Serialize};

    use yew::prelude::*;
    use yew_router::prelude::*;

    use hikari_boot::{Application, DeclType, DeriveApplication, DeriveRoutes, RoutesOutsideProps};

    #[function_component]
    fn Portal() -> yew::Html {
        html! {
            <div>{"Portal"}</div>
        }
    }

    #[derive(yew::Properties, Clone, PartialEq, Debug)]
    pub struct TestProps {
        pub id: String,
    }

    #[function_component]
    fn Test(props: &TestProps) -> yew::Html {
        html! {
            <div>{format!("Test {}", props.id)}</div>
        }
    }

    #[derive(PartialEq, Clone, Debug, DeriveRoutes, Routable)]
    pub enum Routes {
        #[at("/")]
        #[not_found]
        #[component(Portal)]
        Portal,

        #[at("/test/:id")]
        #[component(Test)]
        Test { id: String },
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

        fn decl_render_outside(props: &RoutesOutsideProps<Self::AppStates>) -> yew::Html {
            yew::html! {
                <>
                    <h1>{"Hikari DEMO"}</h1>
                    {props.children.clone()}
                </>
            }
        }
    }

    #[tokio::test]
    async fn render_on_server() -> anyhow::Result<()> {
        let html = App::render_to_string(
            "/test/123".to_string(),
            AppStates {
                color: "#114514".to_string(),
            },
        )
        .await;
        println!("{}", html);

        Ok(())
    }
}
