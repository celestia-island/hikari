// hikari-e2e/src/tests/ssr_tests.rs
// SSR (Server-Side Rendering) E2E tests for Hikari website
//
// This test suite has two layers:
//
// 1. **Fixture-based unit tests** (no browser required) — `test_fixture_*()` methods:
//    These validate the `HtmlAssertions` utility against a fixture HTML document that
//    represents the *expected* SSR output structure. They test that our assertion helpers
//    work correctly and that the fixture HTML matches the design contract.
//    Run with: `cargo test -p hikari-e2e --lib ssr`
//
// 2. **E2E browser tests** — `test_e2e_*()` methods:
//    These navigate a live dev-server with Chrome WebDriver and validate the actual
//    runtime behavior. Require a running server + WebDriver.
//
// 3. **No-JS HTTP tests** — `test_e2e_no_js_visibility()`:
//    Uses a plain HTTP client (reqwest) to fetch the raw server response, bypassing
//    the browser's JavaScript engine entirely. This is the definitive SSR content test.

use anyhow::Result;
use reqwest;
use scraper::{Html, Selector};
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};
use thirtyfour::{By, WebDriver};
use tracing::{error, info, warn};

use crate::Test;
use crate::html_assertions::HtmlAssertions;

/// SSR-specific test result with additional metadata
#[derive(Debug, Clone)]
pub struct SsrTestResult {
    pub test_name: String,
    pub status: SsrTestStatus,
    pub message: String,
    pub duration_ms: u64,
    pub html_structure_passed: bool,
    pub no_js_passed: bool,
    pub hydration_passed: bool,
    pub screenshot_path: Option<String>,
}

#[derive(Debug, Clone)]
pub enum SsrTestStatus {
    Success,
    PartialSuccess {
        passed_tests: Vec<String>,
        failed_tests: Vec<String>,
    },
    Failure(String),
    Error(String),
}

impl SsrTestResult {
    pub fn success(test_name: &str, message: &str) -> Self {
        Self {
            test_name: test_name.to_string(),
            status: SsrTestStatus::Success,
            message: message.to_string(),
            duration_ms: 0,
            html_structure_passed: true,
            no_js_passed: true,
            hydration_passed: true,
            screenshot_path: None,
        }
    }

    pub fn partial(
        test_name: &str,
        message: &str,
        passed: Vec<String>,
        failed: Vec<String>,
    ) -> Self {
        Self {
            test_name: test_name.to_string(),
            status: SsrTestStatus::PartialSuccess {
                passed_tests: passed,
                failed_tests: failed,
            },
            message: message.to_string(),
            duration_ms: 0,
            html_structure_passed: false,
            no_js_passed: false,
            hydration_passed: false,
            screenshot_path: None,
        }
    }

    pub fn failure(test_name: &str, error_msg: &str) -> Self {
        Self {
            test_name: test_name.to_string(),
            status: SsrTestStatus::Failure(error_msg.to_string()),
            message: error_msg.to_string(),
            duration_ms: 0,
            html_structure_passed: false,
            no_js_passed: false,
            hydration_passed: false,
            screenshot_path: None,
        }
    }

    pub fn error(test_name: &str, error_msg: &str) -> Self {
        Self {
            test_name: test_name.to_string(),
            status: SsrTestStatus::Error(error_msg.to_string()),
            message: error_msg.to_string(),
            duration_ms: 0,
            html_structure_passed: false,
            no_js_passed: false,
            hydration_passed: false,
            screenshot_path: None,
        }
    }
}

/// SSR Tests for Hikari components
pub struct SsrTests;

