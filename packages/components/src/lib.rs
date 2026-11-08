//! # Hikari Components Library
//!
//! Core UI components for the Hikari design system — layout, forms, data
//! display, feedback, and navigation.
//!
//! Built on the Tairitsu framework; the same design system also ships as the
//! Vue 3 package `@celestia-island/hikari`.

// Core modules
// rsx children are written `{expr}` by grammar; the macro expands them into
// call arguments, so rustc's `unused_braces` misfires on the source spans.
#![allow(unused_braces)]
// Rust
// rsx component blocks spell `field: value` with the same binding name (they mirror
// Vue's prop names); clippy flags each one after macro expansion.
#![allow(clippy::redundant_field_names)]

pub mod auth;
pub mod basic;
pub mod data;
pub mod display;
pub mod entry;
pub mod feedback;
pub mod hooks;
pub mod layout;
pub mod navigation;
pub mod overlay;
pub mod platform;
pub mod portal;
pub mod production;
pub mod scene;
#[cfg(target_arch = "wasm32")]
pub mod scripts;
pub mod style_builder;
pub mod styled;
pub mod utils;

// Prelude module
pub mod prelude;

// Re-export StyledComponent and StyleRegistry
// Re-exports
pub use auth::*;
pub use basic::*;
pub use data::*;
pub use display::*;
pub use entry::*;
pub use feedback::*;
pub use layout::*;
pub use navigation::*;
pub use overlay::*;
pub use production::*;
pub use scene::*;
pub use styled::{StyleRegistry, StyledComponent};

// Theme system
pub mod theme;
// Portal system
pub use portal::{
    PortalEntry, PortalMaskMode, PortalPositionStrategy, PortalProvider, TriggerPlacement,
    generate_portal_id, use_portal,
};
pub use tairitsu_hooks::{
    AnimationConfig, AnimationDirection, AnimationState, Context, EasingFunction, UseRef,
    consume_context, provide_context, use_animation, use_context, use_effect, use_ref, use_signal,
    use_simple_animation, use_state,
};
pub use tairitsu_macros::{component, rsx};
// Re-export tairitsu prelude for convenience
pub use tairitsu_vdom::{
    ChangeEvent, Classes, ElementHandle, EventData, EventHandle, FocusEvent, InputEvent,
    KeyboardEvent, MouseEvent, Platform, Signal, Style, VElement, VNode, VText, batch,
    create_effect,
};
pub use theme::{
    ComponentOverrides, ComponentPalette, IntoThemeName, LayoutDirection, ThemeContext,
    ThemePalette, ThemeProvider, get_default_theme, get_registered_theme, prefers_dark_mode,
    register_theme, use_layout_direction, use_theme,
};

/// Test-only helpers shared by the compiled-stylesheet guards.
#[cfg(test)]
pub(crate) mod test_css {
    /// Compiled CSS with `/* … */` block comments removed.
    ///
    /// [`StyledComponent::styles`](crate::StyledComponent::styles) returns
    /// grass's EXPANDED output, and grass only drops block comments in
    /// compressed mode (`grass_compiler::options` defaults to
    /// `OutputStyle::Expanded`) — so every `/* … */` in a mirrored sheet
    /// reaches the caller, prose included. Because those sheets also quote
    /// their own declarations in that prose (the checkbox sheet writes
    /// `` `align-self: flex-start` `` in one), a needle checked against the
    /// raw string can be satisfied by a sentence instead of a rule: on the first
    /// review of this guard `align-self: flex-start` appeared TWICE in the
    /// compiled sheet, once as code and once as a comment, and deleting the
    /// declaration left the needle green. Structural needles are matched
    /// against this stripped string, where a declaration or a selector is what
    /// satisfies them.
    ///
    /// Not a general CSS parser, and two shapes sit outside what a text strip
    /// can decide:
    ///
    /// * a `/*` inside a string literal (for example `content: "/*"`) is
    ///   stripped as if it opened a comment — no sheet in this crate does it;
    /// * grass runs interpolation inside comments, so a LOUD comment can emit
    ///   a marker (`/* probe #{"*" + "/"} align-self: flex-start */` reaches
    ///   the caller as `/* probe */ align-self: flex-start */`). The strip then
    ///   ends at the injected marker and reads the rest as CSS, which let a
    ///   deleted declaration keep the needle green in review.
    ///
    /// The second is caught instead of documented: the strip asserts that no
    /// marker survives, so unbalanced input panics rather than handing prose to
    /// a needle (the emitted CSS is already corrupt, so nothing ships through
    /// it). Balanced input is unaffected.
    pub(crate) fn without_comments(css: &str) -> String {
        let mut out = String::with_capacity(css.len());
        let mut rest = css;
        while let Some(start) = rest.find("/*") {
            out.push_str(&rest[..start]);
            match rest[start + 2..].find("*/") {
                Some(end) => rest = &rest[start + 2 + end + 2..],
                // Unterminated: the rest is comment, drop it.
                None => return out,
            }
        }
        out.push_str(rest);
        // A marker that survives means the input was NOT balanced, and the
        // text-level strip cannot tell an injected one from a real one: grass
        // interpolates inside comments, so `/* #{…} */` can hand this function
        // a `*/` of its own. Callers turn the result into needles, so prose
        // would be read as CSS; panicking is the only honest outcome here.
        assert!(
            !out.contains("/*") && !out.contains("*/"),
            "compiled css has unbalanced comment markers after stripping — a Sass              interpolation inside a comment most likely emitted one"
        );
        out
    }

    #[test]
    fn without_comments_rejects_a_comment_that_emits_a_marker() {
        // The exact shape a loud comment hands the stripper: grass runs
        // interpolation inside comments, so the injected `*/` closes the strip
        // early and the tail arrives as prose. Balanced sheets never produce
        // this; corrupt output must panic instead of satisfying a needle.
        let emitted = "/* probe */ align-self: flex-start */\n.a { align-self: center; }";
        assert!(
            emitted.matches("*/").count() > emitted.matches("/*").count(),
            "the fixture is supposed to be unbalanced"
        );
        assert!(
            std::panic::catch_unwind(|| without_comments(emitted)).is_err(),
            "unbalanced comment markers must not be stripped silently"
        );
    }

    #[test]
    fn without_comments_drops_block_comments_only() {
        assert_eq!(without_comments("a/*b*/c"), "ac");
        assert_eq!(without_comments("/*x*/"), "");
        assert_eq!(without_comments("a/*b"), "a");
        assert_eq!(without_comments("a{color:red}"), "a{color:red}");
        // The shape this helper exists for: a declaration quoted in prose must
        // stop satisfying a needle that the real declaration satisfies.
        let sheet = "/* ride it: `align-self: flex-start` */\n.a { align-self: flex-start; }";
        assert_eq!(sheet.matches("align-self: flex-start").count(), 2);
        assert_eq!(
            without_comments(sheet)
                .matches("align-self: flex-start")
                .count(),
            1
        );
    }
}
