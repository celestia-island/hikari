#[macro_export]
macro_rules! register_routes {
    // TODO - 改为传入一个 ident 作为标记模块名之后，直接书写各种数据结构的定义
    //        然后以开头的 ident 作为模块名，直接写出一整个命名空间
    ($mod_name: ident, $route_enum:path, $switch_fn:path, $page_props:path, $app_props_context: path, $app_states_context:path) => {
        mod $mod_name {
            use $app_props_context;
            use $app_states_context;
            use $page_props;
            use $route_enum;
            use $switch_fn;

            #[derive(yew::Properties, PartialEq, Debug)]
            pub struct AppProps {
                pub style_manager: stylist::manager::StyleManager,
                pub url: yew::AttrValue,
                pub queries: std::collections::HashMap<String, String>,
                pub page_data: $page_props,
            }

            #[yew::function_component]
            pub fn App() -> yew::Html {
                use stylist::{manager::StyleManager, yew::ManagerProvider};
                use yew::prelude::*;
                use yew_router::BrowserRouter;

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

            #[yew::function_component]
            pub fn ServerApp(props: &AppProps) -> yew::Html {
                use stylist::yew::ManagerProvider;
                use yew::prelude::*;
                use yew_router::{
                    history::{AnyHistory, History, MemoryHistory},
                    prelude::*,
                };

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

            #[derive(yew::Properties, Debug, PartialEq)]
            struct ContextProps {
                #[prop_or(AppPageProps::Portal{id: "".into(), thread_list: vec![]})]
                pub page_props: AppPageProps,
            }

            #[yew::function_component]
            fn ContextShell(props: &ContextProps) -> yew::Html {
                use yew::prelude::*;

                html! {
                    <$app_states_context>
                        <$app_props_context page_props={props.page_props.to_owned()}>
                            <Content />
                        </$app_props_context>
                    </$app_states_context>
                }
            }

            #[stylist::yew::styled_component]
            pub fn Content() -> yew::Html {
                use yew::prelude::*;
                use yew_router::prelude::*;

                html! {
                    <>
                        <Switch<$route_enum> render={$switch_fn} />
                    </>
                }
            }
        }
    };
}

#[derive(Debug, PartialEq, Clone)]
pub struct AppProps<PageContextEnum: PartialEq + Default> {
    pub style_manager: stylist::manager::StyleManager,
    pub url: yew::AttrValue,
    pub queries: std::collections::HashMap<String, String>,
    pub page_data: PageContextEnum,
}

#[derive(yew::Properties, Debug, PartialEq, Clone)]
pub struct ContextProps<PageContextEnum: PartialEq + Default> {
    #[prop_or_default]
    pub page_props: PageContextEnum,
}

pub trait WebClient<PageContextEnum: PartialEq + Default> {
    // <..., StateContextEnum>
    #[allow(non_snake_case)]
    fn App(&self) -> yew::Html;
    #[allow(non_snake_case)]
    fn ServerApp(&self, props: &AppProps<PageContextEnum>) -> yew::Html;
}
