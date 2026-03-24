// SSR E2E Test Usage Example
//
// This example demonstrates how to use the SSR E2E testing framework
// for the Hikari website.

use hikari_e2e::{SsrTestHelper, SsrTests};
use thirtyfour::{WebDriver, prelude::*};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("SSR E2E Test Example");
    println!("====================\n");

    // Example 1: Using the test helper for quick validation
    println!("Example 1: Quick SSR validation");
    let sample_html = r#"<!DOCTYPE html>
<html>
<head><title>Hikari</title></head>
<body>
    <div id="hikari-app" class="hi-layout">
        <main class="hi-layout-content">
            <div class="hikari-page">
                <h1>Welcome to Hikari</h1>
            </div>
        </main>
    </div>
</body>
</html>"#;

    let validation = SsrTestHelper::validate_ssr_structure(sample_html)?;
    println!("  SSR Valid: {}", validation.is_valid());
    println!("  Summary: {}\n", validation.summary());

    // Example 2: Checking for rendered content
    println!("Example 2: Check for rendered content");
    let has_content = SsrTestHelper::has_rendered_content(sample_html, ".hikari-page")?;
    println!("  Has rendered content: {}\n", has_content);

    // Example 3: Counting elements
    println!("Example 3: Count elements");
    let count = SsrTestHelper::count_elements(sample_html, "div")?;
    println!("  Found {} div elements\n", count);

    // Example 4: Running with WebDriver (requires running server and chromedriver)
    println!("Example 4: WebDriver tests (requires server and chromedriver)");
    println!("  To run full E2E tests:");
    println!("    1. Start dev server: cd examples/website && npm run dev");
    println!("    2. Start chromedriver: chromedriver --port=4444");
    println!("    3. Run tests: cargo run -p hikari-e2e --bin run-ssr-e2e");
    println!();
    println!("  Or programmatically:");
    println!("    let caps = DesiredCapabilities::chrome();");
    println!("    let driver = WebDriver::new(\"http://localhost:4444\", caps).await?;");
    println!("    let ssr_tests = SsrTests;");
    println!("    let results = ssr_tests.test_e2e_route(&driver, \"/\").await?;");
    println!("    driver.quit().await?;");

    Ok(())
}
