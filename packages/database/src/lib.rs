pub mod migration;
pub mod models;

use sea_orm::{Database, EntityTrait};
use sea_orm_migration::MigratorTrait;

pub async fn init() {
    let db = Database::connect("mysql://root:1145141919810@localhost:3306/test")
        .await
        .unwrap();
    println!("{:?}\n", db);

    migration::Migrator::up(&db, None).await.unwrap();

    for cc in models::post::Entity::find().all(&db).await.unwrap() {
        println!("{:?}\n", cc);
    }
}