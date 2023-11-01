use stylist::{
    manager::StyleManager,
    yew::{styled_component, ManagerProvider},
};
use yew::prelude::*;
use yew_router::{
    history::{AnyHistory, History, MemoryHistory},
    prelude::*,
};

use crate::utils::{
    app_props::AppProps,
    contexts::{
        app_props::{AppPageProps, AppPropsContextShell},
        theme::ThemeContextShell,
    },
    routes::{switch, Route},
};

#[function_component]
pub fn App() -> Html {
    let fallback = html! { <div>{"Loading..."}</div> };
    let style_manager = (*use_memo((), |_| {
        StyleManager::new().expect("failed to create style manager.")
    }))
    .to_owned();

    let page_data_el = web_sys::window()
        .expect("Cannot get the global window object")
        .document()
        .expect("Cannot get the global document object")
        .get_element_by_id("__ssr_data")
        .expect("Cannot get the root DOM element");
    let page_data = page_data_el.inner_html();
    let page_data = {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD_NO_PAD
            .decode(page_data)
            .unwrap()
    };
    let page_data = String::from_utf8(page_data).unwrap();
    let page_data: AppPageProps =
        serde_json::from_str(&page_data).expect("Failed to parse page data.");

    wasm_bindgen_futures::spawn_local(async move {
        page_data_el.remove();
    });

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
    html! {
        <>
            <Switch<Route> render={switch} />
        </>
    }
}
