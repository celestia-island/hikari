use yew::prelude::*;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct Context {
    pub msg1: String,
    pub msg2: String,
}

#[derive(Properties, Debug, PartialEq)]
pub struct ContextProviderProps {
    #[prop_or_default]
    pub children: Children,
}

pub type ContextProviderType = UseStateHandle<Context>;

#[function_component]
pub fn ContextShell(props: &ContextProviderProps) -> Html {
    let ctx = use_state(|| Context {
        msg1: "No message yet.".to_owned(),
        msg2: "No message yet.".to_owned(),
    });

    html! {
        <ContextProvider<ContextProviderType> context={ctx.clone()}>
            {props.children.clone()}
        </ContextProvider<ContextProviderType>>
    }
}
