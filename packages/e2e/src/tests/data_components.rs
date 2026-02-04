// hikari-e2e/src/tests/data_components.rs
// E2E tests for Layer 2 data components

use anyhow::Result;
use std::time::{Duration, Instant};

use thirtyfour::{By, WebDriver};
use tracing::info;

use super::TestResult;
use crate::Test;

/// Test suite for Layer 2 data components
pub struct DataComponentsTests;

impl DataComponentsTests {
    async fn test_table(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Table component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/table", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let table = driver.find(By::Css(".hi-table")).await.map_err(|e| {
            info!("Table element not found: {}", e);
            anyhow::anyhow!("Table element not found: {}", e)
        })?;

        info!("Table element found");

        let rows = table
            .find_all(By::Css("tr"))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to find table rows: {}", e))?;

        if rows.is_empty() {
            return Ok(TestResult::failure("Table", "Table element has no rows"));
        }

        info!("Table has {} rows", rows.len());

        let class_attr = table
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get table attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for table"))?;

        if !class_attr.contains("hi-table") {
            return Ok(TestResult::failure(
                "Table",
                "Table element missing 'hi-table' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Table".to_string(),
            status: super::TestStatus::Success,
            message: format!(
                "Table component renders correctly with {} rows and has proper class",
                rows.len()
            ),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_tree(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Tree component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/tree", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let tree = driver.find(By::Css(".hi-tree")).await.map_err(|e| {
            info!("Tree element not found: {}", e);
            anyhow::anyhow!("Tree element not found: {}", e)
        })?;

        info!("Tree element found");

        let nodes = tree
            .find_all(By::Css(".hi-tree-node"))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to find tree nodes: {}", e))?;

        if nodes.is_empty() {
            return Ok(TestResult::failure("Tree", "Tree element has no nodes"));
        }

        info!("Tree has {} nodes", nodes.len());

        let class_attr = tree
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get tree attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for tree"))?;

        if !class_attr.contains("hi-tree") {
            return Ok(TestResult::failure(
                "Tree",
                "Tree element missing 'hi-tree' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Tree".to_string(),
            status: super::TestStatus::Success,
            message: format!(
                "Tree component renders correctly with {} nodes and has proper class",
                nodes.len()
            ),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_pagination(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Pagination component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/pagination", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let pagination = driver.find(By::Css(".hi-pagination")).await.map_err(|e| {
            info!("Pagination element not found: {}", e);
            anyhow::anyhow!("Pagination element not found: {}", e)
        })?;

        info!("Pagination element found");

        let items = pagination
            .find_all(By::Css(".hi-pagination-item"))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to find pagination items: {}", e))?;

        if items.is_empty() {
            return Ok(TestResult::failure(
                "Pagination",
                "Pagination element has no items",
            ));
        }

        info!("Pagination has {} items", items.len());

        let class_attr = pagination
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get pagination attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for pagination"))?;

        if !class_attr.contains("hi-pagination") {
            return Ok(TestResult::failure(
                "Pagination",
                "Pagination element missing 'hi-pagination' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Pagination".to_string(),
            status: super::TestStatus::Success,
            message: format!(
                "Pagination component renders correctly with {} items and has proper class",
                items.len()
            ),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_dropdown(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Dropdown component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/components/layer2/dropdown", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let dropdown = driver.find(By::Css(".hi-dropdown")).await.map_err(|e| {
            info!("Dropdown element not found: {}", e);
            anyhow::anyhow!("Dropdown element not found: {}", e)
        })?;

        info!("Dropdown element found");

        dropdown
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click dropdown: {}", e))?;
        info!("Dropdown clicked successfully");

        tokio::time::sleep(Duration::from_millis(200)).await;

        let class_attr = dropdown
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get dropdown attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for dropdown"))?;

        if !class_attr.contains("hi-dropdown") {
            return Ok(TestResult::failure(
                "Dropdown",
                "Dropdown element missing 'hi-dropdown' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Dropdown".to_string(),
            status: super::TestStatus::Success,
            message: "Dropdown component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
            screenshot_path: None,
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

    async fn run_with_driver(&self, driver: &WebDriver) -> Result<TestResult> {
        info!("Running data components E2E tests");

        let mut results = vec![];

        match self.test_table(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Table test failed: {}", e);
                results.push(TestResult::error("Table", &e.to_string()));
            }
        }

        match self.test_tree(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Tree test failed: {}", e);
                results.push(TestResult::error("Tree", &e.to_string()));
            }
        }

        match self.test_pagination(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Pagination test failed: {}", e);
                results.push(TestResult::error("Pagination", &e.to_string()));
            }
        }

        match self.test_dropdown(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Dropdown test failed: {}", e);
                results.push(TestResult::error("Dropdown", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
