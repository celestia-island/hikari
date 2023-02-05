pub mod functions;
pub mod migration;
pub mod models;

use log::info;
use std::time::Duration;

use sea_orm::{ConnectOptions, ConnectionTrait, Database, DatabaseConnection, Statement};
use sea_orm_migration::MigratorTrait;

pub async fn init() -> Result<Box<DatabaseConnection>, Box<dyn std::error::Error>> {
    {
        let mut opt =
            ConnectOptions::new("mysql://root:1145141919810@localhost:3306/hikari".into());
        opt.max_connections(100)
            .min_connections(5)
            .connect_timeout(Duration::from_secs(8))
            .acquire_timeout(Duration::from_secs(8))
            .idle_timeout(Duration::from_secs(8))
            .max_lifetime(Duration::from_secs(8))
            .sqlx_logging(true)
            .sqlx_logging_level(log::LevelFilter::Trace);
        let db = Database::connect(opt).await?;

        db.execute(Statement::from_string(
            db.get_database_backend(),
            format!(r#"CREATE DATABASE IF NOT EXISTS hikari DEFAULT CHARACTER SET utf8mb4;"#),
        ))
        .await?;
    }

    let mut opt = ConnectOptions::new("mysql://root:1145141919810@localhost:3306/hikari".into());
    opt.max_connections(100)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(8))
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(8))
        .max_lifetime(Duration::from_secs(8))
        .sqlx_logging(true)
        .sqlx_logging_level(log::LevelFilter::Trace);
    let db = Database::connect(opt).await?;

    migration::Migrator::up(&db, None).await.unwrap();

    info!("Database is ready");
    Ok(Box::new(db))
}
