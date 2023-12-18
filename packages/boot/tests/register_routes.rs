#![allow(dead_code)]
#![allow(non_snake_case)]

#[cfg(test)]
mod test {
    use serde::{Deserialize, Serialize};
    use yew::prelude::*;
    use yew_router::prelude::*;

    use hikari_boot::{DeriveAppProps, DeriveAppStates, DeriveApplication, DeriveRoutes};

    #[function_component]
    fn Portal() -> yew::Html {
        html! {
            <div>{"Portal"}</div>
        }
    }

    // #[derive(yew::Properties, PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
    // pub struct ThreadProps {
    //     pub id: String,
    // }

    // #[function_component]
    // fn Thread(props: &ThreadProps) -> yew::Html {
    //     html! {
    //         <div>{format!("Thread {}", props.id)}</div>
    //     }
    // }

    #[derive(Clone, Debug)]
    pub struct Router;

    impl DeriveApplication for Router {
        type Routes = Routes;
        type AppProps = PageProps;
        type AppStates = Theme;
    }

    #[derive(PartialEq, Eq, Clone, Debug, DeriveRoutes, Routable)]
    pub enum Routes {
        #[at("/")]
        #[component(Portal)]
        Portal,
        //
        // #[at("/t/:id")]
        // #[component(Thread)]
        // Thread { id: String },
    }

    #[derive(PartialEq, Eq, Clone, Debug, DeriveAppStates, Serialize, Deserialize)]
    pub struct Theme {
        pub color: String,
    }

    #[derive(PartialEq, Eq, Clone, Debug, DeriveAppProps, Serialize, Deserialize)]
    pub enum PageProps {
        Portal,
        //
        // Thread {
        //     id: String,
        // },
    }
}
