#![allow(non_snake_case)]

pub trait DeclRoutes: ::yew_router::Routable {
    fn switch(routes: &Self) -> ::yew::Html;
}

#[derive(Debug, PartialEq, Clone, ::yew::Properties)]
pub struct AppContext<T>
where
    T: PartialEq + Clone + ::serde::Serialize + ::serde::Deserialize<'static>,
{
    pub style_manager: ::stylist::manager::StyleManager,
    pub url: String,
    pub states: T,
}

#[async_trait::async_trait]
pub trait Application: DeclType {
    async fn render_to_string(url: String, status: <Self as DeclType>::AppStates) -> String;
}

pub trait DeclType
where
    Self::Routes: DeclRoutes + ::yew_router::Routable,
    Self::AppStates: PartialEq + Clone + ::serde::Serialize + ::serde::Deserialize<'static>,
{
    type Routes;
    type AppStates;
}
