use std::collections::HashMap;

use stylist::css;
use stylist::manager::StyleManager;
use stylist::yew::{styled_component, Global, ManagerProvider};
use yew::prelude::*;
use yew_router::history::{AnyHistory, History, MemoryHistory};
use yew_router::prelude::*;

use crate::components::container::{AsideLayout, FooterLayout, HeaderLayout, MainLayout};
use crate::pages::home::Home;
use crate::pages::page_not_found::PageNotFound;
use crate::utils::store::ContextShell;

#[derive(Properties, PartialEq)]
pub struct AppProps {
    pub manager: StyleManager,
    pub url: AttrValue,
    pub queries: HashMap<String, String>,
}

#[function_component]
pub fn App() -> Html {
    let fallback = html! { <div>{"Loading..."}</div> };
    let style_manager = (*use_memo(|_| StyleManager::new().unwrap(), ())).to_owned();

    html! {
        <Suspense {fallback}>
            <ManagerProvider manager={style_manager}>
                <BrowserRouter>
                    <Content />
                </BrowserRouter>
            </ManagerProvider>
        </Suspense>
    }
}

#[function_component]
pub fn ServerApp(props: &AppProps) -> Html {
    let fallback = html! { <div>{"Loading..."}</div> };
    let history = AnyHistory::from(MemoryHistory::new());
    history
        .push_with_query(&*props.url, &props.queries)
        .unwrap();

    html! {
        <Suspense {fallback}>
            <ManagerProvider manager={props.manager.clone()}>
                <Router history={history}>
                    <Content />
                </Router>
            </ManagerProvider>
        </Suspense>
    }
}

#[styled_component]
pub fn Content() -> Html {
    html! {
        <>
            <ContextShell>
                <Global css={css!(r#"
                    html, body {
                        margin: 0;
                        padding: 0;
                    }

                    * {
                        box-sizing: border-box;
                    }
                "#)} />

                <HeaderLayout>
                    <h1>{"Header"}</h1>
                </HeaderLayout>

                <MainLayout>
                    <Switch<Route> render={switch} />
                </MainLayout>

                <AsideLayout>
                    <p>{"Aside"}</p>
                </AsideLayout>

                <FooterLayout>
                    <p>{"Footer"}</p>
                </FooterLayout>
            </ContextShell>
        </>
    }
}

#[derive(Routable, PartialEq, Eq, Clone, Debug)]
pub enum Route {
    #[at("/")]
    Home,
    #[not_found]
    #[at("/404")]
    NotFound,
}

fn switch(routes: Route) -> Html {
    match routes {
        Route::Home => {
            html! { <Home /> }
        }
        Route::NotFound => {
            html! { <PageNotFound /> }
        }
    }
}
