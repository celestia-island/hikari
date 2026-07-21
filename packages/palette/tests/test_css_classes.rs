use hikari_palette::UtilityClass;
use hikari_palette::classes::*;

fn assert_all_non_empty(variants: &[String]) {
    for v in variants {
        assert!(!v.is_empty(), "Class name should not be empty");
        assert!(v.starts_with("hk-"), "Class '{v}' should start with 'hi-'");
    }
}

#[test]
fn test_display_class_names() {
    let names = vec![
        Display::Hidden.as_class(),
        Display::Block.as_class(),
        Display::InlineBlock.as_class(),
        Display::Flex.as_class(),
        Display::InlineFlex.as_class(),
        Display::Grid.as_class(),
        Display::InlineGrid.as_class(),
    ];
    assert_all_non_empty(&names);
    assert_eq!(Display::Flex.as_class(), "hk-flex");
    assert_eq!(Display::Hidden.as_class(), "hk-hidden");
}

#[test]
fn test_flex_direction_class_names() {
    assert_eq!(FlexDirection::Row.as_class(), "hk-flex-row");
    assert_eq!(FlexDirection::Column.as_class(), "hk-flex-col");
    assert_eq!(FlexDirection::RowReverse.as_class(), "hk-flex-row-reverse");
    assert_eq!(
        FlexDirection::ColumnReverse.as_class(),
        "hk-flex-col-reverse"
    );
}

#[test]
fn test_flex_wrap_class_names() {
    assert_eq!(FlexWrap::Wrap.as_class(), "hk-flex-wrap");
    assert_eq!(FlexWrap::Nowrap.as_class(), "hk-flex-nowrap");
    assert_eq!(FlexWrap::WrapReverse.as_class(), "hk-flex-wrap-reverse");
}

#[test]
fn test_flex_class_names() {
    assert_eq!(Flex::Flex1.as_class(), "hk-flex-1");
    assert_eq!(Flex::Auto.as_class(), "hk-flex-auto");
    assert_eq!(Flex::None.as_class(), "hk-flex-none");
    assert_eq!(Flex::Grow0.as_class(), "hk-grow-0");
    assert_eq!(Flex::Grow1.as_class(), "hk-grow-1");
    assert_eq!(Flex::Shrink0.as_class(), "hk-shrink-0");
    assert_eq!(Flex::Shrink1.as_class(), "hk-shrink-1");
}

#[test]
fn test_align_items_class_names() {
    let names = vec![
        AlignItems::Start.as_class(),
        AlignItems::End.as_class(),
        AlignItems::Center.as_class(),
        AlignItems::Stretch.as_class(),
        AlignItems::Baseline.as_class(),
    ];
    assert_all_non_empty(&names);
    assert_eq!(AlignItems::Center.as_class(), "hk-items-center");
}

#[test]
fn test_justify_content_class_names() {
    let names = vec![
        JustifyContent::Start.as_class(),
        JustifyContent::End.as_class(),
        JustifyContent::Center.as_class(),
        JustifyContent::Between.as_class(),
        JustifyContent::Around.as_class(),
        JustifyContent::Evenly.as_class(),
    ];
    assert_all_non_empty(&names);
    assert_eq!(JustifyContent::Center.as_class(), "hk-justify-center");
}

#[test]
fn test_align_self_class_names() {
    assert_eq!(AlignSelf::Start.as_class(), "hk-self-start");
    assert_eq!(AlignSelf::Center.as_class(), "hk-self-center");
    assert_eq!(AlignSelf::Auto.as_class(), "hk-self-auto");
}

#[test]
fn test_grid_cols_class_names() {
    assert_eq!(GridCols::Col1.as_class(), "hk-grid-cols-1");
    assert_eq!(GridCols::Col12.as_class(), "hk-grid-cols-12");
}

#[test]
fn test_gap_class_names() {
    assert_eq!(Gap::Gap0.as_class(), "hk-gap-0");
    assert_eq!(Gap::Gap4.as_class(), "hk-gap-4");
    assert_eq!(Gap::Gap12.as_class(), "hk-gap-12");
}

#[test]
fn test_row_gap_and_column_gap() {
    assert_eq!(RowGap::Gap2.as_class(), "hk-gap-y-2");
    assert_eq!(ColumnGap::Gap3.as_class(), "hk-gap-x-3");
}

#[test]
fn test_position_class_names() {
    let names = vec![
        Position::Static.as_class(),
        Position::Relative.as_class(),
        Position::Absolute.as_class(),
        Position::Fixed.as_class(),
        Position::Sticky.as_class(),
    ];
    assert_all_non_empty(&names);
    assert_eq!(Position::Relative.as_class(), "hk-relative");
}

