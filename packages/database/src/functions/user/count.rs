use anyhow::Result;
use serde::{Deserialize, Serialize};

use prql_compiler_macros::prql_to_sql;

use crate::DB_CONN;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
struct Ret {
    c: u64,
}

pub async fn count() -> Result<u64> {
    let mut ret = DB_CONN
        .get()
        .await
        .query(prql_to_sql!(
            r#"
            from user
            aggregate {
                c = count id
            }
            "#
        ))
        .await?;

    let ret: Option<Ret> = ret.take(0)?;
    let ret = ret.map(|r| r.c).unwrap_or(0);
    Ok(ret)
}
