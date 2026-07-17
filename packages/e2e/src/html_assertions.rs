// hikari-e2e/src/html_assertions.rs
// HTML assertion utilities for E2E testing

use scraper::{Html, Selector};

/// HTML assertion helper for validating rendered component output
pub struct HtmlAssertions {
    html: String,
    parsed: Html,
}

impl HtmlAssertions {
    /// Create a new HTML assertion helper from raw HTML string
    pub fn new(html: String) -> Self {
        let parsed = Html::parse_document(&html);
        Self { html, parsed }
    }

    /// Create from a string slice (convenience method)
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(html: &str) -> Self {
        Self::new(html.to_string())
    }

    /// Parse selector helper
    fn parse_selector(&self, selector: &str) -> anyhow::Result<Selector> {
        Selector::parse(selector)
            .map_err(|e| anyhow::anyhow!("Invalid CSS selector '{}': {}", selector, e))
    }

    /// Assert that an element with the given CSS selector exists
    pub fn assert_exists(&self, selector: &str) -> anyhow::Result<&Self> {
        let sel = self.parse_selector(selector)?;

        if self.parsed.select(&sel).next().is_none() {
            anyhow::bail!("Element not found: {}\n\nHTML:\n{}", selector, self.html);
        }

        Ok(self)
    }

    /// Assert that an element with the given CSS selector does NOT exist
    pub fn assert_not_exists(&self, selector: &str) -> anyhow::Result<&Self> {
        let sel = self.parse_selector(selector)?;

        if self.parsed.select(&sel).next().is_some() {
            anyhow::bail!(
                "Element should not exist but found: {}\n\nHTML:\n{}",
                selector,
                self.html
            );
        }

        Ok(self)
    }

    /// Assert that an element has a specific class
    pub fn assert_has_class(&self, selector: &str, class_name: &str) -> anyhow::Result<&Self> {
        let sel = self.parse_selector(selector)?;

        let element = self
            .parsed
            .select(&sel)
            .next()
            .ok_or_else(|| anyhow::anyhow!("Element not found: {}", selector))?;

        let class_attr = element.value().attr("class").unwrap_or("");

        if !class_attr.split_whitespace().any(|c| c == class_name) {
            anyhow::bail!(
                "Element '{}' does not have class '{}'. Classes: '{}'\n\nHTML:\n{}",
                selector,
                class_name,
                class_attr,
                self.html
            );
        }

        Ok(self)
    }

    /// Assert that an element has a specific attribute value
    pub fn assert_attr_eq(
        &self,
        selector: &str,
        attr: &str,
        expected: &str,
    ) -> anyhow::Result<&Self> {
        let sel = self.parse_selector(selector)?;

        let element = self
            .parsed
            .select(&sel)
            .next()
            .ok_or_else(|| anyhow::anyhow!("Element not found: {}", selector))?;

        let actual = element.value().attr(attr).ok_or_else(|| {
            anyhow::anyhow!("Element '{}' does not have attribute '{}'", selector, attr)
        })?;

        if actual != expected {
            anyhow::bail!(
                "Attribute '{}' on element '{}' has value '{}', expected '{}'\n\nHTML:\n{}",
                attr,
                selector,
                actual,
                expected,
                self.html
            );
        }

        Ok(self)
    }
}

impl From<&str> for HtmlAssertions {
    fn from(html: &str) -> Self {
        Self::new(html.to_string())
    }
}

impl HtmlAssertions {
    /// Assert that an element contains specific text content
    pub fn assert_text_contains(&self, selector: &str, text: &str) -> anyhow::Result<&Self> {
        let sel = self.parse_selector(selector)?;

        let element = self
            .parsed
            .select(&sel)
            .next()
            .ok_or_else(|| anyhow::anyhow!("Element not found: {}", selector))?;

        let actual = element.text().collect::<String>();

        if !actual.contains(text) {
            anyhow::bail!(
                "Element '{}' does not contain text '{}'. Actual text: '{}'\n\nHTML:\n{}",
                selector,
                text,
                actual,
                self.html
            );
        }

        Ok(self)
    }

    /// Assert that an element has exact text content
    pub fn assert_text_eq(&self, selector: &str, expected: &str) -> anyhow::Result<&Self> {
        let sel = self.parse_selector(selector)?;

        let element = self
            .parsed
            .select(&sel)
            .next()
            .ok_or_else(|| anyhow::anyhow!("Element not found: {}", selector))?;

        let actual = element.text().collect::<String>();

        if actual.trim() != expected {
            anyhow::bail!(
                "Element '{}' has text '{}', expected '{}'\n\nHTML:\n{}",
                selector,
                actual.trim(),
                expected,
                self.html
            );
        }

        Ok(self)
    }

    /// Assert that multiple elements exist with the given selector
    pub fn assert_count(&self, selector: &str, expected_count: usize) -> anyhow::Result<&Self> {
        let sel = self.parse_selector(selector)?;

        let actual_count = self.parsed.select(&sel).count();

        if actual_count != expected_count {
            anyhow::bail!(
                "Expected {} elements matching '{}', found {}\n\nHTML:\n{}",
                expected_count,
                selector,
                actual_count,
                self.html
            );
        }

        Ok(self)
    }

    /// Assert data-theme attribute equals expected value
    pub fn assert_theme(&self, expected_theme: &str) -> anyhow::Result<&Self> {
        self.assert_attr_eq("[data-theme]", "data-theme", expected_theme)
    }

    /// Get the raw HTML string
    pub fn html(&self) -> &str {
        &self.html
    }

    /// Get a formatted HTML string for debugging
    pub fn debug_html(&self) -> String {
        format!("<!-- HTML DEBUG -->\n{}\n<!-- END DEBUG -->", self.html)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assert_exists() {
        let html = r#"<div class="hi-button">Click me</div>"#;
        let assertions = HtmlAssertions::from_str(html);
        assertions.assert_exists(".hi-button").unwrap();
    }

    #[test]
    fn test_assert_has_class() {
        let html = r#"<button class="hi-button hi-button-primary">Click</button>"#;
        let assertions = HtmlAssertions::from_str(html);
        assertions
            .assert_has_class(".hi-button", "hi-button-primary")
            .unwrap();
    }

    #[test]
    fn test_assert_text_contains() {
        let html = r#"<div class="hi-card">Hello World</div>"#;
        let assertions = HtmlAssertions::from_str(html);
        assertions
            .assert_text_contains(".hi-card", "World")
            .unwrap();
    }

    #[test]
    fn test_assert_attr_eq() {
        let html = r#"<input type="text" placeholder="Enter text" />"#;
        let assertions = HtmlAssertions::from_str(html);
        assertions
            .assert_attr_eq("input", "placeholder", "Enter text")
            .unwrap();
    }
}
