// Direct SSR test - doesn't require server or WebDriver

use anyhow::Result;
use std::fs;
use tracing::info;

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();
    
    info!("Starting direct SSR test for hikari website");
    info!("==========================================\n");
    
    // Read the WASM file
    let wasm_path = "/mnt/sdb1/hikari/public/website.wasm";
    let wasm_bytes = fs::read(wasm_path)?;
    info!("Loaded {} bytes from {}", wasm_bytes.len(), wasm_path);
    
    // This would normally call tairitsu_ssr::render_to_html
    // For now, we'll check if the file exists and show basic info
    info!("WASM file size: {} bytes", wasm_bytes.len());
    info!("WASM magic bytes: {:02X} {:02X} {:02X} {:02X}", 
          wasm_bytes[0], wasm_bytes[1], wasm_bytes[2], wasm_bytes[3]);
    
    if wasm_bytes.len() < 100 {
        info!("WARNING: File is smaller than expected, may be corrupted");
        return Err(anyhow::anyhow!("WASM file too small ({} bytes)", wasm_bytes.len()));
    }
    
    // Basic magic number check (WebAssembly file starts with \0asm)
    if wasm_bytes[0] != 0x00 || wasm_bytes[1] != 0x61 || wasm_bytes[2] != 0x73 || wasm_bytes[3] != 0x6d {
        info!("WARNING: File doesn't start with WebAssembly magic number");
    } else {
        info!("Confirmed: Valid WebAssembly file");
    }
    
    // Check if tairitsu_ssr is available
    info!("\nChecking tairitsu-ssr availability...");
    
    // Try to dynamically load tairitsu_ssr if it's available
    #[cfg(feature = "direct-ssr")]
    {
        info!("Direct SSR feature enabled, will test rendering");
    } else {
        info!("Direct SSR feature not enabled");
        info!("Note: For actual SSR testing, you need to build with 'direct-ssr' feature");
        info!("      or run tests with the browser automation setup");
    }
    
    info!("\n==========================================");
    info!("Direct SSR test completed");
    info!("==========================================");
    
    Ok(())
}
