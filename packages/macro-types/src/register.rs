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

#[derive(Debug, PartialEq, Clone, ::yew::Properties)]
pub struct RoutesOutsideProps {
    pub children: ::yew::Html,
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

    fn render_outside(props: &RoutesOutsideProps) -> ::yew::Html {
        ::yew::html! {
            <>
                {props.children.clone()}
            </>
        }
    }

    fn render_to_string_outside(
        style_raw: String,
        html_raw: String,
        state: &Self::AppStates,
    ) -> String {
        let state = ::serde_json::to_string(state).unwrap();

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
