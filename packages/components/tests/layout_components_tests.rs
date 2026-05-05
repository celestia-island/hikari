#[cfg(test)]
mod tests {
    use hikari_components::prelude::*;
    use hikari_components::layout::{
        Divider, DividerProps, DividerOrientation, DividerType,
        FlexBox, FlexBoxProps, Direction, Align, Justify, Wrap, FlexGap,
        Space, SpaceProps, SpaceDirection,
        Footer, FooterProps,
        Container, ContainerProps, ContainerSize,
    };

    // ── Divider ────────────────────────────────────────────────

    #[test]
    fn test_divider_renders() {
        let _ = Divider(DividerProps::default());
    }

    #[test]
    fn test_divider_orientation_variants() {
        assert_eq!(DividerOrientation::default(), DividerOrientation::Horizontal);
        let _vertical = DividerOrientation::Vertical;
    }

    #[test]
    fn test_divider_type_variants() {
        assert_eq!(DividerType::default(), DividerType::Solid);
        let _dashed = DividerType::Dashed;
        let _dotted = DividerType::Dotted;
    }

    #[test]
    fn test_divider_props_default() {
        let props = DividerProps::default();
        assert!(props.text.is_none());
        assert_eq!(props.orientation, DividerOrientation::Horizontal);
        assert_eq!(props.divider_type, DividerType::Solid);
        assert_eq!(props.text_align, "center");
        assert!(props.rtl.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_divider_with_text() {
        let props = DividerProps {
            text: Some("or".to_string()),
            orientation: DividerOrientation::Horizontal,
            divider_type: DividerType::Dashed,
            text_align: "left".to_string(),
            ..Default::default()
        };
        assert_eq!(props.text.as_deref().unwrap(), "or");
        assert_eq!(props.divider_type, DividerType::Dashed);
    }

    // ── FlexBox ───────────────────────────────────────────────

    #[test]
    fn test_flexbox_renders() {
        let props = FlexBoxProps {
            children: VNode::empty(),
            ..Default::default()
        };
        let _ = FlexBox(props);
    }

    #[test]
    fn test_flexbox_direction_variants() {
        assert_eq!(Direction::default(), Direction::Column);
        let _row = Direction::Row;
        let _row_rev = Direction::RowReverse;
        let _col_rev = Direction::ColumnReverse;
    }

    #[test]
    fn test_flexbox_align_variants() {
        assert_eq!(Align::default(), Align::Start);
        let _center = Align::Center;
        let _end = Align::End;
        let _stretch = Align::Stretch;
        let _baseline = Align::Baseline;
    }

    #[test]
    fn test_flexbox_justify_variants() {
        assert_eq!(Justify::default(), Justify::Start);
        let _center = Justify::Center;
        let _end = Justify::End;
        let _between = Justify::Between;
        let _around = Justify::Around;
        let _evenly = Justify::Evenly;
    }

    #[test]
    fn test_flexbox_wrap_variants() {
        assert_eq!(Wrap::default(), Wrap::NoWrap);
        let _wrap = Wrap::Wrap;
        let _wrap_rev = Wrap::WrapReverse;
    }

    #[test]
    fn test_flexbox_gap_variants() {
        assert_eq!(FlexGap::default(), FlexGap::None);
        let _gap1 = FlexGap::Gap1;
        let _gap2 = FlexGap::Gap2;
        let _gap3 = FlexGap::Gap3;
        let _gap4 = FlexGap::Gap4;
        let _gap5 = FlexGap::Gap5;
        let _gap6 = FlexGap::Gap6;
        let _gap8 = FlexGap::Gap8;
    }

    #[test]
    fn test_flexbox_props_default() {
        let props = FlexBoxProps::default();
        assert_eq!(props.direction, Direction::Column);
        assert_eq!(props.align, Align::Start);
        assert_eq!(props.justify, Justify::Start);
        assert_eq!(props.wrap, Wrap::NoWrap);
        assert_eq!(props.gap, FlexGap::None);
        assert!(props.flex);
        assert!(props.min_width.is_none());
        assert!(props.min_height.is_none());
        assert!(props.max_width.is_none());
        assert!(props.max_height.is_none());
        assert!(!props.inline);
        assert!(props.rtl.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_flexbox_row_layout() {
        let props = FlexBoxProps {
            direction: Direction::Row,
            align: Align::Center,
            justify: Justify::Between,
            wrap: Wrap::Wrap,
            gap: FlexGap::Gap4,
            inline: true,
            min_width: Some("200px".to_string()),
            max_width: Some("800px".to_string()),
            ..Default::default()
        };
        assert_eq!(props.direction, Direction::Row);
        assert_eq!(props.align, Align::Center);
        assert!(props.inline);
    }

    // ── Space ─────────────────────────────────────────────────

    #[test]
    fn test_space_renders() {
        let props = SpaceProps {
            children: VNode::empty(),
            ..Default::default()
        };
        let _ = Space(props);
    }

    #[test]
    fn test_space_direction_variants() {
        assert_eq!(SpaceDirection::default(), SpaceDirection::Horizontal);
        let _vertical = SpaceDirection::Vertical;
        let _both = SpaceDirection::Both;
    }

    #[test]
    fn test_space_props_default() {
        let props = SpaceProps::default();
        assert_eq!(props.size, 1);
        assert_eq!(props.direction, SpaceDirection::Horizontal);
        assert!(!props.wrap);
        assert_eq!(props.class, "");
    }

    // ── Footer ────────────────────────────────────────────────

    #[test]
    fn test_footer_renders() {
        let _ = Footer(FooterProps::default());
    }

    #[test]
    fn test_footer_props_default() {
        let props = FooterProps::default();
        assert_eq!(props.class, "");
    }

    // ── Container ────────────────────────────────────────────

    #[test]
    fn test_container_renders() {
        let _ = Container(ContainerProps::default());
    }

    #[test]
    fn test_container_size_variants() {
        assert_eq!(ContainerSize::default(), ContainerSize::Medium);
        assert_eq!(ContainerSize::Small.max_width(), "640px");
        assert_eq!(ContainerSize::Medium.max_width(), "960px");
        assert_eq!(ContainerSize::Large.max_width(), "1200px");
        assert_eq!(ContainerSize::Xl.max_width(), "1400px");
    }

    #[test]
    fn test_container_props_default() {
        let props = ContainerProps::default();
        assert_eq!(props.size, ContainerSize::Medium);
        assert!(props.max_width.is_none());
        assert!(!props.center);
        assert!(props.rtl.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_container_centered() {
        let props = ContainerProps {
            size: ContainerSize::Large,
            max_width: Some("1000px".to_string()),
            center: true,
            ..Default::default()
        };
        assert_eq!(props.size, ContainerSize::Large);
        assert!(props.center);
    }
}
