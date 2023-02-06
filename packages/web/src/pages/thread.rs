use log::info;

use stylist::yew::styled_component;
use yew::prelude::*;

use crate::components::form::Button;

#[derive(Properties, Debug, PartialEq)]
pub struct ThreadProps {
    #[prop_or_default]
    pub id: String,
}

#[styled_component]
pub fn Thread(props: &ThreadProps) -> Html {
    info!("Thread page {} loaded.", props.id);

    html! {
        <>
            <Button>
                {"Test"}
            </Button>
        </>
    }
}
