use gloo::console::console;
use gloo::net::http::Request;
use stylist::yew::styled_component;
use yew::prelude::*;

#[styled_component]
pub fn Home() -> Html {
    let count = use_state(|| ".".to_string());

    let onclick = {
        let count = count.clone();
        Callback::from(move |_| {
            count.set("Loading".into());
            let count = count.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let response = Request::get("https://httpbin.org/get")
                    .send()
                    .await
                    .unwrap();
                let raw = response.text().await.unwrap();
                console!(raw.clone());
                count.set(raw);
            });
        })
    };

    html! {
        <div
            class={css!(r#"
                width: 200px;
                min-height: 200px;
                margin-top: 32px;

                background: black;
                border-radius: 4px;
                box-shadow: 0 0 4px 1px rgba(0, 0, 0, 0.8);
                color: white;
            "#)}
            onclick={onclick}
        >
            {&*count}
        </div>
    }
}
