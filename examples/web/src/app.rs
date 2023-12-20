use serde::{Deserialize, Serialize};

use yew::prelude::*;
use yew_router::prelude::*;

use crate::pages::*;
use hikari_boot::{DeclType, DeriveApplication, DeriveRoutes, RoutesOutsideProps};

use self::_HikariContextShellProps::states;

#[derive(PartialEq, Clone, Debug, DeriveRoutes, Routable)]
pub enum Routes {
    #[at("/")]
    #[component(Portal)]
    Portal,

    #[at("/t/:id")]
    #[component(Thread)]
    Thread { id: String },

    #[at("/u/:id")]
    #[component(Personal)]
    Personal { id: String },

    #[not_found]
    #[at("/404")]
    #[component(NotFound)]
    NotFound,
}

#[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
pub struct AppStates {
    pub user: String,
}

#[derive(Clone, Debug, DeriveApplication)]
pub struct App;

impl DeclType for App {
    type Routes = Routes;
    type AppStates = AppStates;

    fn decl_render_outside(props: &RoutesOutsideProps) -> yew::Html {
        yew::html! {
            <>
                <h1>{"Hikari DEMO"}</h1>
                {props.children.clone()}
            </>
        }
    }
}
