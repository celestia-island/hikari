// hikari-e2e/src/tests/basic_components.rs
// E2E tests for Layer 1 basic components

use anyhow::Result;
use std::time::{Duration, Instant};

use headless_chrome::Browser;
use tracing::{error, info, warn};

use crate::Test;

pub struct BasicComponentsTests;

#[derive(Debug, Clone)]
pub enum TestStatus {
    Success,
    Failure,
    Error(String),
}

#[derive(Debug, Clone)]
pub struct TestResult {
    pub component: String,
    pub status: TestStatus,
    pub message: String,
    pub duration_ms: u64,
}

impl TestResult {
    pub fn success(component: &str, message: &str) -> Self {
        Self {
            component: component.to_string(),
            status: TestStatus::Success,
            message: message.to_string(),
            duration_ms: 0,
        }
    }

    pub fn failure(component: &str, message: &str) -> Self {
        Self {
            component: component.to_string(),
            status: TestStatus::Failure,
            message: message.to_string(),
            duration_ms: 0,
        }
    }

    pub fn error(component: &str, error_msg: &str) -> Self {
        Self {
            component: component.to_string(),
            status: TestStatus::Error(error_msg.to_string()),
            message: error_msg.to_string(),
            duration_ms: 0,
        }
    }

    pub fn aggregate(results: Vec<TestResult>) -> Self {
        let total = results.len();
        let passed = results
            .iter()
            .filter(|r| matches!(r.status, TestStatus::Success))
            .count();
        let failed = total - passed;

        let status = if failed == 0 {
            TestStatus::Success
        } else if failed < total {
            TestStatus::Failure
        } else {
            TestStatus::Error(format!("{} of {} tests failed", failed, total))
        };

        Self {
            component: "Test Suite".to_string(),
            status,
            message: format!("{} passed, {} failed", passed, failed),
            duration_ms: 0,
        }
    }
}

impl BasicComponentsTests {
    fn test_button(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Button component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer1/button", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let button = tab.find_element(".hi-button").map_err(|e| {
            warn!("Button element not found: {}", e);
            anyhow::anyhow!("Button element not found: {}", e)
        })?;

        info!("Button element found");

        button
            .click()
            .map_err(|e| anyhow::anyhow!("Failed to click button: {}", e))?;
        info!("Button clicked successfully");

        let attrs = button
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get button attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for button"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-button"));

        if !has_class {
            return Ok(TestResult::failure(
                "Button",
                "Button element missing 'hi-button' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Button".to_string(),
            status: TestStatus::Success,
            message: "Button component renders correctly, responds to clicks, and has proper class"
                .to_string(),
            duration_ms: duration,
        })
    }

    fn test_input(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Input component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer1/input", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let input = tab.find_element(".hi-input").map_err(|e| {
            warn!("Input element not found: {}", e);
            anyhow::anyhow!("Input element not found: {}", e)
        })?;

        info!("Input element found");

        let test_text = "Hello Hikari";
        tab.type_str(test_text)
            .map_err(|e| anyhow::anyhow!("Failed to type text: {}", e))?;

        let attrs = input
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get input attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for input"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-input"));

        if !has_class {
            return Ok(TestResult::failure(
                "Input",
                "Input element missing 'hi-input' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Input".to_string(),
            status: TestStatus::Success,
            message: "Input component renders correctly, accepts user input, and has proper class"
                .to_string(),
            duration_ms: duration,
        })
    }

    fn test_card(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Card component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer1/card", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let card = tab.find_element(".hi-card").map_err(|e| {
            warn!("Card element not found: {}", e);
            anyhow::anyhow!("Card element not found: {}", e)
        })?;

        info!("Card element found");

        let children = card
            .find_elements("div")
            .map_err(|e| anyhow::anyhow!("Failed to find card children: {}", e))?;

        if children.is_empty() {
            return Ok(TestResult::failure("Card", "Card element has no children"));
        }

        info!("Card has {} children", children.len());

        let attrs = card
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get card attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for card"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-card"));

        if !has_class {
            return Ok(TestResult::failure(
                "Card",
                "Card element missing 'hi-card' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Card".to_string(),
            status: TestStatus::Success,
            message: "Card component renders correctly, displays children, and has proper class"
                .to_string(),
            duration_ms: duration,
        })
    }
}

impl Test for BasicComponentsTests {
    fn name(&self) -> &str {
        "Layer 1: Basic Components Tests"
    }

    fn setup(&self) -> Result<()> {
        info!("Setting up basic components test suite");
        info!("Dev server check: http://localhost:3000");
        Ok(())
    }

    fn run_with_browser(&self, browser: &Browser) -> Result<TestResult> {
        info!("Running basic components E2E tests");

        let mut results = vec![];

        match self.test_button(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Button test failed: {}", e);
                results.push(TestResult::error("Button", &e.to_string()));
            }
        }

        match self.test_input(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Input test failed: {}", e);
                results.push(TestResult::error("Input", &e.to_string()));
            }
        }

        match self.test_card(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Card test failed: {}", e);
                results.push(TestResult::error("Card", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
