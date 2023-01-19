use std::rc::Rc;

use gloo::console::console;
use gloo::net::http::Request;
use stylist::yew::styled_component;
use yew::prelude::*;

#[styled_component]
pub fn Inside() -> Html {
    let count = use_state(|| Rc::new(".".to_string()));

    use_effect_with_deps(
        move |_| {
            wasm_bindgen_futures::spawn_local(async move {
                let response = Request::get("https://httpbin.org/get")
                    .send()
                    .await
                    .unwrap();
                let raw = response.text().await.unwrap();
                console!(raw);
            })
        },
        (),
    );

    let onclick = {
        let count = count.clone();
        Callback::from(move |_| {
            count.set((*count).repeat(2).into());
        })
    };

    html! {
        <div
            class={css!(r#"
                width: 200px;
                height: 200px;
                border-radius: 5px;

                background: black;

                padding: 15px;
                box-sizing: border-box;

                box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.7);
                color: white;
            "#)}
            onclick={onclick}
        >
            {&**count}
        </div>
    }
}

#[styled_component]
pub fn Home() -> Html {
    html! {
        <>
            <h1>{"Yew Integration"}</h1>
            <div class={css!(r#"
                box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.7);
                height: 500px;
                width: 500px;
                border-radius: 5px;

                display: flex;
                justify-content: space-around;
                align-items: center;

                padding: 15px;
                box-sizing: border-box;

                flex-direction: column;
                background-color: white;
            "#)} id="yew-sample-content">
                <Inside />
            </div>
        </>
    }
}
