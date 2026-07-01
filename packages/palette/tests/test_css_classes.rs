use hikari_palette::classes::*;
use tairitsu_style::TypedClass;

fn assert_all_non_empty(variants: Vec<&'static str>) {
    for v in &variants {
        assert!(!v.is_empty(), "Class name should not be empty");
        assert!(
            v.starts_with("hi-"),
            "Class '{v}' should start with 'hi-'"
        );
    }
}

#[test]
fn test_display_class_names() {
    let names: Vec<&'static str> = vec![
        Display::Hidden.class_name(),
        Display::Block.class_name(),
        Display::InlineBlock.class_name(),
        Display::Flex.class_name(),
        Display::InlineFlex.class_name(),
        Display::Grid.class_name(),
        Display::InlineGrid.class_name(),
    ];
    assert_all_non_empty(names);
    assert_eq!(Display::Flex.class_name(), "hi-flex");
    assert_eq!(Display::Hidden.class_name(), "hi-hidden");
}

#[test]
fn test_flex_direction_class_names() {
    assert_eq!(FlexDirection::Row.class_name(), "hi-flex-row");
    assert_eq!(FlexDirection::Column.class_name(), "hi-flex-col");
    assert_eq!(
        FlexDirection::RowReverse.class_name(),
        "hi-flex-row-reverse"
    );
    assert_eq!(
        FlexDirection::ColumnReverse.class_name(),
        "hi-flex-col-reverse"
    );
}

#[test]
fn test_flex_wrap_class_names() {
    assert_eq!(FlexWrap::Wrap.class_name(), "hi-flex-wrap");
    assert_eq!(FlexWrap::Nowrap.class_name(), "hi-flex-nowrap");
    assert_eq!(FlexWrap::WrapReverse.class_name(), "hi-flex-wrap-reverse");
}

#[test]
fn test_flex_class_names() {
    assert_eq!(Flex::Flex1.class_name(), "hi-flex-1");
    assert_eq!(Flex::Auto.class_name(), "hi-flex-auto");
    assert_eq!(Flex::None.class_name(), "hi-flex-none");
    assert_eq!(Flex::Grow0.class_name(), "hi-grow-0");
    assert_eq!(Flex::Grow1.class_name(), "hi-grow-1");
    assert_eq!(Flex::Shrink0.class_name(), "hi-shrink-0");
    assert_eq!(Flex::Shrink1.class_name(), "hi-shrink-1");
}

#[test]
fn test_align_items_class_names() {
    let names: Vec<&'static str> = vec![
        AlignItems::Start.class_name(),
        AlignItems::End.class_name(),
        AlignItems::Center.class_name(),
        AlignItems::Stretch.class_name(),
        AlignItems::Baseline.class_name(),
    ];
    assert_all_non_empty(names);
    assert_eq!(AlignItems::Center.class_name(), "hi-items-center");
}

#[test]
fn test_justify_content_class_names() {
    let names: Vec<&'static str> = vec![
        JustifyContent::Start.class_name(),
        JustifyContent::End.class_name(),
        JustifyContent::Center.class_name(),
        JustifyContent::Between.class_name(),
        JustifyContent::Around.class_name(),
        JustifyContent::Evenly.class_name(),
    ];
    assert_all_non_empty(names);
    assert_eq!(JustifyContent::Center.class_name(), "hi-justify-center");
}

#[test]
fn test_align_self_class_names() {
    assert_eq!(AlignSelf::Start.class_name(), "hi-self-start");
    assert_eq!(AlignSelf::Center.class_name(), "hi-self-center");
    assert_eq!(AlignSelf::Auto.class_name(), "hi-self-auto");
}

#[test]
fn test_grid_cols_class_names() {
    assert_eq!(GridCols::Col1.class_name(), "hi-grid-cols-1");
    assert_eq!(GridCols::Col12.class_name(), "hi-grid-cols-12");
}

#[test]
fn test_gap_class_names() {
    assert_eq!(Gap::Gap0.class_name(), "hi-gap-0");
    assert_eq!(Gap::Gap4.class_name(), "hi-gap-4");
    assert_eq!(Gap::Gap12.class_name(), "hi-gap-12");
}

#[test]
fn test_row_gap_and_column_gap() {
    assert_eq!(RowGap::Gap2.class_name(), "hi-gap-y-2");
    assert_eq!(ColumnGap::Gap3.class_name(), "hi-gap-x-3");
}

