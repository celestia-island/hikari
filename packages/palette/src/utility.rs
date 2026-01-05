// hikari-palette/src/utility.rs
// Utility class system (Tailwind-like but independent)

/// Utility class constants for common styling needs
///
/// This provides a comprehensive set of utility classes similar to Tailwind CSS
/// but with `hi-` prefix and without external dependencies.
///
/// # Design Decisions
///
/// **No !important**: Utility classes do NOT use !important to avoid:
/// - Style specificity pollution
/// - Making styles impossible to override
/// - Violating CSS cascade principles
///
/// If you need to override styles, use:
/// - More specific selectors
/// - Later class declarations (CSS cascade)
/// - Inline styles as last resort
pub const UTILITY_CLASSES: &str = r#"
/* Hikari Utility Classes */
/* Tailwind-like utility classes without external dependencies */
/* NOTE: No !important used to preserve CSS cascade */

/* ===== Display ===== */
.hi-hidden { display: none }
.hi-block { display: block }
.hi-inline-block { display: inline-block }
.hi-flex { display: flex }
.hi-inline-flex { display: inline-flex }
.hi-grid { display: grid }

/* ===== Flexbox ===== */
.hi-flex-row { flex-direction: row }
.hi-flex-col { flex-direction: column }
.hi-flex-wrap { flex-wrap: wrap }
.hi-flex-nowrap { flex-wrap: nowrap }
.hi-flex-1 { flex: 1 1 0% }
.hi-flex-auto { flex: 1 1 auto }
.hi-flex-none { flex: none }

.hi-items-start { align-items: flex-start }
.hi-items-end { align-items: flex-end }
.hi-items-center { align-items: center }
.hi-items-stretch { align-items: stretch }
.hi-items-baseline { align-items: baseline }

.hi-justify-start { justify-content: flex-start }
.hi-justify-end { justify-content: flex-end }
.hi-justify-center { justify-content: center }
.hi-justify-between { justify-content: space-between }
.hi-justify-around { justify-content: space-around }

/* ===== Grid ===== */
.hi-grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) }
.hi-grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) }
.hi-grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) }
.hi-grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) }
.hi-grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)) }

.hi-gap-1 { gap: 0.25rem }
.hi-gap-2 { gap: 0.5rem }
.hi-gap-3 { gap: 0.75rem }
.hi-gap-4 { gap: 1rem }
.hi-gap-6 { gap: 1.5rem }
.hi-gap-8 { gap: 2rem }

/* ===== Spacing (Padding) ===== */
.hi-p-0 { padding: 0 }
.hi-p-1 { padding: 0.25rem }
.hi-p-2 { padding: 0.5rem }
.hi-p-3 { padding: 0.75rem }
.hi-p-4 { padding: 1rem }
.hi-p-5 { padding: 1.25rem }
.hi-p-6 { padding: 1.5rem }
.hi-p-8 { padding: 2rem }
.hi-p-10 { padding: 2.5rem }
.hi-p-12 { padding: 3rem }

.hi-px-1 { padding-left: 0.25rem padding-right: 0.25rem }
.hi-px-2 { padding-left: 0.5rem padding-right: 0.5rem }
.hi-px-3 { padding-left: 0.75rem padding-right: 0.75rem }
.hi-px-4 { padding-left: 1rem padding-right: 1rem }
.hi-px-6 { padding-left: 1.5rem padding-right: 1.5rem }

.hi-py-1 { padding-top: 0.25rem padding-bottom: 0.25rem }
.hi-py-2 { padding-top: 0.5rem padding-bottom: 0.5rem }
.hi-py-3 { padding-top: 0.75rem padding-bottom: 0.75rem }
.hi-py-4 { padding-top: 1rem padding-bottom: 1rem }

/* ===== Spacing (Margin) ===== */
.hi-m-0 { margin: 0 }
.hi-m-1 { margin: 0.25rem }
.hi-m-2 { margin: 0.5rem }
.hi-m-3 { margin: 0.75rem }
.hi-m-4 { margin: 1rem }
.hi-m-auto { margin: auto }

