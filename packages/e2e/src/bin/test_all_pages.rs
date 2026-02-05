// hikari-e2e/src/bin/test_all_pages.rs
// Binary to test all 34 pages for basic quality

use hikari_e2e::tests::visual_quality::VisualQualityTests;
use thirtyfour::{prelude::*, WebDriver};
use tracing::{error, info};
use tracing_subscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting All Pages Quality Tests...\n");

    let base_url = std::env::var("WEBSITE_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    info!("Testing website at: {}", base_url);

    let caps = DesiredCapabilities::chrome();
    let driver = WebDriver::new("http://localhost:4444", caps).await?;

    info!("Browser created successfully\n");

    match VisualQualityTests::test_all_pages_quality(&driver).await {
        Ok(results) => {
            info!("\n=== All Pages Tests Complete ===");
            let total_tests: usize = results.iter().map(|t| t.tests.len()).sum();
            let total_passed: usize = results.iter().map(|t| t.passed).sum();
            let total_failed: usize = results.iter().map(|t| t.failed).sum();
            let avg_load_time: u64 = if !results.is_empty() {
                results.iter().map(|t| t.page_load_time_ms).sum::<u64>() / results.len() as u64
            } else {
                0
            };

            info!("Total Pages: {}", results.len());
            info!("Total Checks: {}", total_tests);
            info!("Passed: {}", total_passed);
            info!("Failed: {}", total_failed);
            info!("Average Load Time: {}ms", avg_load_time);

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
                anyhow::bail!("All pages tests failed with {} checks", total_failed);
            } else {
                info!("\n✅ All pages quality checks passed!");
            }
        }
        Err(e) => {
            error!("All pages tests failed: {}", e);
            anyhow::bail!("All pages tests failed: {}", e);
        }
    }

    driver.quit().await?;

    Ok(())
}
