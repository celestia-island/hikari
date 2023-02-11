use base64::Engine;
use log::info;

use stylist::{
    manager::StyleManager,
    yew::{styled_component, ManagerProvider},
};
use web_sys::window;
use yew::prelude::*;
use yew_router::{
    history::{AnyHistory, History, MemoryHistory},
    prelude::*,
};

use crate::utils::{
    app_props::AppProps,
    contexts::{
        app_props::AppPropsContextShell,
        theme::{ThemeContextProviderType, ThemeContextShell},
    },
    routes::{switch, Route},
};
use crate::{
    components::container::{AsideLayout, ContainerLayout, FooterLayout, HeaderLayout, MainLayout},
    utils::contexts::app_props::AppPageProps,
};

#[function_component]
pub fn App() -> Html {
    let fallback = html! { <div>{"Loading..."}</div> };
    let style_manager = (*use_memo(|_| StyleManager::new().unwrap(), ())).to_owned();

    let page_data_el = window()
        .unwrap()
        .document()
        .unwrap()
        .get_element_by_id("__ssr_data")
        .unwrap();
    let page_data = page_data_el.inner_html();
    let page_data = base64::engine::general_purpose::STANDARD_NO_PAD
        .decode(page_data)
        .unwrap();
    let page_data = String::from_utf8(page_data).unwrap();
    let page_data: AppPageProps =
        serde_json::from_str(&page_data).expect("Failed to parse page data.");

    wasm_bindgen_futures::spawn_local(async move {
        page_data_el.remove();
    });
    info!("{:?}", page_data);

    html! {
        <Suspense {fallback}>
            <ManagerProvider manager={style_manager}>
                <BrowserRouter>
                    <ContextShell page_props={page_data} />
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
            <ManagerProvider manager={props.style_manager.clone()}>
                <Router history={history}>
                    <ContextShell page_props={props.page_data.clone()} />
                </Router>
            </ManagerProvider>
        </Suspense>
    }
}

#[derive(Properties, Debug, PartialEq)]
struct ContextProps {
    #[prop_or(AppPageProps::Portal{id: "".into(), thread_list: vec![]})]
    pub page_props: AppPageProps,
}

#[function_component]
fn ContextShell(props: &ContextProps) -> Html {
    html! {
        <ThemeContextShell>
            <AppPropsContextShell page_props={props.page_props.to_owned()}>
                <Content />
            </AppPropsContextShell>
        </ThemeContextShell>
    }
}

#[styled_component]
pub fn Content() -> Html {
    let theme = use_context::<ThemeContextProviderType>().unwrap();
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

            <ContainerLayout>
                <HeaderLayout>
                    <img src="/logo.png" alt="logo" class={css!(r#"
                        width: 48px;
                        height: 48px;
                        margin: 8px;
                    "#)} />
                    <h1>{"Header"}</h1>
                </HeaderLayout>

                <ContainerLayout>
                    <AsideLayout>
                        <p>{"Aside"}</p>
                    </AsideLayout>

                    <ContainerLayout>
                        <MainLayout>
                            <Switch<Route> render={switch} />
                        </MainLayout>

                        <FooterLayout>
                            <p>{"Footer"}</p>
                        </FooterLayout>
                    </ContainerLayout>
                </ContainerLayout>
            </ContainerLayout>
        </>
    }
}