.hi-mx-auto { margin-left: auto margin-right: auto }
.hi-my-auto { margin-top: auto margin-bottom: auto }

/* ===== Sizing ===== */
.hi-w-full { width: 100% }
.hi-w-screen { width: 100vw }
.hi-w-auto { width: auto }
.hi-w-6 { width: 1.5rem }
.hi-w-8 { width: 2rem }
.hi-w-12 { width: 3rem }
.hi-w-16 { width: 4rem }
.hi-w-24 { width: 6rem }

.hi-h-full { height: 100% }
.hi-h-screen { height: 100vh }
.hi-h-auto { height: auto }
.hi-h-6 { height: 1.5rem }
.hi-h-8 { height: 2rem }
.hi-h-12 { height: 3rem }

.hi-min-w-0 { min-width: 0 }
.hi-min-h-screen { min-height: 100vh }

.hi-max-w-full { max-width: 100% }
.hi-max-w-screen-lg { max-width: 1024px }
.hi-max-w-screen-xl { max-width: 1280px }

/* ===== Position ===== */
.hi-static { position: static }
.hi-fixed { position: fixed }
.hi-absolute { position: absolute }
.hi-relative { position: relative }
.hi-sticky { position: sticky }

.hi-inset-0 { top: 0 right: 0 bottom: 0 left: 0 }

/* ===== Overflow ===== */
.hi-overflow-hidden { overflow: hidden }
.hi-overflow-auto { overflow: auto }
.hi-overflow-scroll { overflow: scroll }
.hi-overflow-x-auto { overflow-x: auto }
.hi-overflow-y-auto { overflow-y: auto }

/* ===== Typography ===== */
.hi-text-left { text-align: left }
.hi-text-center { text-align: center }
.hi-text-right { text-align: right }

.hi-text-xs { font-size: 0.75rem line-height: 1rem }
.hi-text-sm { font-size: 0.875rem line-height: 1.25rem }
.hi-text-base { font-size: 1rem line-height: 1.5rem }
.hi-text-lg { font-size: 1.125rem line-height: 1.75rem }
.hi-text-xl { font-size: 1.25rem line-height: 1.75rem }
.hi-text-2xl { font-size: 1.5rem line-height: 2rem }
.hi-text-3xl { font-size: 1.875rem line-height: 2.25rem }

.hi-font-normal { font-weight: 400 }
.hi-font-medium { font-weight: 500 }
.hi-font-semibold { font-weight: 600 }
.hi-font-bold { font-weight: 700 }

/* ===== Border Radius ===== */
.hi-rounded-none { border-radius: 0 }
.hi-rounded-sm { border-radius: 0.125rem }
.hi-rounded { border-radius: 0.25rem }
.hi-rounded-lg { border-radius: 0.5rem }
.hi-rounded-xl { border-radius: 0.75rem }
.hi-rounded-full { border-radius: 9999px }

/* ===== Opacity ===== */
.hi-opacity-0 { opacity: 0 }
.hi-opacity-50 { opacity: 0.5 }
.hi-opacity-100 { opacity: 1 }

/* ===== Cursor ===== */
.hi-cursor-pointer { cursor: pointer }
.hi-cursor-not-allowed { cursor: not-allowed }

/* ===== Pointer Events ===== */
.hi-pointer-events-none { pointer-events: none }
.hi-pointer-events-auto { pointer-events: auto }

/* ===== User Select ===== */
.hi-select-none { user-select: none }
.hi-select-text { user-select: text }
.hi-select-all { user-select: all }

/* ===== Z-Index ===== */
.hi-z-0 { z-index: 0 }
.hi-z-10 { z-index: 10 }
.hi-z-20 { z-index: 20 }
.hi-z-30 { z-index: 30 }
.hi-z-40 { z-index: 40 }
.hi-z-50 { z-index: 50 }
.hi-z-auto { z-index: auto }

