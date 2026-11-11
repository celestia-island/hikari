// packages/components/src/production/code_highlight.rs
// Code highlighting component
//
// NOTE: This component provides a styled code display with line numbers
// and copy functionality. The `language-{lang}` class is added to the code
// element for integration with external syntax highlighters like Prism.js
// or highlight.js. For built-in Rust-based highlighting, consider
// integrating with syntect.
//
// COPY FEEDBACK (user direction 2026-11-11): the copy button's face is
// CONSTANT — it never flips to "Copied"/check. The REAL write result is
// pushed into the crate's own toast store (`feedback::toast` — hosts
// rendering the family ToastComponent see it; without one the click is
// silent, the same contract the Vue HkErrorLanding declares).

use hikari_i18n::t;
use hikari_palette::classes::{ClassesBuilder, CodeHighlightClass};
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use wasm_bindgen::prelude::*;

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
use crate::feedback::toast::use_toast;
use crate::prelude::*;
use crate::styled::StyledComponent;

// Helper function to copy text to clipboard (WASM only). The second
// parameter receives the REAL write result: the async-clipboard promise
// resolves true/false, the execCommand fallback resolves with
// `execCommand`'s own return — so the Rust side can push an HONEST
// toast instead of claiming success for a rejected write.
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
#[wasm_bindgen(inline_js = r#"
export function copyToClipboard(text, onResult) {
    const finish = (success) => {
        if (typeof onResult === 'function') onResult(Boolean(success));
    };
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => finish(true)).catch(() => finish(false));
    } else {
        // Fallback to execCommand
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        finish(success);
        return Promise.resolve(success);
    }
}
"#)]
#[allow(unsafe)]
unsafe extern "C" {
    fn copyToClipboard(text: &str, on_result: &js_sys::Function);
}

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
fn copy_to_clipboard(text: &str, on_result: impl FnOnce(bool) + 'static) {
    // Same idiom `platform::set_timeout` uses: hand the JS side a
    // one-shot closure. `once_into_js` releases it to the JS GC, which
    // owns it until the promise settles and calls it.
    let callback = wasm_bindgen::closure::Closure::once_into_js(on_result);
    let callback = js_sys::Function::from(callback);
    copyToClipboard(text, &callback);
}

pub struct CodeHighlightComponent;

/// NOTE ON THEMING: unlike the Vue-side HkToolBlock (which reads the
/// host theme's --code-* family, see packages/vue/src/tokens.scss), this
/// Rust/WASM component ships self-contained palettes as deliberate
/// content: each `data-palette` selects a full, explicit token set. Hosts
/// that render this component with their own highlight pass can either
/// pick one of these palettes or ignore `data-palette` and style their
/// own `.language-*` classes with the host theme's --code-* tokens —
/// the component never injects palette CSS unless a palette is chosen.
/// Selectable syntax highlighting palettes inspired by popular Neovim colorschemes.
/// Each palette defines CSS variables for syntax token colors.
#[derive(Debug, Clone, PartialEq, Default)]
pub enum CodePalette {
    /// TokyoNight — deep blues, muted purples. Good default for dark themes.
    #[default]
    TokyoNight,
    /// Catppuccin Mocha — warm pastels on a dark base.
    Catppuccin,
    /// Gruvbox — retro groove, earthy oranges and greens.
    Gruvbox,
    /// Nord — arctic, north-bluish color palette.
    Nord,
    /// One Dark (Atom) — balanced, high-contrast.
    OneDark,
    /// GitHub Light — clean, light background.
    GithubLight,
}

