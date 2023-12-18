#![allow(non_snake_case)]

pub trait Routes: yew_router::Routable {}

pub trait AppProps {}

pub trait AppStates {}

#[derive(Debug, PartialEq, Clone)]
pub struct AppContext<T>
where
    T: AppProps,
{
    pub style_manager: stylist::manager::StyleManager,
    pub uri: String,
    pub queries: std::collections::HashMap<String, String>,
    pub page_data: T,
}

pub trait Application: DeriveApplicationType {
    fn switch(&self) -> yew::Html;

    fn App(&self) -> yew::Html;
    fn ServerApp(&self, props: &AppContext<<Self as DeriveApplicationType>::AppProps>)
        -> yew::Html;
}

pub trait DeriveApplicationType
where
    Self::Routes: Routes + yew_router::Routable,
    Self::AppProps: AppProps,
    Self::AppStates: AppStates,
{
    type Routes;
    type AppProps;
    type AppStates;
}