/* ===== Colors (Background) ===== */
.hi-bg-white { background-color: #ffffff }
.hi-bg-black { background-color: #000000 }
.hi-bg-transparent { background-color: transparent }
.hi-bg-gray-50 { background-color: #f9fafb }
.hi-bg-gray-100 { background-color: #f3f4f6 }
.hi-bg-gray-200 { background-color: #e5e7eb }
.hi-bg-gray-300 { background-color: #d1d5db }
.hi-bg-gray-500 { background-color: #6b7280 }
.hi-bg-gray-700 { background-color: #374151 }
.hi-bg-gray-900 { background-color: #111827 }

/* Hikari theme colors */
.hi-bg-primary { background-color: #4a9eff }
.hi-bg-primary-light { background-color: #3a8eef }
.hi-bg-dark { background-color: #1a1a2e }
.hi-bg-dark-light { background-color: #16213e }

/* ===== Colors (Text) ===== */
.hi-text-white { color: #ffffff }
.hi-text-black { color: #000000 }
.hi-text-gray-500 { color: #6b7280 }
.hi-text-gray-700 { color: #374151 }
.hi-text-gray-900 { color: #111827 }

/* Hikari theme colors */
.hi-text-primary { color: #4a9eff }

/* ===== Opacity Variants ===== */
.hi-bg-white\/10 { background-color: rgba(255, 255, 255, 0.1) }
.hi-bg-white\/20 { background-color: rgba(255, 255, 255, 0.2) }
.hi-bg-black\/50 { background-color: rgba(0, 0, 0, 0.5) }
.hi-bg-black\/30 { background-color: rgba(0, 0, 0, 0.3) }
.hi-bg-black\/10 { background-color: rgba(0, 0, 0, 0.1) }

/* ===== Position (Inset) ===== */
.hi-inset-0 { top: 0 right: 0 bottom: 0 left: 0 }
.hi-inset-y-0 { top: 0 bottom: 0 }
.hi-inset-x-0 { right: 0 left: 0 }
.hi-top-0 { top: 0 }
.hi-bottom-0 { bottom: 0 }
.hi-left-0 { left: 0 }
.hi-right-0 { right: 0 }

/* ===== Transform ===== */
.hi-translate-x-0 { transform: translateX(0) }
.hi--translate-x-full { transform: translateX(-100%) }
.hi-translate-x-full { transform: translateX(100%) }
.hi-translate-y-0 { transform: translateY(0) }

/* ===== Transitions ===== */
.hi-transition-all { transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1) }
.hi-transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) transition-duration: 150ms }
.hi-transition-transform { transition-property: transform transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) transition-duration: 150ms }
.hi-duration-150 { transition-duration: 150ms }
.hi-duration-300 { transition-duration: 300ms }
.hi-duration-500 { transition-duration: 500ms }
.hi-ease-in-out { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) }

/* ===== Hover States ===== */
.hi-hover\:bg-primary-light:hover { background-color: #3a8eef }
.hi-hover\:bg-white\/10:hover { background-color: rgba(255, 255, 255, 0.1) }
.hi-hover\:bg-white\/20:hover { background-color: rgba(255, 255, 255, 0.2) }
.hi-hover\:bg-gray-100:hover { background-color: #f3f4f6 }
.hi-hover\:bg-gray-200:hover { background-color: #e5e7eb }
.hi-hover\:text-primary:hover { color: #4a9eff }
.hi-hover\:text-white:hover { color: #ffffff }
.hi-hover\:underline:hover { text-decoration: underline }

/* ===== Focus States ===== */
.hi-focus\:outline-none:focus { outline: none }
.hi-focus\:ring-2:focus { box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.5) }

/* ===== Responsive (LG) ===== */
@media (min-width: 1024px) {
  .hi-lg\:block { display: block }
  .hi-lg\:flex { display: flex }
  .hi-lg\:hidden { display: none }
  .hi-lg\:static { position: static }
  .hi-lg\:fixed { position: fixed }
  .hi-lg\:ml-0 { margin-left: 0 }
  .hi-lg\:w-auto { width: auto }
  .hi-lg\:translate-x-0 { transform: translateX(0) }
  .hi-lg\:p-10 { padding: 2.5rem }
}

/* ===== Custom Width/Height ===== */
.hi-w-64 { width: 16rem }
.hi-w-auto { width: auto }
.hi-h-6 { height: 1.5rem }
.hi-h-screen { height: 100vh }

/* ===== Border Radius ===== */
.hi-rounded-lg { border-radius: 0.5rem }
.hi-rounded-xl { border-radius: 0.75rem }

/* ===== Border ===== */
.hi-border { border-width: 1px }
.hi-border-b { border-bottom-width: 1px }
.hi-border-gray-200 { border-color: #e5e7eb }
.hi-border-gray-300 { border-color: #d1d5db }

/* ===== Self Alignment ===== */
.hi-self-end { align-self: flex-end }
.hi-self-start { align-self: flex-start }
.hi-self-center { align-self: center }

/* ===== Object Fit ===== */
.hi-object-cover { object-fit: cover }
.hi-object-contain { object-fit: contain }

/* ===== Custom Theme Colors (for demo app) ===== */
.hi-bg-dark-theme { background-color: #1a1a2e }
.hi-bg-dark-theme-light { background-color: #16213e }
.hi-bg-light-theme { background-color: #f5f5f5 }
.hi-text-primary-light { color: #4a9eff }

/* ===== Font Sizes ===== */
.hi-text-xl { font-size: 1.25rem line-height: 1.75rem }
.hi-text-2xl { font-size: 1.5rem line-height: 2rem }
.hi-text-3xl { font-size: 1.875rem line-height: 2.25rem }
.hi-text-4xl { font-size: 2.25rem line-height: 2.5rem }

/* ===== Font Weight ===== */
.hi-font-semibold { font-weight: 600 }
.hi-font-bold { font-weight: 700 }

/* ===== Font Family ===== */
.hi-font-sans { font-family: system-ui, -apple-system, sans-serif }

/* ===== Additional Margin ===== */
.hi-mb-2 { margin-bottom: 0.5rem }
.hi-mb-3 { margin-bottom: 0.75rem }
.hi-mb-4 { margin-bottom: 1rem }
.hi-mb-5 { margin-bottom: 1.25rem }
.hi-mb-16 { margin-bottom: 4rem }
.hi-mb-2\.5 { margin-bottom: 0.625rem }
.hi-ml-0 { margin-left: 0 }
.hi-mr-2 { margin-right: 0.5rem }
.hi-mr-4 { margin-right: 1rem }
.hi-m-0 { margin: 0 }
.hi-mt-3 { margin-top: 0.75rem }
.hi-pl-6 { padding-left: 1.5rem }
.hi-pl-12 { padding-left: 3rem }
.hi-py-1 { padding-top: 0.25rem padding-bottom: 0.25rem }

/* ===== Additional Width ===== */
.hi-w-2xl { width: 42rem }
.hi-w-3xl { width: 48rem }
.hi-max-w-2xl { max-width: 42rem }
.hi-max-w-3xl { max-width: 48rem }
.hi-max-w-4xl { max-width: 56rem }

/* ===== Additional Text Colors ===== */
.hi-text-gray-400 { color: #9ca3af }
.hi-text-gray-600 { color: #4b5563 }
.hi-text-gray-800 { color: #1f2937 }
.hi-text-dark-theme { color: #1a1a2e }
.hi-text-blue-800 { color: #1e40af }

/* ===== Line Height ===== */
.hi-leading-relaxed { line-height: 1.625 }

/* ===== Text Transform ===== */
.hi-uppercase { text-transform: uppercase }

/* ===== Letter Spacing ===== */
.hi-tracking-wider { letter-spacing: 0.05em }

/* ===== Space Between ===== */
.hi-space-y-6 > * + * { margin-top: 1.5rem }

/* ===== Shadow ===== */
.hi-shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) }
.hi-shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) }

/* ===== Transform Negative ===== */
.hi--translate-y-1 { transform: translateY(-0.25rem) }

/* ===== Border ===== */
.hi-border-2 { border-width: 2px }
.hi-border-transparent { border-color: transparent }

/* ===== Responsive (MD) ===== */
@media (min-width: 768px) {
  .hi-md\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) }
}
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