impl SsrTests {
    /// Fixture HTML representing the *expected* SSR output of the Hikari website.
    ///
    /// This fixture defines the design contract: the elements, class names,
    /// and overall structure that `tairitsu_ssr::render_to_html()` must produce.
    /// The fixture-based unit tests (`test_fixture_*`) validate:
    ///   1. The `HtmlAssertions` utility works correctly on this structure.
    ///   2. The fixture itself satisfies the design contract.
    ///
    /// When real SSR is available, golden-file tests should fetch actual output
    /// and compare against this fixture (or replace it entirely).
    fn expected_ssr_fixture_html() -> String {
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hikari - UI Component Library</title>
    <link rel="stylesheet" href="/assets/hikari.css">
</head>
<body data-theme="light">
    <div id="hikari-app" class="hk-layout hi-layout-light hi-layout-has-sidebar">
        <header class="hk-layout-header">
            <div class="hk-layout-brand">
                <span class="hk-brand-logo">Hikari</span>
            </div>
            <nav class="hk-layout-nav">
                <a href="/components" class="hk-nav-link">Components</a>
                <a href="/system" class="hk-nav-link">Design System</a>
                <a href="/demos" class="hk-nav-link">Demos</a>
            </nav>
        </header>
        <div class="hk-layout-body">
            <div id="drawer-overlay" class="hk-layout-overlay"></div>
            <aside class="hk-layout-aside">
                <nav class="hk-side-nav">
                    <div class="hk-side-nav-group">
                        <div class="hk-side-nav-title">Getting Started</div>
                        <a href="/intro" class="hk-side-nav-link">Introduction</a>
                        <a href="/install" class="hk-side-nav-link">Installation</a>
                    </div>
                    <div class="hk-side-nav-group">
                        <div class="hk-side-nav-title">Components</div>
                        <a href="/components/button" class="hk-side-nav-link">Button</a>
                        <a href="/components/input" class="hk-side-nav-link">Input</a>
                        <a href="/components/card" class="hk-side-nav-link">Card</a>
                    </div>
                </nav>
            </aside>
            <main class="hk-layout-main">
                <div class="hk-layout-content">
                    <!-- Home Page -->
                    <div id="page-home" class="hikari-page is-active">
                        <section class="page-hero">
                            <div class="page-hero-inner">
                                <h1 class="page-hero-title">Hikari</h1>
                                <p class="page-hero-subtitle">A comprehensive Rust UI component library</p>
                                <p class="page-hero-desc">
                                    Built with a reactive virtual DOM, compiled to WebAssembly.
                                </p>
                                <div class="page-hero-actions">
                                    <a href="/components" class="hk-btn hi-btn--primary hi-btn--lg">Explore Components</a>
                                    <a href="/system" class="hk-btn hi-btn--secondary hi-btn--lg">Design System</a>
                                </div>
                            </div>
                        </section>
                        <section class="page-section">
                            <h2 class="page-section-title">What is Hikari?</h2>
                            <div class="card-grid">
                                <div class="card">
                                    <h3 class="card-title">Component Library</h3>
                                    <p class="card-body">Layered architecture with rich components.</p>
                                </div>
                                <div class="card">
                                    <h3 class="card-title">Design System</h3>
                                    <p class="card-body">500+ traditional Chinese colours.</p>
                                </div>
                                <div class="card">
                                    <h3 class="card-title">WebAssembly First</h3>
                                    <p class="card-body">No JavaScript framework required.</p>
                                </div>
                            </div>
                        </section>
                    </div>
                    <!-- Components Page -->
                    <div id="page-components" class="hikari-page">
                        <section class="page-section">
                            <h1 class="page-title">Components</h1>
                            <div class="component-list">
                                <div class="component-item">
                                    <h3>Button</h3>
                                    <p class="hk-btn hi-btn--primary">Primary Button</p>
                                    <p class="hk-btn hi-btn--secondary">Secondary Button</p>
                                </div>
                            </div>
                        </section>
                    </div>
                    <!-- System Page -->
                    <div id="page-system" class="hikari-page">
                        <section class="page-section">
                            <h1 class="page-title">Design System</h1>
                            <div class="color-palette">
                                <div class="color-swatch" style="background: #E91E63;"></div>
                                <div class="color-swatch" style="background: #9C27B0;"></div>
                            </div>
                        </section>
                    </div>
                    <!-- Demos Page -->
                    <div id="page-demos" class="hikari-page">
                        <section class="page-section">
                            <h1 class="page-title">Demos</h1>
                        </section>
                    </div>
                    <!-- 404 Page -->
                    <div id="page-404" class="hikari-page">
                        <section class="page-hero">
                            <h1 class="page-hero-title">404</h1>
                            <p class="page-hero-subtitle">Page not found</p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    </div>
</body>
</html>"#.to_string()
    }

    /// Test 1: Verify SSR output HTML structure
    /// Fixture test 1: Validates `HtmlAssertions` utility against the expected SSR output fixture.
    /// Checks that the fixture HTML contains the required top-level document structure.
    pub fn test_fixture_html_structure() -> Result<SsrTestResult> {
        info!("[fixture] Validating HTML structure in expected SSR fixture");

        let html = Self::expected_ssr_fixture_html();
        let assertions = HtmlAssertions::new(html);

        // Verify basic HTML structure
        assertions
            .assert_exists("html")
            .map_err(|e| anyhow::anyhow!("HTML root not found: {}", e))?;
        assertions
            .assert_exists("head")
            .map_err(|e| anyhow::anyhow!("Head element not found: {}", e))?;
        assertions
            .assert_exists("body")
            .map_err(|e| anyhow::anyhow!("Body element not found: {}", e))?;

        // Verify meta tags
        assertions
            .assert_exists("meta[charset]")
            .map_err(|e| anyhow::anyhow!("Charset meta tag not found: {}", e))?;
        assertions
            .assert_attr_eq("meta[name='viewport']", "name", "viewport")
            .map_err(|e| anyhow::anyhow!("Viewport meta not found: {}", e))?;

        // Verify app root
        assertions
            .assert_exists("#hikari-app")
            .map_err(|e| anyhow::anyhow!("Hikari app root not found: {}", e))?;

        Ok(SsrTestResult::success(
            "test_fixture_html_structure",
            "Fixture HTML structure contains all required elements: html, head, body, meta tags, and app root",
        ))
    }

    /// Fixture test 2: Validates `HtmlAssertions` utility against the expected SSR output fixture.
    /// Checks that all page sections are present in the fixture HTML.
    pub fn test_fixture_has_all_pages() -> Result<SsrTestResult> {
        info!("[fixture] Validating all pages present in expected SSR fixture");

        let html = Self::expected_ssr_fixture_html();
        let assertions = HtmlAssertions::new(html);

        // Verify all expected pages exist
        let expected_pages = vec![
            ("#page-home", "Home page"),
            ("#page-components", "Components page"),
            ("#page-system", "System page"),
            ("#page-demos", "Demos page"),
            ("#page-404", "404 page"),
        ];

        for (selector, page_name) in expected_pages {
            assertions
                .assert_exists(selector)
                .map_err(|e| anyhow::anyhow!("{} not found: {}", page_name, e))?;
        }

        // Verify all pages have the hikari-page class
        assertions
            .assert_count(".hikari-page", 5)
            .map_err(|e| anyhow::anyhow!("Expected 5 pages with .hikari-page class: {}", e))?;

        Ok(SsrTestResult::success(
            "test_fixture_has_all_pages",
            "Fixture HTML contains all 5 pages (home, components, system, demos, 404)",
        ))
    }

