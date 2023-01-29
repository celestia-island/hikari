use yew::prelude::*;

#[derive(Debug, PartialEq, Eq, Clone)]
pub(crate) struct Context {
    pub(crate) msg1: String,
    pub(crate) msg2: String,
}

#[derive(Properties, Debug, PartialEq)]
pub(crate) struct ContextProviderProps {
    #[prop_or_default]
    pub(crate) children: Children,
}

pub(crate) type ContextProviderType = UseStateHandle<Context>;

#[function_component]
pub(crate) fn ContextShell(props: &ContextProviderProps) -> Html {
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
