use std::collections::HashMap;

use stylist::{
    manager::StyleManager,
    yew::{styled_component, ManagerProvider},
};
use yew::prelude::*;
use yew_router::{
    history::{AnyHistory, History, MemoryHistory},
    prelude::*,
};

use crate::components::container::{AsideLayout, FooterLayout, HeaderLayout, MainLayout};
use crate::pages::{home::Home, page_not_found::PageNotFound};
use crate::utils::contexts::theme::{ThemeContextProviderType, ThemeContextShell};

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
                    <ContextShell />
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
                    <ContextShell />
                </Router>
            </ManagerProvider>
        </Suspense>
    }
}

#[function_component]
fn ContextShell() -> Html {
    html! {
        <ThemeContextShell>
            <Content />
        </ThemeContextShell>
    }
}

#[styled_component]
pub fn Content() -> Html {
    let theme = use_context::<ThemeContextProviderType>().expect("Theme context not found.");
    let theme_raw = format!(
        r#"
            :root {{
                --color-primary: {};
                --color-secondary: {};

                --color-error: {};
                --color-warning: {};
                --color-success: {};
                --color-info: {};

                --color-primary-text: {};
                --color-secondary-text: {};
                --color-button-text: {};
                --color-disabled-text: {};
                --color-placeholder-text: {};

                --color-shadow-rgba: {};
                --color-background: {};
            }}

            
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}

            body {{
                font-family: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
                background-color: rgb(var(--color-background));
                color: rgb(var(--color-primary-text));
            }}
        "#,
        theme.primary_color.to_owned(),
        theme.secondary_color.to_owned(),
        theme.error_color.to_owned(),
        theme.warning_color.to_owned(),
        theme.success_color.to_owned(),
        theme.info_color.to_owned(),
        theme.primary_text_color.to_owned(),
        theme.secondary_text_color.to_owned(),
        theme.button_text_color.to_owned(),
        theme.disabled_text_color.to_owned(),
        theme.placeholder_text_color.to_owned(),
        theme.shadow_color_rgba.to_owned(),
        theme.background_color.to_owned(),
    );

    html! {
        <>
            <style>
                {theme_raw}
            </style>

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