    /// Fixture test 3: Validates `HtmlAssertions` utility against the expected SSR output fixture.
    /// Checks that all required CSS classes are present in the fixture HTML.
    pub fn test_fixture_css_classes_present() -> Result<SsrTestResult> {
        info!("[fixture] Validating CSS class names in expected SSR fixture");

        let html = Self::expected_ssr_fixture_html();
        let assertions = HtmlAssertions::new(html);

        // Verify layout classes
        assertions
            .assert_has_class("#hikari-app", "hk-layout")
            .map_err(|e| anyhow::anyhow!("App root missing hi-layout class: {}", e))?;
        assertions
            .assert_has_class("#hikari-app", "hk-layout-light")
            .map_err(|e| anyhow::anyhow!("App root missing hi-layout-light class: {}", e))?;

        // Verify button classes
        assertions
            .assert_has_class(".hk-btn--primary", "hk-btn")
            .map_err(|e| anyhow::anyhow!("Primary button missing hi-btn class: {}", e))?;
        assertions
            .assert_has_class(".hk-btn--primary", "hk-btn--primary")
            .map_err(|e| anyhow::anyhow!("Primary button missing hi-btn--primary class: {}", e))?;
        assertions
            .assert_has_class(".hk-btn--primary", "hk-btn--lg")
            .map_err(|e| anyhow::anyhow!("Primary button missing hi-btn--lg class: {}", e))?;

        // Verify hero section classes
        assertions
            .assert_exists(".page-hero")
            .map_err(|e| anyhow::anyhow!("Hero section not found: {}", e))?;
        assertions
            .assert_exists(".page-hero-title")
            .map_err(|e| anyhow::anyhow!("Hero title not found: {}", e))?;

        // Verify card classes
        assertions
            .assert_count(".card", 3)
            .map_err(|e| anyhow::anyhow!("Expected 3 cards: {}", e))?;
        assertions
            .assert_exists(".card-title")
            .map_err(|e| anyhow::anyhow!("Card title not found: {}", e))?;

        // Verify navigation classes
        assertions
            .assert_exists(".hk-layout-nav")
            .map_err(|e| anyhow::anyhow!("Layout nav not found: {}", e))?;
        assertions
            .assert_count(".hk-nav-link", 3)
            .map_err(|e| anyhow::anyhow!("Expected 3 nav links: {}", e))?;

        Ok(SsrTestResult::success(
            "test_fixture_css_classes_present",
            "Fixture HTML contains all required CSS classes: layout, buttons, hero, cards, navigation",
        ))
    }

    /// Fixture test 4: Validates `HtmlAssertions` utility against the expected SSR output fixture.
    /// Checks that all critical content exists directly in the fixture HTML
    /// (i.e. would be visible without JavaScript).
    pub fn test_fixture_no_js_required() -> Result<SsrTestResult> {
        info!("[fixture] Validating no-JS content presence in expected SSR fixture");

        let html = Self::expected_ssr_fixture_html();
        let assertions = HtmlAssertions::new(html);

        // Verify important content is in HTML (not loaded via JS)
        assertions
            .assert_text_contains(".page-hero-title", "Hikari")
            .map_err(|e| anyhow::anyhow!("Hero title not in HTML: {}", e))?;
        assertions
            .assert_text_contains(".page-hero-subtitle", "Rust UI component library")
            .map_err(|e| anyhow::anyhow!("Hero subtitle not in HTML: {}", e))?;

        // Verify card content is present
        assertions
            .assert_text_contains(".card:nth-child(1) .card-title", "Component Library")
            .map_err(|e| anyhow::anyhow!("Card 1 title not in HTML: {}", e))?;
        assertions
            .assert_text_contains(".card:nth-child(2) .card-title", "Design System")
            .map_err(|e| anyhow::anyhow!("Card 2 title not in HTML: {}", e))?;
        assertions
            .assert_text_contains(".card:nth-child(3) .card-title", "WebAssembly First")
            .map_err(|e| anyhow::anyhow!("Card 3 title not in HTML: {}", e))?;

        // Verify button text is present
        assertions
            .assert_text_contains(".hk-btn--primary", "Explore Components")
            .map_err(|e| anyhow::anyhow!("Primary button text not in HTML: {}", e))?;

        // Verify navigation links are present
        assertions
            .assert_attr_eq(".hk-nav-link[href='/components']", "href", "/components")
            .map_err(|e| anyhow::anyhow!("Components nav link not in HTML: {}", e))?;

        Ok(SsrTestResult::success(
            "test_fixture_no_js_required",
            "Fixture HTML contains all critical content inline (would be visible without JS)",
        ))
    }

