use stylist::yew::styled_component;
use yew::{html::ChildrenRenderer, prelude::*, virtual_dom::VChild};

use hikari_theme::types::{ColorType, SizeType};

use super::button::{BorderRadiusType, Button};

pub(crate) mod group_injector_context {
    use yew::prelude::*;

    use super::BorderRadiusType;
    use hikari_theme::types::{ColorType, SizeType};

    #[derive(Debug, PartialEq, Clone)]
    pub struct Context {
        pub border_radius_type: BorderRadiusType,
    }

    #[derive(Properties, Debug, PartialEq)]
    pub struct ContextProviderProps {
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

    pub type ContextProviderType = UseStateHandle<Context>;

    #[function_component]
    pub fn ContextShell(props: &ContextProviderProps) -> Html {
        let ctx = use_state(|| Context {
            border_radius_type: props.border_radius_type,
        });

        html! {
            <ContextProvider<ContextProviderType> context={ctx.clone()}>
                {props.children.clone()  }
            </ContextProvider<ContextProviderType>>
        }
    }
}

#[derive(Clone, derive_more::From, PartialEq)]
pub enum ButtonGroupVariant {
    Button(VChild<Button>),
}

impl From<ButtonGroupVariant> for Html {
    fn from(val: ButtonGroupVariant) -> Self {
        match val {
            ButtonGroupVariant::Button(child) => child.into(),
        }
    }
}

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or(SizeType::Medium)]
    pub size: SizeType,
    #[prop_or(ColorType::Primary)]
    pub color: ColorType,
    #[prop_or(false)]
    pub outlined: bool,

    #[prop_or_default]
    pub children: ChildrenRenderer<ButtonGroupVariant>,
}

#[styled_component]
pub fn ButtonGroup(props: &Props) -> Html {
    match props.children.len() {
        0 => html! {},
        1 => html! { <>
            {{
                let children = props.children.clone().iter().map(|child| child.into()).collect::<Vec<Html>>();
                children.clone()
            }}
        </> },
        _ => html! {
            <div class={css!(r#"
                width: max-content;
                height: max-content;

                display: flex;
                flex-direction: row;
            "#)}>
                <group_injector_context::ContextShell
                    border_radius_type={BorderRadiusType::OnlyLeft}
                >
                    {
                        if let Some(children) = props.children.clone().iter().next() {
                            children.clone().into()
                        } else {
                            html! {}
                        }
                    }
                </group_injector_context::ContextShell>

                {props.children.iter().skip(1).take(props.children.len() - 2).map(|child| html! {
                    <group_injector_context::ContextShell
                        border_radius_type={BorderRadiusType::None}
                    >
                        {{
                            let child: Html = child.clone().into();
                            child
                        }}
                    </group_injector_context::ContextShell>
                }).collect::<Html>()}

                <group_injector_context::ContextShell
                    border_radius_type={BorderRadiusType::OnlyRight}
                >
                    {
                        if let Some(children) = props.children.clone().iter().last() {
                            children.clone().into()
                        } else {
                            html! {}
                        }
                    }
                </group_injector_context::ContextShell>
            </div>
        },
    }
}