#[test]
fn test_overflow_class_names() {
    assert_eq!(Overflow::Hidden.as_class(), "hk-overflow-hidden");
    assert_eq!(Overflow::Auto.as_class(), "hk-overflow-auto");
    assert_eq!(Overflow::Scroll.as_class(), "hk-overflow-scroll");
    assert_eq!(OverflowX::Hidden.as_class(), "hk-overflow-x-hidden");
    assert_eq!(OverflowY::Auto.as_class(), "hk-overflow-y-auto");
}

#[test]
fn test_z_index_class_names() {
    assert_eq!(ZIndex::Z0.as_class(), "hk-z-0");
    assert_eq!(ZIndex::Z50.as_class(), "hk-z-50");
    assert_eq!(ZIndex::Auto.as_class(), "hk-z-auto");
}

#[test]
fn test_padding_class_names() {
    assert_eq!(Padding::P0.as_class(), "hk-p-0");
    assert_eq!(Padding::P4.as_class(), "hk-p-4");
    assert_eq!(Padding::P12.as_class(), "hk-p-12");
    assert_eq!(PaddingX::Px4.as_class(), "hk-px-4");
    assert_eq!(PaddingY::Py2.as_class(), "hk-py-2");
    assert_eq!(PaddingTop::Pt4.as_class(), "hk-pt-4");
    assert_eq!(PaddingBottom::Pb8.as_class(), "hk-pb-8");
    assert_eq!(PaddingLeft::Pl0.as_class(), "hk-pl-0");
    assert_eq!(PaddingRight::Pr6.as_class(), "hk-pr-6");
}

#[test]
fn test_margin_class_names() {
    assert_eq!(Margin::M0.as_class(), "hk-m-0");
    assert_eq!(Margin::Auto.as_class(), "hk-m-auto");
    assert_eq!(MarginX::MxAuto.as_class(), "hk-mx-auto");
    assert_eq!(MarginY::MyAuto.as_class(), "hk-my-auto");
    assert_eq!(MarginTop::Mt4.as_class(), "hk-mt-4");
    assert_eq!(MarginBottom::Mb2.as_class(), "hk-mb-2");
    assert_eq!(MarginLeft::Ml0.as_class(), "hk-ml-0");
    assert_eq!(MarginRight::Mr8.as_class(), "hk-mr-8");
}

#[test]
fn test_space_between_class_names() {
    assert_eq!(SpaceBetween::SpaceY2.as_class(), "hk-space-y-2");
    assert_eq!(SpaceBetween::SpaceY4.as_class(), "hk-space-y-4");
    assert_eq!(SpaceBetween::SpaceY6.as_class(), "hk-space-y-6");
}

#[test]
fn test_text_color_class_names() {
    assert_eq!(TextColor::White.as_class(), "hk-text-white");
    assert_eq!(TextColor::Black.as_class(), "hk-text-black");
    assert_eq!(TextColor::Primary.as_class(), "hk-text-primary");
    assert_eq!(TextColor::Secondary.as_class(), "hk-text-secondary");
    assert_eq!(TextColor::Muted.as_class(), "hk-text-muted");
    assert_eq!(TextColor::Accent.as_class(), "hk-text-accent");
}

#[test]
fn test_bg_color_class_names() {
    assert_eq!(BgColor::White.as_class(), "hk-bg-white");
    assert_eq!(BgColor::Black.as_class(), "hk-bg-black");
    assert_eq!(BgColor::Transparent.as_class(), "hk-bg-transparent");
    assert_eq!(BgColor::Surface.as_class(), "hk-bg-surface");
    assert_eq!(BgColor::Primary.as_class(), "hk-bg-primary");
    assert_eq!(BgColor::Secondary.as_class(), "hk-bg-secondary");
    assert_eq!(BgColor::Accent.as_class(), "hk-bg-accent");
}

#[test]
fn test_border_color_class_names() {
    assert_eq!(BorderColor::Transparent.as_class(), "hk-border-transparent");
}

#[test]
fn test_font_size_class_names() {
    assert_eq!(FontSize::Xs.as_class(), "hk-text-xs");
    assert_eq!(FontSize::Base.as_class(), "hk-text-base");
    assert_eq!(FontSize::X4xl.as_class(), "hk-text-4xl");
}

#[test]
fn test_font_weight_class_names() {
    assert_eq!(FontWeight::Normal.as_class(), "hk-font-normal");
    assert_eq!(FontWeight::Bold.as_class(), "hk-font-bold");
    assert_eq!(FontWeight::Medium.as_class(), "hk-font-medium");
    assert_eq!(FontWeight::Semibold.as_class(), "hk-font-semibold");
}

