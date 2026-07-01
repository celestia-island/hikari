#[cfg(test)]
mod tests {

    use hikari_components::layout::{
        Align, AsideProps, Col, ColProps, Container, ContainerProps, ContainerSize, Content,
        ContentProps, Direction, Divider, DividerOrientation, DividerProps, DividerType, FlexBox,
        FlexBoxProps, FlexGap, Footer, FooterProps, Grid, GridProps, Header, HeaderProps, Justify,
        Row, RowProps, ScrollbarContainer, ScrollbarContainerProps, Section, SectionProps, Space,
        SpaceDirection, SpaceProps, Spacer, SpacerProps, Wrap,
    };
    use hikari_components::prelude::*;

    // ── Divider ────────────────────────────────────────────────

    #[test]
    fn test_divider_renders() {
        let _ = Divider(DividerProps::default());
    }

    #[test]
    fn test_divider_orientation_variants() {
        assert_eq!(
            DividerOrientation::default(),
            DividerOrientation::Horizontal
        );
        let _ = DividerOrientation::Vertical;
    }

    #[test]
    fn test_divider_type_variants() {
        assert_eq!(DividerType::default(), DividerType::Solid);
        let _ = DividerType::Dashed;
        let _ = DividerType::Dotted;
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
        let _ = Direction::Row;
        let _ = Direction::RowReverse;
        let _ = Direction::ColumnReverse;
    }

    #[test]
    fn test_flexbox_align_variants() {
        assert_eq!(Align::default(), Align::Start);
        let _ = Align::Center;
        let _ = Align::End;
        let _ = Align::Stretch;
        let _ = Align::Baseline;
    }

    #[test]
    fn test_flexbox_justify_variants() {
        assert_eq!(Justify::default(), Justify::Start);
        let _ = Justify::Center;
        let _ = Justify::End;
        let _ = Justify::Between;
        let _ = Justify::Around;
        let _ = Justify::Evenly;
    }

    #[test]
    fn test_flexbox_wrap_variants() {
        assert_eq!(Wrap::default(), Wrap::NoWrap);
        let _ = Wrap::Wrap;
        let _ = Wrap::WrapReverse;
    }

