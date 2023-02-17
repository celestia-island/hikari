use log::info;
use wasm_bindgen::{JsCast, UnwrapThrowExt};
use web_sys::{Event, HtmlInputElement, InputEvent};

use gloo::net::http::Request;
use stylist::yew::styled_component;
use yew::prelude::*;

use crate::components::{
    form::{Button, TextInput},
    Color, Size,
};

#[styled_component]
pub fn Portal() -> Html {
    let is_fetching = use_state(|| false);
    let url = use_state(|| "/test".to_string());
    let data = use_state(|| "Ready to fetch".to_string());

    let onclick = {
        let is_fetching = is_fetching.clone();
        let url = url.clone();
        let data = data.clone();
        Callback::from(move |_| {
            is_fetching.set(true);

            let is_fetching = is_fetching.to_owned();
            let url = url.to_owned();
            let data = data.to_owned();

            wasm_bindgen_futures::spawn_local(async move {
                match Request::get(&*url).send().await {
                    Ok(response) => {
                        let raw = (&response).text().await.unwrap();
                        info!("{:?}", response);
                        data.set(raw);
                    }
                    Err(err) => {
                        info!("{:?}", err);
                        data.set("Failed to Fetch".to_string());
                    }
                };
                is_fetching.set(false);
            });
        })
    };

    html! {
        <>
            <TextInput
                value={
                    (*(url.clone())).clone()
                }
                oninput={{
                    let url = url.clone();
                    Callback::from(
                    move |event: InputEvent| {
                        let event: Event = event.dyn_into().unwrap_throw();
                        let event_target = event.target().unwrap_throw();
                        let target: HtmlInputElement = event_target.dyn_into().unwrap_throw();
                        url.set(target.value())
                    }
                )}}
            />
            <Button onclick={onclick}>
                {"Click me"}
            </Button>
            <p>{&*data}</p>
            <div>
                <Button outlined={true} size={Size::Large}>
                    {"Test Biiiiiig Button"}
                </Button>
                <Button outlined={true}>
                    {"Test"}
                </Button>
                <Button outlined={true} size={Size::Small}>
                    {"Test Small Button"}
                </Button>
                <Button>
                    {"Test"}
                </Button>
                <Button color={Color::Secondary}>
                    {"Test"}
                </Button>
                <Button color={Color::Success}>
                    {"Test"}
                </Button>
                <Button color={Color::Warning}>
                    {"Test"}
                </Button>
                <Button color={Color::Error}>
                    {"Test"}
                </Button>
                <Button color={Color::Info}>
                    {"Test"}
                </Button>
            </div>
        </>
    }
}
