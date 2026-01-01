use stylist::yew::styled_component;
use wasm_bindgen::{throw_str, UnwrapThrowExt};
use yew::prelude::*;

use crate::{app::PageData, preload_data::PreloadDataContext};

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub id: String,
}

#[styled_component]
pub fn Guide(props: &Props) -> Html {
    let status =
        use_context::<PreloadDataContext>().expect_throw("Cannot find preload data context");
    let (path, raw) = match &status.preload {
        PageData::Guide { path, raw } => (path, raw),
        _ => throw_str("Invalid preload data"),
    };

    html! {
        <>
            <h1>{"Guide"}</h1>
            <p>{format!("Guide {}", props.id)}</p>

            <pre>
                <p>{path}</p>
                <code>{raw}</code>
            </pre>
        </>
    }
}


