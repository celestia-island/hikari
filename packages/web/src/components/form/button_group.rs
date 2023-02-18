use stylist::yew::styled_component;
use yew::prelude::*;

use super::button::{BorderRadiusType, BorderRadiusTypeContextShell, Button};

#[derive(Properties, Debug, PartialEq)]
pub struct ButtonGroupProps {
    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn ButtonGroup(props: &ButtonGroupProps) -> Html {
    html! {
        <div>
            <BorderRadiusTypeContextShell border_radius_type={BorderRadiusType::OnlyLeft}>
                <Button>
                    {"1"}
                </Button>
            </BorderRadiusTypeContextShell>
            <BorderRadiusTypeContextShell border_radius_type={BorderRadiusType::None}>
                <Button>
                    {"2"}
                </Button>
            </BorderRadiusTypeContextShell>
            <BorderRadiusTypeContextShell border_radius_type={BorderRadiusType::OnlyRight}>
                <Button>
                    {"3"}
                </Button>
            </BorderRadiusTypeContextShell>
        </div>
    }
}
