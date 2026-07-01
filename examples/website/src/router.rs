use std::collections::BTreeMap;

pub struct Route {
    pub path: &'static str,
    pub page_id: &'static str,
}

pub static ROUTES: &[Route] = &[
    Route { path: "/", page_id: "page-home" },
    Route { path: "/components", page_id: "page-components" },
    Route { path: "/components/layer1/button", page_id: "page-component-button" },
    Route { path: "/components/layer1/form", page_id: "page-component-form" },
    Route { path: "/components/layer1/number-input", page_id: "page-component-number-input" },
    Route { path: "/components/layer1/search", page_id: "page-component-search" },
    Route { path: "/components/layer1/switch", page_id: "page-component-switch" },
    Route { path: "/components/layer1/feedback", page_id: "page-component-feedback" },
    Route { path: "/components/layer1/display", page_id: "page-component-display" },
    Route { path: "/components/layer1/avatar", page_id: "page-component-avatar" },
    Route { path: "/components/layer1/image", page_id: "page-component-image" },
    Route { path: "/components/layer1/tag", page_id: "page-component-tag" },
    Route { path: "/components/layer1/empty", page_id: "page-component-empty" },
    Route { path: "/components/layer1/comment", page_id: "page-component-comment" },
    Route { path: "/components/layer1/description-list", page_id: "page-component-description-list" },
    Route { path: "/components/layer2/navigation", page_id: "page-component-navigation" },
    Route { path: "/components/layer2/collapsible", page_id: "page-component-collapsible" },
    Route { path: "/components/layer2/data", page_id: "page-component-data" },
    Route { path: "/components/layer2/table", page_id: "page-component-table" },
    Route { path: "/components/layer2/tree", page_id: "page-component-tree" },
    Route { path: "/components/layer2/pagination", page_id: "page-component-pagination" },
    Route { path: "/components/layer2/qrcode", page_id: "page-component-qrcode" },
    Route { path: "/components/layer2/timeline", page_id: "page-component-timeline" },
    Route { path: "/components/layer2/form", page_id: "page-component-form-composed" },
    Route { path: "/components/layer2/cascader", page_id: "page-component-cascader" },
    Route { path: "/components/layer2/transfer", page_id: "page-component-transfer" },
    Route { path: "/components/layer2/feedback", page_id: "page-component-feedback-composed" },
    Route { path: "/components/layer3/media", page_id: "page-component-media" },
    Route { path: "/components/layer3/editor", page_id: "page-component-editor" },
    Route { path: "/components/layer3/visualization", page_id: "page-component-visualization" },
    Route { path: "/components/layer3/user-guide", page_id: "page-component-user-guide" },
    Route { path: "/components/layer3/zoom-controls", page_id: "page-component-zoom-controls" },
    Route { path: "/system", page_id: "page-system-overview" },
    Route { path: "/system/palette", page_id: "page-system-palette" },
    Route { path: "/system/css", page_id: "page-system-css" },
    Route { path: "/system/icons", page_id: "page-system-icons" },
    Route { path: "/system/animations", page_id: "page-system-animations" },
    Route { path: "/system/i18n", page_id: "page-system-i18n" },
    Route { path: "/demos", page_id: "page-demos-overview" },
    Route { path: "/demos/form", page_id: "page-demos-form" },
    Route { path: "/demos/dashboard", page_id: "page-demos-dashboard" },
    Route { path: "/demos/video", page_id: "page-demos-video" },
    Route { path: "/interactive", page_id: "page-interactive" },
    Route { path: "/animations", page_id: "page-animations" },
];

pub fn route_map() -> BTreeMap<&'static str, &'static str> {
    ROUTES.iter().map(|r| (r.path, r.page_id)).collect()
}

pub fn page_id_for_path(path: &str) -> Option<&'static str> {
    let clean = path.trim_end_matches('/');
    if clean.is_empty() {
        return Some("page-home");
    }
    ROUTES.iter().find(|r| r.path == clean).map(|r| r.page_id)
}

