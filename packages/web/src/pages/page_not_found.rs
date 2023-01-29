use gloo::console::console;
use yew::prelude::*;

use crate::utils::store::{Context, ContextProviderType};

#[function_component]
pub fn PageNotFound() -> Html {
    let context = use_context::<ContextProviderType>().expect("No context found");

    let handle_change_msg1 = {
        let context = context.clone();

        Callback::from(move |_| {
            console!("Clicked msg1 button".to_string());

            context.set(Context {
                msg1: "Changed".to_string(),
                ..(*context).to_owned()
            })
        })
    };
    let handle_change_msg2 = {
        let context = context.clone();
        Callback::from(move |_| {
            console!("Clicked msg2 button".to_string());
            context.set(Context {
                msg2: "Changed".to_string(),
                ..(*context).to_owned()
            })
        })
    };

    let msg1 = context.msg1.to_owned();
    let msg2 = context.msg2.to_owned();

    html! {
        <>
            <h1>{r#"404 page not found."#}</h1>
            <button onclick={handle_change_msg1}>{msg1}</button>
            <button onclick={handle_change_msg2}>{msg2}</button>
        </>

    }
}