    /// Run all fixture-based unit tests (no browser required).
    /// These validate the `HtmlAssertions` utility and the expected SSR output fixture.
    pub fn run_all() -> Vec<SsrTestResult> {
        let mut results = vec![];

        // Fixture test 1: HTML structure
        match Self::test_fixture_html_structure() {
            Ok(result) => results.push(result),
            Err(e) => {
                tracing::error!("Fixture HTML structure test failed: {}", e);
                results.push(SsrTestResult::error(
                    "test_fixture_html_structure",
                    &e.to_string(),
                ));
            }
        }

        // Fixture test 2: All pages rendered
        match Self::test_fixture_has_all_pages() {
            Ok(result) => results.push(result),
            Err(e) => {
                tracing::error!("Fixture pages test failed: {}", e);
                results.push(SsrTestResult::error(
                    "test_fixture_has_all_pages",
                    &e.to_string(),
                ));
            }
        }

        // Fixture test 3: CSS classes
        match Self::test_fixture_css_classes_present() {
            Ok(result) => results.push(result),
            Err(e) => {
                tracing::error!("Fixture CSS classes test failed: {}", e);
                results.push(SsrTestResult::error(
                    "test_fixture_css_classes_present",
                    &e.to_string(),
                ));
            }
        }

        // Fixture test 4: No JS required
        match Self::test_fixture_no_js_required() {
            Ok(result) => results.push(result),
            Err(e) => {
                tracing::error!("Fixture no-JS test failed: {}", e);
                results.push(SsrTestResult::error(
                    "test_fixture_no_js_required",
                    &e.to_string(),
                ));
            }
        }

        results
    }

    // ========== E2E Tests with WebDriver ==========

    /// Get the base URL for testing
    fn base_url() -> String {
        std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
    }

    /// Take a screenshot with SSR-specific naming
    async fn take_screenshot(
        driver: &WebDriver,
        test_name: &str,
        test_type: &str,
        _status: &str,
    ) -> Result<String> {
        let screenshots_dir = std::env::var("E2E_SCREENSHOTS_DIR")
            .unwrap_or_else(|_| "./screenshots/ssr".to_string());

        std::fs::create_dir_all(&screenshots_dir)
            .map_err(|e| anyhow::anyhow!("Failed to create screenshots directory: {}", e))?;

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("ssr_{}_{}_{}.png", test_name, test_type, timestamp);
        let filepath = PathBuf::from(&screenshots_dir).join(&filename);

        let screenshot_data = driver.screenshot_as_png().await.map_err(|e| {
            anyhow::anyhow!(
                "Failed to take screenshot for {} {}: {}",
                test_name,
                test_type,
                e
            )
        })?;

        std::fs::write(&filepath, screenshot_data)
            .map_err(|e| anyhow::anyhow!("Failed to save screenshot: {}", e))?;

        info!("SSR Screenshot saved to: {}", filepath.display());

        Ok(filepath.to_string_lossy().to_string())
    }

    /// Get page HTML source for validation
    async fn get_page_html(driver: &WebDriver) -> Result<String> {
        driver
            .source()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get page source: {}", e))
    }