pub fn generate_router_js() -> String {
    let mut entries = Vec::new();
    for route in ROUTES {
        entries.push(format!("    '{}': '{}'", route.path, route.page_id));
    }
    let routes_obj = entries.join(",\n");

    format!(
        r#"(function() {{
'use strict';
const routes = {{
{routes_obj}
}};
function getPageId(path) {{
    var clean = path.endsWith('/') ? path.slice(0, -1) : path;
    if (!clean) clean = '/';
    return routes[clean] || 'page-not-found';
}}
function showPage(pageId) {{
    document.querySelectorAll('.hikari-page').forEach(function(p) {{
        p.classList.remove('is-active');
        p.setAttribute('aria-hidden', 'true');
    }});
    var page = document.getElementById(pageId);
    if (page) {{
        page.classList.add('is-active');
        page.removeAttribute('aria-hidden');
        window.scrollTo(0, 0);
    }}
    updateSidebarState();
    updateTopNavState();
    updateBreadcrumb();
}}
function updateSidebarState() {{
    var currentPath = location.pathname || '/';
    document.querySelectorAll('.hi-sidebar-item.is-active, .hi-menu-item.is-active').forEach(function(el) {{
        el.classList.remove('is-active');
    }});
    var activeInner = document.querySelector('.hi-sidebar-item[href="' + currentPath + '"], .hi-menu-item-inner[href="' + currentPath + '"]');
    if (activeInner) {{
        var activeLi = activeInner.closest('.hi-menu-item, .hi-sidebar-item');
        if (activeLi) activeLi.classList.add('is-active');
        var parent = activeInner.closest('.hi-submenu[data-collapsed]');
        while (parent) {{
            parent.removeAttribute('data-collapsed');
            parent = parent.parentElement ? parent.parentElement.closest('.hi-submenu[data-collapsed]') : null;
        }}
    }}
}}
function updateTopNavState() {{
    document.querySelectorAll('.hikari-topnav__link').forEach(function(link) {{
        link.classList.remove('is-active');
        if (currentPath().startsWith(link.getAttribute('href'))) {{
            link.classList.add('is-active');
        }}
    }});
}}
function currentPath() {{ return location.pathname || '/'; }}
function updateBreadcrumb() {{
    var bcCurrent = document.getElementById('breadcrumb-current');
    if (!bcCurrent) return;
    var parts = currentPath().substring(1).split('/');
    var labels = [];
    if (parts[0] === 'components') {{
        labels.push('Components');
        if (parts[1]) labels.push(parts[1].replace('layer', 'Layer '));
        if (parts[2]) labels.push(parts[2].charAt(0).toUpperCase() + parts[2].slice(1));
    }} else if (parts[0] === 'system') {{
        labels.push('System');
        if (parts[1]) labels.push(parts[1].charAt(0).toUpperCase() + parts[1].slice(1));
    }} else if (parts[0] === 'demos') {{
        labels.push('Demos');
        if (parts[1]) labels.push(parts[1].charAt(0).toUpperCase() + parts[1].slice(1));
    }} else if (!parts[0]) {{
        labels.push('Home');
    }} else {{
        labels.push(parts.map(function(s) {{ return s.charAt(0).toUpperCase() + s.slice(1); }}).join(' '));
    }}
    bcCurrent.textContent = labels.length > 0 ? labels[labels.length - 1] : 'Home';
}}
function navigate() {{
    var path = location.pathname || '/';
    var pageId = getPageId(path);
    showPage(pageId);
}}
document.addEventListener('click', function(e) {{
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || !href.startsWith('/')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (link.target === '_blank') return;
    e.preventDefault();
    if (location.pathname !== href) history.pushState(null, '', href);
    var aside = document.getElementById('hikari-aside');
    var overlay = document.getElementById('drawer-overlay');
    if (aside) aside.classList.remove('hi-aside-drawer-open');
    if (overlay) overlay.classList.remove('hi-layout-overlay-open');
    navigate();
}});
window.addEventListener('popstate', navigate);
if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', navigate);
}} else {{
    navigate();
}}
setTimeout(navigate, 200);
window.navigate = navigate;
window.hikariRouter = {{ navigate: navigate, showPage: showPage, getPageId: getPageId, routes: routes }};
}})();"#,
        routes_obj = routes_obj
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_route_map_completeness() {
        let map = route_map();
        assert!(map.contains_key("/"));
        assert!(map.contains_key("/components"));
        assert!(map.contains_key("/components/layer1/button"));
        assert!(map.contains_key("/system"));
        assert!(map.contains_key("/system/palette"));
        assert!(map.contains_key("/interactive"));
        assert!(map.contains_key("/animations"));
        assert!(map.contains_key("/demos"));
    }

    #[test]
    fn test_page_id_for_path() {
        assert_eq!(page_id_for_path("/"), Some("page-home"));
        assert_eq!(page_id_for_path("/components"), Some("page-components"));
        assert_eq!(page_id_for_path("/components/layer1/button"), Some("page-component-button"));
        assert_eq!(page_id_for_path("/system/palette"), Some("page-system-palette"));
        assert_eq!(page_id_for_path("/unknown"), None);
    }

    #[test]
    fn test_page_id_for_path_trailing_slash() {
        assert_eq!(page_id_for_path("/"), Some("page-home"));
        assert_eq!(page_id_for_path("/components/"), Some("page-components"));
    }

    #[test]
    fn test_generate_router_js() {
        let js = generate_router_js();
        assert!(js.contains("'/'"));
        assert!(js.contains("'page-home'"));
        assert!(js.contains("'page-component-button'"));
        assert!(js.contains("hikariRouter"));
        assert!(js.contains("navigate"));
        assert!(js.contains("popstate"));
    }

    #[test]
    fn test_all_layer1_routes_present() {
        let map = route_map();
        let layer1_paths = [
            "/components/layer1/button",
            "/components/layer1/form",
            "/components/layer1/number-input",
            "/components/layer1/search",
            "/components/layer1/switch",
            "/components/layer1/feedback",
            "/components/layer1/display",
            "/components/layer1/avatar",
            "/components/layer1/image",
            "/components/layer1/tag",
            "/components/layer1/empty",
            "/components/layer1/comment",
            "/components/layer1/description-list",
        ];
        for path in &layer1_paths {
            assert!(map.contains_key(path), "Missing route: {}", path);
        }
    }

    #[test]
    fn test_all_layer2_routes_present() {
        let map = route_map();
        let layer2_paths = [
            "/components/layer2/navigation",
            "/components/layer2/collapsible",
            "/components/layer2/data",
            "/components/layer2/table",
            "/components/layer2/tree",
            "/components/layer2/pagination",
            "/components/layer2/qrcode",
            "/components/layer2/timeline",
            "/components/layer2/form",
            "/components/layer2/cascader",
            "/components/layer2/transfer",
            "/components/layer2/feedback",
        ];
        for path in &layer2_paths {
            assert!(map.contains_key(path), "Missing route: {}", path);
        }
    }

    #[test]
    fn test_all_layer3_routes_present() {
        let map = route_map();
        let layer3_paths = [
            "/components/layer3/media",
            "/components/layer3/editor",
            "/components/layer3/visualization",
            "/components/layer3/user-guide",
            "/components/layer3/zoom-controls",
        ];
        for path in &layer3_paths {
            assert!(map.contains_key(path), "Missing route: {}", path);
        }
    }
}
