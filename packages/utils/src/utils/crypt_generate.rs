use anyhow::Result;

use bcrypt::{hash, DEFAULT_COST};

pub fn crypt_generate(password: String) -> Result<String> {
    Ok(hash(password, DEFAULT_COST)?.to_string())
}
