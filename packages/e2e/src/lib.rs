// hikari-e2e/src/lib.rs
// E2E testing library entry point

pub mod tests;
pub mod html_assertions;

pub use tests::{
    Test,
    basic_components::{BasicComponentsTests, TestResult, TestStatus},
    advanced_components::AdvancedComponentsTests,
    data_components::DataComponentsTests,
    form_components::FormComponentsTests,
};
pub use html_assertions::HtmlAssertions;
use thirtyfour::WebDriver;
use tracing::{error, info};

/// Run all E2E test suites
pub async fn run_all_tests(driver: &WebDriver) -> anyhow::Result<Vec<TestResult>> {
    println!("Running all Hikari E2E tests...\n");

    let mut results = vec![];

    // Layer 1: Basic Components (3 tests)
    match tests::Test::run_with_driver(&tests::basic_components::BasicComponentsTests, driver).await {
        Ok(result) => results.push(result),
        Err(e) => {
            eprintln!("Basic components test suite failed: {}", e);
            results.push(TestResult::error("BasicComponents", &e.to_string()));
        }
    }

    // Layer 2: Form Components (5 tests)
    match tests::Test::run_with_driver(&tests::form_components::FormComponentsTests, driver).await {
        Ok(result) => results.push(result),
        Err(e) => {
            eprintln!("Form components test suite failed: {}", e);
            results.push(TestResult::error("FormComponents", &e.to_string()));
        }
    }

    // Layer 2: Data Components (4 tests)
    match tests::Test::run_with_driver(&tests::data_components::DataComponentsTests, driver).await {
        Ok(result) => results.push(result),
        Err(e) => {
            eprintln!("Data components test suite failed: {}", e);
            results.push(TestResult::error("DataComponents", &e.to_string()));
        }
    }

    // Layer 3: Advanced Components (6 tests)
    match tests::Test::run_with_driver(&tests::advanced_components::AdvancedComponentsTests, driver).await {
        Ok(result) => results.push(result),
        Err(e) => {
            eprintln!("Advanced components test suite failed: {}", e);
            results.push(TestResult::error("AdvancedComponents", &e.to_string()));
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
    info!("Layer 1 (Basic): Button, Input, Card, Divider (4 components)");
    info!("Layer 2 (Form): Form, Select, Checkbox, Radio, Switch, Stepper (6 components)");
    info!("Layer 2 (Data): Table, Tree, Pagination, Dropdown (4 components)");
    info!("Layer 3 (Advanced): VideoPlayer, AudioWaveform, RichTextEditor, DragLayer, Collapsible, ZoomControls, UserGuide, Timeline (10 components)");
    info!("====================");
    info!("Total: 24 components tested");

    Ok(results)
}
