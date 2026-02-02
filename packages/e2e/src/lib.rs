// hikari-e2e/src/lib.rs
// E2E testing library entry point

pub mod tests;

pub use tests::{
    Test,
    basic_simple::{TestResult, TestStatus},
};
use thirtyfour::WebDriver;
use tracing::{error, info};

/// Run all E2E test suites
pub async fn run_all_tests(driver: &WebDriver) -> anyhow::Result<Vec<TestResult>> {
    println!("Running all Hikari E2E tests...\n");

    let mut results = vec![];

    // Layer 1: Basic Components (7 tests)
    match tests::Test::run_with_driver(&tests::basic_simple::BasicComponentsTests, driver).await {
        Ok(result) => results.push(result),
        Err(e) => {
            eprintln!("Basic components test suite failed: {}", e);
            results.push(TestResult::error("BasicComponents", &e.to_string()));
        }
    }

    println!("\n=== E2E Test Results ===");
    for result in &results {
        info!("{}: {}", result.component, result.message);
        match &result.status {
            TestStatus::Success => info!("  Status: ✅ PASSED"),
            TestStatus::Failure => info!("  Status: ❌ FAILED"),
            TestStatus::Error(msg) => error!("  Status: ⚠️ ERROR - {}", msg),
        }
    }
    info!("=== End of Test Results ===\n");

    println!("\n=== Test Coverage ===");
    info!("Layer 1 (Basic): Button, Input, Card, Badge, Select, Checkbox, Radio (7 components)");
    info!("====================");
    info!("Total: 7 components tested");

    Ok(results)
}