#[test]
fn test_position_class_names() {
    let names: Vec<&'static str> = vec![
        Position::Static.class_name(),
        Position::Relative.class_name(),
        Position::Absolute.class_name(),
        Position::Fixed.class_name(),
        Position::Sticky.class_name(),
    ];
    assert_all_non_empty(names);
    assert_eq!(Position::Relative.class_name(), "hi-relative");
}

#[test]
fn test_overflow_class_names() {
    assert_eq!(Overflow::Hidden.class_name(), "hi-overflow-hidden");
    assert_eq!(Overflow::Auto.class_name(), "hi-overflow-auto");
    assert_eq!(Overflow::Scroll.class_name(), "hi-overflow-scroll");
    assert_eq!(OverflowX::Hidden.class_name(), "hi-overflow-x-hidden");
    assert_eq!(OverflowY::Auto.class_name(), "hi-overflow-y-auto");
}

#[test]
fn test_z_index_class_names() {
    assert_eq!(ZIndex::Z0.class_name(), "hi-z-0");
    assert_eq!(ZIndex::Z50.class_name(), "hi-z-50");
    assert_eq!(ZIndex::Auto.class_name(), "hi-z-auto");
}

#[test]
fn test_padding_class_names() {
    assert_eq!(Padding::P0.class_name(), "hi-p-0");
    assert_eq!(Padding::P4.class_name(), "hi-p-4");
    assert_eq!(Padding::P12.class_name(), "hi-p-12");
    assert_eq!(PaddingX::Px4.class_name(), "hi-px-4");
    assert_eq!(PaddingY::Py2.class_name(), "hi-py-2");
    assert_eq!(PaddingTop::Pt4.class_name(), "hi-pt-4");
    assert_eq!(PaddingBottom::Pb8.class_name(), "hi-pb-8");
    assert_eq!(PaddingLeft::Pl0.class_name(), "hi-pl-0");
    assert_eq!(PaddingRight::Pr6.class_name(), "hi-pr-6");
}

#[test]
fn test_margin_class_names() {
    assert_eq!(Margin::M0.class_name(), "hi-m-0");
    assert_eq!(Margin::Auto.class_name(), "hi-m-auto");
    assert_eq!(MarginX::MxAuto.class_name(), "hi-mx-auto");
    assert_eq!(MarginY::MyAuto.class_name(), "hi-my-auto");
    assert_eq!(MarginTop::Mt4.class_name(), "hi-mt-4");
    assert_eq!(MarginBottom::Mb2.class_name(), "hi-mb-2");
    assert_eq!(MarginLeft::Ml0.class_name(), "hi-ml-0");
    assert_eq!(MarginRight::Mr8.class_name(), "hi-mr-8");
}

#[test]
fn test_space_between_class_names() {
    assert_eq!(SpaceBetween::SpaceY2.class_name(), "hi-space-y-2");
    assert_eq!(SpaceBetween::SpaceY4.class_name(), "hi-space-y-4");
    assert_eq!(SpaceBetween::SpaceY6.class_name(), "hi-space-y-6");
}

#[test]
fn test_text_color_class_names() {
    assert_eq!(TextColor::White.class_name(), "hi-text-white");
    assert_eq!(TextColor::Black.class_name(), "hi-text-black");
    assert_eq!(TextColor::Primary.class_name(), "hi-text-primary");
    assert_eq!(TextColor::Secondary.class_name(), "hi-text-secondary");
    assert_eq!(TextColor::Muted.class_name(), "hi-text-muted");
    assert_eq!(TextColor::Accent.class_name(), "hi-text-accent");
}

#[test]
fn test_bg_color_class_names() {
    assert_eq!(BgColor::White.class_name(), "hi-bg-white");
    assert_eq!(BgColor::Black.class_name(), "hi-bg-black");
    assert_eq!(BgColor::Transparent.class_name(), "hi-bg-transparent");
    assert_eq!(BgColor::Surface.class_name(), "hi-bg-surface");
    assert_eq!(BgColor::Primary.class_name(), "hi-bg-primary");
    assert_eq!(BgColor::Secondary.class_name(), "hi-bg-secondary");
    assert_eq!(BgColor::Accent.class_name(), "hi-bg-accent");
}

#[test]
fn test_border_color_class_names() {
    assert_eq!(
        BorderColor::Transparent.class_name(),
        "hi-border-transparent"
    );
}

#[test]
fn test_font_size_class_names() {
    assert_eq!(FontSize::Xs.class_name(), "hi-text-xs");
    assert_eq!(FontSize::Base.class_name(), "hi-text-base");
    assert_eq!(FontSize::X4xl.class_name(), "hi-text-4xl");
}

