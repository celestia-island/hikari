use serde::{Deserialize, Serialize};
use yuuka::derive_struct;

use yew_router::prelude::*;

use crate::pages::*;
use hikari_boot::{DeclType, DeriveApplication, DeriveRoutes, RoutesOutsideProps};
use hikari_theme::{
    context::{Theme, ThemeContextShell},
    types::ComponentType,
};

#[derive(PartialEq, Clone, Debug, DeriveRoutes, Routable)]
pub enum Routes {
    #[at("/")]
    #[component(Portal)]
    Portal,

    #[at("/guide/:id")]
    #[component(Guide)]
    Guide { id: String },
    #[at("/component/*id")]
    #[component(Component)]
    Component { id: ComponentType },

    #[not_found]
    #[at("/404")]
    #[component(NotFound)]
    NotFound,
}

derive_struct!(
    #[derive(PartialEq, Serialize, Deserialize)]
    pub AppStates {
        theme: Theme,
        data: enum PageData {
            Portal
            Guide { path: String, raw: String }
            Component { id: ComponentType, raw: String }
        } = Portal
    }
);

#[derive(Clone, Debug, DeriveApplication)]
pub struct App;

impl DeclType for App {
    type Routes = Routes;
    type AppStates = AppStates;

    fn decl_render_outside(props: &RoutesOutsideProps<Self::AppStates>) -> yew::HtmlResult {
        Ok(yew::html! {
            <ThemeContextShell context={props.states.theme.clone()}>
                <crate::preload_data::Provider preload_data={props.states.data.clone()}>
                    {props.children.clone()}
                </crate::preload_data::Provider>
            </ThemeContextShell>
        })
    }
}
