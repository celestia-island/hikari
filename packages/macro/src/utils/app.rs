use proc_macro2::TokenStream;
use quote::quote;
use syn::parse::{Parse, ParseStream};
use syn::spanned::Spanned;
use syn::{Data, DeriveInput, Ident};

pub struct DeriveApp {
    ident: Ident,
}

impl Parse for DeriveApp {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let DeriveInput { ident, data, .. } = input.parse()?;

        match data {
            Data::Enum(e) => {
                return Err(syn::Error::new(
                    e.enum_token.span(),
                    "expected struct, found enum",
                ))
            }
            Data::Struct(data) => data,
            Data::Union(u) => {
                return Err(syn::Error::new(
                    u.union_token.span(),
                    "expected enum, found union",
                ))
            }
        };

        Ok(Self { ident })
    }
}

pub fn root(input: DeriveApp) -> TokenStream {
    let DeriveApp { ident, .. } = &input;

    quote! {
        #[::yew::function_component]
        pub fn HikariApp() -> yew::Html {
            use ::stylist::{manager::StyleManager, yew::ManagerProvider};
            use ::yew::prelude::*;
            use ::yew_router::BrowserRouter;

            let fallback = html! { <div>{"Loading..."}</div> };
            let style_manager = (*use_memo((), |_| {
                StyleManager::new().expect("failed to create style manager.")
            }))
            .to_owned();

            let page_data_el = web_sys::window()
                .expect("Cannot get the global window object")
                .document()
                .expect("Cannot get the global document object")
                .get_element_by_id("ssr_data")
                .expect("Cannot get the root DOM element");
            let page_data = page_data_el.inner_html();
            let page_data = {
                use base64::Engine;
                base64::engine::general_purpose::STANDARD_NO_PAD
                    .decode(page_data)
                    .unwrap()
            };
            let page_data = String::from_utf8(page_data).unwrap();
            let page_data: <#ident as ::hikari_boot::DeclType>::AppStates =
                serde_json::from_str(&page_data).expect("Failed to parse page data.");

            wasm_bindgen_futures::spawn_local(async move {
                page_data_el.remove();
            });

            html! {
                <Suspense {fallback}>
                    <ManagerProvider manager={style_manager}>
                        <BrowserRouter>
                            <HikariContextShell states={page_data} />
                        </BrowserRouter>
                    </ManagerProvider>
                </Suspense>
            }
        }

        #[::yew::function_component]
        pub fn HikariServerApp(
            props: &::hikari_boot::AppContext<<#ident as ::hikari_boot::DeclType>::AppStates>
        ) -> yew::Html {
            use ::stylist::yew::ManagerProvider;
            use ::yew::prelude::*;
            use ::yew_router::{
                history::{AnyHistory, History, MemoryHistory},
                prelude::*,
            };

            let fallback = html! { <div>{"Loading..."}</div> };
            let history = AnyHistory::from(MemoryHistory::new());
            history.push(&props.url);

            html! {
                <Suspense {fallback}>
                    <ManagerProvider manager={props.style_manager.clone()}>
                        <Router history={history}>
                            <HikariContextShell states={props.states.to_owned()} />
                        </Router>
                    </ManagerProvider>
                </Suspense>
            }
        }

        #[derive(Clone, Debug, PartialEq, ::yew::Properties)]
        struct HikariContextShellProps {
            states: <#ident as ::hikari_boot::DeclType>::AppStates,
        }


        #[::yew::function_component]
        fn HikariContextShell(states: &HikariContextShellProps) -> yew::Html {
            use yew::prelude::*;

            type AppStates = <#ident as ::hikari_boot::DeclType>::AppStates;
            type AppStatesContextProviderType = UseStateHandle<AppStates>;
            let ctx = use_state(|| states.states.to_owned());

            html! {
                <ContextProvider<AppStatesContextProviderType> context={ctx.clone()}>
                    {
                        <#ident as ::hikari_boot::DeclType>::render_outside(&::hikari_boot::RoutesOutsideProps {
                            children: ::yew::html! {
                                <HikariRoutesContent />
                            }
                        })
                    }
                </ContextProvider<AppStatesContextProviderType>>
            }
        }

        #[::yew::function_component]
        pub fn HikariRoutesContent() -> yew::Html {
            use yew::prelude::*;

            html! {
                <Switch<<#ident as ::hikari_boot::DeclType>::Routes>
                    render={
                        |r| {
                            <<#ident as ::hikari_boot::DeclType>::Routes as ::hikari_boot::DeclRoutes>::switch(&r)
                        }
                    }
                />
            }
        }

        #[automatically_derived]
        #[::async_trait::async_trait]
        impl ::hikari_boot::Application for #ident {
            async fn render_to_string(url: String, states: <#ident as ::hikari_boot::DeclType>::AppStates) -> String {
                use ::stylist::manager::{render_static, StyleManager};
                use ::yew::ServerRenderer;

                let (writer, reader) = render_static();
                let renderer = ServerRenderer::<HikariServerApp>::with_props(move || {
                    let style_manager = StyleManager::builder().writer(writer).build().unwrap();
                    ::hikari_boot::AppContext {
                        style_manager,
                        url,
                        states,
                    }
                });
                let html_raw = renderer.render().await;

                let style_data = reader.read_style_data();
                let mut style_raw = String::new();
                style_data.write_static_markup(&mut style_raw).unwrap();

                format!("
                    <!DOCTYPE html>
                    <html lang='en'>
                        <head>
                            <meta charset='utf-8'>
                            <meta name='viewport' content='width=device-width, initial-scale=1'>
                            <style>{style_raw}</style>
                        </head>
                        <body>
                            <textarea id='ssr_data' style='display: none;'>{{}}</textarea>
                            <div id='app'>{html_raw}</div>
                            <script src='/a.js'></script>
                            <script>(async () => {{await wasm_vendor_entry('/a.wasm');(await (new wasm_vendor_entry.WebHandle())).start();}})()</script>
                        </body>
                    </html>
                ")
            }
        }
    }
}