#[test]
fn test_font_weight_class_names() {
    assert_eq!(FontWeight::Normal.class_name(), "hi-font-normal");
    assert_eq!(FontWeight::Bold.class_name(), "hi-font-bold");
    assert_eq!(FontWeight::Medium.class_name(), "hi-font-medium");
    assert_eq!(FontWeight::Semibold.class_name(), "hi-font-semibold");
}

#[test]
fn test_text_align_class_names() {
    assert_eq!(TextAlign::Left.class_name(), "hi-text-left");
    assert_eq!(TextAlign::Center.class_name(), "hi-text-center");
    assert_eq!(TextAlign::Right.class_name(), "hi-text-right");
}

#[test]
fn test_text_transform_class_names() {
    assert_eq!(TextTransform::Uppercase.class_name(), "hi-uppercase");
    assert_eq!(TextTransform::Lowercase.class_name(), "hi-lowercase");
    assert_eq!(TextTransform::Capitalize.class_name(), "hi-capitalize");
}

#[test]
fn test_width_class_names() {
    assert_eq!(Width::Full.class_name(), "hi-w-full");
    assert_eq!(Width::Screen.class_name(), "hi-w-screen");
    assert_eq!(Width::Auto.class_name(), "hi-w-auto");
    assert_eq!(Width::W64.class_name(), "hi-w-64");
}

#[test]
fn test_height_class_names() {
    assert_eq!(Height::Full.class_name(), "hi-h-full");
    assert_eq!(Height::Screen.class_name(), "hi-h-screen");
    assert_eq!(Height::Auto.class_name(), "hi-h-auto");
    assert_eq!(Height::H12.class_name(), "hi-h-12");
}

#[test]
fn test_min_max_width_class_names() {
    assert_eq!(MinWidth::MinW0.class_name(), "hi-min-w-0");
    assert_eq!(MaxWidth::MaxWFull.class_name(), "hi-max-w-full");
    assert_eq!(MaxWidth::MaxW4xl.class_name(), "hi-max-w-4xl");
    assert_eq!(MaxWidth::MaxWLogo.class_name(), "hi-max-w-logo");
}

#[test]
fn test_object_fit_class_names() {
    assert_eq!(ObjectFit::Contain.class_name(), "hi-object-contain");
    assert_eq!(ObjectFit::Cover.class_name(), "hi-object-cover");
    assert_eq!(ObjectFit::Fill.class_name(), "hi-object-fill");
}

#[test]
fn test_border_radius_class_names() {
    assert_eq!(BorderRadius::None.class_name(), "hi-rounded-none");
    assert_eq!(BorderRadius::Sm.class_name(), "hi-rounded-sm");
    assert_eq!(BorderRadius::Rounded.class_name(), "hi-rounded");
    assert_eq!(BorderRadius::Lg.class_name(), "hi-rounded-lg");
    assert_eq!(BorderRadius::Xl.class_name(), "hi-rounded-xl");
    assert_eq!(BorderRadius::Full.class_name(), "hi-rounded-full");
}

#[test]
fn test_shadow_class_names() {
    assert_eq!(Shadow::Md.class_name(), "hi-shadow-md");
    assert_eq!(Shadow::Lg.class_name(), "hi-shadow-lg");
}

#[test]
fn test_opacity_class_names() {
    assert_eq!(Opacity::O0.class_name(), "hi-opacity-0");
    assert_eq!(Opacity::O50.class_name(), "hi-opacity-50");
    assert_eq!(Opacity::O100.class_name(), "hi-opacity-100");
}

#[test]
fn test_cursor_class_names() {
    assert_eq!(Cursor::Pointer.class_name(), "hi-cursor-pointer");
    assert_eq!(Cursor::NotAllowed.class_name(), "hi-cursor-not-allowed");
}

#[test]
fn test_pointer_events_class_names() {
    assert_eq!(PointerEvents::None.class_name(), "hi-pointer-events-none");
    assert_eq!(PointerEvents::Auto.class_name(), "hi-pointer-events-auto");
}

#[test]
fn test_user_select_class_names() {
    assert_eq!(UserSelect::None.class_name(), "hi-select-none");
    assert_eq!(UserSelect::Text.class_name(), "hi-select-text");
    assert_eq!(UserSelect::All.class_name(), "hi-select-all");
}

#[test]
fn test_transition_class_names() {
    assert_eq!(Transition::All.class_name(), "hi-transition-all");
    assert_eq!(Transition::Colors.class_name(), "hi-transition-colors");
    assert_eq!(
        Transition::Transform.class_name(),
        "hi-transition-transform"
    );
}

