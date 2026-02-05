// hikari-e2e/src/lib.rs
// E2E testing library entry point

pub mod html_assertions;
pub mod tests;

pub use html_assertions::HtmlAssertions;
pub use tests::{
    Test,
    advanced_components::AdvancedComponentsTests,
    basic_components::{BasicComponentsTests, TestResult, TestStatus},
    data_components::DataComponentsTests,
    form_components::FormComponentsTests,
    interactive_test::{
        InteractionStep, InteractiveTestResult, InteractiveTests, TestStep, VisualAnalysis,
        analyze_test_step, compare_visuals,
    },
    visual_quality::{VisualCheck, VisualCheckType, VisualQualityTest, VisualQualityTests},
};
use thirtyfour::WebDriver;
use tracing::{error, info};

/// Run all E2E test suites
pub async fn run_all_tests(driver: &WebDriver) -> anyhow::Result<Vec<TestResult>> {
    println!("Running all Hikari E2E tests...\n");

    let mut results = vec![];

    // Layer 1: Basic Components (3 tests)
    match tests::Test::run_with_driver(&tests::basic_components::BasicComponentsTests, driver).await
    {
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
    match tests::Test::run_with_driver(&tests::advanced_components::AdvancedComponentsTests, driver)
        .await
    {
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
            tests::basic_components::TestStatus::Success => info!("  Status: ✅ PASSED"),
            tests::basic_components::TestStatus::Failure => info!("  Status: ❌ FAILED"),
            tests::basic_components::TestStatus::Error(msg) => {
                error!("  Status: ⚠️  ERROR - {}", msg)
            }
        }
    }
    info!("=== End of Test Results ===\n");

    println!("\n=== Test Coverage ===");
    info!("Layer 1 (Basic): Button, Input, Card, Divider (4 components)");
    info!("Layer 2 (Form): Form, Select, Checkbox, Radio, Switch, Stepper (6 components)");
    info!("Layer 2 (Data): Table, Tree, Pagination, Dropdown (4 components)");
    info!(
        "Layer 3 (Advanced): VideoPlayer, AudioWaveform, RichTextEditor, DragLayer, Collapsible, ZoomControls, UserGuide, Timeline (10 components)"
    );
    info!("====================");
    info!("Total: 24 components tested");

    Ok(results)
}

/// Run interactive tests with multi-step operations and screenshots
pub async fn run_interactive_tests(
    driver: &WebDriver,
) -> anyhow::Result<Vec<InteractiveTestResult>> {
    println!("Running Hikari Interactive E2E tests...\n");

    let results = tests::interactive_test::InteractiveTests
        .run_all(driver)
        .await?;

    println!("\n=== Interactive Test Results ===");
    for result in &results {
        info!("{}: {}", result.component, result.message);
        if result.status == "success" {
            info!("  Status: ✅ PASSED ({} steps)", result.steps.len());
            for (i, step) in result.steps.iter().enumerate() {
                info!(
                    "    Step {}: {} - {:?}",
                    i + 1,
                    step.step.as_str(),
                    step.description
                );
            }
        } else {
            info!("  Status: ❌ FAILED");
            info!("  Message: {}", result.message);
        }
    }
    info!("=== End of Interactive Test Results ===\n");

    println!("\n=== Interactive Test Coverage ===");
    info!("Layer 1 (Basic): Button, Input, Card, Alert (4 components)");
    info!("Layer 2 (Navigation): Tabs, Menu, Breadcrumb, Steps (4 components)");
    info!("Layer 2 (Data): Table, Tree, Pagination (3 components)");
    info!("Layer 2 (Feedback): Modal, Dropdown, Drawer (3 components)");
    info!(
        "Layer 3 (Extra): Timeline, UserGuide, ZoomControls, Collapsible, VideoPlayer, RichTextEditor, CodeHighlighter, DragLayer (8 components)"
    );
    info!("======================");
    info!("Total: 22 components with multi-step interactive tests");

    Ok(results)
}
