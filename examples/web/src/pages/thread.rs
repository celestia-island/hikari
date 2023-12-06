use log::info;

use stylist::yew::styled_component;
use yew::prelude::*;

use crate::utils::contexts::app_props::{AppPageProps, AppPropsContextProviderType};

#[derive(Properties, Debug, PartialEq)]
pub struct ThreadProps {
    #[prop_or_default]
    pub id: String,
}

#[styled_component]
pub fn Thread(props: &ThreadProps) -> Html {
    info!("Thread page {} loaded.", props.id);
    let page_props = use_context::<AppPropsContextProviderType>().unwrap();
    match &page_props.page_props {
        AppPageProps::Thread {
            id,
            title,
            content,
            comments,
        } => {
            html! {
                <>
                  <p>{format!("id: {}", id)}</p>
                  <p>{format!("title: {}", title)}</p>
                  <p>{format!("content: {}", content)}</p>
                  <p>{format!("comments: {}", comments.join(", "))}</p>
                </>
            }
        }
        _ => {
            html! {
              <>{"WAHT?"}</>
            }
        }
    }
}
