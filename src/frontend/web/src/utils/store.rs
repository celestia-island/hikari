use std::rc::Rc;
use yew::prelude::*;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct Context {
    pub inner: String,
}

impl Reducible for Context {
    type Action = String;

    fn reduce(self: Rc<Self>, action: Self::Action) -> Rc<Self> {
        Context { inner: action }.into()
    }
}

#[derive(Properties, Debug, PartialEq)]
pub struct ContextProviderProps {
    #[prop_or_default]
    pub children: Children,
}

#[function_component]
pub fn MessageProvider(props: &ContextProviderProps) -> Html {
    let msg = use_reducer(|| Message {
        inner: "No message yet.".to_string(),
    });

    html! {
        <ContextProvider<UseReducerHandle<Context>> context={msg}>
            {props.children.clone()}
        </ContextProvider<UseReducerHandle<Context>>>
    }
}
