use anyhow::Result;

use crate::DB_CONN;

pub async fn delete(id: impl ToString) -> Result<()> {
    DB_CONN.get().await.delete(("user", id.to_string())).await?;

    Ok(())
}
