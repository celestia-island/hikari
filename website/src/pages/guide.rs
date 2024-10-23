use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub id: String,
}

#[styled_component]
pub fn Guide(props: &Props) -> Html {
    html! {
        <>
            <h1>{"Guide"}</h1>
            <p>{format!("Guide {}", props.id)}</p>
        </>
    }
}
