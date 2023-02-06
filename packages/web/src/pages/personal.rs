use log::info;

use stylist::yew::styled_component;
use yew::prelude::*;

use crate::utils::contexts::app_props::{AppPageProps, AppPropsContextProviderType, Sex};

#[derive(Properties, Debug, PartialEq)]
pub struct PersonalProps {
    #[prop_or_default]
    pub id: String,
}

#[styled_component]
pub fn Personal(props: &PersonalProps) -> Html {
    info!("Personal page {} loaded.", props.id);
    let page_props = use_context::<AppPropsContextProviderType>().unwrap();
    match &page_props.page_props {
        AppPageProps::Personal {
            id,
            name,
            email,
            sex,
        } => {
            html! {
                <>
                  <p>{format!("id: {}", id)}</p>
                  <p>{format!("name: {}", name)}</p>
                  <p>{format!("email: {}", email)}</p>
                  <p>{format!("sex: {}", match sex {
                    Sex::Male => "Male",
                    Sex::Female => "Female"
                  })}</p>
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
