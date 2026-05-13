use tairitsu_ssr::{SsrConfig, render_to_html};

fn main() -> anyhow::Result<()> {
    // Read the hikari website WASM file
    let wasm_bytes = std::fs::read("/mnt/sdb1/hikari/public/website.wasm")?;
    
    println!("Loaded {} bytes from website.wasm", wasm_bytes.len());
    
    // Render to HTML with default config
    let html = render_to_html(&wasm_bytes, SsrConfig::default())?;
    
    println!("\n=== RENDERED HTML (first 2000 chars) ===\n");
    println!("{}", &html[..html.len().min(2000)]);
    
    // Verify expected elements
    let mut checks = vec![
        ("Contains #hikari-app", html.contains("#hikari-app")),
        ("Contains .hi-layout", html.contains(".hi-layout")),
        ("Contains .hikari-page", html.contains(".hikari-page")),
        ("Contains home page", html.contains("home")),
        ("Contains components", html.contains("components")),
        ("Contains system", html.contains("system")),
        ("Contains demos", html.contains("demos")),
        ("Contains 404 page", html.contains("not-found")),
    ];
    
    println!("\n=== VERIFICATION RESULTS ===\n");
    let mut passed = 0;
    let mut failed = 0;
    
    for (check, result) in checks {
        let status = if result { "✓ PASS" } else { "✗ FAIL" };
        if result {
            passed += 1;
        } else {
            failed += 1;
        }
        println!("{}: {}", status, check);
    }
    
    println!("\n=== SUMMARY ===");
    println!("Passed: {}/{}", passed, checks.len());
    println!("Failed: {}/{}", failed, checks.len());
    
    if failed == 0 {
        println!("\nAll checks passed! The website was rendered successfully.");
        
        // Save full HTML output
        std::fs::write("/tmp/hikari-ssr-output.html", &html)?;
        println!("Full HTML saved to /tmp/hikari-ssr-output.html");
    } else {
        println!("\nSome checks failed. Review the output above for details.");
    }
    
    Ok(())
}
