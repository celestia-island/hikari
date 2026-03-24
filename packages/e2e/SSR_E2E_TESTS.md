# SSR E2E Tests for Hikari

## Overview

This document describes the SSR (Server-Side Rendering) E2E test framework for the Hikari website. The framework has two layers:

1. **Fixture unit tests** — validate the `HtmlAssertions` and `SsrTestHelper` utilities against a fixture HTML document that defines the expected SSR output structure. No browser or server required.
2. **E2E browser tests** — navigate a live dev-server with Chrome WebDriver and validate the actual runtime behavior.

## Test Structure

### Layer 1: Fixture Unit Tests (no browser)

Located in `src/tests/ssr_tests.rs` — `SsrTests::test_fixture_*()` methods:

| Test | What it validates |
|------|-------------------|
| `test_fixture_html_structure` | Expected SSR HTML contains `<html>`, `<head>`, `<body>`, meta tags, `#hikari-app` |
| `test_fixture_has_all_pages` | All 5 page sections (`#page-home`, `#page-components`, etc.) are present |
| `test_fixture_css_classes_present` | Required CSS classes (`hi-layout`, `hi-btn`, etc.) are in the fixture |
| `test_fixture_no_js_required` | Critical text content is inline in the HTML (no JS needed) |

These tests define the **design contract** for SSR output. When real `tairitsu_ssr::render_to_html()` is available, its output should satisfy these same assertions.

### Layer 2: E2E Browser Tests (requires WebDriver)

Located in `src/tests/ssr_tests.rs` — `SsrTests::test_e2e_*()` methods:

#### `test_e2e_html_structure`
Navigates to the live server and validates the DOM structure received by the browser.

#### `test_e2e_no_js_visibility`
Uses a plain HTTP client (`reqwest`) to fetch the raw server response **without executing JavaScript**. This is the definitive no-JS test: exactly what a search-engine crawler or a JS-disabled browser receives.

Checks performed on raw HTML:
- Root `#hikari-app` element exists
- `hi-` component classes are present
- Header/navigation is present
- Main content area has meaningful text
- At least one `.hikari-page` exists

#### `test_e2e_hydration`
Verifies interactive features work after client-side WASM hydration.

#### `test_e2e_seo_metadata` (planned)
Checks SEO metadata: title tag, meta description, semantic HTML elements.

## Running the Tests

### Fixture Tests (no browser required)

```bash
cargo test -p hikari-e2e --lib
```

### E2E Tests (requires browser + server)

```bash
# Start the dev server
just dev

# In another terminal, start ChromeDriver
chromedriver --port=4444

# Set server URL and run
WEBSITE_BASE_URL=http://localhost:3000 cargo run -p hikari-e2e --bin run-ssr-e2e
```

## Helper Utilities

### `SsrTestHelper` (`ssr_helpers.rs`)

```rust
use hikari_e2e::{SsrTestHelper, SsrValidationResult};

let helper = SsrTestHelper::new();
let result = SsrTestHelper::validate_ssr_structure(&html)?;
assert!(result.has_doctype);
assert!(result.has_hikari_app);
```

### `HtmlAssertions` (`html_assertions.rs`)

```rust
use hikari_e2e::HtmlAssertions;

let assertions = HtmlAssertions::new(html);
assertions.assert_exists("#hikari-app")?;
assertions.assert_has_class("#hikari-app", "hi-layout")?;
assertions.assert_text_contains(".page-hero__title", "Hikari")?;
```

### `compare_visuals` (`interactive_test.rs`)

Compares two screenshot files byte-by-byte. Returns `before_after_match: Some(true)` when the files are identical, `Some(false)` when they differ, and `None` when files cannot be read.

```rust
use hikari_e2e::compare_visuals;

let analysis = compare_visuals(before_path, after_path, "Button", "click").await?;
// analysis.before_after_match: Some(true) = unchanged, Some(false) = changed
```
