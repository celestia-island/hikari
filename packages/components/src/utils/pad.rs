// hi-components/src/utils/pad.rs
// The shared container-padding scale — mirror of the Vue
// `runtime/containerPad` contract (`packages/vue/src/runtime/containerPad.ts`).
//
//   1. TOKEN — every container's padding rule reads
//      `padding: var(--hk-pad, <its legacy default>)`. Setting the custom
//      property on the element retunes that container's content padding
//      without touching its stylesheet; leaving it unset preserves the
//      component's historical look byte-for-byte.
//   2. PROP — `padding?: HkPad` maps the named step onto the token via
//      [`hk_pad_style`] (one inline custom property).

/// The named padding steps every container's `padding` prop accepts.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum HkPad {
    None,
    Xs,
    Sm,
    #[default]
    Md,
    Lg,
}

/// The custom property the container padding rules consume. Hosts and
/// themes may also set it directly (per instance or per subtree).
pub const HK_PAD_VAR: &str = "--hk-pad";

impl HkPad {
    /// Step → the spacing-scale value handed to the token (the house
    /// spacing scale `--space-*`, vendored in `styles/vue-mirror/scale.scss`).
    pub fn token_value(self) -> &'static str {
        match self {
            HkPad::None => "0",
            HkPad::Xs => "var(--space-4, 0.25rem)",
            HkPad::Sm => "var(--space-8, 0.5rem)",
            HkPad::Md => "var(--space-12, 0.75rem)",
            HkPad::Lg => "var(--space-16, 1rem)",
        }
    }
}

/// The inline style carrying the token for one `padding` prop value — an
/// empty string when the prop is unset (the component keeps its legacy
/// default). Call sites concatenate it into their existing style string.
pub fn hk_pad_style(pad: Option<HkPad>) -> String {
    match pad {
        Some(pad) => format!("{}:{}", HK_PAD_VAR, pad.token_value()),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hk_pad_style_maps_each_named_step() {
        assert_eq!(hk_pad_style(Some(HkPad::None)), "--hk-pad:0");
        assert_eq!(hk_pad_style(Some(HkPad::Xs)), "--hk-pad:var(--space-4, 0.25rem)");
        assert_eq!(hk_pad_style(Some(HkPad::Sm)), "--hk-pad:var(--space-8, 0.5rem)");
        assert_eq!(hk_pad_style(Some(HkPad::Md)), "--hk-pad:var(--space-12, 0.75rem)");
        assert_eq!(hk_pad_style(Some(HkPad::Lg)), "--hk-pad:var(--space-16, 1rem)");
    }

    #[test]
    fn hk_pad_style_is_empty_when_unset() {
        assert_eq!(hk_pad_style(None), "");
    }
}
