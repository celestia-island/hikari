use yew::prelude::*;
use yew_router::prelude::*;

use crate::pages::*;

#[derive(Routable, PartialEq, Eq, Clone, Debug)]
pub enum Route {
    #[at("/")]
    Portal,

    #[at("/t/:id")]
    Thread { id: String },

    #[at("/u/:id")]
    Personal { id: String },

    #[not_found]
    #[at("/404")]
    NotFound,
}

pub fn switch(routes: Route) -> Html {
    match routes {
        Route::Portal => {
            html! { <Portal /> }
        }
        Route::Thread { id } => {
            html! { <Thread {id} /> }
        }
        Route::Personal { id } => {
            html! { <Personal {id} /> }
        }
        Route::NotFound => {
            html! { <PageNotFound /> }
        }
    }
}
