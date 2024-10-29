use yuuka::derive_struct;

use yew_router::prelude::*;

use crate::pages::*;
use hikari_boot::{DeclType, DeriveApplication, DeriveRoutes, RoutesOutsideProps};
use hikari_components::prelude::element::designs::color::COLOR_MAP;
use hikari_theme::types::ColorMap;

#[derive(PartialEq, Clone, Debug, DeriveRoutes, Routable)]
pub enum Routes {
    #[at("/")]
    #[component(Portal)]
    Portal,

    #[at("/guide/:id")]
    #[component(Guide)]
    Guide { id: String },
    #[at("/component/:id")]
    #[component(Component)]
    Component { id: String },

    #[not_found]
    #[at("/404")]
    #[component(NotFound)]
    NotFound,
}

derive_struct!(AppStates {
    theme: {
        color: ColorMap = COLOR_MAP.clone()
    }
    data: enum PageData {
        Portal
        Guide { id: String, raw: String }
        Component(enum {
            Button,
            ButtonGroup,
            // TODO: Add more components.
        })
    } = Portal
});

#[derive(Clone, Debug, DeriveApplication)]
pub struct App;

impl DeclType for App {
    type Routes = Routes;
    type AppStates = AppStates;

    fn decl_render_outside(props: &RoutesOutsideProps<Self::AppStates>) -> yew::HtmlResult {
        let theme_raw = format!(
            r#"
            :root {{
                --color-primary: {};
                --color-secondary: {};

                --color-error: {};
                --color-warning: {};
                --color-success: {};
                --color-info: {};
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
            props.states.theme.color.primary.to_rgb_str(),
            props.states.theme.color.secondary.to_rgb_str(),
            props.states.theme.color.error.to_rgb_str(),
            props.states.theme.color.warning.to_rgb_str(),
            props.states.theme.color.success.to_rgb_str(),
            props.states.theme.color.info.to_rgb_str(),
        );

        Ok(yew::html! {
            <>
                <style>
                    {theme_raw}
                </style>

                {props.children.clone()}
            </>
        })
    }
}
