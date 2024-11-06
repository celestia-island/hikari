use anyhow::Result;

use hikari_boot::Application;
use hikari_website::app::{App, AppStates, PageData};

pub async fn html(id: String) -> Result<String> {
    App::render_to_string(
        format!("/guide/{}", id),
        AppStates {
            theme: Default::default(),
            data: PageData::Guide {
                id,
                raw: "いいよ！こいよ".to_string(),
            },
        },
    )
    .await
}
