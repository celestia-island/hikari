//! Hikari Website Router
//!
//! Simple client-side router for page navigation using History API.
//! All pages are pre-rendered; router toggles `.is-active` class.

/// Generate the router JavaScript code as a string.
pub fn router_js() -> String {
    r#"
// Hikari Website Router
(function() {
    'use strict';

    // Page routes mapping from URL path to page element ID
    const routes = {
        '/': 'page-home',
        '/components': 'page-components',
        '/components/layer1': 'page-components-layer1',
        '/components/layer2': 'page-components-layer2',
        '/components/layer3': 'page-components-layer3',
        '/system': 'page-system',
        '/system/palette': 'page-system-palette',
        '/system/css': 'page-system-css',
        '/system/icons': 'page-system-icons',
        '/system/animations': 'page-system-animations',
        '/system/i18n': 'page-system-i18n',
        '/interactive': 'page-interactive',
        '/animations': 'page-animations',
        '/demos': 'page-demos',
        '/demos/form': 'page-demos-form',
        '/demos/dashboard': 'page-demos-dashboard',
        '/demos/video': 'page-demos-video',
        '/components/layer1/button': 'page-components-layer1',
        '/components/layer1/avatar': 'page-components-layer1',
        '/components/layer1/input': 'page-components-layer1',
        '/components/layer1/switch': 'page-components-layer1',
        '/components/layer1/tag': 'page-components-layer1',
        '/components/layer1/form': 'page-components-layer1',
        '/components/layer1/number-input': 'page-components-layer1',
        '/components/layer1/search': 'page-components-layer1',
        '/components/layer1/image': 'page-components-layer1',
        '/components/layer1/comment': 'page-components-layer1',
        '/components/layer1/empty': 'page-components-layer1',
        '/components/layer1/skeleton': 'page-components-layer1',
        '/components/layer2/navigation': 'page-components-layer2',
        '/components/layer2/data': 'page-components-layer2',
        '/components/layer2/table': 'page-components-layer2',
        '/components/layer2/tree': 'page-components-layer2',
        '/components/layer2/collapsible': 'page-components-layer2',
        '/components/layer2/timeline': 'page-components-layer2',
        '/components/layer2/pagination': 'page-components-layer2',
        '/components/layer2/transfer': 'page-components-layer2',
        '/components/layer2/cascader': 'page-components-layer2',
        '/components/layer2/feedback': 'page-components-layer2',
        '/components/layer2/breadcrumb': 'page-components-layer2',
        '/components/layer2/steps': 'page-components-layer2',
        '/components/layer3/media': 'page-components-layer3',
        '/components/layer3/editor': 'page-components-layer3',
        '/components/layer3/visualization': 'page-components-layer3',
        '/components/layer3/zoom-controls': 'page-components-layer3',
    };

    /**
     * Get page ID from path, or default to home
     */
    function getPageId(path) {
        // Remove trailing slash
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        return routes[cleanPath] || 'page-home';
    }

    /**
     * Hide all pages
     */
    function hideAllPages() {
        document.querySelectorAll('.hikari-page').forEach(page => {
            page.classList.remove('is-active');
        });
    }

    /**
     * Show a specific page
     */
    function showPage(pageId) {
        hideAllPages();
        const page = document.getElementById(pageId);
        if (page) {
            page.classList.add('is-active');
            // Update active state in sidebar
            updateSidebarActiveState(pageId);
            // Update active state in top nav
            updateTopNavActiveState(pageId);
        } else {
            console.warn('Page not found:', pageId);
            // Show 404 page if exists, otherwise show home
            const notFound = document.getElementById('page-not-found');
            if (notFound) {
                notFound.classList.add('is-active');
            } else {
                document.getElementById('page-home')?.classList.add('is-active');
            }
        }
    }

    /**
     * Update active state in sidebar links
     */
    function updateSidebarActiveState(pageId) {
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('is-active');
            const href = link.getAttribute('href');
            if (href && routes[href] === pageId) {
                link.classList.add('is-active');
            }
        });
    }

    /**
     * Update active state in top nav links
     */
    function updateTopNavActiveState(pageId) {
        document.querySelectorAll('.hikari-topnav__link').forEach(link => {
            link.classList.remove('is-active');
            const href = link.getAttribute('href');
            if (href) {
                // Check if this link's route matches current page
                const linkPageId = routes[href];
                if (linkPageId === pageId) {
                    link.classList.add('is-active');
                }
            }
        });
    }

    /**
     * Navigate to a path
     */
    function navigate(path) {
        const pageId = getPageId(path);
        showPage(pageId);

        // Update URL without triggering navigation
        if (window.history && window.history.pushState) {
            window.history.pushState({ path, pageId }, '', path);
        }
    }

    /**
     * Handle browser back/forward buttons
     */
    function handlePopState(event) {
        const path = window.location.pathname;
        const pageId = getPageId(path);
        showPage(pageId);
    }

    /**
     * Handle link clicks
     */
    function handleLinkClick(event) {
        const link = event.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Only handle internal links (starting with /)
        if (!href.startsWith('/')) return;

        // Check if it's a route we handle
        const isRoute = routes[href] || href.startsWith('/components/') || href.startsWith('/system/');
        if (isRoute) {
            event.preventDefault();
            navigate(href);
        }
    }

    /**
     * Initialize the router
     */
    function initRouter() {
        // Show the current page based on URL
        const path = window.location.pathname;
        const pageId = getPageId(path);
        showPage(pageId);

        // Listen for browser navigation
        window.addEventListener('popstate', handlePopState);

        // Listen for link clicks (delegated)
        document.addEventListener('click', handleLinkClick, { passive: false });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRouter);
    } else {
        // Small delay to ensure WASM hydration is complete
        setTimeout(initRouter, 50);
    }

    // Also initialize after WASM hydration (for SSR scenarios)
    setTimeout(initRouter, 200);

    // Expose API globally for testing and manual navigation
    // routes is exposed so the doc router can check if a path is
    // already handled by the static page map and avoid clobbering it.
    window.hikariRouter = {
        navigate: navigate,
        showPage: showPage,
        getPageId: getPageId,
        routes: routes
    };
    // Global navigate() for packager's post-WASM SPA re-trigger
    window.navigate = navigate;
})();
"#.to_string()
}