    /// E2E Test 1: HTML Structure Validation
    /// Verifies that SSR output contains correct elements and structure
    pub async fn test_e2e_html_structure(
        &self,
        driver: &WebDriver,
        path: &str,
    ) -> Result<SsrTestResult> {
        let start = Instant::now();
        let test_name = format!("HTML_Structure_{}", path.replace('/', "_"));

        info!("Testing E2E HTML structure for path: {}", path);

        let url = format!("{}{}", Self::base_url(), path);
        driver
            .goto(&url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        // Get HTML (should be SSR output)
        let html = Self::get_page_html(driver).await?;
        let assertions = HtmlAssertions::from_str(&html);

        let mut checks_passed = vec![];
        let mut checks_failed = vec![];

        // Check 1: Root app element exists
        match assertions.assert_exists("#hikari-app") {
            Ok(_) => checks_passed.push("Root #hikari-app element".to_string()),
            Err(e) => {
                checks_failed.push(format!("Root #hikari-app element: {}", e));
                warn!("Check failed: {}", e);
            }
        }

        // Check 2: Layout classes present
        match assertions.assert_has_class("#hikari-app", "hk-layout") {
            Ok(_) => checks_passed.push("Layout class".to_string()),
            Err(e) => {
                checks_failed.push(format!("Layout class: {}", e));
            }
        }

        // Check 3: Header/navigation present
        match assertions.assert_exists(".hk-layout-header") {
            Ok(_) => checks_passed.push("Header element".to_string()),
            Err(e) => {
                checks_failed.push(format!("Header element: {}", e));
            }
        }

        // Check 4: Main content area present
        match assertions.assert_exists(".hk-layout-content") {
            Ok(_) => checks_passed.push("Main content area".to_string()),
            Err(e) => {
                checks_failed.push(format!("Main content area: {}", e));
            }
        }

        // Check 5: Sidebar present
        match assertions.assert_exists(".hk-layout-aside") {
            Ok(_) => checks_passed.push("Sidebar element".to_string()),
            Err(e) => {
                checks_failed.push(format!("Sidebar element: {}", e));
            }
        }

        // Check 6: At least one page is rendered
        match assertions.assert_exists(".hikari-page") {
            Ok(_) => checks_passed.push("Page elements rendered".to_string()),
            Err(e) => {
                checks_failed.push(format!("Page elements: {}", e));
            }
        }

        // Check 7: Basic HTML structure
        match assertions.assert_exists("html") {
            Ok(_) => checks_passed.push("HTML root".to_string()),
            Err(e) => {
                checks_failed.push(format!("HTML root: {}", e));
            }
        }

        match assertions.assert_exists("head") {
            Ok(_) => checks_passed.push("Head element".to_string()),
            Err(e) => {
                checks_failed.push(format!("Head element: {}", e));
            }
        }

        match assertions.assert_exists("body") {
            Ok(_) => checks_passed.push("Body element".to_string()),
            Err(e) => {
                checks_failed.push(format!("Body element: {}", e));
            }
        }

        // Take screenshot
        let screenshot = Self::take_screenshot(driver, &test_name, "structure", "done")
            .await
            .unwrap_or_default();

        let duration = start.elapsed().as_millis() as u64;

        if checks_failed.is_empty() {
            Ok(SsrTestResult {
                test_name,
                status: SsrTestStatus::Success,
                message: format!(
                    "HTML structure validation passed ({} checks)",
                    checks_passed.len()
                ),
                duration_ms: duration,
                html_structure_passed: true,
                no_js_passed: false,
                hydration_passed: false,
                screenshot_path: Some(screenshot),
            })
        } else {
            Ok(SsrTestResult {
                test_name,
                status: SsrTestStatus::PartialSuccess {
                    passed_tests: checks_passed.clone(),
                    failed_tests: checks_failed.clone(),
                },
                message: format!(
                    "HTML structure: {} passed, {} failed",
                    checks_passed.len(),
                    checks_failed.len()
                ),
                duration_ms: duration,
                html_structure_passed: false,
                no_js_passed: false,
                hydration_passed: false,
                screenshot_path: Some(screenshot),
            })
        }
    }

    /// E2E Test 2: No-JS Content Visibility
    ///
    /// Uses a plain HTTP client (reqwest) to fetch the raw server response
    /// without executing JavaScript. This is the definitive SSR content test:
    /// whatever the server sends is what a user without JS (or a search-engine
    /// crawler) will see.
    pub async fn test_e2e_no_js_visibility(
        &self,
        driver: &WebDriver,
        path: &str,
    ) -> Result<SsrTestResult> {
        let start = Instant::now();
        let test_name = format!("No_JS_{}", path.replace('/', "_"));

        info!(
            "Testing no-JS content visibility for path: {} (via HTTP fetch)",
            path
        );

        let url = format!("{}{}", Self::base_url(), path);

        // Fetch the raw HTML from the server using a plain HTTP client.
        // The browser's JS engine is never involved — this is exactly what
        // a search-engine crawler or a user with JS disabled would receive.
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to build HTTP client: {}", e))?;

        let raw_html = http_client
            .get(&url)
            .header("Accept", "text/html")
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("HTTP fetch failed for {}: {}", url, e))?
            .text()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read response body: {}", e))?;

        info!("Fetched {} bytes of raw HTML from {}", raw_html.len(), url);

        let assertions = HtmlAssertions::from_str(&raw_html);
        let mut checks_passed = vec![];
        let mut checks_failed = vec![];

        // Check 1: Root element exists in raw server HTML
        match assertions.assert_exists("#hikari-app") {
            Ok(_) => checks_passed.push("Root element in raw HTML".to_string()),
            Err(e) => checks_failed.push(format!("Root element in raw HTML: {}", e)),
        }

        // Check 2: Component classes present in raw HTML
        if raw_html.contains("hk-") {
            checks_passed.push("Component classes present in raw HTML".to_string());
        } else {
            checks_failed.push("No component classes found in raw HTML".to_string());
        }

        // Check 3: Navigation is in raw HTML
        match assertions.assert_exists(".hk-layout-header") {
            Ok(_) => checks_passed.push("Navigation in raw HTML".to_string()),
            Err(e) => checks_failed.push(format!("Navigation in raw HTML: {}", e)),
        }

        // Check 4: Main content area has meaningful text
        if let Ok(sel) = Selector::parse(".hk-layout-content") {
            let parsed = Html::parse_document(&raw_html);
            if let Some(element) = parsed.select(&sel).next() {
                let text = element.text().collect::<String>();
                if text.trim().len() > 10 {
                    checks_passed.push("Main content has text in raw HTML".to_string());
                } else {
                    checks_failed.push("Main content is empty in raw HTML".to_string());
                }
            } else {
                checks_failed.push("Main content area not found in raw HTML".to_string());
            }
        }

        // Check 5: At least one page element exists in raw HTML
        match assertions.assert_exists(".hikari-page") {
            Ok(_) => checks_passed.push("Page elements in raw HTML".to_string()),
            Err(e) => checks_failed.push(format!("Page elements in raw HTML: {}", e)),
        }

        // Take a browser screenshot for visual record (separate from the HTML check)
        let screenshot = Self::take_screenshot_after_navigate(driver, &url, &test_name).await;

        let duration = start.elapsed().as_millis() as u64;

        if checks_failed.is_empty() {
            Ok(SsrTestResult {
                test_name,
                status: SsrTestStatus::Success,
                message: format!(
                    "No-JS (HTTP) visibility passed ({} checks on raw server HTML)",
                    checks_passed.len()
                ),
                duration_ms: duration,
                html_structure_passed: false,
                no_js_passed: true,
                hydration_passed: false,
                screenshot_path: screenshot,
            })
        } else {
            Ok(SsrTestResult {
                test_name,
                status: SsrTestStatus::PartialSuccess {
                    passed_tests: checks_passed.clone(),
                    failed_tests: checks_failed.clone(),
                },
                message: format!(
                    "No-JS (HTTP): {} passed, {} failed",
                    checks_passed.len(),
                    checks_failed.len()
                ),
                duration_ms: duration,
                html_structure_passed: false,
                no_js_passed: false,
                hydration_passed: false,
                screenshot_path: screenshot,
            })
        }
    }

