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
        pub fn HikariClientApp(
            props: &::hikari_boot::AppContextForClient<<#ident as ::hikari_boot::DeclType>::AppStates>
        ) -> yew::Html {
            use ::stylist::{manager::StyleManager, yew::ManagerProvider};
            use ::yew::prelude::*;
            use ::yew_router::BrowserRouter;

            let style_manager = (*use_memo((), |_| {
                StyleManager::new().expect("Failed to create style manager.")
            }))
            .to_owned();
            let suspense_html = html! { <div> {"Loading"} </div> };

            html! {
                <Suspense fallback={suspense_html}>
                    <ManagerProvider manager={style_manager}>
                        <BrowserRouter>
                            <HikariContextShell states={props.states.clone()} />
                        </BrowserRouter>
                    </ManagerProvider>
                </Suspense>
            }
        }

        #[::yew::function_component]
        pub fn HikariServerApp(
            props: &::hikari_boot::AppContextForServer<<#ident as ::hikari_boot::DeclType>::AppStates>
        ) -> yew::Html {
            use ::stylist::yew::ManagerProvider;
            use ::yew::prelude::*;
            use ::yew_router::{
                history::{AnyHistory, History, MemoryHistory},
                prelude::*,
            };

            let history = AnyHistory::from(MemoryHistory::new());
            history.push(&props.url);
            let suspense_html = html! { <div> {"Loading"} </div> };

            html! {
                <Suspense fallback={suspense_html}>
                    <ManagerProvider manager={props.style_manager.clone()}>
                        <Router history={history}>
                            <HikariContextShell states={props.states.clone()} />
                        </Router>
                    </ManagerProvider>
                </Suspense>
            }
        }

        #[derive(::yew::Properties, Clone, Debug, PartialEq)]
        struct HikariContextShellProps {
            states: <#ident as ::hikari_boot::DeclType>::AppStates,
        }


        #[::yew::function_component]
        fn HikariContextShell(props: &HikariContextShellProps) -> yew::HtmlResult {
            use yew::prelude::*;

            let ctx = use_state(|| props.states.clone());

            Ok(html! {
                <ContextProvider
                    <UseStateHandle<<#ident as ::hikari_boot::DeclType>::AppStates>>
                    context={ctx.clone()}
                >
                    {
                        <#ident as ::hikari_boot::DeclType>::decl_render_outside(
                            &::hikari_boot::RoutesOutsideProps {
                                children: ::yew::html! {
                                    <HikariRoutesContent />
                                },
                                states: props.states.clone(),
                            },
                        ).unwrap()
                    }
                </ContextProvider<UseStateHandle<<#ident as ::hikari_boot::DeclType>::AppStates>>>
            })
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
            type ClientApp = HikariClientApp;
            type ServerApp = HikariServerApp;

            async fn render_to_string(url: String, states: <#ident as ::hikari_boot::DeclType>::AppStates) -> ::anyhow::Result<String> {
                use ::stylist::manager::{render_static, StyleManager};
                use ::yew::ServerRenderer;

                let url = url.split('?').next().ok_or(::anyhow::anyhow!("Failed to get url path from '{}'", url))?.to_string();
                let (writer, reader) = render_static();

                let renderer = ServerRenderer::<<#ident as ::hikari_boot::Application>::ServerApp>::with_props({
                    let states = states.clone();
                    move || {
                        let style_manager = StyleManager::builder()
                            .writer(writer)
                            .build()
                            .expect("Failed to create style manager with writer.");
                        ::hikari_boot::AppContextForServer {
                            style_manager,
                            url,
                            states,
                        }
                    }
                });
                let html_raw = renderer.render().await;

                let style_data = reader.read_style_data();
                let mut style_raw = String::new();
                style_data.write_static_markup(&mut style_raw)?;

                Ok(<#ident as ::hikari_boot::DeclType>::render_to_string_outside(style_raw, html_raw, states)?)
            }

            fn render_with_root(
                root: web_sys::Element,
                states: <#ident as ::hikari_boot::DeclType>::AppStates
            ) -> ::yew::prelude::AppHandle<<#ident as ::hikari_boot::Application>::ClientApp> {
                ::yew::Renderer::<<#ident as ::hikari_boot::Application>::ClientApp>::with_root_and_props(
                    root,
                    ::hikari_boot::AppContextForClient {
                        states
                    }
                ).render()
            }

            fn hydrate_with_root(
                root: web_sys::Element,
                states: <#ident as ::hikari_boot::DeclType>::AppStates
            ) -> ::yew::prelude::AppHandle<<#ident as ::hikari_boot::Application>::ClientApp> {
                ::yew::Renderer::<<#ident as ::hikari_boot::Application>::ClientApp>::with_root_and_props(
                    root,
                    ::hikari_boot::AppContextForClient {
                        states
                    }
                ).hydrate()
            }
        }
    }
}
