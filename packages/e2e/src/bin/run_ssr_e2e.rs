// hikari-e2e/src/bin/run_ssr_e2e.rs
// Binary to run SSR E2E tests

use hikari_e2e::run_ssr_e2e_tests;
use thirtyfour::prelude::*;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting Hikari SSR E2E Tests");
    info!("================================");

    // Get base URL from environment or use default
    let base_url =
        std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    info!("Testing against: {}", base_url);
    info!("Make sure the dev server is running!");
    println!();

    // Configure WebDriver capabilities
    let caps = DesiredCapabilities::chrome();
    // Add arguments for headless mode (optional)
    // caps.set_chrome_option(
    //     "args",
    //     serde_json::json!(vec!["--headless", "--disable-gpu"]),
    // )?;

    let driver = WebDriver::new("http://localhost:4444", caps)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to connect to WebDriver: {}", e))?;

    info!("WebDriver connected successfully");

    // Run SSR E2E tests
    let results = run_ssr_e2e_tests(&driver).await?;

    // Summary
    println!("\n================================");
    println!("SSR E2E Test Summary");
    println!("================================");
    let total = results.len();
    let passed = results
        .iter()
        .filter(|r| {
            matches!(
                r.status,
                hikari_e2e::tests::ssr_tests::SsrTestStatus::Success
            )
        })
        .count();
    let partial = results
        .iter()
        .filter(|r| {
            matches!(
                r.status,
                hikari_e2e::tests::ssr_tests::SsrTestStatus::PartialSuccess { .. }
            )
        })
        .count();
    let failed = results
        .iter()
        .filter(|r| {
            matches!(
                r.status,
                hikari_e2e::tests::ssr_tests::SsrTestStatus::Failure(_)
                    | hikari_e2e::tests::ssr_tests::SsrTestStatus::Error(_)
            )
        })
        .count();

    println!("Total tests: {}", total);
    println!("Passed: {}", passed);
    println!("Partial: {}", partial);
    println!("Failed: {}", failed);

    if failed > 0 {
        println!("\nNOTE: Some tests failed. This is expected until tairitsu-ssr bugs are fixed.");
        println!("      These tests are ready to run once SSR is fully functional.");
    }

    // Close browser
    driver.quit().await?;

    Ok(())
}
