// hikari-e2e/src/tests/data_components.rs
// E2E tests for Layer 2 data components

use anyhow::Result;
use std::time::{Duration, Instant};

use headless_chrome::Browser;
use tracing::info;

use super::{TestResult, TestStatus};
use crate::Test;

/// Test suite for Layer 2 data components
pub struct DataComponentsTests;

#[derive(Debug, Clone)]
pub struct DataComponentVerification {
    pub component_name: String,
    pub renders: bool,
    pub displays_data: bool,
    pub supports_interaction: bool,
}

impl TestResult {
    pub fn from_data_verification(verification: &DataComponentVerification) -> Self {
        let status = if verification.renders
            && verification.displays_data
            && verification.supports_interaction
        {
            TestStatus::Success
        } else {
            TestStatus::Error(format!(
                "Failed verification - renders: {}, displays_data: {}, supports_interaction: {}",
                verification.renders, verification.displays_data, verification.supports_interaction
            ))
        };

        Self {
            component: verification.component_name.clone(),
            status,
            message: format!(
                "Data component {} rendering and data display",
                verification.component_name
            ),
            duration_ms: 0,
        }
    }
}

impl DataComponentsTests {
    fn test_table(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Table component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/table", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let table = tab.find_element(".hi-table").map_err(|e| {
            info!("Table element not found: {}", e);
            anyhow::anyhow!("Table element not found: {}", e)
        })?;

        info!("Table element found");

        let rows = table
            .find_elements("tr")
            .map_err(|e| anyhow::anyhow!("Failed to find table rows: {}", e))?;

        if rows.is_empty() {
            return Ok(TestResult::failure("Table", "Table element has no rows"));
        }

        info!("Table has {} rows", rows.len());

        let attrs = table
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get table attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for table"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-table"));

        if !has_class {
            return Ok(TestResult::failure(
                "Table",
                "Table element missing 'hi-table' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Table".to_string(),
            status: TestStatus::Success,
            message: format!(
                "Table component renders correctly with {} rows and has proper class",
                rows.len()
            ),
            duration_ms: duration,
        })
    }

    fn test_tree(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Tree component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/tree", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let tree = tab.find_element(".hi-tree").map_err(|e| {
            info!("Tree element not found: {}", e);
            anyhow::anyhow!("Tree element not found: {}", e)
        })?;

        info!("Tree element found");

        let nodes = tree
            .find_elements(".hi-tree-node")
            .map_err(|e| anyhow::anyhow!("Failed to find tree nodes: {}", e))?;

        if nodes.is_empty() {
            return Ok(TestResult::failure("Tree", "Tree element has no nodes"));
        }

        info!("Tree has {} nodes", nodes.len());

        let attrs = tree
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get tree attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for tree"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-tree"));

        if !has_class {
            return Ok(TestResult::failure(
                "Tree",
                "Tree element missing 'hi-tree' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Tree".to_string(),
            status: TestStatus::Success,
            message: format!(
                "Tree component renders correctly with {} nodes and has proper class",
                nodes.len()
            ),
            duration_ms: duration,
        })
    }

    fn test_pagination(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Pagination component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/pagination", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let pagination = tab.find_element(".hi-pagination").map_err(|e| {
            info!("Pagination element not found: {}", e);
            anyhow::anyhow!("Pagination element not found: {}", e)
        })?;

        info!("Pagination element found");

        let items = pagination
            .find_elements(".hi-pagination-item")
            .map_err(|e| anyhow::anyhow!("Failed to find pagination items: {}", e))?;

        if items.is_empty() {
            return Ok(TestResult::failure(
                "Pagination",
                "Pagination element has no items",
            ));
        }

        info!("Pagination has {} items", items.len());

        let attrs = pagination
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get pagination attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for pagination"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-pagination"));

        if !has_class {
            return Ok(TestResult::failure(
                "Pagination",
                "Pagination element missing 'hi-pagination' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Pagination".to_string(),
            status: TestStatus::Success,
            message: format!(
                "Pagination component renders correctly with {} items and has proper class",
                items.len()
            ),
            duration_ms: duration,
        })
    }

    fn test_dropdown(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Dropdown component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/dropdown", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let dropdown = tab.find_element(".hi-dropdown").map_err(|e| {
            info!("Dropdown element not found: {}", e);
            anyhow::anyhow!("Dropdown element not found: {}", e)
        })?;

        info!("Dropdown element found");

        dropdown
            .click()
            .map_err(|e| anyhow::anyhow!("Failed to click dropdown: {}", e))?;
        info!("Dropdown clicked successfully");

        std::thread::sleep(Duration::from_millis(200));

        let attrs = dropdown
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get dropdown attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for dropdown"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-dropdown"));

        if !has_class {
            return Ok(TestResult::failure(
                "Dropdown",
                "Dropdown element missing 'hi-dropdown' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Dropdown".to_string(),
            status: TestStatus::Success,
            message: "Dropdown component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
        })
    }
}

impl Test for DataComponentsTests {
    fn name(&self) -> &str {
        "Layer 2: Data Components Tests"
    }

    fn setup(&self) -> Result<()> {
        info!("Setting up data components test suite");
        info!("Dev server check: http://localhost:3000");
        Ok(())
    }

    fn run_with_browser(&self, browser: &Browser) -> Result<TestResult> {
        info!("Running data components E2E tests");

        let mut results = vec![];

        match self.test_table(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Table test failed: {}", e);
                results.push(TestResult::error("Table", &e.to_string()));
            }
        }

        match self.test_tree(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Tree test failed: {}", e);
                results.push(TestResult::error("Tree", &e.to_string()));
            }
        }

        match self.test_pagination(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Pagination test failed: {}", e);
                results.push(TestResult::error("Pagination", &e.to_string()));
            }
        }

        match self.test_dropdown(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Dropdown test failed: {}", e);
                results.push(TestResult::error("Dropdown", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
