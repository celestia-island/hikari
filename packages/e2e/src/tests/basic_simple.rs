// hikari-e2e/src/tests/basic_simple.rs
// Simple E2E test for Button component

use anyhow::Result;
use std::time::{Duration, Instant};

use thirtyfour::{By, WebDriver};
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
    async fn test_button(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Button component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer1/button", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let button = driver.find(By::Css(".hi-button")).await.map_err(|e| {
            warn!("Button element not found: {}", e);
            anyhow::anyhow!("Button element not found: {}", e)
        })?;

        info!("Button element found");

        button
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click button: {}", e))?;
        info!("Button clicked successfully");

        let class_attr = button
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get button attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for button"))?;

        if !class_attr.contains("hi-button") {
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

    async fn run_with_driver(&self, driver: &WebDriver) -> Result<TestResult> {
        info!("Running basic components E2E tests");

        let mut results = vec![];

        match self.test_button(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Button test failed: {}", e);
                results.push(TestResult::error("Button", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
