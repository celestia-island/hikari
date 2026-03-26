# Dynamic Documentation Loading Implementation

## Overview

This implementation adds dynamic document page loading to the Hikari website documentation. The system allows documentation content to be loaded on-demand from markdown files in the `/docs/` directory, with support for 9 languages and proper error handling.

## Files Created

### 1. Core Modules

#### `/mnt/sdb1/hikari/examples/website/src/dynamic_docs.rs`

- **Purpose**: Core dynamic documentation loading module
- **Key Functions**:
  - `DocPage()`: Main component for rendering dynamic documentation
  - `build_doc_url()`: Constructs documentation URLs with language support
  - `build_fallback_doc_url()`: Provides fallback to en-US
  - `render_doc_error()`: Error state rendering
  - `render_doc_not_found()`: 404 state rendering
  - `doc_loader_js()`: JavaScript for client-side loading
  - `render_doc_loader_script()`: Script injection component

#### `/mnt/sdb1/hikari/examples/website/src/routing.rs`

- **Purpose**: Client-side routing for documentation pages
- **Key Structures**:
  - `DocRoute`: Route configuration with pattern matching
  - `DocPageType`: Enum for page types (Component, System, Guide, General)
- **Key Functions**:
  - `doc_router_js()`: JavaScript router implementation
  - `render_doc_router_script()`: Script injection component

#### `/mnt/sdb1/hikari/examples/website/src/pages/doc_page.rs`

- **Purpose**: Specialized documentation page components
- **Key Functions**:
  - `DocumentationPage()`: Generic documentation page
  - `ComponentDocPage()`: Component-specific page with layer badges
  - `SystemDocPage()`: System documentation page
  - `GuideDocPage()`: Guide/tutorial page with TOC
  - `DocIndexPage()`: Category index page

### 2. Styles

#### `/mnt/sdb1/hikari/examples/website/public/assets/doc-styles.css`

- **Purpose**: Styles for documentation pages
- **Contains**:
  - Loading state styles with spinner animation
  - Error and not-found state styles
  - Markdown content styling
  - Component/system/guide badges
  - Navigation styles
  - RTL support
  - Dark mode support
  - Responsive design

## Files Modified

### 1. `/mnt/sdb1/hikari/examples/website/src/lib.rs`

- Added `mod dynamic_docs;`
- Added `mod routing;`

### 2. `/mnt/sdb1/hikari/examples/website/src/pages/mod.rs`

- Added `pub mod doc_page;`

### 3. `/mnt/sdb1/hikari/examples/website/src/app.rs`

- Added `use crate::routing;`
- Added `.child(routing::render_doc_router_script())` to app tree

### 4. `/mnt/sdb1/hikari/examples/website/index.html`

- Added `<link rel="stylesheet" href="/assets/doc-styles.css">`

## API Surface

### DocPage Component

```rust
pub fn DocPage(
    doc_path: String,
    language: String,
    title: Option<String>,
) -> VNode
```

**Parameters**:

- `doc_path`: Documentation path (e.g., "components/layer1/button")
- `language`: Language code (e.g., "en-US", "zh-CHS")
- `title`: Optional page title

**Usage Example**:

```rust
DocPage {
    doc_path: "components/layer1/button".to_string(),
    language: "en-US".to_string(),
    title: Some("Button Component".to_string()),
}
```

### DocumentationPage Component

```rust
pub fn DocumentationPage(
    doc_path: String,
    language: String,
    title: Option<String>,
) -> VNode
```

**Parameters**: Same as `DocPage`, but renders a full page with header.

### ComponentDocPage Component

```rust
pub fn ComponentDocPage(
    component_path: String,
    language: String,
    layer: u8,
) -> VNode
```

**Parameters**:

- `component_path`: Component path (e.g., "layer1/button")
- `language`: Language code
- `layer`: Component layer (1, 2, or 3)

### SystemDocPage Component

```rust
pub fn SystemDocPage(
    system_path: String,
    language: String,
) -> VNode
```

### GuideDocPage Component

```rust
pub fn GuideDocPage(
    guide_path: String,
    language: String,
) -> VNode
```

### Utility Functions

```rust
pub fn build_doc_url(doc_path: &str, language: &str) -> String
pub fn build_fallback_doc_url(doc_path: &str) -> String
pub const SUPPORTED_LANGUAGES: &[&str]
pub const DEFAULT_LANGUAGE: &str
```

## JavaScript API

### Doc Loader (`window.hikariDocs`)

```javascript
// Load documentation for a container
window.hikariDocs.load(containerElement);

// Reload all documentation pages
window.hikariDocs.reload();

// Initialize all doc pages
window.hikariDocs.init();
```

### Router (`window.hikariRouter`)

```javascript
// Navigate to a documentation page
window.hikariRouter.navigate(path, language);

// Match a URL pattern
window.hikariRouter.match(path);

// Get current language
window.hikariRouter.getCurrentLanguage();
```

## Supported Languages

The system supports 9 languages with automatic fallback to en-US:

1. `en-US` - English (Default)
2. `zh-CHS` - Chinese (Simplified)
3. `zh-CHT` - Chinese (Traditional)
4. `fr-FR` - French
5. `ru-RU` - Russian
6. `es-ES` - Spanish
7. `ar-SA` - Arabic
8. `ja-JP` - Japanese
9. `ko-KR` - Korean

## Routing Configuration

Routes are defined in `routing.rs` with the following patterns:

| Pattern | Description |
|---------|-------------|
| `/components/layer1/:path` | Layer 1 components |
| `/components/layer2/:path` | Layer 2 components |
| `/components/layer3/:path` | Layer 3 components |
| `/system/:path` | System documentation |
| `/guides/:path` | Guides and tutorials |
| `/docs/:path` | General documentation |

## Loading States

The implementation provides three states:

1. **Loading**: Shows spinner with "Loading documentation..." text
2. **Loaded**: Renders markdown content with proper styling
3. **Error**: Shows error message with path information

## Error Handling

- Network errors are caught and displayed with user-friendly messages
- Missing translations fall back to en-US automatically
- 404 errors show a "Documentation not found" message
- All errors include the document path for debugging

## Integration Guide

To add dynamic documentation to a new page:

1. **Import the modules**:

```rust
use crate::dynamic_docs::DocPage;
use crate::pages::doc_page::DocumentationPage;
```

1. **Create a doc page**:

```rust
DocumentationPage {
    doc_path: "your/doc/path".to_string(),
    language: "en-US".to_string(),
    title: Some("Your Title".to_string()),
}
```

1. **Add markdown files** to `/docs/{lang}/{path}.md`

2. **Update navigation** in `components/mod.rs` if needed

## Future Enhancements

Potential improvements for the future:

1. **Server-Side Rendering**: Pre-render documentation on the server
2. **Search**: Full-text search across documentation
3. **Table of Contents**: Auto-generated from document headers
4. **Code Highlighting**: Syntax highlighting for code blocks
5. **Edit Links**: "Edit this page" links to GitHub
6. **Versioning**: Support for multiple documentation versions
7. **Analytics**: Track documentation page views
8. **Print Styles**: Optimized styles for printing

## Testing

The implementation includes unit tests for:

- URL building functions
- Route configuration validation
- Language support verification

Run tests with:

```bash
cargo test --package website
```

## Browser Support

The implementation uses modern JavaScript features:

- Fetch API
- Async/await
- ES6 template literals
- CSS custom properties

Minimum browser versions:

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
