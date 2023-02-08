pub mod functions;
pub mod models;

use anyhow::Context;
use log::info;
use std::time::Duration;

use sea_orm::{ConnectOptions, ConnectionTrait, Database, DatabaseConnection, Schema, Statement};

pub struct DatabaseNetworkConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
}

pub enum DatabaseLocalConfig {
    FilePath(Box<std::path::Path>),
    InMemory,
}

pub enum DatabaseConfig {
    MySQL(DatabaseNetworkConfig),
    SQLite(DatabaseLocalConfig),
    PostgreSQL(DatabaseNetworkConfig),
}

pub async fn init(
    config: DatabaseConfig,
) -> Result<Box<DatabaseConnection>, Box<dyn std::error::Error>> {
    {
        match &config {
            DatabaseConfig::MySQL(config) => {
                let db = Database::connect(format!(
                    "mysql://{}:{}@{}:{}",
                    config.username, config.password, config.host, config.port
                ))
                .await?;
                db.execute(Statement::from_string(
                    db.get_database_backend(),
                    format!(
                        r#"CREATE DATABASE IF NOT EXISTS hikari DEFAULT CHARACTER SET utf8mb4;"#
                    ),
                ))
                .await?;
            }
            DatabaseConfig::PostgreSQL(config) => {
                let db = Database::connect(format!(
                    "postgres://{}:{}@{}:{}",
                    config.username, config.password, config.host, config.port
                ))
                .await?;
                db.execute(Statement::from_string(
                    db.get_database_backend(),
                    format!(
                        r#"CREATE DATABASE IF NOT EXISTS hikari DEFAULT CHARACTER SET utf8mb4;"#
                    ),
                ))
                .await?;
            }
            DatabaseConfig::SQLite(_) => {}
        };
    }

    let mut opt = ConnectOptions::new(match &config {
        DatabaseConfig::MySQL(config) => {
            format!(
                "mysql://{}:{}@{}:{}/hikari",
                config.username, config.password, config.host, config.port
            )
        }
        DatabaseConfig::PostgreSQL(config) => {
            format!(
                "postgres://{}:{}@{}:{}/hikari",
                config.username, config.password, config.host, config.port
            )
        }
        DatabaseConfig::SQLite(config) => match config {
            DatabaseLocalConfig::FilePath(path) => {
                format!(
                    "sqlite:///{}",
                    path.to_str()
                        .context("Failed to convert database file path to string")?
                )
            }
            DatabaseLocalConfig::InMemory => "sqlite::memory:".into(),
        },
    });
    opt.max_connections(100)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(8))
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(8))
        .max_lifetime(Duration::from_secs(8))
        .sqlx_logging(true)
        .sqlx_logging_level(log::LevelFilter::Trace);
    let db = Database::connect(opt).await?;

    let builder = db.get_database_backend();

    db.execute(
        builder.build(
            Schema::new(builder)
                .create_table_from_entity(models::channel::Entity)
                .if_not_exists(),
        ),
    )
    .await?;
    db.execute(
        builder.build(
            Schema::new(builder)
                .create_table_from_entity(models::post::Entity)
                .if_not_exists(),
        ),
    )
    .await?;
    db.execute(
        builder.build(
            Schema::new(builder)
                .create_table_from_entity(models::tag::Entity)
                .if_not_exists(),
        ),
    )
    .await?;
    db.execute(
        builder.build(
            Schema::new(builder)
                .create_table_from_entity(models::thread::Entity)
                .if_not_exists(),
        ),
    )
    .await?;
    db.execute(
        builder.build(
            Schema::new(builder)
                .create_table_from_entity(models::user::Entity)
                .if_not_exists(),
        ),
    )
    .await?;

    info!("Database is ready");
    Ok(Box::new(db))
}
