use sea_orm::{DatabaseConnection, EntityTrait};

use crate::models::post::Entity as Post;

pub async fn query_all_post(
    db: Box<DatabaseConnection>,
) -> Result<String, Box<dyn std::error::Error>> {
    let mut res = String::new();
    for cc in Post::find().all(&*db).await? {
        res.push_str(&format!("{:?}\n", cc));
    }
    Ok(res)
}
