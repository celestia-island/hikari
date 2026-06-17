#[derive(Clone, Copy, PartialEq, Debug, Default)]
#[non_exhaustive]
pub enum PopoverPlacement {
    #[default]
    Bottom,
    Top,
    Left,
    Right,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
#[non_exhaustive]
pub enum ModalPosition {
    #[default]
    Center,
    TopLeft,
    Top,
    TopRight,
    Right,
    BottomRight,
    Bottom,
    BottomLeft,
    Left,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
#[non_exhaustive]
pub enum MaskMode {
    #[default]
    Opaque,
    Transparent,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
#[non_exhaustive]
pub enum ModalSize {
    #[default]
    Md,
    Sm,
    Lg,
    Xl,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_modal_position_default() {
        assert_eq!(ModalPosition::default(), ModalPosition::Center);
    }

    #[test]
    fn test_modal_position_variants() {
        let all = [
            ModalPosition::Center,
            ModalPosition::TopLeft,
            ModalPosition::Top,
            ModalPosition::TopRight,
            ModalPosition::Right,
            ModalPosition::BottomRight,
            ModalPosition::Bottom,
            ModalPosition::BottomLeft,
            ModalPosition::Left,
        ];
        for i in 0..all.len() {
            for j in (i + 1)..all.len() {
                assert_ne!(all[i], all[j], "variants must be distinct");
            }
        }
    }

    #[test]
    fn test_modal_size_default() {
        assert_eq!(ModalSize::default(), ModalSize::Md);
    }

    #[test]
    fn test_modal_size_variants() {
        assert_ne!(ModalSize::Sm, ModalSize::Md);
        assert_ne!(ModalSize::Md, ModalSize::Lg);
        assert_ne!(ModalSize::Lg, ModalSize::Xl);
    }

    #[test]
    fn test_popover_placement_default() {
        assert_eq!(PopoverPlacement::default(), PopoverPlacement::Bottom);
    }

    #[test]
    fn test_popover_placement_variants() {
        assert_ne!(PopoverPlacement::Top, PopoverPlacement::Bottom);
        assert_ne!(PopoverPlacement::Left, PopoverPlacement::Right);
    }

    #[test]
    fn test_mask_mode_default() {
        assert_eq!(MaskMode::default(), MaskMode::Opaque);
    }

    #[test]
    fn test_mask_mode_variants() {
        assert_ne!(MaskMode::Opaque, MaskMode::Transparent);
    }
}