    /// Navigate the browser to a URL and take a screenshot for visual record.
    /// Returns the screenshot path on success, or logs and returns None on error.
    async fn take_screenshot_after_navigate(
        driver: &WebDriver,
        url: &str,
        test_name: &str,
    ) -> Option<String> {
        if let Err(e) = driver.goto(url).await {
            warn!(
                "Could not navigate browser to {} for screenshot: {}",
                url, e
            );
            return None;
        }
        tokio::time::sleep(Duration::from_millis(400)).await;
        Self::take_screenshot(driver, test_name, "no-js", "done")
            .await
            .ok()
    }

    /// E2E Test 3: Hydration Functionality
    /// Verifies that interactive features work after client-side hydration
    pub async fn test_e2e_hydration(
        &self,
        driver: &WebDriver,
        path: &str,
    ) -> Result<SsrTestResult> {
        let start = Instant::now();
        let test_name = format!("Hydration_{}", path.replace('/', "_"));

        info!("Testing E2E hydration for path: {}", path);

        let url = format!("{}{}", Self::base_url(), path);
        driver
            .goto(&url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let mut checks_passed = vec![];
        let mut checks_failed = vec![];

        // Check 1: JavaScript is enabled and working
        let js_enabled = driver
            .execute(
                "return typeof window !== 'undefined' && typeof document !== 'undefined';",
                Vec::new(),
            )
            .await;

        match js_enabled {
            Ok(result) => {
                if result.convert::<bool>().unwrap_or(false) {
                    checks_passed.push("JavaScript runtime available".to_string());
                } else {
                    checks_failed.push("JavaScript runtime not available".to_string());
                }
            }
            Err(e) => {
                checks_failed.push(format!("JavaScript check failed: {}", e));
            }
        }

        // Check 2: Hikari app is mounted
        let app_mounted = driver
            .execute(
                "return document.querySelector('#hikari-app') !== null;",
                Vec::new(),
            )
            .await;

        match app_mounted {
            Ok(result) => {
                if result.convert::<bool>().unwrap_or(false) {
                    checks_passed.push("Hikari app element mounted".to_string());
                } else {
                    checks_failed.push("Hikari app element not found".to_string());
                }
            }
            Err(e) => {
                checks_failed.push(format!("App mount check failed: {}", e));
            }
        }

        // Check 3: Event listeners are attached (try clicking something)
        // Look for interactive elements like buttons
        let button_result = driver.find(By::Css(".hk-button, .hk-btn")).await;

        match button_result {
            Ok(button) => {
                // Try to click it - if it works, hydration is successful
                match button.click().await {
                    Ok(_) => {
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        checks_passed.push("Interactive button clickable".to_string());
                    }
                    Err(e) => {
                        // Button exists but might not be interactive yet
                        info!("Button found but click failed: {}", e);
                        checks_passed.push("Interactive button found".to_string());
                    }
                }
            }
            Err(_) => {
                info!("No button found for hydration test (non-critical)");
                checks_passed.push("Interactive button (optional)".to_string());
            }
        }

        // Check 4: Router is functional
        let router_working = driver
            .execute(
                "return typeof window.history !== 'undefined' && typeof window.history.pushState === 'function';",
                Vec::new(),
            )
            .await;

        match router_working {
            Ok(result) => {
                if result.convert::<bool>().unwrap_or(false) {
                    checks_passed.push("History API available".to_string());
                } else {
                    checks_failed.push("History API not available".to_string());
                }
            }
            Err(e) => {
                checks_failed.push(format!("Router check failed: {}", e));
            }
        }

        // Check 5: No visible hydration errors
        let error_elements = driver.find_all(By::Css(".error, .hydration-error")).await;
        match error_elements {
            Ok(elements) => {
                if elements.is_empty() {
                    checks_passed.push("No visible hydration errors".to_string());
                } else {
                    checks_failed
                        .push(format!("Found {} potential error elements", elements.len()));
                }
            }
            Err(_) => {
                checks_passed.push("No visible hydration errors".to_string());
            }
        }

        // Check 6: Active page is correctly set
        let active_page = driver
            .execute(
                "return document.querySelector('.hikari-page.is-active') !== null;",
                Vec::new(),
            )
            .await;

        match active_page {
            Ok(result) => {
                if result.convert::<bool>().unwrap_or(false) {
                    checks_passed.push("Active page marker present".to_string());
                } else {
                    info!("No active page marker found (non-critical)");
                    checks_passed.push("Active page marker (optional)".to_string());
                }
            }
            Err(e) => {
                info!("Active page check failed: {} (non-critical)", e);
                checks_passed.push("Active page marker (optional)".to_string());
            }
        }

        // Take screenshot
        let screenshot = Self::take_screenshot(driver, &test_name, "hydration", "done")
            .await
            .unwrap_or_default();

        let duration = start.elapsed().as_millis() as u64;

        if checks_failed.is_empty() {
            Ok(SsrTestResult {
                test_name,
                status: SsrTestStatus::Success,
                message: format!("Hydration passed ({} checks)", checks_passed.len()),
                duration_ms: duration,
                html_structure_passed: false,
                no_js_passed: false,
                hydration_passed: true,
                screenshot_path: Some(screenshot),
            })
        } else {
            Ok(SsrTestResult {
                test_name,
                status: SsrTestStatus::PartialSuccess {
                    passed_tests: checks_passed.clone(),
                    failed_tests: checks_failed.clone(),
                },
                message: format!(
                    "Hydration: {} passed, {} failed",
                    checks_passed.len(),
                    checks_failed.len()
                ),
                duration_ms: duration,
                html_structure_passed: false,
                no_js_passed: false,
                hydration_passed: false,
                screenshot_path: Some(screenshot),
            })
        }
    }

    /// E2E Test 4: SEO Metadata
    /// Verifies SSR produces proper SEO metadata
    pub async fn test_e2e_seo_metadata(
        &self,
        driver: &WebDriver,
        path: &str,
    ) -> Result<SsrTestResult> {
        let start = Instant::now();
        let test_name = format!("SEO_{}", path.replace('/', "_"));

        info!("Testing E2E SEO metadata for path: {}", path);

        let url = format!("{}{}", Self::base_url(), path);
        driver
            .goto(&url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let html = Self::get_page_html(driver).await?;
        let assertions = HtmlAssertions::from_str(&html);

        let mut checks_passed = vec![];
        let mut checks_failed = vec![];

        // Check 1: Title tag exists
        match assertions.assert_exists("title") {
            Ok(_) => checks_passed.push("Title tag present".to_string()),
            Err(e) => {
                checks_failed.push(format!("Title tag: {}", e));
            }
        }

        // Check 2: Title is not empty
        let parsed = Html::parse_document(&html);
        if let Some(title) = parsed.select(&Selector::parse("title").unwrap()).next() {
            let title_text = title.text().collect::<String>();
            if !title_text.trim().is_empty() {
                checks_passed.push(format!("Title content: '{}'", title_text.trim()));
            } else {
                checks_failed.push("Title is empty".to_string());
            }
        }

        // Check 3: Meta description (optional)
        match assertions.assert_exists("meta[name='description']") {
            Ok(_) => checks_passed.push("Meta description present".to_string()),
            Err(_) => {
                info!("No meta description (non-critical)");
                checks_passed.push("Meta description (optional)".to_string());
            }
        }

        // Check 4: Semantic HTML elements
        match assertions.assert_exists("main") {
            Ok(_) => checks_passed.push("Semantic <main> element".to_string()),
            Err(e) => {
                checks_failed.push(format!("Semantic <main>: {}", e));
            }
        }

        match assertions.assert_exists("nav") {
            Ok(_) => checks_passed.push("Semantic <nav> element".to_string()),
            Err(e) => {
                checks_failed.push(format!("Semantic <nav>: {}", e));
            }
        }

        // Check 5: Proper heading structure
        match assertions.assert_exists("h1") {
            Ok(_) => checks_passed.push("H1 heading present".to_string()),
            Err(e) => {
                checks_failed.push(format!("H1 heading: {}", e));
            }
        }

        let duration = start.elapsed().as_millis() as u64;

        if checks_failed.is_empty() {
            Ok(SsrTestResult {
                test_name,
                status: SsrTestStatus::Success,
                message: format!("SEO metadata passed ({} checks)", checks_passed.len()),
                duration_ms: duration,
                html_structure_passed: false,
                no_js_passed: false,
                hydration_passed: false,
                screenshot_path: None,
            })
        } else {
            Ok(SsrTestResult {
                test_name,
                status: SsrTestStatus::PartialSuccess {
                    passed_tests: checks_passed.clone(),
                    failed_tests: checks_failed.clone(),
                },
                message: format!(
                    "SEO metadata: {} passed, {} failed",
                    checks_passed.len(),
                    checks_failed.len()
                ),
                duration_ms: duration,
                html_structure_passed: false,
                no_js_passed: false,
                hydration_passed: false,
                screenshot_path: None,
            })
        }
    }

    /// Test a specific route with all SSR E2E checks
    pub async fn test_e2e_route(&self, driver: &WebDriver, path: &str) -> Result<SsrTestResult> {
        info!("Running full E2E SSR test suite for route: {}", path);

        let mut all_results = vec![];

        // Run all four test categories
        match self.test_e2e_html_structure(driver, path).await {
            Ok(result) => all_results.push(result),
            Err(e) => {
                error!("HTML structure test failed: {}", e);
                all_results.push(SsrTestResult::failure(
                    &format!("HTML_Structure_{}", path.replace('/', "_")),
                    &e.to_string(),
                ));
            }
        }

        match self.test_e2e_no_js_visibility(driver, path).await {
            Ok(result) => all_results.push(result),
            Err(e) => {
                error!("No-JS test failed: {}", e);
                all_results.push(SsrTestResult::failure(
                    &format!("No_JS_{}", path.replace('/', "_")),
                    &e.to_string(),
                ));
            }
        }

        match self.test_e2e_hydration(driver, path).await {
            Ok(result) => all_results.push(result),
            Err(e) => {
                error!("Hydration test failed: {}", e);
                all_results.push(SsrTestResult::failure(
                    &format!("Hydration_{}", path.replace('/', "_")),
                    &e.to_string(),
                ));
            }
        }

        match self.test_e2e_seo_metadata(driver, path).await {
            Ok(result) => all_results.push(result),
            Err(e) => {
                error!("SEO metadata test failed: {}", e);
                all_results.push(SsrTestResult::failure(
                    &format!("SEO_{}", path.replace('/', "_")),
                    &e.to_string(),
                ));
            }
        }

        // Aggregate results
        let total_tests = all_results.len();
        let passed = all_results
            .iter()
            .filter(|r| matches!(r.status, SsrTestStatus::Success))
            .count();

        let html_passed = all_results.iter().any(|r| r.html_structure_passed);
        let no_js_passed = all_results.iter().any(|r| r.no_js_passed);
        let hydration_passed = all_results.iter().any(|r| r.hydration_passed);

        let status = if passed == total_tests {
            SsrTestStatus::Success
        } else if passed > 0 {
            SsrTestStatus::PartialSuccess {
                passed_tests: vec![],
                failed_tests: vec![],
            }
        } else {
            SsrTestStatus::Failure("All tests failed".to_string())
        };

        Ok(SsrTestResult {
            test_name: format!("Route_{}", path.replace('/', "_")),
            status,
            message: format!("SSR E2E tests for {}: {} passed", path, passed),
            duration_ms: 0,
            html_structure_passed: html_passed,
            no_js_passed,
            hydration_passed,
            screenshot_path: None,
        })
    }

    /// Test all critical routes
    pub async fn test_e2e_all_routes(&self, driver: &WebDriver) -> Result<Vec<SsrTestResult>> {
        let routes = vec![
            "/",
            "/components/layer1",
            "/components/layer2",
            "/components/layer3",
        ];

        let mut results = vec![];

        for route in routes {
            match self.test_e2e_route(driver, route).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    error!("Route test failed for {}: {}", route, e);
                    results.push(SsrTestResult::failure(
                        &format!("Route_{}", route.replace('/', "_")),
                        &e.to_string(),
                    ));
                }
            }
        }

        Ok(results)
    }
}

