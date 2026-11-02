// hi-components/src/feedback/loading_veil.rs
// LoadingVeil — mirror of the canonical Vue `HkLoadingVeil`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkLoadingVeil.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-loading-veil*` class names are literal and identical in both forms.
// DOM contract (mirrors Vue exactly):
//
//   div.hk-loading-veil  role="status" aria-live="polite"
//                        aria-label="{label or 'loading'}"
//     div.hk-loading-veil-body
//       span.hk-loading-veil-spinner   aria-hidden="true"
//       p.hk-loading-veil-label        (only when `label` is non-empty)
//
// Behaviour delta vs Vue (documented): the Vue comment says "fades out on
// false (150 ms)" but the implementation returns `null` immediately when
// `active` turns false (the fade-out is purely the CSS enter animation).
// This mirror follows the IMPLEMENTATION: the root is unmounted when
// `active` is false. It is NOT a modal: no scroll lock, no focus trap, no
// Esc close; `pointer-events: all` on the root swallows interaction.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct LoadingVeilComponent;

#[define_props]
pub struct LoadingVeilProps {
    /// Paint + block while true. Unmounts (like Vue) when false.
    #[default]
    pub active: bool,

    /// One-line label under the spinner (already localized by the caller).
    #[default]
    pub label: String,
}

#[component]
pub fn LoadingVeil(props: LoadingVeilProps) -> Element {
    if !props.active {
        // Vue returns null (unmounts) when inactive.
        return empty_vnode();
    }

    // Vue: `aria-label={props.label || "loading"}`.
    let aria_label = if props.label.is_empty() {
        "loading".to_string()
    } else {
        props.label.clone()
    };

    rsx! {
        div {
            class: "hk-loading-veil",
            "role": "status",
            "aria-live": "polite",
            "aria-label": aria_label,
            div { class: "hk-loading-veil-body",
                span {
                    class: "hk-loading-veil-spinner",
                    "aria-hidden": "true",
                }
                if !props.label.is_empty() {
                    p { class: "hk-loading-veil-label",
                        "{props.label}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for LoadingVeilComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-loading-veil*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkLoadingVeil.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "loading-veil"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loading_veil_defaults_match_the_vue_props() {
        let props = LoadingVeilProps::default();
        assert!(!props.active);
        assert_eq!(props.label, "");
    }

    #[test]
    fn loading_veil_styles_come_from_the_canonical_vue_sheet() {
        let css = LoadingVeilComponent::styles();
        assert!(
            css.contains(".hk-loading-veil") && css.contains(".hk-loading-veil-spinner"),
            "loading veil css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored loading veil sheet"
        );
    }
}