    #[test]
    fn test_flexbox_gap_variants() {
        assert_eq!(FlexGap::default(), FlexGap::None);
        let _ = FlexGap::Gap1;
        let _ = FlexGap::Gap2;
        let _ = FlexGap::Gap3;
        let _ = FlexGap::Gap4;
        let _ = FlexGap::Gap5;
        let _ = FlexGap::Gap6;
        let _ = FlexGap::Gap8;
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
        let _ = SpaceDirection::Vertical;
        let _ = SpaceDirection::Both;
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

    // ── Grid ──────────────────────────────────────────────────

    #[test]
    fn test_grid_renders() {
        let props = GridProps {
            children: Some(VNode::empty()),
            ..Default::default()
        };
        let _ = Grid(props);
    }

    #[test]
    fn test_grid_props_default() {
        let props = GridProps::default();
        assert_eq!(props.columns, 0);
        assert_eq!(props.gap, "");
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_grid_custom_columns() {
        let props = GridProps {
            children: Some(VNode::empty()),
            columns: 6,
            gap: "lg".to_string(),
            class: "my-grid".to_string(),
        };
        assert_eq!(props.columns, 6);
        assert_eq!(props.gap, "lg");
    }

    // ── Col ───────────────────────────────────────────────────

    #[test]
    fn test_col_renders() {
        let props = ColProps {
            children: Some(VNode::empty()),
            ..Default::default()
        };
        let _ = Col(props);
    }

    #[test]
    fn test_col_props_default() {
        let props = ColProps::default();
        assert!(props.span.is_none());
        assert!(props.span_sm.is_none());
        assert!(props.span_md.is_none());
        assert!(props.span_lg.is_none());
        assert!(props.offset.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_col_with_span() {
        let props = ColProps {
            children: Some(VNode::empty()),
            span: Some(6),
            span_sm: Some(12),
            span_md: Some(6),
            span_lg: Some(4),
            offset: Some(2),
            ..Default::default()
        };
        assert_eq!(props.span, Some(6));
        assert_eq!(props.span_sm, Some(12));
        assert_eq!(props.offset, Some(2));
    }

    // ── Row ───────────────────────────────────────────────────

    #[test]
    fn test_row_renders() {
        let props = RowProps {
            children: Some(VNode::empty()),
            ..Default::default()
        };
        let _ = Row(props);
    }

    #[test]
    fn test_row_props_default() {
        let props = RowProps::default();
        assert_eq!(props.gap, "");
        assert!(!props.wrap);
        assert_eq!(props.justify, "");
        assert_eq!(props.align, "");
        assert!(props.rtl.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_row_custom_layout() {
        let props = RowProps {
            children: Some(VNode::empty()),
            gap: "lg".to_string(),
            wrap: false,
            justify: "between".to_string(),
            align: "stretch".to_string(),
            rtl: Some(true),
            class: "my-row".to_string(),
            style: "min-height: 100px;".to_string(),
        };
        assert!(!props.wrap);
        assert_eq!(props.justify, "between");
        assert_eq!(props.rtl, Some(true));
    }

    // ── Section ───────────────────────────────────────────────

    #[test]
    fn test_section_renders() {
        let props = SectionProps {
            children: Some(VNode::empty()),
            ..Default::default()
        };
        let _ = Section(props);
    }

    #[test]
    fn test_section_props_default() {
        let props = SectionProps::default();
        assert!(props.title.is_none());
        assert!(props.description.is_none());
        assert_eq!(props.size, "");
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_section_with_header() {
        let props = SectionProps {
            children: Some(VNode::empty()),
            title: Some(Some("Welcome".to_string())),
            description: Some(Some("A description".to_string())),
            size: "lg".to_string(),
            class: "hero-section".to_string(),
        };
        assert_eq!(props.title.flatten().as_deref(), Some("Welcome"));
        assert_eq!(
            props.description.flatten().as_deref(),
            Some("A description")
        );
        assert_eq!(props.size, "lg");
    }

    // ── Spacer ────────────────────────────────────────────────

    #[test]
    fn test_spacer_renders() {
        let _ = Spacer(SpacerProps::default());
    }

    #[test]
    fn test_spacer_props_default() {
        let props = SpacerProps::default();
        assert_eq!(props.orientation, "");
        assert_eq!(props.size, "");
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_spacer_horizontal() {
        let props = SpacerProps {
            orientation: "horizontal".to_string(),
            size: "xl".to_string(),
            ..Default::default()
        };
        assert_eq!(props.orientation, "horizontal");
        assert_eq!(props.size, "xl");
    }

    // ── Header ────────────────────────────────────────────────

    #[test]
    fn test_header_renders() {
        let props = HeaderProps {
            children: Some(VNode::empty()),
            ..Default::default()
        };
        let _ = Header(props);
    }

    #[test]
    fn test_header_props_default() {
        let props = HeaderProps::default();
        assert!(!props.bordered);
        assert!(!props.show_menu_toggle);
        assert!(props.on_menu_toggle.is_none());
        assert!(props.rtl.is_none());
        assert_eq!(props.class, "");
        assert!(props.right_content.is_none());
    }

    #[test]
    fn test_header_with_toggle() {
        let props = HeaderProps {
            children: Some(VNode::empty()),
            bordered: false,
            show_menu_toggle: true,
            on_menu_toggle: Some(Some(Callback::new(|_| {}))),
            right_content: Some(VNode::empty()),
            ..Default::default()
        };
        assert!(!props.bordered);
        assert!(props.show_menu_toggle);
        assert!(props.on_menu_toggle.is_some());
        assert!(props.right_content.is_some());
    }

    // ── Aside ─────────────────────────────────────────────────

    #[test]
    fn test_aside_props_default() {
        let props = AsideProps::default();
        assert!(props.header.is_none());
        assert!(props.footer.is_none());
        assert_eq!(props.width, "");
        assert_eq!(props.variant, "");
        assert!(!props.collapsible);
        assert!(!props.initial_open);
        assert!(props.rtl.is_none());
        assert!(props.on_close.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_aside_with_options() {
        let props = AsideProps {
            children: Some(VNode::empty()),
            header: Some(Some(VNode::empty())),
            footer: Some(Some(VNode::empty())),
            width: "lg".to_string(),
            variant: "light".to_string(),
            collapsible: false,
            initial_open: true,
            rtl: Some(false),
            class: "sidebar".to_string(),
            ..Default::default()
        };
        assert!(props.header.is_some());
        assert!(props.footer.is_some());
        assert_eq!(props.width, "lg");
        assert!(!props.collapsible);
        assert!(props.initial_open);
    }

    // ── Content ───────────────────────────────────────────────

    #[test]
    fn test_content_renders() {
        let props = ContentProps {
            children: Some(VNode::empty()),
            ..Default::default()
        };
        let _ = Content(props);
    }

    #[test]
    fn test_content_props_default() {
        let props = ContentProps::default();
        assert_eq!(props.background_color, "");
        assert_eq!(props.padding, "");
        assert!(!props.scrollable);
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_content_custom() {
        let props = ContentProps {
            children: Some(VNode::empty()),
            background_color: "#ffffff".to_string(),
            padding: "p-4".to_string(),
            scrollable: false,
            class: "main-content".to_string(),
        };
        assert_eq!(props.background_color, "#ffffff");
        assert!(!props.scrollable);
    }

    // ── ScrollbarContainer ────────────────────────────────────

    #[test]
    fn test_scrollbar_container_renders() {
        let props = ScrollbarContainerProps {
            children: Some(VNode::empty()),
            ..Default::default()
        };
        let _ = ScrollbarContainer(props);
    }

    #[test]
    fn test_scrollbar_container_props_default() {
        let props = ScrollbarContainerProps::default();
        assert_eq!(props.height, "");
        assert_eq!(props.width, "");
        assert_eq!(props.class, "");
    }

    #[test]
    fn test_scrollbar_container_custom_dimensions() {
        let props = ScrollbarContainerProps {
            children: Some(VNode::empty()),
            height: "400px".to_string(),
            width: "auto".to_string(),
            class: "custom-scroll".to_string(),
        };
        assert_eq!(props.height, "400px");
        assert_eq!(props.width, "auto");
    }
}