#[test]
fn test_text_align_class_names() {
    assert_eq!(TextAlign::Left.as_class(), "hk-text-left");
    assert_eq!(TextAlign::Center.as_class(), "hk-text-center");
    assert_eq!(TextAlign::Right.as_class(), "hk-text-right");
}

#[test]
fn test_text_transform_class_names() {
    assert_eq!(TextTransform::Uppercase.as_class(), "hk-uppercase");
    assert_eq!(TextTransform::Lowercase.as_class(), "hk-lowercase");
    assert_eq!(TextTransform::Capitalize.as_class(), "hk-capitalize");
}

#[test]
fn test_width_class_names() {
    assert_eq!(Width::Full.as_class(), "hk-w-full");
    assert_eq!(Width::Screen.as_class(), "hk-w-screen");
    assert_eq!(Width::Auto.as_class(), "hk-w-auto");
    assert_eq!(Width::W64.as_class(), "hk-w-64");
}

#[test]
fn test_height_class_names() {
    assert_eq!(Height::Full.as_class(), "hk-h-full");
    assert_eq!(Height::Screen.as_class(), "hk-h-screen");
    assert_eq!(Height::Auto.as_class(), "hk-h-auto");
    assert_eq!(Height::H12.as_class(), "hk-h-12");
}

#[test]
fn test_min_max_width_class_names() {
    assert_eq!(MinWidth::MinW0.as_class(), "hk-min-w-0");
    assert_eq!(MaxWidth::MaxWFull.as_class(), "hk-max-w-full");
    assert_eq!(MaxWidth::MaxW4xl.as_class(), "hk-max-w-4xl");
    assert_eq!(MaxWidth::MaxWLogo.as_class(), "hk-max-w-logo");
}

#[test]
fn test_object_fit_class_names() {
    assert_eq!(ObjectFit::Contain.as_class(), "hk-object-contain");
    assert_eq!(ObjectFit::Cover.as_class(), "hk-object-cover");
    assert_eq!(ObjectFit::Fill.as_class(), "hk-object-fill");
}

#[test]
fn test_border_radius_class_names() {
    assert_eq!(BorderRadius::None.as_class(), "hk-rounded-none");
    assert_eq!(BorderRadius::Sm.as_class(), "hk-rounded-sm");
    assert_eq!(BorderRadius::Rounded.as_class(), "hk-rounded");
    assert_eq!(BorderRadius::Lg.as_class(), "hk-rounded-lg");
    assert_eq!(BorderRadius::Xl.as_class(), "hk-rounded-xl");
    assert_eq!(BorderRadius::Full.as_class(), "hk-rounded-full");
}

#[test]
fn test_shadow_class_names() {
    assert_eq!(Shadow::Md.as_class(), "hk-shadow-md");
    assert_eq!(Shadow::Lg.as_class(), "hk-shadow-lg");
}

#[test]
fn test_opacity_class_names() {
    assert_eq!(Opacity::O0.as_class(), "hk-opacity-0");
    assert_eq!(Opacity::O50.as_class(), "hk-opacity-50");
    assert_eq!(Opacity::O100.as_class(), "hk-opacity-100");
}

#[test]
fn test_cursor_class_names() {
    assert_eq!(Cursor::Pointer.as_class(), "hk-cursor-pointer");
    assert_eq!(Cursor::NotAllowed.as_class(), "hk-cursor-not-allowed");
}

#[test]
fn test_pointer_events_class_names() {
    assert_eq!(PointerEvents::None.as_class(), "hk-pointer-events-none");
    assert_eq!(PointerEvents::Auto.as_class(), "hk-pointer-events-auto");
}

#[test]
fn test_user_select_class_names() {
    assert_eq!(UserSelect::None.as_class(), "hk-select-none");
    assert_eq!(UserSelect::Text.as_class(), "hk-select-text");
    assert_eq!(UserSelect::All.as_class(), "hk-select-all");
}

#[test]
fn test_transition_class_names() {
    assert_eq!(Transition::All.as_class(), "hk-transition-all");
    assert_eq!(Transition::Colors.as_class(), "hk-transition-colors");
    assert_eq!(Transition::Transform.as_class(), "hk-transition-transform");
}

#[test]
fn test_duration_class_names() {
    assert_eq!(Duration::D150.as_class(), "hk-duration-150");
    assert_eq!(Duration::D300.as_class(), "hk-duration-300");
    assert_eq!(Duration::D500.as_class(), "hk-duration-500");
}

#[test]
fn test_ease_class_names() {
    assert_eq!(Ease::InOut.as_class(), "hk-ease-in-out");
}

