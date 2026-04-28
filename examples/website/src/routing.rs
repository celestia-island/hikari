//! Client-side routing for dynamic documentation pages.
//!
//! This module provides JavaScript-based routing for documentation pages,
//! enabling dynamic loading based on URL patterns.

use tairitsu_vdom::{VElement, VNode, VText};

/// Routing configuration for documentation pages.
pub struct DocRoute {
    /// URL pattern (supports :lang and :path parameters)
    pub pattern: &'static str,
    /// Documentation base path
    pub doc_base: &'static str,
    /// Page type (component, system, guide, etc.)
    pub page_type: DocPageType,
}

/// Documentation page types.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocPageType {
    /// Component documentation page
    Component { layer: u8 },
    /// System documentation page
    System,
    /// Guide documentation page
    Guide,
    /// General documentation page
    General,
}

/// Documentation routing configuration.
pub const DOC_ROUTES: &[DocRoute] = &[
    DocRoute {
        pattern: "/components/layer1/:path",
        doc_base: "components/layer1",
        page_type: DocPageType::Component { layer: 1 },
    },
    DocRoute {
        pattern: "/components/layer2/:path",
        doc_base: "components/layer2",
        page_type: DocPageType::Component { layer: 2 },
    },
    DocRoute {
        pattern: "/components/layer3/:path",
        doc_base: "components/layer3",
        page_type: DocPageType::Component { layer: 3 },
    },
    DocRoute {
        pattern: "/system/:path",
        doc_base: "system",
        page_type: DocPageType::System,
    },
    DocRoute {
        pattern: "/guides/:path",
        doc_base: "guides",
        page_type: DocPageType::Guide,
    },
    DocRoute {
        pattern: "/docs/:path",
        doc_base: "",
        page_type: DocPageType::General,
    },
];

