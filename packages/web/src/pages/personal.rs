use log::info;

use stylist::yew::styled_component;
use yew::prelude::*;

use crate::components::form::Button;

#[derive(Properties, Debug, PartialEq)]
pub struct PersonalProps {
    #[prop_or_default]
    pub id: String,
}

#[styled_component]
pub fn Personal(props: &PersonalProps) -> Html {
    info!("Personal page {} loaded.", props.id);

    html! {
        <>
            <Button>
                {"Test"}
            </Button>
        </>
    }
}