#[test]
fn test_transform_class_names() {
    assert_eq!(Transform::TranslateX0.as_class(), "hk-translate-x-0");
    assert_eq!(Transform::TranslateXFull.as_class(), "hk-translate-x-full");
    assert_eq!(Transform::TranslateY0.as_class(), "hk-translate-y-0");
}

#[test]
fn test_classes_builder_produces_valid_string() {
    let classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Row)
        .add(Gap::Gap4)
        .add(AlignItems::Center)
        .build();
    assert!(!classes.is_empty());
    assert!(classes.contains("hk-flex"));
    assert!(classes.contains("hk-flex-row"));
    assert!(classes.contains("hk-gap-4"));
    assert!(classes.contains("hk-items-center"));
}

#[test]
fn test_classes_builder_empty() {
    let classes = ClassesBuilder::new().build();
    assert_eq!(classes, "");
}

#[test]
fn test_classes_builder_single() {
    let classes = ClassesBuilder::new().add(Display::Flex).build();
    assert_eq!(classes, "hk-flex");
}

#[test]
fn test_classes_builder_multiple_spacing() {
    let classes = ClassesBuilder::new()
        .add(Padding::P4)
        .add(Margin::M2)
        .add(Width::Full)
        .build();
    let parts: Vec<&str> = classes.split_whitespace().collect();
    assert_eq!(parts.len(), 3);
    assert!(parts.contains(&"hk-p-4"));
    assert!(parts.contains(&"hk-m-2"));
    assert!(parts.contains(&"hk-w-full"));
}

#[test]
fn test_classes_builder_with_effects() {
    let classes = ClassesBuilder::new()
        .add(BorderRadius::Lg)
        .add(Shadow::Md)
        .add(Opacity::O50)
        .build();
    assert!(classes.contains("hk-rounded-lg"));
    assert!(classes.contains("hk-shadow-md"));
    assert!(classes.contains("hk-opacity-50"));
}

#[test]
fn test_classes_builder_with_typography() {
    let classes = ClassesBuilder::new()
        .add(FontSize::Lg)
        .add(FontWeight::Bold)
        .add(TextAlign::Center)
        .build();
    assert!(classes.contains("hk-text-lg"));
    assert!(classes.contains("hk-font-bold"));
    assert!(classes.contains("hk-text-center"));
}

#[test]
fn test_classes_builder_with_color_classes() {
    let classes = ClassesBuilder::new()
        .add(TextColor::Primary)
        .add(BgColor::Surface)
        .add(BorderColor::Transparent)
        .build();
    assert!(classes.contains("hk-text-primary"));
    assert!(classes.contains("hk-bg-surface"));
    assert!(classes.contains("hk-border-transparent"));
}

#[test]
fn test_classes_builder_with_transitions() {
    let classes = ClassesBuilder::new()
        .add(Transition::All)
        .add(Duration::D300)
        .add(Ease::InOut)
        .build();
    assert!(classes.contains("hk-transition-all"));
    assert!(classes.contains("hk-duration-300"));
    assert!(classes.contains("hk-ease-in-out"));
}

#[test]
fn test_classes_builder_with_layout() {
    let classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Overflow::Hidden)
        .add(ZIndex::Z10)
        .build();
    assert!(classes.contains("hk-relative"));
    assert!(classes.contains("hk-overflow-hidden"));
    assert!(classes.contains("hk-z-10"));
}

#[test]
fn test_all_typed_class_names_are_unique() {
    let display_names = vec![
        Display::Hidden.as_class(),
        Display::Block.as_class(),
        Display::InlineBlock.as_class(),
        Display::Flex.as_class(),
        Display::InlineFlex.as_class(),
        Display::Grid.as_class(),
        Display::InlineGrid.as_class(),
    ];
    let mut seen = std::collections::HashSet::new();
    for name in &display_names {
        assert!(seen.insert(name), "Duplicate class name found: {name}");
    }
}

#[test]
fn test_all_gap_names_are_unique() {
    let gap_names = vec![
        Gap::Gap0.as_class(),
        Gap::Gap1.as_class(),
        Gap::Gap2.as_class(),
        Gap::Gap3.as_class(),
        Gap::Gap4.as_class(),
        Gap::Gap5.as_class(),
        Gap::Gap6.as_class(),
        Gap::Gap8.as_class(),
        Gap::Gap12.as_class(),
    ];
    let mut seen = std::collections::HashSet::new();
    for name in &gap_names {
        assert!(seen.insert(name), "Duplicate gap name: {name}");
    }
    assert_eq!(gap_names.len(), 9);
}
