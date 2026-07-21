// hikari-e2e/src/ssr_helpers.rs
// Helper utilities for SSR testing

use anyhow::Result;
use scraper::{Html, Selector};
use thirtyfour::WebDriver;

use crate::html_assertions::HtmlAssertions;

/// SSR test helper for common operations
pub struct SsrTestHelper {
    pub base_url: String,
}

impl SsrTestHelper {
    /// Create a new SSR test helper
    pub fn new() -> Self {
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        Self { base_url }
    }

    /// Create with custom base URL
    pub fn with_base_url(base_url: String) -> Self {
        Self { base_url }
    }

    /// Navigate to a path and get HTML
    pub async fn navigate_and_get_html(&self, driver: &WebDriver, path: &str) -> Result<String> {
        let url = format!("{}{}", self.base_url, path);
        driver
            .goto(&url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", url, e))?;

        // Wait for page to load
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        driver
            .source()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get page source: {}", e))
    }

    /// Check if page has valid SSR structure
    pub fn validate_ssr_structure(html: &str) -> Result<SsrValidationResult> {
        let _assertions = HtmlAssertions::from_str(html);
        let parsed = Html::parse_document(html);

        let has_doctype =
            html.starts_with("<!DOCTYPE html>") || html.starts_with("<!doctype html>");
        let has_html_tag = parsed
            .select(&Selector::parse("html").unwrap())
            .next()
            .is_some();
        let has_head_tag = parsed
            .select(&Selector::parse("head").unwrap())
            .next()
            .is_some();
        let has_body_tag = parsed
            .select(&Selector::parse("body").unwrap())
            .next()
            .is_some();
        let has_hikari_app = parsed
            .select(&Selector::parse("#hikari-app").unwrap())
            .next()
            .is_some();

        let mut result = SsrValidationResult {
            has_doctype,
            has_html_tag,
            has_head_tag,
            has_body_tag,
            has_hikari_app,
            ..Default::default()
        };

        // Check for layout classes
        if let Some(app) = parsed
            .select(&Selector::parse("#hikari-app").unwrap())
            .next()
        {
            let class = app.value().attr("class").unwrap_or("");
            result.has_layout_class = class.contains("hk-layout");
        }

        // Check for content
        result.has_page_content = parsed
            .select(&Selector::parse(".hikari-page").unwrap())
            .next()
            .is_some();

        // Check for semantic HTML
        result.has_main_tag = parsed
            .select(&Selector::parse("main").unwrap())
            .next()
            .is_some();
        result.has_nav_tag = parsed
            .select(&Selector::parse("nav").unwrap())
            .next()
            .is_some();

        Ok(result)
    }

    /// Check if content is rendered (not empty)
    pub fn has_rendered_content(html: &str, selector: &str) -> Result<bool> {
        let parsed = Html::parse_document(html);
        let sel = Selector::parse(selector)
            .map_err(|e| anyhow::anyhow!("Invalid selector '{}': {}", selector, e))?;

        if let Some(element) = parsed.select(&sel).next() {
            let text = element.text().collect::<String>();
            Ok(text.trim().len() > 10)
        } else {
            Ok(false)
        }
    }

    /// Count elements matching selector
    pub fn count_elements(html: &str, selector: &str) -> Result<usize> {
        let parsed = Html::parse_document(html);
        let sel = Selector::parse(selector)
            .map_err(|e| anyhow::anyhow!("Invalid selector '{}': {}", selector, e))?;

        Ok(parsed.select(&sel).count())
    }

    /// Get text content of element
    pub fn get_text_content(html: &str, selector: &str) -> Result<String> {
        let parsed = Html::parse_document(html);
        let sel = Selector::parse(selector)
            .map_err(|e| anyhow::anyhow!("Invalid selector '{}': {}", selector, e))?;

        let element = parsed
            .select(&sel)
            .next()
            .ok_or_else(|| anyhow::anyhow!("Element not found: {}", selector))?;

        Ok(element.text().collect::<String>())
    }
}

impl Default for SsrTestHelper {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of SSR validation
#[derive(Debug, Default, Clone)]
pub struct SsrValidationResult {
    pub has_doctype: bool,
    pub has_html_tag: bool,
    pub has_head_tag: bool,
    pub has_body_tag: bool,
    pub has_hikari_app: bool,
    pub has_layout_class: bool,
    pub has_page_content: bool,
    pub has_main_tag: bool,
    pub has_nav_tag: bool,
}

impl SsrValidationResult {
    /// Check if all basic structure is valid
    pub fn is_valid(&self) -> bool {
        self.has_doctype
            && self.has_html_tag
            && self.has_head_tag
            && self.has_body_tag
            && self.has_hikari_app
            && self.has_layout_class
    }

    /// Get validation summary
    pub fn summary(&self) -> String {
        format!(
            "DOCTYPE: {}, HTML: {}, HEAD: {}, BODY: {}, App: {}, Layout: {}, Content: {}",
            self.has_doctype,
            self.has_html_tag,
            self.has_head_tag,
            self.has_body_tag,
            self.has_hikari_app,
            self.has_layout_class,
            self.has_page_content
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_ssr_structure() {
        let html = r#"<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <div id="hikari-app" class="hk-layout">
        <div class="hikari-page">Content</div>
    </div>
</body>
</html>"#;

        let result = SsrTestHelper::validate_ssr_structure(html).unwrap();
        assert!(result.is_valid());
        assert!(result.has_doctype);
        assert!(result.has_hikari_app);
    }

    #[test]
    fn test_has_rendered_content() {
        let html = r#"<div class="content">Hello World</div>"#;
        assert!(SsrTestHelper::has_rendered_content(html, ".content").unwrap());
    }

    #[test]
    fn test_count_elements() {
        let html = r#"<div class="item">1</div><div class="item">2</div><div class="item">3</div>"#;
        assert_eq!(SsrTestHelper::count_elements(html, ".item").unwrap(), 3);
    }
}
