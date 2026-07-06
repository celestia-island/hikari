// Verifies the build-script-generated `color!` macro: zero-cost compile-time
// resolution across all enabled collections, with a clear error on unknown
// names.
//
// Active whenever at least one collection is enabled (i.e. the macro exists).
#![cfg(any(hikari_collection_chinese, hikari_collection_tailwind))]

use hikari_palette::{Color, color};

#[test]
fn test_color_macro_resolves_tailwind() {
    // Equivalent to hikari_palette::collections::tailwind::red_500.
    let c: Color = color!("red_500");
    assert_eq!(c.hex(), "#EF4444");
    assert_eq!(c.name(), Some("red_500"));
}

#[test]
fn test_color_macro_resolves_chinese() {
    let c: Color = color!("粉红");
    assert_eq!(c.hex(), "#FFB3A7");
    assert_eq!(c.name(), Some("粉红"));
}

#[test]
fn test_color_macro_is_zero_cost_constant() {
    // color!("...") must expand to a `pub const`, so it's usable in a const
    // context — proving there's no runtime resolution cost.
    const RESOLVED: Color = color!("blue_500");
    assert_eq!(RESOLVED.hex(), "#3B82F6");
}

// The unknown-name fallback emits a compile_error!, so we cannot call it here.
// Verified manually: `color!("nonexistent")` fails to compile with a message
// pointing at the literal.