impl CodePalette {
    /// The `data-palette` attribute value used to select the CSS variable set.
    pub fn data_attr(&self) -> &'static str {
        match self {
            Self::TokyoNight => "tokyonight",
            Self::Catppuccin => "catppuccin",
            Self::Gruvbox => "gruvbox",
            Self::Nord => "nord",
            Self::OneDark => "onedark",
            Self::GithubLight => "github-light",
        }
    }

    /// CSS variable definitions for this palette. Emitted as a `:root` block
    /// scoped to `[data-palette="<attr>"]`.
    pub fn css_vars(&self) -> &'static str {
        match self {
            // TokyoNight
            Self::TokyoNight => {
                r#"
[data-palette="tokyonight"]{
--code-syntax-comment:#565f89;--code-syntax-string:#9ece6a;--code-syntax-keyword:#bb9af7;
--code-syntax-function:#7aa2f7;--code-syntax-type:#2ac3de;--code-syntax-constant:#ff9e64;
--code-syntax-operator:#89ddff;--code-syntax-punctuation:#c0caf5;--code-syntax-tag:#f7768e;
--code-syntax-attribute:#bb9af7;--code-syntax-number:#ff9e64;--code-syntax-regexp:#b4f9f8;
}"#
            }
            // Catppuccin Mocha
            Self::Catppuccin => {
                r#"
[data-palette="catppuccin"]{
--code-syntax-comment:#6c7086;--code-syntax-string:#a6e3a1;--code-syntax-keyword:#cba6f7;
--code-syntax-function:#89b4fa;--code-syntax-type:#89dceb;--code-syntax-constant:#fab387;
--code-syntax-operator:#94e2d5;--code-syntax-punctuation:#cdd6f4;--code-syntax-tag:#f38ba8;
--code-syntax-attribute:#cba6f7;--code-syntax-number:#fab387;--code-syntax-regexp:#f5c2e7;
}"#
            }
            // Gruvbox
            Self::Gruvbox => {
                r#"
[data-palette="gruvbox"]{
--code-syntax-comment:#928374;--code-syntax-string:#b8bb26;--code-syntax-keyword:#d3869b;
--code-syntax-function:#fabd2f;--code-syntax-type:#83a598;--code-syntax-constant:#fe8019;
--code-syntax-operator:#8ec07c;--code-syntax-punctuation:#ebdbb2;--code-syntax-tag:#fb4934;
--code-syntax-attribute:#d3869b;--code-syntax-number:#d3869b;--code-syntax-regexp:#fe8019;
}"#
            }
            // Nord
            Self::Nord => {
                r#"
[data-palette="nord"]{
--code-syntax-comment:#616e88;--code-syntax-string:#a3be8c;--code-syntax-keyword:#81a1c1;
--code-syntax-function:#88c0d0;--code-syntax-type:#8fbcbb;--code-syntax-constant:#d08770;
--code-syntax-operator:#81a1c1;--code-syntax-punctuation:#e5e9f0;--code-syntax-tag:#bf616a;
--code-syntax-attribute:#b48ead;--code-syntax-number:#b48ead;--code-syntax-regexp:#ebcb8b;
}"#
            }
            // One Dark
            Self::OneDark => {
                r#"
[data-palette="onedark"]{
--code-syntax-comment:#7f848e;--code-syntax-string:#98c379;--code-syntax-keyword:#c678dd;
--code-syntax-function:#61afef;--code-syntax-type:#56b6c2;--code-syntax-constant:#d19a66;
--code-syntax-operator:#56b6c2;--code-syntax-punctuation:#abb2bf;--code-syntax-tag:#e06c75;
--code-syntax-attribute:#d19a66;--code-syntax-number:#d19a66;--code-syntax-regexp:#98c379;
}"#
            }
            // GitHub Light
            Self::GithubLight => {
                r#"
[data-palette="github-light"]{
--code-syntax-comment:#6a737d;--code-syntax-string:#032f62;--code-syntax-keyword:#d73a49;
--code-syntax-function:#6f42c1;--code-syntax-type:#22863a;--code-syntax-constant:#005cc5;
--code-syntax-operator:#d73a49;--code-syntax-punctuation:#24292e;--code-syntax-tag:#22863a;
--code-syntax-attribute:#6f42c1;--code-syntax-number:#005cc5;--code-syntax-regexp:#032f62;
}"#
            }
        }
    }
}

#[define_props]
pub struct CodeHighlightProps {
    #[default("".to_string())]
    pub language: String,

