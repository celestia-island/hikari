#![allow(non_snake_case)]

pub trait DeriveRoutesTrait: yew_router::Routable {
    fn switch(&self) -> yew::Html;
}

pub trait DeriveAppPropsTrait {
    type AppProps;
}

pub trait DeriveAppStatesTrait {
    type AppStates;
}

#[derive(Debug, PartialEq, Clone)]
pub struct AppContext<T>
where
    T: DeriveAppPropsTrait,
{
    pub style_manager: stylist::manager::StyleManager,
    pub uri: String,
    pub queries: std::collections::HashMap<String, String>,
    pub page_data: T,
}

pub trait Application: DeriveApplication {
    fn App(&self) -> yew::Html;
    fn ServerApp(&self, props: &AppContext<<Self as DeriveApplication>::AppProps>) -> yew::Html;
}

pub trait DeriveApplication
where
    Self::Routes: DeriveRoutesTrait,
    Self::AppProps: DeriveAppPropsTrait,
    Self::AppStates: DeriveAppStatesTrait,
{
    type Routes;
    type AppProps;
    type AppStates;
}
