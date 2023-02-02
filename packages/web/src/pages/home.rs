use gloo::net::http::Request;
use log::info;
use stylist::yew::styled_component;
use yew::prelude::*;

use crate::components::form::Button;

#[styled_component]
pub fn Home() -> Html {
    let is_fetching = use_state(|| false);
    let data = use_state(|| "Click me".to_string());

    let onclick = {
        let is_fetching = is_fetching.clone();
        let data = data.clone();
        Callback::from(move |_| {
            is_fetching.set(true);
            let is_fetching = is_fetching.to_owned();
            let data = data.to_owned();
            wasm_bindgen_futures::spawn_local(async move {
                let response = Request::get("https://httpbin.org/get")
                    .send()
                    .await
                    .unwrap();
                let raw = (&response).text().await.unwrap();
                info!("{:?}", response);
                is_fetching.set(false);
                data.set(raw);
            });
        })
    };

    html! {
        <>
            <Button onclick={onclick}>
                {match *is_fetching {
                    true => "Loading...",
                    false => "Click me",
                }}
            </Button>
            <p>{&*data}</p>
        </>
    }
}