    #[default("".to_string())]
    pub code: String,

    #[default(true)]
    pub line_numbers: bool,

    #[default(true)]
    pub copyable: bool,

    /// Syntax highlighting palette. See [`CodePalette`].
    #[default(CodePalette::TokyoNight)]
    pub palette: CodePalette,

    pub max_height: Option<String>,

    #[default("".to_string())]
    pub class: String,

    #[default("".to_string())]
    pub style: String,
}

#[component]
pub fn CodeHighlight(props: CodeHighlightProps) -> Element {
    let lines: Vec<&str> = props.code.lines().collect();
    let line_count = lines.len();

    let container_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::Container)
        .add_raw(&props.class)
        .build();

    let header_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::Header)
        .build();

    let language_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::Language)
        .build();

    let copy_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::CopyButton)
        .build();

    let code_classes = ClassesBuilder::new().add(CodeHighlightClass::Code).build();

    let line_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::LineNumbers)
        .build();

    let content_classes = ClassesBuilder::new()
        .add(CodeHighlightClass::Content)
        .build();

    let max_height_style = if let Some(ref height) = props.max_height {
        format!("max-height: {}; overflow-y: auto; {}", height, props.style)
    } else {
        props.style.clone()
    };

    let code_for_copy = props.code.clone();
    let code = props.code.clone();
    let language = props.language.clone();

    // The copy control's face is CONSTANT (user direction 2026-11-11: a
    // copy control's text never flips to "Copied"). The click pushes the
    // REAL write result into the crate's own toast store (see
    // `feedback::toast`) — hosts rendering the family ToastComponent see
    // it; hosts without one hear nothing, the same contract the Vue
    // HkErrorLanding declares. No copied signal, no flipped classes, no
    // reset timer.

    let button_class = copy_classes;

    let button_text = t("hikari.code.copy", "Copy");

    let language_class = format!("language-{}", language);

    // Pre-compute line number elements outside rsx! using VElement builder
    let line_number_nodes: Vec<VNode> = (1..=line_count)
        .map(|i| {
            VNode::Element(Box::new(
                VElement::new("div")
                    .class("hk-code-highlight-line-number")
                    .child(VNode::Text(VText::new(&i.to_string()))),
            ))
        })
        .collect();

    rsx! {
        div {
            class: container_classes,
            "data-palette": props.palette.data_attr(),

            div {
                class: header_classes,

                div {
                    class: language_classes,
                    language
                }

                if props.copyable {
                    button {
                        class: button_class,
                        onclick: {
                            let code_for_copy = code_for_copy.clone();
                            move |_| {
                                #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
                                {
                                    // The REAL write result lands in the
                                    // callback (the promise settles after
                                    // this handler returns); the button
                                    // itself never mutates.
                                    let code_for_copy = code_for_copy.clone();
                                    copy_to_clipboard(&code_for_copy, move |ok| {
                                        let store = use_toast();
                                        if ok {
                                            store.success(&t("hikari.code.copyOk", "Copied"));
                                        } else {
                                            store.error(&t("hikari.code.copyFailed", "Copy failed"));
                                        }
                                    });
                                }
                                #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
                                {
                                    // Server renders never fire clicks; keep
                                    // the branch an explicit no-op.
                                    let _ = code_for_copy;
                                }
                            }
                        },
                        button_text
                    }
                }
            }

            div {
                class: content_classes,
                style: max_height_style,

                if props.line_numbers {
                    div {
                        class: line_classes,
                        ..line_number_nodes
                    }
                }

                pre {
                    class: code_classes,
                    code {
                        class: language_class,
                        code
                    }
                }
            }
        }
    }
}

