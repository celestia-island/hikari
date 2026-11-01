// hi-components/src/basic/icon_chip.rs
// IconChip — mirror of the canonical Vue `HkIconChip`: the standard leading
// icon chip (a small rounded square painted in a 10% tint of the tone colour
// with the tone colour as the glyph ink).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkIconChip.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`.
//
//   span.hk-icon-chip.hk-icon-chip-{size}.hk-icon-chip-tone-{tone}
//        aria-hidden="true"
//     {icon at 13px (sm) / 15px (md)}
//
// Purely decorative by contract (aria-hidden); the icon meaning must be
// conveyed by adjacent text. The `tone` palette is the one HkStatCard owns;
// the mirror carries the same five tone names.

use hikari_icons::Icon;
use hikari_icons::MdiIcon;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct IconChipComponent;

/// The tone palette shared with HkStatCard (Vue: `StatTone`, six tones,
/// default `primary`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconChipTone {
    #[default]
    Primary,
    Info,
    Success,
    Warning,
    Error,
    Muted,
}

impl IconChipTone {
    /// The SIX tone classes the canonical sheet defines (verified against
    /// `HkIconChip.scss`: primary/info/success/warning/error/muted).
    pub fn class_name(self) -> &'static str {
        match self {
            IconChipTone::Primary => "hk-icon-chip-tone-primary",
            IconChipTone::Info => "hk-icon-chip-tone-info",
            IconChipTone::Success => "hk-icon-chip-tone-success",
            IconChipTone::Warning => "hk-icon-chip-tone-warning",
            IconChipTone::Error => "hk-icon-chip-tone-error",
            IconChipTone::Muted => "hk-icon-chip-tone-muted",
        }
    }
}

/// The two box sizes (Vue: sm = 24px box / 13px glyph, md = 28px / 15px).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconChipSize {
    Sm,
    #[default]
    Md,
}

impl IconChipSize {
    pub fn class_name(self) -> &'static str {
        match self {
            IconChipSize::Sm => "hk-icon-chip-sm",
            IconChipSize::Md => "hk-icon-chip-md",
        }
    }

    /// The glyph size in px (Vue: 13 for sm, 15 for md).
    pub fn glyph_px(self) -> u32 {
        match self {
            IconChipSize::Sm => 13,
            IconChipSize::Md => 15,
        }
    }
}

#[define_props]
pub struct IconChipProps {
    /// The glyph (Rust: a typed MDI icon — Vue passes a component).
    #[default(MdiIcon::Help)]
    pub icon: MdiIcon,

    #[default]
    pub tone: IconChipTone,

    #[default]
    pub size: IconChipSize,
}

#[component]
pub fn IconChip(props: IconChipProps) -> Element {
    rsx! {
        span {
            class: format!(
                "hk-icon-chip {} {}",
                props.size.class_name(),
                props.tone.class_name()
            ),
            "aria-hidden": "true",
            Icon {
                icon: props.icon,
                size: props.size.glyph_px(),
            }
        }
    }
}

impl StyledComponent for IconChipComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkIconChip.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "icon-chip"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn icon_chip_classes_match_vue() {
        assert_eq!(IconChipSize::Sm.class_name(), "hk-icon-chip-sm");
        assert_eq!(IconChipSize::Md.class_name(), "hk-icon-chip-md");
        assert_eq!(
            IconChipTone::Primary.class_name(),
            "hk-icon-chip-tone-primary"
        );
        assert_eq!(IconChipTone::Error.class_name(), "hk-icon-chip-tone-error");
        assert_eq!(IconChipTone::Muted.class_name(), "hk-icon-chip-tone-muted");
    }

    #[test]
    fn icon_chip_glyph_sizes_match_vue() {
        assert_eq!(IconChipSize::Sm.glyph_px(), 13);
        assert_eq!(IconChipSize::Md.glyph_px(), 15);
    }

    #[test]
    fn icon_chip_defaults_match_the_vue_props() {
        let props = IconChipProps::default();
        assert_eq!(props.tone, IconChipTone::Primary);
        assert_eq!(props.size, IconChipSize::Md);
    }

    #[test]
    fn icon_chip_styles_come_from_the_canonical_vue_sheet() {
        let css = IconChipComponent::styles();
        assert!(
            css.contains(".hk-icon-chip"),
            "icon chip css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored icon chip sheet"
        );
    }
}
