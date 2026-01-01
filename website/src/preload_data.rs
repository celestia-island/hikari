use yew::prelude::*;

use crate::app::PageData;

#[derive(Debug, PartialEq, Clone)]
pub struct PreloadData {
    pub preload: PageData,
}

#[derive(Debug, PartialEq, Clone)]
pub enum PreloadDataAction {}

impl Reducible for PreloadData {
    type Action = PreloadDataAction;

    fn reduce(self: std::rc::Rc<Self>, _action: Self::Action) -> std::rc::Rc<Self> {
        self
    }
}

pub type PreloadDataContext = UseReducerHandle<PreloadData>;

#[derive(Properties, Debug, PartialEq)]
pub struct ProviderProps {
    pub preload_data: PageData,

    #[prop_or_default]
    pub children: Html,
}

#[function_component]
pub fn Provider(props: &ProviderProps) -> Html {
    let state = use_reducer(|| PreloadData {
        preload: props.preload_data.clone(),
    });

    html! {
        <ContextProvider<PreloadDataContext> context={state}>
            {props.children.clone()}
        </ContextProvider<PreloadDataContext>>
    }
}


