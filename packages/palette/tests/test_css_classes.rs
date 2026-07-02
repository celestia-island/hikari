use hikari_palette::UtilityClass;
use hikari_palette::classes::*;

fn assert_all_non_empty(variants: &[String]) {
    for v in variants {
        assert!(!v.is_empty(), "Class name should not be empty");
        assert!(v.starts_with("hi-"), "Class '{v}' should start with 'hi-'");
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
    assert_eq!(Display::Flex.as_class(), "hi-flex");
    assert_eq!(Display::Hidden.as_class(), "hi-hidden");
}

#[test]
fn test_flex_direction_class_names() {
    assert_eq!(FlexDirection::Row.as_class(), "hi-flex-row");
    assert_eq!(FlexDirection::Column.as_class(), "hi-flex-col");
    assert_eq!(FlexDirection::RowReverse.as_class(), "hi-flex-row-reverse");
    assert_eq!(
        FlexDirection::ColumnReverse.as_class(),
        "hi-flex-col-reverse"
    );
}

#[test]
fn test_flex_wrap_class_names() {
    assert_eq!(FlexWrap::Wrap.as_class(), "hi-flex-wrap");
    assert_eq!(FlexWrap::Nowrap.as_class(), "hi-flex-nowrap");
    assert_eq!(FlexWrap::WrapReverse.as_class(), "hi-flex-wrap-reverse");
}

#[test]
fn test_flex_class_names() {
    assert_eq!(Flex::Flex1.as_class(), "hi-flex-1");
    assert_eq!(Flex::Auto.as_class(), "hi-flex-auto");
    assert_eq!(Flex::None.as_class(), "hi-flex-none");
    assert_eq!(Flex::Grow0.as_class(), "hi-grow-0");
    assert_eq!(Flex::Grow1.as_class(), "hi-grow-1");
    assert_eq!(Flex::Shrink0.as_class(), "hi-shrink-0");
    assert_eq!(Flex::Shrink1.as_class(), "hi-shrink-1");
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
    assert_eq!(AlignItems::Center.as_class(), "hi-items-center");
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
    assert_eq!(JustifyContent::Center.as_class(), "hi-justify-center");
}

#[test]
fn test_align_self_class_names() {
    assert_eq!(AlignSelf::Start.as_class(), "hi-self-start");
    assert_eq!(AlignSelf::Center.as_class(), "hi-self-center");
    assert_eq!(AlignSelf::Auto.as_class(), "hi-self-auto");
}

#[test]
fn test_grid_cols_class_names() {
    assert_eq!(GridCols::Col1.as_class(), "hi-grid-cols-1");
    assert_eq!(GridCols::Col12.as_class(), "hi-grid-cols-12");
}

#[test]
fn test_gap_class_names() {
    assert_eq!(Gap::Gap0.as_class(), "hi-gap-0");
    assert_eq!(Gap::Gap4.as_class(), "hi-gap-4");
    assert_eq!(Gap::Gap12.as_class(), "hi-gap-12");
}

#[test]
fn test_row_gap_and_column_gap() {
    assert_eq!(RowGap::Gap2.as_class(), "hi-gap-y-2");
    assert_eq!(ColumnGap::Gap3.as_class(), "hi-gap-x-3");
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
    assert_eq!(Position::Relative.as_class(), "hi-relative");
}

#[test]
fn test_overflow_class_names() {
    assert_eq!(Overflow::Hidden.as_class(), "hi-overflow-hidden");
    assert_eq!(Overflow::Auto.as_class(), "hi-overflow-auto");
    assert_eq!(Overflow::Scroll.as_class(), "hi-overflow-scroll");
    assert_eq!(OverflowX::Hidden.as_class(), "hi-overflow-x-hidden");
    assert_eq!(OverflowY::Auto.as_class(), "hi-overflow-y-auto");
}

#[test]
fn test_z_index_class_names() {
    assert_eq!(ZIndex::Z0.as_class(), "hi-z-0");
    assert_eq!(ZIndex::Z50.as_class(), "hi-z-50");
    assert_eq!(ZIndex::Auto.as_class(), "hi-z-auto");
}

#[test]
fn test_padding_class_names() {
    assert_eq!(Padding::P0.as_class(), "hi-p-0");
    assert_eq!(Padding::P4.as_class(), "hi-p-4");
    assert_eq!(Padding::P12.as_class(), "hi-p-12");
    assert_eq!(PaddingX::Px4.as_class(), "hi-px-4");
    assert_eq!(PaddingY::Py2.as_class(), "hi-py-2");
    assert_eq!(PaddingTop::Pt4.as_class(), "hi-pt-4");
    assert_eq!(PaddingBottom::Pb8.as_class(), "hi-pb-8");
    assert_eq!(PaddingLeft::Pl0.as_class(), "hi-pl-0");
    assert_eq!(PaddingRight::Pr6.as_class(), "hi-pr-6");
}

#[test]
fn test_margin_class_names() {
    assert_eq!(Margin::M0.as_class(), "hi-m-0");
    assert_eq!(Margin::Auto.as_class(), "hi-m-auto");
    assert_eq!(MarginX::MxAuto.as_class(), "hi-mx-auto");
    assert_eq!(MarginY::MyAuto.as_class(), "hi-my-auto");
    assert_eq!(MarginTop::Mt4.as_class(), "hi-mt-4");
    assert_eq!(MarginBottom::Mb2.as_class(), "hi-mb-2");
    assert_eq!(MarginLeft::Ml0.as_class(), "hi-ml-0");
    assert_eq!(MarginRight::Mr8.as_class(), "hi-mr-8");
}

#[test]
fn test_space_between_class_names() {
    assert_eq!(SpaceBetween::SpaceY2.as_class(), "hi-space-y-2");
    assert_eq!(SpaceBetween::SpaceY4.as_class(), "hi-space-y-4");
    assert_eq!(SpaceBetween::SpaceY6.as_class(), "hi-space-y-6");
}

#[test]
fn test_text_color_class_names() {
    assert_eq!(TextColor::White.as_class(), "hi-text-white");
    assert_eq!(TextColor::Black.as_class(), "hi-text-black");
    assert_eq!(TextColor::Primary.as_class(), "hi-text-primary");
    assert_eq!(TextColor::Secondary.as_class(), "hi-text-secondary");
    assert_eq!(TextColor::Muted.as_class(), "hi-text-muted");
    assert_eq!(TextColor::Accent.as_class(), "hi-text-accent");
}

#[test]
fn test_bg_color_class_names() {
    assert_eq!(BgColor::White.as_class(), "hi-bg-white");
    assert_eq!(BgColor::Black.as_class(), "hi-bg-black");
    assert_eq!(BgColor::Transparent.as_class(), "hi-bg-transparent");
    assert_eq!(BgColor::Surface.as_class(), "hi-bg-surface");
    assert_eq!(BgColor::Primary.as_class(), "hi-bg-primary");
    assert_eq!(BgColor::Secondary.as_class(), "hi-bg-secondary");
    assert_eq!(BgColor::Accent.as_class(), "hi-bg-accent");
}

#[test]
fn test_border_color_class_names() {
    assert_eq!(BorderColor::Transparent.as_class(), "hi-border-transparent");
}

#[test]
fn test_font_size_class_names() {
    assert_eq!(FontSize::Xs.as_class(), "hi-text-xs");
    assert_eq!(FontSize::Base.as_class(), "hi-text-base");
    assert_eq!(FontSize::X4xl.as_class(), "hi-text-4xl");
}

#[test]
fn test_font_weight_class_names() {
    assert_eq!(FontWeight::Normal.as_class(), "hi-font-normal");
    assert_eq!(FontWeight::Bold.as_class(), "hi-font-bold");
    assert_eq!(FontWeight::Medium.as_class(), "hi-font-medium");
    assert_eq!(FontWeight::Semibold.as_class(), "hi-font-semibold");
}

#[test]
fn test_text_align_class_names() {
    assert_eq!(TextAlign::Left.as_class(), "hi-text-left");
    assert_eq!(TextAlign::Center.as_class(), "hi-text-center");
    assert_eq!(TextAlign::Right.as_class(), "hi-text-right");
}

#[test]
fn test_text_transform_class_names() {
    assert_eq!(TextTransform::Uppercase.as_class(), "hi-uppercase");
    assert_eq!(TextTransform::Lowercase.as_class(), "hi-lowercase");
    assert_eq!(TextTransform::Capitalize.as_class(), "hi-capitalize");
}

#[test]
fn test_width_class_names() {
    assert_eq!(Width::Full.as_class(), "hi-w-full");
    assert_eq!(Width::Screen.as_class(), "hi-w-screen");
    assert_eq!(Width::Auto.as_class(), "hi-w-auto");
    assert_eq!(Width::W64.as_class(), "hi-w-64");
}

#[test]
fn test_height_class_names() {
    assert_eq!(Height::Full.as_class(), "hi-h-full");
    assert_eq!(Height::Screen.as_class(), "hi-h-screen");
    assert_eq!(Height::Auto.as_class(), "hi-h-auto");
    assert_eq!(Height::H12.as_class(), "hi-h-12");
}

#[test]
fn test_min_max_width_class_names() {
    assert_eq!(MinWidth::MinW0.as_class(), "hi-min-w-0");
    assert_eq!(MaxWidth::MaxWFull.as_class(), "hi-max-w-full");
    assert_eq!(MaxWidth::MaxW4xl.as_class(), "hi-max-w-4xl");
    assert_eq!(MaxWidth::MaxWLogo.as_class(), "hi-max-w-logo");
}

#[test]
fn test_object_fit_class_names() {
    assert_eq!(ObjectFit::Contain.as_class(), "hi-object-contain");
    assert_eq!(ObjectFit::Cover.as_class(), "hi-object-cover");
    assert_eq!(ObjectFit::Fill.as_class(), "hi-object-fill");
}

#[test]
fn test_border_radius_class_names() {
    assert_eq!(BorderRadius::None.as_class(), "hi-rounded-none");
    assert_eq!(BorderRadius::Sm.as_class(), "hi-rounded-sm");
    assert_eq!(BorderRadius::Rounded.as_class(), "hi-rounded");
    assert_eq!(BorderRadius::Lg.as_class(), "hi-rounded-lg");
    assert_eq!(BorderRadius::Xl.as_class(), "hi-rounded-xl");
    assert_eq!(BorderRadius::Full.as_class(), "hi-rounded-full");
}

#[test]
fn test_shadow_class_names() {
    assert_eq!(Shadow::Md.as_class(), "hi-shadow-md");
    assert_eq!(Shadow::Lg.as_class(), "hi-shadow-lg");
}

#[test]
fn test_opacity_class_names() {
    assert_eq!(Opacity::O0.as_class(), "hi-opacity-0");
    assert_eq!(Opacity::O50.as_class(), "hi-opacity-50");
    assert_eq!(Opacity::O100.as_class(), "hi-opacity-100");
}

#[test]
fn test_cursor_class_names() {
    assert_eq!(Cursor::Pointer.as_class(), "hi-cursor-pointer");
    assert_eq!(Cursor::NotAllowed.as_class(), "hi-cursor-not-allowed");
}

#[test]
fn test_pointer_events_class_names() {
    assert_eq!(PointerEvents::None.as_class(), "hi-pointer-events-none");
    assert_eq!(PointerEvents::Auto.as_class(), "hi-pointer-events-auto");
}

#[test]
fn test_user_select_class_names() {
    assert_eq!(UserSelect::None.as_class(), "hi-select-none");
    assert_eq!(UserSelect::Text.as_class(), "hi-select-text");
    assert_eq!(UserSelect::All.as_class(), "hi-select-all");
}

#[test]
fn test_transition_class_names() {
    assert_eq!(Transition::All.as_class(), "hi-transition-all");
    assert_eq!(Transition::Colors.as_class(), "hi-transition-colors");
    assert_eq!(Transition::Transform.as_class(), "hi-transition-transform");
}

#[test]
fn test_duration_class_names() {
    assert_eq!(Duration::D150.as_class(), "hi-duration-150");
    assert_eq!(Duration::D300.as_class(), "hi-duration-300");
    assert_eq!(Duration::D500.as_class(), "hi-duration-500");
}

#[test]
fn test_ease_class_names() {
    assert_eq!(Ease::InOut.as_class(), "hi-ease-in-out");
}

#[test]
fn test_transform_class_names() {
    assert_eq!(Transform::TranslateX0.as_class(), "hi-translate-x-0");
    assert_eq!(Transform::TranslateXFull.as_class(), "hi-translate-x-full");
    assert_eq!(Transform::TranslateY0.as_class(), "hi-translate-y-0");
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
    assert!(classes.contains("hi-flex"));
    assert!(classes.contains("hi-flex-row"));
    assert!(classes.contains("hi-gap-4"));
    assert!(classes.contains("hi-items-center"));
}

#[test]
fn test_classes_builder_empty() {
    let classes = ClassesBuilder::new().build();
    assert_eq!(classes, "");
}

#[test]
fn test_classes_builder_single() {
    let classes = ClassesBuilder::new().add(Display::Flex).build();
    assert_eq!(classes, "hi-flex");
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
    assert!(parts.contains(&"hi-p-4"));
    assert!(parts.contains(&"hi-m-2"));
    assert!(parts.contains(&"hi-w-full"));
}

#[test]
fn test_classes_builder_with_effects() {
    let classes = ClassesBuilder::new()
        .add(BorderRadius::Lg)
        .add(Shadow::Md)
        .add(Opacity::O50)
        .build();
    assert!(classes.contains("hi-rounded-lg"));
    assert!(classes.contains("hi-shadow-md"));
    assert!(classes.contains("hi-opacity-50"));
}

#[test]
fn test_classes_builder_with_typography() {
    let classes = ClassesBuilder::new()
        .add(FontSize::Lg)
        .add(FontWeight::Bold)
        .add(TextAlign::Center)
        .build();
    assert!(classes.contains("hi-text-lg"));
    assert!(classes.contains("hi-font-bold"));
    assert!(classes.contains("hi-text-center"));
}

#[test]
fn test_classes_builder_with_color_classes() {
    let classes = ClassesBuilder::new()
        .add(TextColor::Primary)
        .add(BgColor::Surface)
        .add(BorderColor::Transparent)
        .build();
    assert!(classes.contains("hi-text-primary"));
    assert!(classes.contains("hi-bg-surface"));
    assert!(classes.contains("hi-border-transparent"));
}

#[test]
fn test_classes_builder_with_transitions() {
    let classes = ClassesBuilder::new()
        .add(Transition::All)
        .add(Duration::D300)
        .add(Ease::InOut)
        .build();
    assert!(classes.contains("hi-transition-all"));
    assert!(classes.contains("hi-duration-300"));
    assert!(classes.contains("hi-ease-in-out"));
}

#[test]
fn test_classes_builder_with_layout() {
    let classes = ClassesBuilder::new()
        .add(Position::Relative)
        .add(Overflow::Hidden)
        .add(ZIndex::Z10)
        .build();
    assert!(classes.contains("hi-relative"));
    assert!(classes.contains("hi-overflow-hidden"));
    assert!(classes.contains("hi-z-10"));
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
