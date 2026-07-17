// Standalone SSR test

use anyhow::Result;
use std::fs;
use tracing::info;

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting standalone SSR test");
    info!("===========================\n");

    // Read WASM file
    let wasm_bytes = fs::read("/mnt/sdb1/hikari/public/website.wasm")?;
    info!("Loaded {} bytes of WASM", wasm_bytes.len());

    // Try to load tairitsu_ssr dynamically
    let dynamic_lib = std::ffi::CString::new("/mnt/sdb1/tairitsu/target/debug/libtairitsu_ssr-1e71b4c225e205fd.rlib")?;
    info!("Looking for library: {}", dynamic_lib.to_string_lossy());

    Ok(())
}
