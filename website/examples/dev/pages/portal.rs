use anyhow::Result;

use hikari_boot::Application;
use hikari_website::app::{App, AppStates, PageData};

pub async fn html() -> Result<String> {
    App::render_to_string(
        "/".to_string(),
        AppStates {
            theme: Default::default(),
            data: PageData::Portal,
        },
    )
    .await
}
