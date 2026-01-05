// hikari-palette/src/utility.rs
// Utility class system (Tailwind-like but independent)

/// Utility class constants for common styling needs
///
/// This provides a minimal set of utility classes similar to Tailwind CSS
/// but without external dependencies.
pub const UTILITY_CLASSES: &str = r#"
/* Hikari Utility Classes */
/* Tailwind-like utility classes without external dependencies */

/* ===== Display ===== */
.hi-hidden { display: none !important; }
.hi-block { display: block !important; }
.hi-inline-block { display: inline-block !important; }
.hi-flex { display: flex !important; }
.hi-inline-flex { display: inline-flex !important; }
.hi-grid { display: grid !important; }

/* ===== Flexbox ===== */
.hi-flex-row { flex-direction: row !important; }
.hi-flex-col { flex-direction: column !important; }
.hi-flex-wrap { flex-wrap: wrap !important; }
.hi-flex-nowrap { flex-wrap: nowrap !important; }
.hi-flex-1 { flex: 1 1 0% !important; }
.hi-flex-auto { flex: 1 1 auto !important; }
.hi-flex-none { flex: none !important; }

.hi-items-start { align-items: flex-start !important; }
.hi-items-end { align-items: flex-end !important; }
.hi-items-center { align-items: center !important; }
.hi-items-stretch { align-items: stretch !important; }
.hi-items-baseline { align-items: baseline !important; }

.hi-justify-start { justify-content: flex-start !important; }
.hi-justify-end { justify-content: flex-end !important; }
.hi-justify-center { justify-content: center !important; }
.hi-justify-between { justify-content: space-between !important; }
.hi-justify-around { justify-content: space-around !important; }

/* ===== Grid ===== */
.hi-grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
.hi-grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
.hi-grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
.hi-grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
.hi-grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }

.hi-gap-1 { gap: 0.25rem !important; }
.hi-gap-2 { gap: 0.5rem !important; }
.hi-gap-3 { gap: 0.75rem !important; }
.hi-gap-4 { gap: 1rem !important; }
.hi-gap-6 { gap: 1.5rem !important; }
.hi-gap-8 { gap: 2rem !important; }

/* ===== Spacing (Padding) ===== */
.hi-p-0 { padding: 0 !important; }
.hi-p-1 { padding: 0.25rem !important; }
.hi-p-2 { padding: 0.5rem !important; }
.hi-p-3 { padding: 0.75rem !important; }
.hi-p-4 { padding: 1rem !important; }
.hi-p-5 { padding: 1.25rem !important; }
.hi-p-6 { padding: 1.5rem !important; }
.hi-p-8 { padding: 2rem !important; }
.hi-p-10 { padding: 2.5rem !important; }
.hi-p-12 { padding: 3rem !important; }

.hi-px-1 { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
.hi-px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
.hi-px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
.hi-px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
.hi-px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }

.hi-py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
.hi-py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
.hi-py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
.hi-py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }

/* ===== Spacing (Margin) ===== */
.hi-m-0 { margin: 0 !important; }
.hi-m-1 { margin: 0.25rem !important; }
.hi-m-2 { margin: 0.5rem !important; }
.hi-m-3 { margin: 0.75rem !important; }
.hi-m-4 { margin: 1rem !important; }
.hi-m-auto { margin: auto !important; }

.hi-mx-auto { margin-left: auto !important; margin-right: auto !important; }
.hi-my-auto { margin-top: auto !important; margin-bottom: auto !important; }

/* ===== Sizing ===== */
.hi-w-full { width: 100% !important; }
.hi-w-screen { width: 100vw !important; }
.hi-w-auto { width: auto !important; }
.hi-w-6 { width: 1.5rem !important; }
.hi-w-8 { width: 2rem !important; }
.hi-w-12 { width: 3rem !important; }
.hi-w-16 { width: 4rem !important; }
.hi-w-24 { width: 6rem !important; }

.hi-h-full { height: 100% !important; }
.hi-h-screen { height: 100vh !important; }
.hi-h-auto { height: auto !important; }
.hi-h-6 { height: 1.5rem !important; }
.hi-h-8 { height: 2rem !important; }
.hi-h-12 { height: 3rem !important; }

.hi-min-w-0 { min-width: 0 !important; }
.hi-min-h-screen { min-height: 100vh !important; }

.hi-max-w-full { max-width: 100% !important; }
.hi-max-w-screen-lg { max-width: 1024px !important; }
.hi-max-w-screen-xl { max-width: 1280px !important; }

/* ===== Position ===== */
.hi-static { position: static !important; }
.hi-fixed { position: fixed !important; }
.hi-absolute { position: absolute !important; }
.hi-relative { position: relative !important; }
.hi-sticky { position: sticky !important; }

.hi-inset-0 { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }

/* ===== Overflow ===== */
.hi-overflow-hidden { overflow: hidden !important; }
.hi-overflow-auto { overflow: auto !important; }
.hi-overflow-scroll { overflow: scroll !important; }
.hi-overflow-x-auto { overflow-x: auto !important; }
.hi-overflow-y-auto { overflow-y: auto !important; }

/* ===== Typography ===== */
.hi-text-left { text-align: left !important; }
.hi-text-center { text-align: center !important; }
.hi-text-right { text-align: right !important; }

.hi-text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
.hi-text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
.hi-text-base { font-size: 1rem !important; line-height: 1.5rem !important; }
.hi-text-lg { font-size: 1.125rem !important; line-height: 1.75rem !important; }
.hi-text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
.hi-text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
.hi-text-3xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }

.hi-font-normal { font-weight: 400 !important; }
.hi-font-medium { font-weight: 500 !important; }
.hi-font-semibold { font-weight: 600 !important; }
.hi-font-bold { font-weight: 700 !important; }

/* ===== Border Radius ===== */
.hi-rounded-none { border-radius: 0 !important; }
.hi-rounded-sm { border-radius: 0.125rem !important; }
.hi-rounded { border-radius: 0.25rem !important; }
.hi-rounded-lg { border-radius: 0.5rem !important; }
.hi-rounded-xl { border-radius: 0.75rem !important; }
.hi-rounded-full { border-radius: 9999px !important; }

/* ===== Opacity ===== */
.hi-opacity-0 { opacity: 0 !important; }
.hi-opacity-50 { opacity: 0.5 !important; }
.hi-opacity-100 { opacity: 1 !important; }

/* ===== Cursor ===== */
.hi-cursor-pointer { cursor: pointer !important; }
.hi-cursor-not-allowed { cursor: not-allowed !important; }

/* ===== Pointer Events ===== */
.hi-pointer-events-none { pointer-events: none !important; }
.hi-pointer-events-auto { pointer-events: auto !important; }

/* ===== User Select ===== */
.hi-select-none { user-select: none !important; }
.hi-select-text { user-select: text !important; }
.hi-select-all { user-select: all !important; }

/* ===== Z-Index ===== */
.hi-z-0 { z-index: 0 !important; }
.hi-z-10 { z-index: 10 !important; }
.hi-z-20 { z-index: 20 !important; }
.hi-z-30 { z-index: 30 !important; }
.hi-z-40 { z-index: 40 !important; }
.hi-z-50 { z-index: 50 !important; }
.hi-z-auto { z-index: auto !important; }
"#;

/// Get utility classes CSS
pub fn get_utility_classes() -> &'static str {
    UTILITY_CLASSES
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_utility_classes_not_empty() {
        assert!(!UTILITY_CLASSES.is_empty());
    }
}
