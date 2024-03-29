use stylist::yew::styled_component;
use yew::{html::ChildrenRenderer, prelude::*, virtual_dom::VChild};

use hikari_theme::prelude::*;

use super::button::{BorderRadiusType, Button, ButtonGroupInjectorContextShell};

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
pub struct ButtonGroupProps {
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
pub fn ButtonGroup(props: &ButtonGroupProps) -> Html {
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
                <ButtonGroupInjectorContextShell
                    border_radius_type={BorderRadiusType::OnlyLeft}
                >
                    {
                        if let Some(children) = props.children.clone().iter().next() {
                            children.clone().into()
                        } else {
                            html! {}
                        }
                    }
                </ButtonGroupInjectorContextShell>

                {props.children.iter().skip(1).take(props.children.len() - 2).map(|child| html! {
                    <ButtonGroupInjectorContextShell
                        border_radius_type={BorderRadiusType::None}
                    >
                        {{
                            let child: Html = child.clone().into();
                            child
                        }}
                    </ButtonGroupInjectorContextShell>
                }).collect::<Html>()}

                <ButtonGroupInjectorContextShell
                    border_radius_type={BorderRadiusType::OnlyRight}
                >
                    {
                        if let Some(children) = props.children.clone().iter().last() {
                            children.clone().into()
                        } else {
                            html! {}
                        }
                    }
                </ButtonGroupInjectorContextShell>
            </div>
        },
    }
}
