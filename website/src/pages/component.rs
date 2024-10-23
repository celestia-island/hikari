use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub id: String,
}

#[styled_component]
pub fn Component(props: &Props) -> Html {
    html! {
        <>
            <h1>{"Component"}</h1>
            <p>{format!("Component {}", props.id)}</p>
        </>
    }
}
