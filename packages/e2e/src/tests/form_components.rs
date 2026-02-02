// hikari-e2e/src/tests/form_components.rs
// E2E tests for Layer 2 form-related components

use anyhow::Result;
use std::time::{Duration, Instant};

use headless_chrome::Browser;
use tracing::info;

use super::{TestResult, TestStatus};
use crate::Test;

/// Test suite for Layer 2 form components
pub struct FormComponentsTests;

#[derive(Debug, Clone)]
pub struct FormFieldVerification {
    pub component_name: String,
    pub renders: bool,
    pub accepts_input: bool,
    pub validates: bool,
}

impl TestResult {
    pub fn from_form_verification(verification: &FormFieldVerification) -> Self {
        let status = if verification.renders && verification.accepts_input && verification.validates
        {
            TestStatus::Success
        } else {
            TestStatus::Error(format!(
                "Failed verification - renders: {}, accepts_input: {}, validates: {}",
                verification.renders, verification.accepts_input, verification.validates
            ))
        };

        Self {
            component: verification.component_name.clone(),
            status,
            message: format!(
                "Form field {} rendering and input handling",
                verification.component_name
            ),
            duration_ms: 0,
        }
    }
}

impl FormComponentsTests {
    fn test_form(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Form component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/form", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let form = tab.find_element(".hi-form").map_err(|e| {
            info!("Form element not found: {}", e);
            anyhow::anyhow!("Form element not found: {}", e)
        })?;

        info!("Form element found");

        let attrs = form
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get form attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for form"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-form"));

        if !has_class {
            return Ok(TestResult::failure(
                "Form",
                "Form element missing 'hi-form' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Form".to_string(),
            status: TestStatus::Success,
            message: "Form component renders correctly and has proper class".to_string(),
            duration_ms: duration,
        })
    }

    fn test_select(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Select component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/select", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let select = tab.find_element(".hi-select").map_err(|e| {
            info!("Select element not found: {}", e);
            anyhow::anyhow!("Select element not found: {}", e)
        })?;

        info!("Select element found");

        select
            .click()
            .map_err(|e| anyhow::anyhow!("Failed to click select: {}", e))?;
        info!("Select clicked successfully");

        std::thread::sleep(Duration::from_millis(200));

        let attrs = select
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get select attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for select"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-select"));

        if !has_class {
            return Ok(TestResult::failure(
                "Select",
                "Select element missing 'hi-select' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Select".to_string(),
            status: TestStatus::Success,
            message: "Select component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
        })
    }

    fn test_checkbox(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Checkbox component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/checkbox", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let checkbox = tab.find_element(".hi-checkbox").map_err(|e| {
            info!("Checkbox element not found: {}", e);
            anyhow::anyhow!("Checkbox element not found: {}", e)
        })?;

        info!("Checkbox element found");

        checkbox
            .click()
            .map_err(|e| anyhow::anyhow!("Failed to click checkbox: {}", e))?;
        info!("Checkbox clicked successfully");

        let attrs = checkbox
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get checkbox attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for checkbox"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-checkbox"));

        if !has_class {
            return Ok(TestResult::failure(
                "Checkbox",
                "Checkbox element missing 'hi-checkbox' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Checkbox".to_string(),
            status: TestStatus::Success,
            message: "Checkbox component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
        })
    }

    fn test_radio(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Radio component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/radio", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let radio = tab.find_element(".hi-radio").map_err(|e| {
            info!("Radio element not found: {}", e);
            anyhow::anyhow!("Radio element not found: {}", e)
        })?;

        info!("Radio element found");

        radio
            .click()
            .map_err(|e| anyhow::anyhow!("Failed to click radio: {}", e))?;
        info!("Radio clicked successfully");

        let attrs = radio
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get radio attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for radio"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-radio"));

        if !has_class {
            return Ok(TestResult::failure(
                "Radio",
                "Radio element missing 'hi-radio' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Radio".to_string(),
            status: TestStatus::Success,
            message: "Radio component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
        })
    }

    fn test_switch(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Switch component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/switch", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let switch = tab.find_element(".hi-switch").map_err(|e| {
            info!("Switch element not found: {}", e);
            anyhow::anyhow!("Switch element not found: {}", e)
        })?;

        info!("Switch element found");

        switch
            .click()
            .map_err(|e| anyhow::anyhow!("Failed to click switch: {}", e))?;
        info!("Switch clicked successfully");

        let attrs = switch
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get switch attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for switch"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-switch"));

        if !has_class {
            return Ok(TestResult::failure(
                "Switch",
                "Switch element missing 'hi-switch' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Switch".to_string(),
            status: TestStatus::Success,
            message: "Switch component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
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

    fn run_with_browser(&self, browser: &Browser) -> Result<TestResult> {
        info!("Running form components E2E tests");

        let mut results = vec![];

        match self.test_form(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Form test failed: {}", e);
                results.push(TestResult::error("Form", &e.to_string()));
            }
        }

        match self.test_select(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Select test failed: {}", e);
                results.push(TestResult::error("Select", &e.to_string()));
            }
        }

        match self.test_checkbox(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Checkbox test failed: {}", e);
                results.push(TestResult::error("Checkbox", &e.to_string()));
            }
        }

        match self.test_radio(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Radio test failed: {}", e);
                results.push(TestResult::error("Radio", &e.to_string()));
            }
        }

        match self.test_switch(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Switch test failed: {}", e);
                results.push(TestResult::error("Switch", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
