use stylist::yew::styled_component;
use wasm_bindgen::{throw_str, UnwrapThrowExt};
use yew::prelude::*;

use hikari_components::form::Button;
use hikari_theme::types::{ColorType, ComponentType};

use crate::{app::PageData, preload_data::PreloadDataContext};

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub id: ComponentType,
}

#[styled_component]
pub fn Component(props: &Props) -> Html {
    let status =
        use_context::<PreloadDataContext>().expect_throw("Cannot find preload data context");
    let (id, raw) = match &status.preload {
        PageData::Component { id, raw } => (id, raw),
        _ => throw_str("Invalid preload data"),
    };

    html! {
        <>
            <h1>{"Component"}</h1>
            <p>{format!("Component {:?}", props.id)}</p>

            <pre>
                <p>{id.to_string()}</p>
                <code>{raw}</code>
            </pre>

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
