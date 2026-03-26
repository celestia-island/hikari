//! Dynamic documentation loading module.
//!
//! Fetches markdown content from /docs/{lang}/{path}.md and renders it
//! with proper loading states, error handling, and language fallback support.

use tairitsu_vdom::{VElement, VNode, VText};

/// Supported languages for documentation.
pub const SUPPORTED_LANGUAGES: &[&str] = &[
    "en-US", "zh-CHS", "zh-CHT", "fr-FR", "ru-RU", "es-ES", "ar-SA", "ja-JP", "ko-KR",
];

/// Default fallback language.
pub const DEFAULT_LANGUAGE: &str = "en-US";

/// Documentation loading state.
#[derive(Debug, Clone, PartialEq)]
pub enum DocLoadState {
    /// Document is currently loading.
    Loading,
    /// Document loaded successfully with content.
    Loaded(String),
    /// Failed to load document with error message.
    Error(String),
}

/// Dynamic documentation page component.
///
/// Renders a documentation page with:
/// - Loading indicator while fetching
/// - Error message on failure
/// - Rendered markdown content on success
///
/// # Arguments
///
/// * `doc_path` - The documentation path (e.g., "components/layer1/button")
/// * `language` - The language code (e.g., "en-US", "zh-CHS")
/// * `title` - Optional page title
pub fn DocPage(
    doc_path: String,
    language: String,
    _title: Option<String>,
) -> VNode {
    // For now, we'll render a placeholder that will be populated by JavaScript
    // In a full implementation, this would use Rust's async capabilities
    // or JavaScript interop to fetch and render the content

    let container_id = format!("doc-page-{}", doc_path.replace('/', "-"));
    let data_doc = doc_path.clone();
    let data_lang = language.clone();

    VNode::Element(
        VElement::new("div")
            .attr("id", &container_id)
            .attr("data-doc-page", "true")
            .attr("data-doc-path", &data_doc)
            .attr("data-language", &data_lang)
            .class("hi-doc-page")
            .child(render_loading_indicator())
            .child(VNode::Element(
                VElement::new("script")
                    .attr("type", "text/hikari-doc-config")
                    .attr("data-doc-path", &data_doc)
                    .attr("data-language", &data_lang)
                    .attr("data-container-id", &container_id),
            )),
    )
}

/// Render a loading indicator for documentation pages.
fn render_loading_indicator() -> VNode {
    VNode::Element(
        VElement::new("div")
            .class("hi-doc-loading")
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-doc-loading__spinner"),
            ))
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-doc-loading__text")
                    .child(VNode::Text(VText::new("Loading documentation..."))),
            )),
    )
}

/// Render an error message for failed documentation loads.
pub fn render_doc_error(message: &str, doc_path: &str) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class("hi-doc-error")
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-doc-error__icon")
                    .child(VNode::Text(VText::new("⚠"))),
            ))
            .child(VNode::Element(
                VElement::new("h3")
                    .class("hi-doc-error__title")
                    .child(VNode::Text(VText::new("Failed to load documentation"))),
            ))
            .child(VNode::Element(
                VElement::new("p")
                    .class("hi-doc-error__message")
                    .child(VNode::Text(VText::new(message))),
            ))
            .child(VNode::Element(
                VElement::new("p")
                    .class("hi-doc-error__path")
                    .child(VNode::Text(VText::new(&format!("Path: {}", doc_path)))),
            )),
    )
}

/// Render a fallback message when documentation is not available.
pub fn render_doc_not_found(doc_path: &str, language: &str) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class("hi-doc-not-found")
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-doc-not-found__icon")
                    .child(VNode::Text(VText::new("📄"))),
            ))
            .child(VNode::Element(
                VElement::new("h3")
                    .class("hi-doc-not-found__title")
                    .child(VNode::Text(VText::new("Documentation not found"))),
            ))
            .child(VNode::Element(
                VElement::new("p")
                    .class("hi-doc-not-found__message")
                    .child(VNode::Text(VText::new(&format!(
                        "The documentation for '{}' is not available in {}.",
                        doc_path, language
                    )))),
            ))
            .child(VNode::Element(
                VElement::new("p")
                    .class("hi-doc-not-found__hint")
                    .child(VNode::Text(VText::new(
                        "This page may be under development or the translation is not yet available.",
                    ))),
            )),
    )
}