#[test]
fn test_duration_class_names() {
    assert_eq!(Duration::D150.class_name(), "hi-duration-150");
    assert_eq!(Duration::D300.class_name(), "hi-duration-300");
    assert_eq!(Duration::D500.class_name(), "hi-duration-500");
}

#[test]
fn test_ease_class_names() {
    assert_eq!(Ease::InOut.class_name(), "hi-ease-in-out");
}

#[test]
fn test_transform_class_names() {
    assert_eq!(Transform::TranslateX0.class_name(), "hi-translate-x-0");
    assert_eq!(
        Transform::TranslateXFull.class_name(),
        "hi-translate-x-full"
    );
    assert_eq!(Transform::TranslateY0.class_name(), "hi-translate-y-0");
}

#[test]
fn test_classes_builder_produces_valid_string() {
    let classes = ClassesBuilder::new()
        .add(Display::Flex.class_name())
        .add(FlexDirection::Row.class_name())
        .add(Gap::Gap4.class_name())
        .add(AlignItems::Center.class_name())
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
    let classes = ClassesBuilder::new()
        .add(Display::Flex.class_name())
        .build();
    assert_eq!(classes, "hi-flex");
}

#[test]
fn test_classes_builder_multiple_spacing() {
    let classes = ClassesBuilder::new()
        .add(Padding::P4.class_name())
        .add(Margin::M2.class_name())
        .add(Width::Full.class_name())
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
        .add(BorderRadius::Lg.class_name())
        .add(Shadow::Md.class_name())
        .add(Opacity::O50.class_name())
        .build();
    assert!(classes.contains("hi-rounded-lg"));
    assert!(classes.contains("hi-shadow-md"));
    assert!(classes.contains("hi-opacity-50"));
}

#[test]
fn test_classes_builder_with_typography() {
    let classes = ClassesBuilder::new()
        .add(FontSize::Lg.class_name())
        .add(FontWeight::Bold.class_name())
        .add(TextAlign::Center.class_name())
        .build();
    assert!(classes.contains("hi-text-lg"));
    assert!(classes.contains("hi-font-bold"));
    assert!(classes.contains("hi-text-center"));
}

#[test]
fn test_classes_builder_with_color_classes() {
    let classes = ClassesBuilder::new()
        .add(TextColor::Primary.class_name())
        .add(BgColor::Surface.class_name())
        .add(BorderColor::Transparent.class_name())
        .build();
    assert!(classes.contains("hi-text-primary"));
    assert!(classes.contains("hi-bg-surface"));
    assert!(classes.contains("hi-border-transparent"));
}

#[test]
fn test_classes_builder_with_transitions() {
    let classes = ClassesBuilder::new()
        .add(Transition::All.class_name())
        .add(Duration::D300.class_name())
        .add(Ease::InOut.class_name())
        .build();
    assert!(classes.contains("hi-transition-all"));
    assert!(classes.contains("hi-duration-300"));
    assert!(classes.contains("hi-ease-in-out"));
}

#[test]
fn test_classes_builder_with_layout() {
    let classes = ClassesBuilder::new()
        .add(Position::Relative.class_name())
        .add(Overflow::Hidden.class_name())
        .add(ZIndex::Z10.class_name())
        .build();
    assert!(classes.contains("hi-relative"));
    assert!(classes.contains("hi-overflow-hidden"));
    assert!(classes.contains("hi-z-10"));
}

#[test]
fn test_all_typed_class_names_are_unique() {
    let display_names: Vec<&'static str> = vec![
        Display::Hidden.class_name(),
        Display::Block.class_name(),
        Display::InlineBlock.class_name(),
        Display::Flex.class_name(),
        Display::InlineFlex.class_name(),
        Display::Grid.class_name(),
        Display::InlineGrid.class_name(),
    ];
    let mut seen = std::collections::HashSet::new();
    for name in &display_names {
        assert!(seen.insert(name), "Duplicate class name found: {name}");
    }
}

#[test]
fn test_all_gap_names_are_unique() {
    let gap_names: Vec<&'static str> = vec![
        Gap::Gap0.class_name(),
        Gap::Gap1.class_name(),
        Gap::Gap2.class_name(),
        Gap::Gap3.class_name(),
        Gap::Gap4.class_name(),
        Gap::Gap5.class_name(),
        Gap::Gap6.class_name(),
        Gap::Gap8.class_name(),
        Gap::Gap12.class_name(),
    ];
    let mut seen = std::collections::HashSet::new();
    for name in &gap_names {
        assert!(seen.insert(name), "Duplicate gap name: {name}");
    }
    assert_eq!(gap_names.len(), 9);
}
