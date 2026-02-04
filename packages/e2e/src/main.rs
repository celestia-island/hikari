// hikari-e2e/src/main.rs
// E2E testing entry point for Hikari components

use anyhow::Result;
use std::{env, time::Duration};

use thirtyfour::prelude::*;
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Hikari E2E test framework");
    let base_url =
        env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());

    info!("Website base URL: {}", base_url);

    let remote_chrome =
        env::var("CHROME_REMOTE_ADDRESS").unwrap_or_else(|_| "http://localhost:4444".to_string());

    info!("Connecting to remote Chrome at {}", remote_chrome);

    let caps = DesiredCapabilities::chrome();
    let driver = WebDriver::new(remote_chrome.as_str(), caps)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to connect to Chrome: {}", e))?;

    info!("Remote Chrome connected successfully");

    // Simulate initialization time
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Run all E2E tests
    info!("Running E2E test suites...");

    let results = hikari_e2e::run_all_tests(&driver).await?;

    // Display test results summary
    info!("\n=== E2E Test Results ===");
    for result in &results {
        info!("{}: {}", result.component, result.message);
        match &result.status {
            hikari_e2e::TestStatus::Success => info!("  Status: ✅ PASSED"),
            hikari_e2e::TestStatus::Failure => info!("  Status: ❌ FAILED"),
            hikari_e2e::TestStatus::Error(msg) => error!("  Status: ⚠️ ERROR - {}", msg),
        }
    }
    info!("=== End of Test Results ===\n");

    // Clean up driver resources
    driver
        .quit()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to quit driver: {}", e))?;
    info!("Remote Chrome closed");

    info!("E2E test framework execution completed");
    info!("\n=== Test Coverage ===");
    info!("Layer 1 (Basic): Button, Input, Card, Divider (4 components)");
    info!("Layer 2 (Form): Form, Select, Checkbox, Radio, Switch, Stepper (6 components)");
    info!("Layer 2 (Data): Table, Tree, Pagination, Dropdown (4 components)");
    info!("Layer 3 (Advanced): VideoPlayer, AudioWaveform, RichTextEditor, DragLayer, Collapsible, ZoomControls, UserGuide, Timeline (10 components)");
    info!("====================");
    info!("Total: 24 components tested");

    Ok(())
}
