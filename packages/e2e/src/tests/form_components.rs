// hikari-e2e/src/tests/form_components.rs
// E2E tests for Layer 2 form-related components

use anyhow::Result;
use std::time::{Duration, Instant};

use thirtyfour::{By, WebDriver};
use tracing::info;

use super::TestResult;
use crate::Test;

/// Test suite for Layer 2 form components
pub struct FormComponentsTests;

impl FormComponentsTests {
    async fn test_form(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Form component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/form", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let form = driver.find(By::Css(".hi-form")).await.map_err(|e| {
            info!("Form element not found: {}", e);
            anyhow::anyhow!("Form element not found: {}", e)
        })?;

        info!("Form element found");

        let class_attr = form
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get form attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for form"))?;

        if !class_attr.contains("hi-form") {
            return Ok(TestResult::failure(
                "Form",
                "Form element missing 'hi-form' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Form".to_string(),
            status: super::TestStatus::Success,
            message: "Form component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_select(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Select component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/select", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let select = driver.find(By::Css(".hi-select")).await.map_err(|e| {
            info!("Select element not found: {}", e);
            anyhow::anyhow!("Select element not found: {}", e)
        })?;

        info!("Select element found");

        select
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click select: {}", e))?;
        info!("Select clicked successfully");

        tokio::time::sleep(Duration::from_millis(200)).await;

        let class_attr = select
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get select attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for select"))?;

        if !class_attr.contains("hi-select") {
            return Ok(TestResult::failure(
                "Select",
                "Select element missing 'hi-select' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Select".to_string(),
            status: super::TestStatus::Success,
            message: "Select component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_checkbox(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Checkbox component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/checkbox", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let checkbox = driver.find(By::Css(".hi-checkbox")).await.map_err(|e| {
            info!("Checkbox element not found: {}", e);
            anyhow::anyhow!("Checkbox element not found: {}", e)
        })?;

        info!("Checkbox element found");

        checkbox
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click checkbox: {}", e))?;
        info!("Checkbox clicked successfully");

        let class_attr = checkbox
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get checkbox attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for checkbox"))?;

        if !class_attr.contains("hi-checkbox") {
            return Ok(TestResult::failure(
                "Checkbox",
                "Checkbox element missing 'hi-checkbox' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Checkbox".to_string(),
            status: super::TestStatus::Success,
            message: "Checkbox component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_radio(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Radio component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/radio", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let radio = driver.find(By::Css(".hi-radio")).await.map_err(|e| {
            info!("Radio element not found: {}", e);
            anyhow::anyhow!("Radio element not found: {}", e)
        })?;

        info!("Radio element found");

        radio
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click radio: {}", e))?;
        info!("Radio clicked successfully");

        let class_attr = radio
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get radio attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for radio"))?;

        if !class_attr.contains("hi-radio") {
            return Ok(TestResult::failure(
                "Radio",
                "Radio element missing 'hi-radio' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Radio".to_string(),
            status: super::TestStatus::Success,
            message: "Radio component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_switch(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Switch component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/switch", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let switch = driver.find(By::Css(".hi-switch")).await.map_err(|e| {
            info!("Switch element not found: {}", e);
            anyhow::anyhow!("Switch element not found: {}", e)
        })?;

        info!("Switch element found");

        switch
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click switch: {}", e))?;
        info!("Switch clicked successfully");

        let class_attr = switch
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get switch attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for switch"))?;

        if !class_attr.contains("hi-switch") {
            return Ok(TestResult::failure(
                "Switch",
                "Switch element missing 'hi-switch' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Switch".to_string(),
            status: super::TestStatus::Success,
            message: "Switch component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_carousel(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Carousel component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // Carousel is demonstrated in layer2/navigation page
        let test_url = format!("{}/components/layer2/navigation", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        // Verify Carousel element exists
        let carousel = driver.find(By::Css(".hi-carousel")).await.map_err(|e| {
            info!("Carousel element not found: {}", e);
            anyhow::anyhow!("Carousel element not found: {}", e)
        })?;

        info!("Carousel element found");

        let class_attr = carousel
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get carousel attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for carousel"))?;

        if !class_attr.contains("hi-carousel") {
            return Ok(TestResult::failure(
                "Carousel",
                "Carousel element missing 'hi-carousel' class",
            ));
        }

        // Verify carousel track exists
        driver.find(By::Css(".hi-carousel-track")).await.map_err(|e| {
            info!("Carousel track not found: {}", e);
            anyhow::anyhow!("Carousel track not found: {}", e)
        })?;

        info!("Carousel track found");

        // Verify carousel items exist
        let carousel_items = driver.find_all(By::Css(".hi-carousel-item")).await.map_err(|e| {
            info!("Carousel items not found: {}", e);
            anyhow::anyhow!("Carousel items not found: {}", e)
        })?;

        info!("Found {} carousel items", carousel_items.len());

        if carousel_items.len() < 2 {
            return Ok(TestResult::failure(
                "Carousel",
                &format!("Expected at least 2 carousel items, found {}", carousel_items.len()),
            ));
        }

        // Click next button to test navigation
        let next_button = driver
            .find(By::Css(".hi-carousel-arrow-next"))
            .await
            .map_err(|e| {
                info!("Next button not found: {}", e);
                anyhow::anyhow!("Next button not found: {}", e)
            })?;

        next_button
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click next button: {}", e))?;
        info!("Next button clicked");

        tokio::time::sleep(Duration::from_millis(200)).await;

        // Click previous button to test navigation
        let prev_button = driver
            .find(By::Css(".hi-carousel-arrow-prev"))
            .await
            .map_err(|e| {
                info!("Previous button not found: {}", e);
                anyhow::anyhow!("Previous button not found: {}", e)
            })?;

        prev_button
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click previous button: {}", e))?;
        info!("Previous button clicked");

        tokio::time::sleep(Duration::from_millis(200)).await;

        // Verify carousel dots exist
        let carousel_dots = driver.find_all(By::Css(".hi-carousel-dot")).await.map_err(|e| {
            info!("Carousel dots not found: {}", e);
            anyhow::anyhow!("Carousel dots not found: {}", e)
        })?;

        info!("Found {} carousel dots", carousel_dots.len());

        if carousel_dots.len() != carousel_items.len() {
            return Ok(TestResult::failure(
                "Carousel",
                &format!("Carousel items ({}) and dots ({}) count mismatch",
                         carousel_items.len(),
                         carousel_dots.len()),
            ));
        }

        // Verify active dot exists
        driver
            .find(By::Css(".hi-carousel-dot-active"))
            .await
            .map_err(|e| {
                info!("Active carousel dot not found: {}", e);
                anyhow::anyhow!("Active carousel dot not found: {}", e)
            })?;

        info!("Active carousel dot found");

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Carousel".to_string(),
            status: super::TestStatus::Success,
            message: format!(
                "Carousel component renders correctly with {} items, {} dots, and functional navigation",
                carousel_items.len(),
                carousel_dots.len()
            ),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_stepper(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Stepper component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // Stepper is demonstrated in layer2/navigation page
        let test_url = format!("{}/components/layer2/navigation", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        // Verify Stepper element exists
        let stepper = driver.find(By::Css(".hi-stepper")).await.map_err(|e| {
            info!("Stepper element not found: {}", e);
            anyhow::anyhow!("Stepper element not found: {}", e)
        })?;

        info!("Stepper element found");

        let class_attr = stepper
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get stepper attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for stepper"))?;

        if !class_attr.contains("hi-stepper") {
            return Ok(TestResult::failure(
                "Stepper",
                "Stepper element missing 'hi-stepper' class",
            ));
        }

        // Verify step numbers exist
        let step_numbers = driver.find_all(By::Css(".hi-step-number")).await.map_err(|e| {
            info!("Step numbers not found: {}", e);
            anyhow::anyhow!("Step numbers not found: {}", e)
        })?;

        info!("Found {} step numbers", step_numbers.len());

        if step_numbers.len() < 2 {
            return Ok(TestResult::failure(
                "Stepper",
                &format!("Expected at least 2 step numbers, found {}", step_numbers.len()),
            ));
        }

        // Verify active step exists
        let active_step = driver
            .find(By::Css(".hi-step-active"))
            .await
            .map_err(|e| {
                info!("Active step not found: {}", e);
                anyhow::anyhow!("Active step not found: {}", e)
            })?;

        info!("Active step found");

        let active_class_attr = active_step
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get active step attributes: {}", e))?;

        let active_class_attr =
            active_class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for active step"))?;

        if !active_class_attr.contains("hi-step-active") {
            return Ok(TestResult::failure(
                "Stepper",
                "Active step missing 'hi-step-active' class",
            ));
        }

        // Verify connectors exist
        let connectors = driver.find_all(By::Css(".hi-step-connector")).await.map_err(|e| {
            info!("Connectors not found: {}", e);
            anyhow::anyhow!("Connectors not found: {}", e)
        })?;

        info!("Found {} connectors", connectors.len());

        if connectors.is_empty() {
            return Ok(TestResult::failure(
                "Stepper",
                "No connectors found",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Stepper".to_string(),
            status: super::TestStatus::Success,
            message: format!(
                "Stepper component renders correctly with {} steps and {} connectors",
                step_numbers.len(),
                connectors.len()
            ),
            duration_ms: duration,
            screenshot_path: None,
        })
    }
}

impl Test for FormComponentsTests {
    fn name(&self) -> &str {
        "Layer 2: Form Components Tests"
    }

    fn setup(&self) -> Result<()> {
        info!("Setting up form components test suite");
        info!("Dev server check: http://localhost:3000");
        Ok(())
    }

    async fn run_with_driver(&self, driver: &WebDriver) -> Result<TestResult> {
        info!("Running form components E2E tests");

        let mut results = vec![];

        match self.test_form(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Form test failed: {}", e);
                results.push(TestResult::error("Form", &e.to_string()));
            }
        }

        match self.test_select(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Select test failed: {}", e);
                results.push(TestResult::error("Select", &e.to_string()));
            }
        }

        match self.test_checkbox(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Checkbox test failed: {}", e);
                results.push(TestResult::error("Checkbox", &e.to_string()));
            }
        }

        match self.test_radio(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Radio test failed: {}", e);
                results.push(TestResult::error("Radio", &e.to_string()));
            }
        }

        match self.test_switch(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Switch test failed: {}", e);
                results.push(TestResult::error("Switch", &e.to_string()));
            }
        }

        match self.test_carousel(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Carousel test failed: {}", e);
                results.push(TestResult::error("Carousel", &e.to_string()));
            }
        }

        match self.test_stepper(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Stepper test failed: {}", e);
                results.push(TestResult::error("Stepper", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