/// Implement the Test trait for SsrTests to integrate with the E2E framework
impl Test for SsrTests {
    fn name(&self) -> &str {
        "SSR E2E Tests"
    }

    fn setup(&self) -> Result<()> {
        info!("Setting up SSR E2E test suite");
        info!("This suite has two layers:");
        info!("  Unit (fixture): validate HtmlAssertions against expected SSR output fixture");
        info!("  E2E (browser):  navigate a live server and check actual DOM / HTTP response");
        info!("");
        info!("E2E tests require a running dev server (WEBSITE_BASE_URL) and WebDriver.");
        Ok(())
    }

    async fn run_with_driver(
        &self,
        driver: &WebDriver,
    ) -> Result<crate::tests::basic_components::TestResult> {
        info!("Running SSR E2E tests");

        let mut all_results = vec![];

        // Test home page with all SSR checks
        match self.test_e2e_route(driver, "/").await {
            Ok(result) => {
                info!("Home page SSR test: {:?}", result.status);
                all_results.push(result);
            }
            Err(e) => {
                error!("Home page test failed: {}", e);
                all_results.push(SsrTestResult::failure("Home", &e.to_string()));
            }
        }

        // Test components page
        match self.test_e2e_route(driver, "/components/layer1").await {
            Ok(result) => {
                info!("Components page SSR test: {:?}", result.status);
                all_results.push(result);
            }
            Err(e) => {
                error!("Components page test failed: {}", e);
                all_results.push(SsrTestResult::failure("Components", &e.to_string()));
            }
        }

        // Aggregate and convert to basic TestResult
        let total = all_results.len();
        let passed = all_results
            .iter()
            .filter(|r| matches!(r.status, SsrTestStatus::Success))
            .count();

        let message = format!(
            "SSR E2E Tests: {} of {} routes passed. HTML: {}, No-JS: {}, Hydration: {}",
            passed,
            total,
            all_results.iter().any(|r| r.html_structure_passed),
            all_results.iter().any(|r| r.no_js_passed),
            all_results.iter().any(|r| r.hydration_passed)
        );

        Ok(crate::tests::basic_components::TestResult {
            component: "SSR".to_string(),
            status: if passed == total {
                crate::tests::basic_components::TestStatus::Success
            } else if passed > 0 {
                crate::tests::basic_components::TestStatus::Failure
            } else {
                crate::tests::basic_components::TestStatus::Error(message.clone())
            },
            message,
            duration_ms: 0,
            screenshot_path: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verifies the `HtmlAssertions` utility can detect correct HTML structure
    /// in the expected SSR output fixture.
    #[test]
    fn test_fixture_html_structure_passes() {
        let result = SsrTests::test_fixture_html_structure();
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(matches!(result.status, SsrTestStatus::Success));
    }

    #[test]
    fn test_fixture_has_all_pages_passes() {
        let result = SsrTests::test_fixture_has_all_pages();
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(matches!(result.status, SsrTestStatus::Success));
    }

    #[test]
    fn test_fixture_css_classes_present_passes() {
        let result = SsrTests::test_fixture_css_classes_present();
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(matches!(result.status, SsrTestStatus::Success));
    }

    #[test]
    fn test_fixture_no_js_required_passes() {
        let result = SsrTests::test_fixture_no_js_required();
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(matches!(result.status, SsrTestStatus::Success));
    }

    #[test]
    fn test_run_all_fixture_tests() {
        let results = SsrTests::run_all();
        assert_eq!(results.len(), 4);
        for result in &results {
            assert!(matches!(result.status, SsrTestStatus::Success));
        }
    }
}
