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
pub struct ComponentContextState {
    pub border_radius_type: BorderRadiusType,
}

#[derive(Properties, Debug, PartialEq)]
pub struct ComponentContextProps {
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

pub type ComponentContextProviderType = UseStateHandle<ComponentContextState>;

#[function_component]
pub fn ComponentContextShell(props: &ComponentContextProps) -> Html {
    let ctx = use_state(|| ComponentContextState {
        border_radius_type: props.border_radius_type,
    });

    html! {
        <ContextProvider<ComponentContextProviderType> context={ctx.clone()}>
            {props.children.clone()  }
        </ContextProvider<ComponentContextProviderType>>
    }
}
