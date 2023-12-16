#[derive(Debug, PartialEq, Clone)]
pub struct AppProps<PageContextEnum: PartialEq + Default> {
    pub style_manager: stylist::manager::StyleManager,
    pub uri: yew::AttrValue,
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
