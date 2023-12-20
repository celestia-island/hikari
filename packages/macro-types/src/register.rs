#![allow(non_snake_case)]

pub trait DeclRoutes: ::yew_router::Routable {
    fn switch(routes: &Self) -> ::yew::Html;
}

#[derive(::yew::Properties, Debug, PartialEq, Clone)]
pub struct AppContextForServer<T>
where
    T: PartialEq + Clone + ::serde::Serialize + ::serde::Deserialize<'static>,
{
    pub style_manager: ::stylist::manager::StyleManager,
    pub url: String,
    pub states: T,
}

#[derive(::yew::Properties, Debug, PartialEq, Clone)]
pub struct AppContextForClient<T>
where
    T: PartialEq + Clone + ::serde::Serialize + ::serde::Deserialize<'static>,
{
    pub states: T,
}

#[derive(::yew::Properties, Debug, PartialEq, Clone)]
pub struct RoutesOutsideProps<States>
where
    States: PartialEq + Clone + ::serde::Serialize + ::serde::Deserialize<'static>,
{
    pub children: ::yew::Html,
    pub states: States,
}

#[async_trait::async_trait]
pub trait Application: DeclType
where
    Self::ClientApp: ::yew::BaseComponent,
    Self::ServerApp: ::yew::BaseComponent,
{
    type ClientApp;
    type ServerApp;

    async fn render_to_string(url: String, states: <Self as DeclType>::AppStates) -> String;

    fn render_with_root(
        root: web_sys::Element,
        states: <Self as DeclType>::AppStates,
    ) -> ::yew::prelude::AppHandle<Self::ClientApp>;
}

pub trait DeclType
where
    Self::Routes: DeclRoutes + ::yew_router::Routable,
    Self::AppStates: PartialEq + Clone + ::serde::Serialize + ::serde::Deserialize<'static>,
{
    type Routes;
    type AppStates;

    fn decl_render_outside(props: &RoutesOutsideProps<Self::AppStates>) -> ::yew::Html {
        ::yew::html! {
            <>
                {props.children.clone()}
            </>
        }
    }

    fn render_to_string_outside(
        style_raw: String,
        html_raw: String,
        state: Self::AppStates,
    ) -> String {
        let state = ::serde_json::to_string(&state).unwrap();

        format!("
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset='utf-8'>
                    <meta name='viewport' content='width=device-width, initial-scale=1'>
                    <style>{style_raw}</style>
                </head>
                <body>
                    <textarea id='ssr_data' style='display: none;'>{state}</textarea>
                    <div id='app'>{html_raw}</div>
                    <script src='/a.js'></script>
                    <script>(async () => {{await wasm_vendor_entry('/a.wasm');(await (new wasm_vendor_entry.WebHandle())).start();}})()</script>
                </body>
            </html>
        ")
    }
}
