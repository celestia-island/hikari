use serde::{Deserialize, Serialize};

use yew::prelude::*;
use yew_router::prelude::*;

use crate::pages::*;
use hikari_boot::{DeclType, DeriveApplication, DeriveRoutes, RoutesOutsideProps};

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
    pub primary_color: String,
    pub secondary_color: String,

    pub error_color: String,
    pub warning_color: String,
    pub success_color: String,
    pub info_color: String,

    pub primary_text_color: String,
    pub secondary_text_color: String,
    pub button_text_color: String,
    pub disabled_text_color: String,
    pub placeholder_text_color: String,

    pub shadow_color_rgba: String,
    pub background_color: String,

    pub large_text_size: String,
    pub medium_text_size: String,
    pub small_text_size: String,
}

#[derive(Clone, Debug, DeriveApplication)]
pub struct App;

impl DeclType for App {
    type Routes = Routes;
    type AppStates = AppStates;

    fn decl_render_outside(props: &RoutesOutsideProps<Self::AppStates>) -> yew::Html {
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

                --size-large-text: {};
                --size-medium-text: {};
                --size-small-text: {};
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
            props.states.primary_color.to_owned(),
            props.states.secondary_color.to_owned(),
            props.states.error_color.to_owned(),
            props.states.warning_color.to_owned(),
            props.states.success_color.to_owned(),
            props.states.info_color.to_owned(),
            props.states.primary_text_color.to_owned(),
            props.states.secondary_text_color.to_owned(),
            props.states.button_text_color.to_owned(),
            props.states.disabled_text_color.to_owned(),
            props.states.placeholder_text_color.to_owned(),
            props.states.shadow_color_rgba.to_owned(),
            props.states.background_color.to_owned(),
            props.states.large_text_size.to_owned(),
            props.states.medium_text_size.to_owned(),
            props.states.small_text_size.to_owned(),
        );

        yew::html! {
            <>
                <style>
                    {theme_raw}
                </style>
                <h1>{"Hikari DEMO"}</h1>
                {props.children.clone()}
            </>
        }
    }
}
