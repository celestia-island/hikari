// hikari-e2e/src/bin/visual_quality_test.rs
// Binary to run visual quality and interactive behavior tests

use hikari_e2e::tests::visual_quality::VisualQualityTests;
use thirtyfour::{prelude::*, WebDriver};
use tracing::{error, info};
use tracing_subscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting Visual Quality and Interactive Behavior Tests...\n");

    // Get base URL from environment or use default
    let base_url = std::env::var("WEBSITE_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    info!("Testing website at: {}", base_url);

    // Create WebDriver capabilities
    let caps = DesiredCapabilities::chrome();
    let driver = WebDriver::new("http://localhost:4444", caps).await?;

    // Set window size
    driver
        .set_window_rect(1920, 1080, 0, 0)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to set window size: {}", e))?;

    // Run visual quality tests
    match VisualQualityTests::run_all(&driver).await {
        Ok(results) => {
            info!("\n=== Visual Quality Tests Complete ===");
            let total_tests: usize = results.iter().map(|t| t.tests.len()).sum();
            let total_passed: usize = results.iter().map(|t| t.passed).sum();
            let total_failed: usize = results.iter().map(|t| t.failed).sum();

            info!("Total Checks: {}", total_tests);
            info!("Passed: {}", total_passed);
            info!("Failed: {}", total_failed);

            if total_failed > 0 {
                error!("\n=== Failed Checks ===");
                for test in &results {
                    for check in &test.tests {
                        if !check.passed {
                            error!("  {} - {}: {}",
                                test.component_name,
                                check.check_name,
                                check.details
                            );
                        }
                    }
                }
                anyhow::bail!("Visual quality tests failed with {} checks", total_failed);
            } else {
                info!("\n✅ All visual quality checks passed!");
            }
        }
        Err(e) => {
            error!("Visual quality tests failed: {}", e);
            anyhow::bail!("Visual quality tests failed: {}", e);
        }
    }

    // Close driver
    driver.quit().await?;

    Ok(())
}
