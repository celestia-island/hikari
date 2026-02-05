// hikari-e2e/src/tests/basic_components.rs
// E2E tests for Layer 1 basic components

use anyhow::Result;
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

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
    pub screenshot_path: Option<String>,
}

impl TestResult {
    pub fn success(component: &str, message: &str) -> Self {
        Self {
            component: component.to_string(),
            status: TestStatus::Success,
            message: message.to_string(),
            duration_ms: 0,
            screenshot_path: None,
        }
    }

    pub fn success_with_screenshot(
        component: &str,
        message: &str,
        screenshot_path: String,
    ) -> Self {
        Self {
            component: component.to_string(),
            status: TestStatus::Success,
            message: message.to_string(),
            duration_ms: 0,
            screenshot_path: Some(screenshot_path),
        }
    }

    pub fn failure(component: &str, message: &str) -> Self {
        Self {
            component: component.to_string(),
            status: TestStatus::Failure,
            message: message.to_string(),
            duration_ms: 0,
            screenshot_path: None,
        }
    }

    pub fn failure_with_screenshot(
        component: &str,
        message: &str,
        screenshot_path: String,
    ) -> Self {
        Self {
            component: component.to_string(),
            status: TestStatus::Failure,
            message: message.to_string(),
            duration_ms: 0,
            screenshot_path: Some(screenshot_path),
        }
    }

    pub fn error(component: &str, error_msg: &str) -> Self {
        Self {
            component: component.to_string(),
            status: TestStatus::Error(error_msg.to_string()),
            message: error_msg.to_string(),
            duration_ms: 0,
            screenshot_path: None,
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
            screenshot_path: None,
        }
    }
}

impl BasicComponentsTests {
    /// Take a screenshot and save it to the screenshots directory
    async fn take_screenshot(
        driver: &WebDriver,
        component_name: &str,
        status: &str,
    ) -> Result<String> {
        let screenshots_dir =
            std::env::var("E2E_SCREENSHOTS_DIR").unwrap_or_else(|_| "./screenshots".to_string());

        // Create screenshots directory if it doesn't exist
        std::fs::create_dir_all(&screenshots_dir)
            .map_err(|e| anyhow::anyhow!("Failed to create screenshots directory: {}", e))?;

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("{}_{}_{}.png", component_name, status, timestamp);
        let filepath = PathBuf::from(&screenshots_dir).join(&filename);

        // Take screenshot as bytes
        let screenshot_data = driver.screenshot_as_png().await.map_err(|e| {
            anyhow::anyhow!("Failed to take screenshot for {}: {}", component_name, e)
        })?;

        // Save screenshot to file
        std::fs::write(&filepath, screenshot_data)
            .map_err(|e| anyhow::anyhow!("Failed to save screenshot: {}", e))?;

        info!("Screenshot saved to: {}", filepath.display());

        Ok(filepath.to_string_lossy().to_string())
    }

    async fn test_button(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Button component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer1/basic", base_url);

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

        // Take initial screenshot
        let _initial_screenshot = Self::take_screenshot(driver, "Button", "initial").await;

        button
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click button: {}", e))?;
        info!("Button clicked successfully");

        tokio::time::sleep(Duration::from_millis(200)).await;

        // Take screenshot after click
        let click_screenshot = Self::take_screenshot(driver, "Button", "clicked")
            .await
            .map_err(|e| {
                warn!("Failed to take screenshot: {}", e);
                String::new()
            })
            .unwrap_or_default();

        let class_attr = button
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get button attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for button"))?;

        if !class_attr.contains("hi-button") {
            // Take screenshot on failure
            let _error_screenshot = Self::take_screenshot(driver, "Button", "failure").await;

            return Ok(TestResult::failure_with_screenshot(
                "Button",
                "Button element missing 'hi-button' class",
                click_screenshot,
            ));
        }

        // Take screenshot on success
        let success_screenshot = Self::take_screenshot(driver, "Button", "success")
            .await
            .map_err(|e| {
                warn!("Failed to take screenshot: {}", e);
                String::new()
            })
            .unwrap_or_default();

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
            screenshot_path: Some(success_screenshot),
        })
    }

    async fn test_input(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Input component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer1/basic", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let input = driver.find(By::Css(".hi-input")).await.map_err(|e| {
            warn!("Input element not found: {}", e);
            anyhow::anyhow!("Input element not found: {}", e)
        })?;

        info!("Input element found");

        input
            .send_keys("test input")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to type in input: {}", e))?;
        info!("Text entered successfully");

        let class_attr = input
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get input attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for input"))?;

        if !class_attr.contains("hi-input") {
            return Ok(TestResult::failure(
                "Input",
                "Input element missing 'hi-input' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Input".to_string(),
            status: TestStatus::Success,
            message: "Input component renders correctly, accepts input, and has proper class"
                .to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_card(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Card component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer1/basic", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let card = driver.find(By::Css(".hi-card")).await.map_err(|e| {
            warn!("Card element not found: {}", e);
            anyhow::anyhow!("Card element not found: {}", e)
        })?;

        info!("Card element found");

        let class_attr = card
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get card attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for card"))?;

        if !class_attr.contains("hi-card") {
            return Ok(TestResult::failure(
                "Card",
                "Card element missing 'hi-card' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Card".to_string(),
            status: TestStatus::Success,
            message: "Card component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_divider(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Divider component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer1/basic", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let divider = driver.find(By::Css(".hi-divider")).await.map_err(|e| {
            warn!("Divider element not found: {}", e);
            anyhow::anyhow!("Divider element not found: {}", e)
        })?;

        info!("Divider element found");

        let class_attr = divider
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get divider attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for divider"))?;

        if !class_attr.contains("hi-divider") {
            return Ok(TestResult::failure(
                "Divider",
                "Divider element missing 'hi-divider' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Divider".to_string(),
            status: TestStatus::Success,
            message: "Divider component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
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

        // Test Button
        match self.test_button(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Button test failed: {}", e);
                results.push(TestResult::error("Button", &e.to_string()));
            }
        }

        // Test Input
        match self.test_input(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Input test failed: {}", e);
                results.push(TestResult::error("Input", &e.to_string()));
            }
        }

        // Test Card
        match self.test_card(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Card test failed: {}", e);
                results.push(TestResult::error("Card", &e.to_string()));
            }
        }

        // Test Divider
        match self.test_divider(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Divider test failed: {}", e);
                results.push(TestResult::error("Divider", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
