use std::collections::HashMap;

use stylist::manager::StyleManager;
use yew::prelude::*;

use crate::utils::contexts::app_props::AppPageProps;

#[derive(Properties, PartialEq)]
pub struct AppProps {
    pub style_manager: StyleManager,
    pub url: AttrValue,
    pub queries: HashMap<String, String>,
    pub page_data: AppPageProps,
}
