use stylist::yew::styled_component;
use yew::prelude::*;

use hikari_components::form::Button;
use hikari_theme::types::{ColorType, ComponentType};

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub id: ComponentType,
}

#[styled_component]
pub fn Component(props: &Props) -> Html {
    html! {
        <>
            <h1>{"Component"}</h1>
            <p>{format!("Component {:?}", props.id)}</p>

            <Button
                color={ColorType::Primary}
                on_click={move |_| {
                    log::info!("Button clicked");
                }}
            >
                {"Button"}
            </Button>
        </>
    }
}