/// JavaScript router for dynamic documentation loading.
///
/// This function returns the JavaScript code that should be injected
/// to handle client-side routing for documentation pages.
pub fn doc_router_js() -> String {
    r#"
// Dynamic Documentation Router for Hikari Website
(function() {
    'use strict';

    const ROUTES = [
        { pattern: /^\/components\/layer1\/(.+)$/, docBase: 'components/layer1', type: 'component', layer: 1 },
        { pattern: /^\/components\/layer2\/(.+)$/, docBase: 'components/layer2', type: 'component', layer: 2 },
        { pattern: /^\/components\/layer3\/(.+)$/, docBase: 'components/layer3', type: 'component', layer: 3 },
        { pattern: /^\/system\/(.+)$/, docBase: 'system', type: 'system' },
        { pattern: /^\/guides\/(.+)$/, docBase: 'guides', type: 'guide' },
        { pattern: /^\/docs\/(.+)$/, docBase: '', type: 'general' },
    ];

    const DEFAULT_LANG = 'en';
    let currentRoute = null;

    /**
     * Get current language from lang module or URL
     */
    function getCurrentLanguage() {
        // Try URL parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const langParam = urlParams.get('lang');
        if (langParam) {
            return langParam;
        }

        // Try lang module
        if (window.hikariLang && window.hikariLang.get) {
            return window.hikariLang.get();
        }

        // Try from localStorage
        try {
            const stored = localStorage.getItem('hikari-lang');
            if (stored) return stored;
        } catch (e) {}

        return DEFAULT_LANG;
    }

    /**
     * Match current URL against routes
     */
    function matchRoute(path) {
        for (const route of ROUTES) {
            const match = path.match(route.pattern);
            if (match) {
                return {
                    route: route,
                    path: match[1],
                    fullPath: path
                };
            }
        }
        return null;
    }

    /**
     * Create a dynamic documentation page
     */
    function createDocPage(routeMatch, language) {
        const { route, path } = routeMatch;
        const docPath = route.docBase ? `${route.docBase}/${path}` : path;

        // Create page container
        const pageId = `dynamic-doc-${Date.now()}`;
        const page = document.createElement('div');
        page.id = pageId;
        page.className = 'hikari-page hikari-dynamic-doc-page';
        page.setAttribute('data-doc-path', docPath);
        page.setAttribute('data-language', language);

        // Create header based on page type
        let title = path.split('/').pop().replace(/-/g, ' ').replace(/_/g, ' ');
        title = title.charAt(0).toUpperCase() + title.slice(1);

        let headerHTML = '';
        if (route.type === 'component') {
            headerHTML = `
                <div class="page-header">
                    <div class="component-doc-badge">
                        <span class="component-doc-badge__layer">Layer ${route.layer}</span>
                    </div>
                    <h1 class="page-header__title">${title}</h1>
                </div>
            `;
        } else if (route.type === 'system') {
            headerHTML = `
                <div class="page-header">
                    <span class="system-doc-badge">System</span>
                    <h1 class="page-header__title">${title}</h1>
                </div>
            `;
        } else {
            headerHTML = `
                <div class="page-header">
                    <h1 class="page-header__title">${title}</h1>
                    <p class="page-header__subtitle">Documentation: ${docPath}</p>
                </div>
            `;
        }

        page.innerHTML = `
            ${headerHTML}
            <div class="page-section">
                <div class="hi-doc-loading">
                    <div class="hi-doc-loading__spinner"></div>
                    <div class="hi-doc-loading__text">Loading documentation...</div>
                </div>
            </div>
        `;

        return page;
    }

    /**
     * Navigate to a documentation page
     */
    function navigateToDoc(path, language) {
        // Never clobber a path that the static SPA router owns.
        if (isHandledBySpaRouter(path)) return;

        const routeMatch = matchRoute(path);
        if (!routeMatch) {
            console.warn('No route match for path:', path);
            return;
        }

        currentRoute = routeMatch;

        // Hide all existing pages
        document.querySelectorAll('.hikari-page').forEach(p => {
            p.classList.remove('is-active');
        });

        // Check if page already exists
        let page = document.querySelector(`[data-doc-path="${routeMatch.route.docBase}/${routeMatch.path}"]`);
        if (!page) {
            // Create new page
            page = createDocPage(routeMatch, language);
            const mainContent = document.querySelector('.hi-layout-content');
            if (mainContent) {
                mainContent.appendChild(page);
            }
        }

        // Show the page
        page.classList.add('is-active');

        // Load documentation content
        if (window.hikariDocs && window.hikariDocs.load) {
            const docContainer = page.querySelector('.hi-doc-loading')?.parentElement;
            if (docContainer) {
                window.hikariDocs.load(docContainer);
            }
        }

        // Update URL without triggering navigation
        if (window.history && window.history.pushState) {
            window.history.pushState({ path, language }, '', path);
        }
    }

    /**
     * Handle browser back/forward navigation
     */
    function handlePopState(event) {
        const path = window.location.pathname;

        // If the SPA router owns this path, let it handle it.
        if (isHandledBySpaRouter(path)) {
            if (window.hikariRouter && typeof window.hikariRouter.showPage === 'function') {
                window.hikariRouter.showPage(window.hikariRouter.getPageId(path));
            }
            return;
        }

        const language = getCurrentLanguage();
        navigateToDoc(path, language);
    }

    /**
     * Handle link clicks for documentation links
     */
    function handleLinkClick(event) {
        const link = event.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Check if it's a documentation link
        const routeMatch = matchRoute(href);
        if (routeMatch) {
            event.preventDefault();
            const language = getCurrentLanguage();
            navigateToDoc(href, language);
        }
    }

    /**
     * Check if the SPA router already handles this path via its static
     * routes map. If so we must NOT create a dynamic doc page — the
     * static page is already rendered and the SPA router will show it.
     */
    function isHandledBySpaRouter(path) {
        const clean = path.endsWith('/') ? path.slice(0, -1) : path;
        if (window.hikariRouter && window.hikariRouter.routes) {
            return !!window.hikariRouter.routes[clean];
        }
        return false;
    }

    /**
     * Initialize the router
     */
    function initRouter() {
        const path = window.location.pathname;

        // Do NOT activate if the static SPA router already owns this path.
        if (isHandledBySpaRouter(path)) return;

        const routeMatch = matchRoute(path);
        if (routeMatch) {
            const language = getCurrentLanguage();
            navigateToDoc(path, language);
        }

        // Listen for browser navigation
        window.addEventListener('popstate', handlePopState);

        // Listen for link clicks
        document.addEventListener('click', handleLinkClick);

        // Listen for language changes
        window.addEventListener('languagechange', function() {
            if (currentRoute) {
                const language = getCurrentLanguage();
                navigateToDoc(currentRoute.fullPath, language);
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRouter);
    } else {
        initRouter();
    }

    // Also initialize after WASM hydration
    setTimeout(initRouter, 200);

    // Expose API globally — do NOT overwrite window.hikariRouter.routes
    // set by the SPA router; merge instead.
    const existingRouter = window.hikariRouter || {};
    window.hikariRouter = Object.assign({}, existingRouter, {
        navigate: navigateToDoc,
        match: matchRoute,
        getCurrentLanguage: getCurrentLanguage,
        isDocRoute: matchRoute
    });
})();
"#.to_string()
}

/// Render the documentation router script.
///
/// This should be included in the page to enable client-side
/// routing for documentation pages.
pub fn render_doc_router_script() -> VNode {
    VNode::Element(
        VElement::new("script")
            .attr("id", "hikari-doc-router")
            .child(VNode::Text(VText::new(&doc_router_js()))),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_doc_routes_defined() {
        assert!(!DOC_ROUTES.is_empty());
        assert_eq!(DOC_ROUTES.len(), 6);
    }

    #[test]
    fn test_component_routes_exist() {
        let layer1 = DOC_ROUTES.iter().find(|r| r.pattern.contains("layer1"));
        assert!(layer1.is_some());

        let layer2 = DOC_ROUTES.iter().find(|r| r.pattern.contains("layer2"));
        assert!(layer2.is_some());

        let layer3 = DOC_ROUTES.iter().find(|r| r.pattern.contains("layer3"));
        assert!(layer3.is_some());
    }
}
