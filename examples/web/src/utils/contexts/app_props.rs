use serde::{Deserialize, Serialize};
use yew::prelude::*;

#[derive(PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
pub enum Sex {
    Male,
    Female,
}

#[derive(PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
pub enum AppPageProps {
    Portal {
        id: String,
        thread_list: Vec<String>,
    },

    Personal {
        id: String,
        name: String,
        email: String,
        sex: Sex,
    },

    Thread {
        id: String,
        title: String,
        content: String,
        comments: Vec<String>,
    },
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AppPropsContext {
    pub page_props: AppPageProps,
}

#[derive(Properties, Debug, PartialEq)]
pub struct AppPropsContextProviderProps {
    #[prop_or(AppPageProps::Portal{id: "".into(), thread_list: vec![]})]
    pub page_props: AppPageProps,

    #[prop_or_default]
    pub children: Children,
}

pub type AppPropsContextProviderType = UseStateHandle<AppPropsContext>;

#[function_component]
pub fn AppPropsContextShell(props: &AppPropsContextProviderProps) -> Html {
    let ctx = use_state(|| AppPropsContext {
        page_props: props.page_props.clone(),
    });

    html! {
        <ContextProvider<AppPropsContextProviderType> context={ctx.clone()}>
            {props.children.clone()  }
        </ContextProvider<AppPropsContextProviderType>>
    }
}
