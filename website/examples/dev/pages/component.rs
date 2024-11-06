use anyhow::Result;
use std::str::FromStr;

use hikari_boot::Application;
use hikari_theme::types::ComponentType;
use hikari_website::app::{App, AppStates, PageData};

pub async fn html(id: String) -> Result<String> {
    App::render_to_string(
        format!("/component/{}", id),
        AppStates {
            theme: Default::default(),
            data: PageData::Component {
                id: ComponentType::from_str(&id)?,
                raw: "いいよ！こいよ".to_string(),
            },
        },
    )
    .await
}
