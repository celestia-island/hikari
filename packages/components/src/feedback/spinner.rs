// hi-components/src/feedback/spinner.rs
// Spinner — mirror of the Vue `HkSpinner` (the canonical implementation).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSpinner.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-spinner*` class names are literal and identical in both forms. The
// DOM contract below mirrors the Vue render output one-to-one:
//
//   div.hk-spinner-wrapper [.hk-spinner-centered]     (style: min-height var)
//     div.hk-spinner [.hk-spinner-<size>] [.hk-spinner-current]
//                                                   (style: px size override)
//     span.hk-spinner-text                            (optional)
//
// Vue prop mapping: `size: "xs".."xl" | number` becomes [`SpinnerSize`] +
// [`SpinnerProps::size_px`]; `minHeight` becomes
// [`SpinnerProps::min_height`] (the `--hk-loading-min-height` override,
// only meaningful with `center`); `tone` maps to [`SpinnerTone`].
// Replaces the retired legacy `Spin` implementation (`hk-spin-*` classes,
// hand-rolled inline CSS, hardcoded Chinese tips).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SpinnerComponent;

/// The named spinner sizes. Vue's numeric `size` prop (a px override)
/// maps to [`SpinnerProps::size_px`].
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SpinnerSize {
    Xs,
    Sm,
    #[default]
    Md,
    Lg,
    Xl,
}

impl SpinnerSize {
    /// The `hk-spinner-<size>` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            SpinnerSize::Xs => "hk-spinner-xs",
            SpinnerSize::Sm => "hk-spinner-sm",
            SpinnerSize::Md => "hk-spinner-md",
            SpinnerSize::Lg => "hk-spinner-lg",
            SpinnerSize::Xl => "hk-spinner-xl",
        }
    }
}

/// Spinner ink. `Current` colors the track and arc with `currentcolor` so
/// the spinner matches surrounding text (e.g. inside a colored button).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SpinnerTone {
    #[default]
    Primary,
    Current,
}

#[define_props]
pub struct SpinnerProps {
    /// Named size; emits the `hk-spinner-<size>` modifier class.
    #[default]
    pub size: SpinnerSize,

    /// Vue's numeric `size`: a px diameter override emitted as an inline
    /// `width`/`height` style (takes precedence over the named class).
    pub size_px: Option<f64>,

    /// Optional label rendered next to the circle (`hk-spinner-text`).
    pub text: Option<String>,

    /// Center the spinner on both axes inside its container (the shared
    /// loading-state placement contract: column layout, min-height floor).
    #[default]
    pub center: bool,

    /// Ink: theme primary (default) or `currentcolor`.
    #[default]
    pub tone: SpinnerTone,

    /// The `--hk-loading-min-height` override; only meaningful with
    /// `center` (Vue: `minHeight`, string or px number).
    pub min_height: Option<String>,

    #[default]
    pub class: String,

    #[default]
    pub style: String,
}

#[component]
pub fn Spinner(props: SpinnerProps) -> Element {
    let spinner_classes = {
        let mut classes = String::from("hk-spinner");
        if props.size_px.is_none() {
            classes.push(' ');
            classes.push_str(props.size.class_name());
        }
        if props.tone == SpinnerTone::Current {
            classes.push(' ');
            classes.push_str("hk-spinner-current");
        }
        classes
    };

    // Vue: numeric size → inline width/height; named size → class only.
    let spinner_style = match props.size_px {
        Some(px) => format!("width:{px}px;height:{px}px"),
        None => String::new(),
    };

    // Vue: `center` + `minHeight` → the `--hk-loading-min-height` override
    // on the wrapper (the sheet's `min-height` floor reads it with a
    // default, so an unset property is the normal path).
    let wrapper_style = match (&props.min_height, props.center) {
        (Some(height), true) if !height.is_empty() => {
            format!("--hk-loading-min-height:{height}")
        }
        _ => String::new(),
    };

    let wrapper_classes = {
        let mut classes = String::from("hk-spinner-wrapper");
        if props.center {
            classes.push(' ');
            classes.push_str("hk-spinner-centered");
        }
        if !props.class.is_empty() {
            classes.push(' ');
            classes.push_str(&props.class);
        }
        classes
    };

    rsx! {
        div {
            class: wrapper_classes,
            style: if wrapper_style.is_empty() { props.style.clone() } else if props.style.is_empty() { wrapper_style } else { format!("{wrapper_style};{}", props.style) },
            div {
                class: spinner_classes,
                style: spinner_style,
            }
            if let Some(text) = props.text {
                if !text.is_empty() {
                    span { class: "hk-spinner-text",
                        "{text}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for SpinnerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-spinner*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSpinner.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "spinner"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spinner_size_class_names_match_the_vue_modifiers() {
        assert_eq!(SpinnerSize::Xs.class_name(), "hk-spinner-xs");
        assert_eq!(SpinnerSize::Sm.class_name(), "hk-spinner-sm");
        assert_eq!(SpinnerSize::Md.class_name(), "hk-spinner-md");
        assert_eq!(SpinnerSize::Lg.class_name(), "hk-spinner-lg");
        assert_eq!(SpinnerSize::Xl.class_name(), "hk-spinner-xl");
    }

    #[test]
    fn spinner_props_default_matches_the_vue_defaults() {
        let props = SpinnerProps::default();
        assert_eq!(props.size, SpinnerSize::Md);
        assert_eq!(props.size_px, None);
        assert_eq!(props.text, None);
        assert!(!props.center);
        assert_eq!(props.tone, SpinnerTone::Primary);
        assert_eq!(props.min_height, None);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn spinner_styles_come_from_the_canonical_vue_sheet() {
        // The mirror compiles the SAME sheet the Vue build uses; the soft
        // grass-failure marker must never appear (a failed compile silently
        // degrades to a comment otherwise).
        let css = SpinnerComponent::styles();
        assert!(
            css.contains(".hk-spinner-wrapper"),
            "spinner css must carry the vue wrapper class"
        );
        assert!(
            css.contains(".hk-spinner-centered"),
            "spinner css must carry the vue centered class"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored spinner sheet"
        );
        // The retired legacy classes must not leak back in (match the
        // historical `.hk-spin*` names exactly — `.hk-spinner` is the new
        // family and must not trip this check).
        for legacy in [
            ".hk-spin ",
            ".hk-spin.",
            ".hk-spin,",
            ".hk-spin:",
            ".hk-spin-sm",
            ".hk-spin-md",
            ".hk-spin-lg",
            ".hk-spin-stopped",
            ".hk-spin-spinner",
            ".hk-spin-tip",
        ] {
            assert!(
                !css.contains(legacy),
                "legacy .hk-spin classes are retired (found {legacy:?})"
            );
        }
    }
}
