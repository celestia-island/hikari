use yew::prelude::*;

use crate::types::{ColorType, SizeType};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum BorderRadiusType {
    #[default]
    Default,
    None,
    OnlyLeft,
    OnlyRight,
}

#[derive(Debug, PartialEq, Clone)]
pub struct ContextState {
    pub border_radius_type: BorderRadiusType,
}

#[derive(Properties, Debug, PartialEq)]
pub struct ContextProps {
    #[prop_or(SizeType::Medium)]
    pub size: SizeType,
    #[prop_or(ColorType::Primary)]
    pub color: ColorType,
    #[prop_or(false)]
    pub outlined: bool,
    #[prop_or_default]
    pub border_radius_type: BorderRadiusType,

    #[prop_or_default]
    pub children: Children,
}

pub type ContextProviderType = UseStateHandle<ContextState>;

#[function_component]
pub fn ContextShell(props: &ContextProps) -> Html {
    let ctx = use_state(|| ContextState {
        border_radius_type: props.border_radius_type,
    });

    html! {
        <ContextProvider<ContextProviderType> context={ctx.clone()}>
            {props.children.clone()  }
        </ContextProvider<ContextProviderType>>
    }
}