/// Build the documentation URL for a given path and language.
///
/// # Arguments
///
/// * `doc_path` - The documentation path (e.g., "components/layer1/button")
/// * `language` - The language code (e.g., "en-US", "zh-CHS")
///
/// # Returns
///
/// The URL path to fetch the markdown content.
pub fn build_doc_url(doc_path: &str, language: &str) -> String {
    format!("/docs/{}/{}.md", language, doc_path)
}

/// Build the fallback documentation URL (defaults to en-US).
///
/// # Arguments
///
/// * `doc_path` - The documentation path (e.g., "components/layer1/button")
///
/// # Returns
///
/// The URL path to fetch the fallback markdown content.
pub fn build_fallback_doc_url(doc_path: &str) -> String {
    format!("/docs/{}/{}.md", DEFAULT_LANGUAGE, doc_path)
}

/// JavaScript module for dynamic documentation loading.
///
/// This function returns the JavaScript code that should be injected
/// to handle client-side documentation loading.
pub fn doc_loader_js() -> String {
    r#"
// Dynamic Documentation Loader for Hikari Website
(function() {
    'use strict';

    const DOC_CACHE = new Map();
    const DEFAULT_LANG = 'en-US';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    /**
     * Fetch markdown content from the docs directory
     * @param {string} docPath - Documentation path (e.g., "components/layer1/button")
     * @param {string} language - Language code (e.g., "en-US", "zh-CHS")
     * @returns {Promise<string|null>} - Markdown content or null if not found
     */
    async function fetchDocContent(docPath, language) {
        const url = `/docs/${language}/${docPath}.md`;

        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.text();
            }
            return null;
        } catch (error) {
            console.warn(`Failed to fetch doc from ${url}:`, error);
            return null;
        }
    }

    /**
     * Fetch documentation with language fallback
     * @param {string} docPath - Documentation path
     * @param {string} language - Preferred language
     * @returns {Promise<{content: string, language: string}|null>}
     */
    async function fetchDocWithFallback(docPath, language) {
        // Try requested language first
        let content = await fetchDocContent(docPath, language);
        if (content) {
            return { content, language };
        }

        // Fall back to default language
        if (language !== DEFAULT_LANG) {
            content = await fetchDocContent(docPath, DEFAULT_LANG);
            if (content) {
                return { content, language: DEFAULT_LANG };
            }
        }

        return null;
    }

    /**
     * Parse markdown and convert to HTML
     * This is a simple parser - in production, use a proper markdown library
     * @param {string} markdown - Markdown content
     * @returns {string} - HTML content
     */
    function parseMarkdown(markdown) {
        // Simple markdown to HTML conversion
        let html = markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            // Code blocks
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            // Images
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        return `<div class="hi-markdown-content">${html}</div>`;
    }

    /**
     * Render documentation content into a container
     * @param {HTMLElement} container - Container element
     * @param {string} content - Markdown content
     * @param {string} language - Actual language of content
     */
    function renderDoc(container, content, language) {
        // Clear loading indicator
        container.innerHTML = '';

        // Create content wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'hi-doc-content';
        wrapper.setAttribute('data-language', language);

        // Parse and insert markdown
        wrapper.innerHTML = parseMarkdown(content);

        // Apply syntax highlighting to code blocks if available
        if (window.Prism || window.hljs) {
            wrapper.querySelectorAll('pre code').forEach(block => {
                if (window.Prism) {
                    Prism.highlightElement(block);
                } else if (window.hljs) {
                    hljs.highlightElement(block);
                }
            });
        }

        container.appendChild(wrapper);
    }

    /**
     * Render error state
     * @param {HTMLElement} container - Container element
     * @param {string} message - Error message
     * @param {string} docPath - Documentation path
     */
    function renderError(container, message, docPath) {
        container.innerHTML = `
            <div class="hi-doc-error">
                <div class="hi-doc-error__icon">⚠</div>
                <h3 class="hi-doc-error__title">Failed to load documentation</h3>
                <p class="hi-doc-error__message">${message}</p>
                <p class="hi-doc-error__path">Path: ${docPath}</p>
            </div>
        `;
    }

    /**
     * Load and render documentation for a container
     * @param {HTMLElement} container - Container with data-doc-path and data-language attributes
     */
    async function loadDocForContainer(container) {
        const docPath = container.getAttribute('data-doc-path');
        const language = container.getAttribute('data-language') || getCurrentLanguage();

        if (!docPath) {
            renderError(container, 'Missing documentation path', 'unknown');
            return;
        }

        // Check cache first
        const cacheKey = `${language}:${docPath}`;
        const cached = DOC_CACHE.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            renderDoc(container, cached.content, cached.language);
            return;
        }

        // Show loading state
        container.innerHTML = `
            <div class="hi-doc-loading">
                <div class="hi-doc-loading__spinner"></div>
                <div class="hi-doc-loading__text">Loading documentation...</div>
            </div>
        `;

        // Fetch with fallback
        const result = await fetchDocWithFallback(docPath, language);

        if (result) {
            // Cache the result
            DOC_CACHE.set(cacheKey, {
                content: result.content,
                language: result.language,
                timestamp: Date.now()
            });

            renderDoc(container, result.content, result.language);
        } else {
            renderError(container, 'Documentation not found', docPath);
        }
    }

    /**
     * Get current language from lang module
     */
    function getCurrentLanguage() {
        if (window.hikariLang && window.hikariLang.get) {
            return window.hikariLang.get();
        }
        return DEFAULT_LANG;
    }

    /**
     * Initialize all doc pages on the page
     */
    function initDocPages() {
        const containers = document.querySelectorAll('[data-doc-page="true"]');
        containers.forEach(loadDocForContainer);
    }

    /**
     * Reload all doc pages (called on language change)
     */
    function reloadDocPages() {
        // Clear cache when language changes
        DOC_CACHE.clear();
        initDocPages();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDocPages);
    } else {
        initDocPages();
    }

    // Also initialize after WASM hydration
    setTimeout(initDocPages, 200);

    // Listen for language changes
    window.addEventListener('languagechange', reloadDocPages);

    // Expose API globally
    window.hikariDocs = {
        load: loadDocForContainer,
        reload: reloadDocPages,
        init: initDocPages
    };
})();
"#.to_string()
}

/// Render the documentation loader script.
///
/// This should be included in the page to enable client-side
/// documentation loading.
pub fn render_doc_loader_script() -> VNode {
    VNode::Element(
        VElement::new("script")
            .attr("id", "hikari-doc-loader")
            .child(VNode::Text(VText::new(&doc_loader_js()))),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_doc_url() {
        assert_eq!(
            build_doc_url("components/layer1/button", "en-US"),
            "/docs/en-US/components/layer1/button.md"
        );
        assert_eq!(
            build_doc_url("system/palette", "zh-CHS"),
            "/docs/zh-CHS/system/palette.md"
        );
    }

    #[test]
    fn test_build_fallback_doc_url() {
        assert_eq!(
            build_fallback_doc_url("components/layer1/button"),
            "/docs/en-US/components/layer1/button.md"
        );
    }

    #[test]
    fn test_supported_languages() {
        assert!(SUPPORTED_LANGUAGES.contains(&"en-US"));
        assert!(SUPPORTED_LANGUAGES.contains(&"zh-CHS"));
        assert!(SUPPORTED_LANGUAGES.contains(&"ja-JP"));
        assert!(!SUPPORTED_LANGUAGES.contains(&"de-DE"));
    }
}
