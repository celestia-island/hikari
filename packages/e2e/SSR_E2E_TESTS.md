# SSR E2E Tests for Hikari

## Overview

This document describes the SSR (Server-Side Rendering) E2E test framework for the Hikari website. These tests are designed to validate that the website works correctly with SSR, including proper HTML structure, content visibility without JavaScript, and client-side hydration.

## Test Structure

The SSR E2E tests are located in `/mnt/sdb1/hikari/packages/e2e/src/tests/ssr_tests.rs` and include:

### 1. HTML Structure Tests (`test_e2e_html_structure`)
Validates that SSR output contains correct elements:
- Root `#hikari-app` element exists
- Layout classes are present
- Header, navigation, and sidebar are rendered
- Main content area exists
- All page elements are present

### 2. No-JS Visibility Tests (`test_e2e_no_js_visibility`)
Verifies that content is visible without JavaScript:
- Root element exists without JS
- Component classes are present
- Navigation is visible
- Main content has text
- Page content is rendered

### 3. Hydration Tests (`test_e2e_hydration`)
Confirms interactive features work after client-side hydration:
- JavaScript runtime is available
- Hikari app element is mounted
- Interactive buttons are clickable
- History API (router) is functional
- No visible hydration errors

### 4. SEO Metadata Tests (`test_e2e_seo_metadata`)
Checks proper SEO elements:
- Title tag exists and is not empty
- Meta description (optional)
- Semantic HTML elements (`main`, `nav`)
- Proper heading structure

## Running the Tests

### Unit Tests (No Browser Required)

Run the SSR unit tests that test against sample HTML:

```bash
cargo test -p hikari-e2e --lib ssr
```

### E2E Tests (Requires Browser)

Run the full E2E tests with WebDriver:

```bash
# Start the dev server first
cd examples/website
npm run dev

# In another terminal, start WebDriver
chromedriver --port=4444

# Run the E2E tests
cargo run -p hikari-e2e --bin run_ssr_e2e
```

### Programmatic Usage

You can also run the tests programmatically:

```rust
use hikari_e2e::{run_ssr_e2e_tests, SsrTests};
use thirtyfour::{prelude::*, WebDriver};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let caps = DesiredCapabilities::chrome();
    let driver = WebDriver::new("http://localhost:4444", caps).await?;

    // Run all SSR E2E tests
    let results = run_ssr_e2e_tests(&driver).await?;

    // Process results...
    driver.quit().await?;
    Ok(())
}
```

## Test Helpers

The framework includes helper utilities in `ssr_helpers.rs`:

```rust
use hikari_e2e::{SsrTestHelper, SsrValidationResult};

// Create helper
let helper = SsrTestHelper::new();

// Navigate and get HTML
let html = helper.navigate_and_get_html(&driver, "/").await?;

// Validate SSR structure
let validation = SsrTestHelper::validate_ssr_structure(&html)?;
if validation.is_valid() {
    println!("SSR structure is valid!");
}

// Check for rendered content
let has_content = SsrTestHelper::has_rendered_content(&html, ".hi-layout-content")?;

// Count elements
let count = SsrTestHelper::count_elements(&html, ".hi-button")?;
```

## Current Status

The SSR E2E test framework is ready to use. However, the actual E2E tests may fail until tairitsu-ssr bugs are fixed. The framework is designed to:

1. Work immediately with the existing sample HTML unit tests
2. Be ready to run E2E tests once SSR is functional
3. Provide clear feedback on what's working and what's not

## Test Coverage

The current test suite covers:

- **Routes tested**: `/`, `/components/layer1`, `/components/layer2`, `/components/layer3`
- **Per-route tests**: 4 test categories (HTML structure, No-JS, Hydration, SEO)
- **Total test cases**: 4 routes × 4 tests = 16 test cases

## Notes

- Tests use Chrome DevTools Protocol (CDP) for JavaScript control when available
- Fallback methods are provided when CDP is not available
- Screenshots are saved to `./screenshots/ssr/` for debugging
- Test results include detailed information about passed/failed checks

## Future Enhancements

Potential additions to the SSR test suite:

- Performance testing (SSR render time)
- Accessibility testing (ARIA attributes)
- Internationalization (i18n) support
- More comprehensive hydration checks
- Visual regression testing
