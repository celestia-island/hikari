use anyhow::Result;

use bcrypt::verify;

pub fn crypt_verify(input_raw: String, storage_hash: String) -> Result<bool> {
    Ok(verify(input_raw, storage_hash.as_str())?)
}