impl StyledComponent for CodeHighlightComponent {
    fn styles() -> &'static str {
        r#"
.hk-code-highlight {
    background-color: var(--hi-color-bg-container, #ffffff);
    border: 1px solid var(--hi-color-border, #e2e8f0);
    border-radius: var(--radius-md, 8px);
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.hk-code-highlight-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--hi-color-bg-elevated, #f6f8fa);
    border-bottom: 1px solid var(--hi-color-border, #e2e8f0);
}

.hk-code-highlight-language {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--hi-color-primary, #3b82f6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.hk-code-highlight-copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    background-color: transparent;
    border: 1px solid var(--hi-color-border, #e2e8f0);
    border-radius: var(--radius-sm, 4px);
    color: var(--hi-color-text-secondary, #64748b);
    cursor: pointer;
    transition: all 0.2s ease;
}

.hk-code-highlight-copy svg {
    display: block;
}

.hk-code-highlight-copy:hover {
    background-color: var(--hi-color-primary, #3b82f6);
    color: var(--hi-color-text-on-solid, #ffffff);
    border-color: var(--hi-color-primary, #3b82f6);
    box-shadow: 0 0 8px var(--hi-color-primary-glow, rgba(127, 127, 127, 0.35));
}

/* Icon-only copy buttons (host-composed face extensions; the component's
   own button is a text button and never swaps its face on copy). */
.hk-code-highlight-copy-icon {
    display: inline-flex;
}

.hk-code-highlight-content {
    display: flex;
    background-color: var(--hi-color-bg-container, #ffffff);
}

.hk-code-highlight-line-numbers {
    flex-shrink: 0;
    padding: 1rem 0.5rem;
    background-color: var(--hi-color-bg-elevated, #f6f8fa);
    border-right: 1px solid var(--hi-color-border, #e2e8f0);
    text-align: right;
    user-select: none;
}

.hk-code-highlight-line-number {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--hi-color-text-tertiary, #94a3b8);
}

/* margin: 0 — the UA `pre { margin-block: 1em }` otherwise pushes the code
   column half a line below the line-number gutter in the flex row.
   font metrics must also be pinned here, not only on `code`: the pre's own
   strut (inherited family/size/line-height, e.g. body sans at 1.65) both
   stretches every line box and shifts its baseline, drifting code away
   from the gutter numbers. */
.hk-code-highlight-code {
    flex: 1;
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
    background-color: transparent;
    border: none;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
}

.hk-code-highlight-code code {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--hi-color-text-primary, #1f2328);
}

/* Syntax highlighting — palette-driven CSS variables.
   Each palette (TokyoNight, Catppuccin, Gruvbox, Nord, OneDark, GitHub Light)
   defines its own set of --code-syntax-* variables via [data-palette="..."].
   Users can override any variable or add custom palettes in their site CSS. */

/* Default palette: TokyoNight (applies when no data-palette is set) */
:root {
--code-syntax-comment:#565f89;--code-syntax-string:#9ece6a;--code-syntax-keyword:#bb9af7;
--code-syntax-function:#7aa2f7;--code-syntax-type:#2ac3de;--code-syntax-constant:#ff9e64;
--code-syntax-operator:#89ddff;--code-syntax-punctuation:#c0caf5;--code-syntax-tag:#f7768e;
--code-syntax-attribute:#bb9af7;--code-syntax-number:#ff9e64;--code-syntax-regexp:#b4f9f8;
}

/* Palette definitions */
[data-palette="tokyonight"]{
--code-syntax-comment:#565f89;--code-syntax-string:#9ece6a;--code-syntax-keyword:#bb9af7;
--code-syntax-function:#7aa2f7;--code-syntax-type:#2ac3de;--code-syntax-constant:#ff9e64;
--code-syntax-operator:#89ddff;--code-syntax-punctuation:#c0caf5;--code-syntax-tag:#f7768e;
--code-syntax-attribute:#bb9af7;--code-syntax-number:#ff9e64;--code-syntax-regexp:#b4f9f8;
}
[data-palette="catppuccin"]{
--code-syntax-comment:#6c7086;--code-syntax-string:#a6e3a1;--code-syntax-keyword:#cba6f7;
--code-syntax-function:#89b4fa;--code-syntax-type:#89dceb;--code-syntax-constant:#fab387;
--code-syntax-operator:#94e2d5;--code-syntax-punctuation:#cdd6f4;--code-syntax-tag:#f38ba8;
--code-syntax-attribute:#cba6f7;--code-syntax-number:#fab387;--code-syntax-regexp:#f5c2e7;
}
[data-palette="gruvbox"]{
--code-syntax-comment:#928374;--code-syntax-string:#b8bb26;--code-syntax-keyword:#d3869b;
--code-syntax-function:#fabd2f;--code-syntax-type:#83a598;--code-syntax-constant:#fe8019;
--code-syntax-operator:#8ec07c;--code-syntax-punctuation:#ebdbb2;--code-syntax-tag:#fb4934;
--code-syntax-attribute:#d3869b;--code-syntax-number:#d3869b;--code-syntax-regexp:#fe8019;
}
[data-palette="nord"]{
--code-syntax-comment:#616e88;--code-syntax-string:#a3be8c;--code-syntax-keyword:#81a1c1;
--code-syntax-function:#88c0d0;--code-syntax-type:#8fbcbb;--code-syntax-constant:#d08770;
--code-syntax-operator:#81a1c1;--code-syntax-punctuation:#e5e9f0;--code-syntax-tag:#bf616a;
--code-syntax-attribute:#b48ead;--code-syntax-number:#b48ead;--code-syntax-regexp:#ebcb8b;
}
[data-palette="onedark"]{
--code-syntax-comment:#7f848e;--code-syntax-string:#98c379;--code-syntax-keyword:#c678dd;
--code-syntax-function:#61afef;--code-syntax-type:#56b6c2;--code-syntax-constant:#d19a66;
--code-syntax-operator:#56b6c2;--code-syntax-punctuation:#abb2bf;--code-syntax-tag:#e06c75;
--code-syntax-attribute:#d19a66;--code-syntax-number:#d19a66;--code-syntax-regexp:#98c379;
}
[data-palette="github-light"]{
--code-syntax-comment:#6a737d;--code-syntax-string:#032f62;--code-syntax-keyword:#d73a49;
--code-syntax-function:#6f42c1;--code-syntax-type:#22863a;--code-syntax-constant:#005cc5;
--code-syntax-operator:#d73a49;--code-syntax-punctuation:#24292e;--code-syntax-tag:#22863a;
--code-syntax-attribute:#6f42c1;--code-syntax-number:#005cc5;--code-syntax-regexp:#032f62;
}

/* Syntax token → CSS variable mapping.
   Works with both Prism.js (.token-*) and syntect (.comment, .keyword, etc.)
   token class names. */
.token-comment, .token-prolog, .token-doctype, .token-cdata,
.comment {
    color: var(--code-syntax-comment);
    font-style: italic;
}

.token-punctuation, .punctuation {
    color: var(--code-syntax-punctuation);
}

.token-property, .token-tag, .token.boolean, .token.number,
.token.constant, .token.symbol,
.tag, .number, .numeric, .constant {
    color: var(--code-syntax-constant);
}

.token-selector, .token.attr-name, .token.string, .token.char,
.token.builtin, .token.inserted,
.string {
    color: var(--code-syntax-string);
}

.token-operator, .token-entity, .token.url,
.language-css .token.string, .style .token.string,
.operator {
    color: var(--code-syntax-operator);
}

.token-atrule, .token.attr-value, .token.keyword,
.keyword, .storage, .annotation {
    color: var(--code-syntax-keyword);
}

.token-function, .token.class-name,
.function {
    color: var(--code-syntax-function);
}

.token-regex, .token.important, .token.variable,
.entity, .type {
    color: var(--code-syntax-type);
}

.token-attribute-name, .attribute-name, .property {
    color: var(--code-syntax-attribute);
}

.token-deleted {
    color: var(--code-syntax-tag);
}

.support, .meta, .variable {
    color: var(--code-syntax-function);
}

.label {
    color: var(--code-syntax-constant);
}
"#
    }

    fn name() -> &'static str {
        "code-highlight"
    }
}
