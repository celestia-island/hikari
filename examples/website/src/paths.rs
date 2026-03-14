//! Static asset paths configuration
//!
//! This module centralizes all static asset paths to ensure consistency
//! between the HTML template and server configuration.
//!
//! IMPORTANT: All paths MUST start with "/" to be absolute paths.
//! This ensures resources load correctly on all routes (including nested routes).
//!
//! # Why Absolute Paths?
//!
//! When using relative paths like `./assets/website.js`:
//! - On route `/` → requests `/assets/website.js` ✅
//! - On route `/components` → requests `/components/assets/website.js` ❌
//!
//! With absolute paths like `/assets/website.js`:
//! - On route `/` → requests `/assets/website.js` ✅
//! - On route `/components` → requests `/assets/website.js" ✅

/// Static asset paths (ALL MUST START WITH /)
pub struct StaticPaths {
    /// Path to CSS bundle
    pub css_bundle: &'static str,

    /// Path to WASM JS glue
    pub wasm_js: &'static str,

    /// Path to WASM binary
    pub wasm_bg: &'static str,

    /// Path to logo.png
    pub logo: &'static str,

    /// Server mount point for assets directory
    pub assets_mount: &'static str,

    /// Server mount point for styles directory
    pub styles_mount: &'static str,

    /// Server mount point for images directory
    pub images_mount: &'static str,

    /// Server mount point for icons directory
    pub icons_mount: &'static str,

    /// Filesystem path to assets directory (relative to project root)
    pub assets_fs: &'static str,

    /// Filesystem path to styles directory (relative to project root)
    pub styles_fs: &'static str,

    /// Filesystem path to images directory (relative to project root)
    pub images_fs: &'static str,

    /// Filesystem path to icons directory (relative to project root)
    pub icons_fs: &'static str,
}

/// Global static paths configuration
pub const STATIC_PATHS: StaticPaths = StaticPaths {
    // HTML references (these MUST be absolute paths starting with /)
    css_bundle: "/styles/bundle.css",
    wasm_js: "/assets/website.js",
    wasm_bg: "/assets/website_bg.wasm",
    logo: "/images/logo.png",

    // Server configuration (mount points for serving files)
    assets_mount: "/assets",
    styles_mount: "/styles",
    images_mount: "/images",
    icons_mount: "/icons",

    // Filesystem paths (relative to project root)
    assets_fs: "public/assets",
    styles_fs: "public/styles",
    images_fs: "public/images",
    icons_fs: "public/icons",
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_paths_are_absolute() {
        // Ensure all HTML reference paths start with "/"
        assert!(
            STATIC_PATHS.css_bundle.starts_with('/'),
            "CSS bundle path must be absolute"
        );
        assert!(
            STATIC_PATHS.wasm_js.starts_with('/'),
            "WASM JS path must be absolute"
        );
        assert!(
            STATIC_PATHS.wasm_bg.starts_with('/'),
            "WASM BG path must be absolute"
        );
        assert!(
            STATIC_PATHS.logo.starts_with('/'),
            "Logo path must be absolute"
        );

        // Ensure all mount points start with "/"
        assert!(
            STATIC_PATHS.assets_mount.starts_with('/'),
            "Assets mount must be absolute"
        );
        assert!(
            STATIC_PATHS.styles_mount.starts_with('/'),
            "Styles mount must be absolute"
        );
        assert!(
            STATIC_PATHS.images_mount.starts_with('/'),
            "Images mount must be absolute"
        );
        assert!(
            STATIC_PATHS.icons_mount.starts_with('/'),
            "Icons mount must be absolute"
        );
    }

    #[test]
    fn test_paths_consistency() {
        // Mount points should match HTML reference prefixes
        assert!(
            STATIC_PATHS
                .css_bundle
                .starts_with(STATIC_PATHS.styles_mount),
            "CSS bundle should be under styles mount"
        );
        assert!(
            STATIC_PATHS.wasm_js.starts_with(STATIC_PATHS.assets_mount),
            "WASM JS should be under assets mount"
        );
        assert!(
            STATIC_PATHS.wasm_bg.starts_with(STATIC_PATHS.assets_mount),
            "WASM BG should be under assets mount"
        );
        assert!(
            STATIC_PATHS.logo.starts_with(STATIC_PATHS.images_mount),
            "Logo should be under images mount"
        );
    }
}
