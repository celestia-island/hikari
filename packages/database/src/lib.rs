// pub mod functions;
// pub mod models;

use anyhow::Result;
use lazy_static::lazy_static;
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{borrow::Cow, cell::Cell};
use tokio::sync::Mutex;

use surrealdb::{
    engine::remote::ws::{Client, Ws},
    opt::auth::Root,
    sql, Surreal,
};

#[derive(Serialize, Deserialize)]
struct Name {
    first: Cow<'static, str>,
    last: Cow<'static, str>,
}

#[derive(Serialize, Deserialize)]
struct Person {
    title: Cow<'static, str>,
    name: Name,
    marketing: bool,
}

pub struct DatabaseNetworkConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub namespace: String,
    pub database: String,
}

pub async fn init(config: DatabaseNetworkConfig) -> Result<()> {
    let db = Surreal::new::<Ws>("database:8000").await?;

    db.signin(Root {
        username: config.username.as_str(),
        password: config.password.as_str(),
    })
    .await?;
    db.use_ns(config.namespace).use_db(config.database).await?;

    // TODO - Test code

    // Create a new person with a random ID
    let created: Person = db
        .create("person")
        .content(Person {
            title: "LY".into(),
            name: Name {
                first: "yo".into(),
                last: "lang".into(),
            },
            marketing: true,
        })
        .await?;

    // Create a new person with a specific ID
    let created: Person = db
        .create(("person", "jaime"))
        .content(Person {
            title: "Founder & COO".into(),
            name: Name {
                first: "Jaime".into(),
                last: "Morgan Hitchcock".into(),
            },
            marketing: false,
        })
        .await?;

    // Update a person record with a specific ID
    let updated: Person = db
        .update(("person", "jaime"))
        .merge(json!({"marketing": true}))
        .await?;

    // Select all people records
    let people: Vec<Person> = db.select("person").await?;

    // Perform a custom advanced query
    let sql = r#"
        SELECT marketing, count()
        FROM type::table($table)
        GROUP BY marketing
    "#;

    let groups = db.query(sql).bind(("table", "person")).await?;

    info!("Database is ready");
    DB_CONN.lock().await.replace(Some(db));

    Ok(())
}

lazy_static! {
    static ref DB_CONN: Mutex<Cell<Option<Surreal<Client>>>> = Default::default();
}
