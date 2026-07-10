#[cfg(test)]
mod tests {

    use hikari_components::display::{
        Calendar, CalendarProps, Carousel, CarouselIndicatorPosition, CarouselIndicatorType,
        CarouselProps, Comment, CommentProps, Empty, EmptyProps, QRCode, QRCodeProps, Skeleton,
        SkeletonCard, SkeletonCardProps, SkeletonProps, SkeletonSize, SkeletonTableProps,
        SkeletonVariant, Tag, TagProps, TagVariant, Timeline, TimelineItem, TimelineItemProps,
        TimelinePosition, TimelineProps,
    };
    use hikari_components::prelude::*;

    // ── Calendar ────────────────────────────────────────────────

    #[test]
    fn test_calendar_renders() {
        let _ = Calendar(CalendarProps::default());
    }

    #[test]
    fn test_calendar_props_default() {
        let props = CalendarProps::default();
        assert_eq!(props.default_year, 2026);
        assert_eq!(props.default_month, 1);
        assert_eq!(props.min_year, 1970);
        assert_eq!(props.max_year, 2100);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert!(props.on_date_select.is_none());
    }

    #[test]
    fn test_calendar_custom_year_month() {
        let props = CalendarProps {
            default_year: 2025,
            default_month: 6,
            min_year: 2000,
            max_year: 2030,
            ..Default::default()
        };
        assert_eq!(props.default_year, 2025);
        assert_eq!(props.default_month, 6);
        assert_eq!(props.min_year, 2000);
        assert_eq!(props.max_year, 2030);
    }

    // ── Carousel ────────────────────────────────────────────────

    #[test]
    fn test_carousel_renders() {
        let props = CarouselProps {
            children: rsx! { div { "Slide 1" } },
            ..Default::default()
        };
        let _ = Carousel(props);
    }

    #[test]
    fn test_carousel_indicator_position_variants() {
        assert_eq!(
            CarouselIndicatorPosition::default(),
            CarouselIndicatorPosition::Bottom
        );
        assert_eq!(
            CarouselIndicatorType::default(),
            CarouselIndicatorType::Dots
        );

        let _ = CarouselIndicatorPosition::Top;
        let _ = CarouselIndicatorPosition::Left;
        let _ = CarouselIndicatorPosition::Right;

        let _ = CarouselIndicatorType::Line;
        let _ = CarouselIndicatorType::Hidden;
    }

    #[test]
    fn test_carousel_props_default() {
        let props = CarouselProps::default();
        assert_eq!(props.autoplay, 5000);
        assert!(props.show_arrows);
        assert_eq!(props.indicator_position, CarouselIndicatorPosition::Bottom);
        assert_eq!(props.indicator_type, CarouselIndicatorType::Dots);
        assert!(props.show_pause);
        assert!(!props.infinite);
        assert!(!props.initial_paused);
    }

    // ── Timeline ────────────────────────────────────────────────

    #[test]
    fn test_timeline_renders() {
        let props = TimelineProps {
            children: VNode::empty(),
            ..Default::default()
        };
        let _ = Timeline(props);
    }

    #[test]
    fn test_timeline_position_variants() {
        assert_eq!(TimelinePosition::default(), TimelinePosition::Alternate);

        let _ = TimelinePosition::Left;
        let _ = TimelinePosition::Right;
    }

    #[test]
    fn test_timeline_props_default() {
        let props = TimelineProps::default();
        assert_eq!(props.position, TimelinePosition::Alternate);
        assert!(props.line);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_timeline_item_renders() {
        let props = TimelineItemProps {
            time: "2024-01-01".to_string(),
            title: "Event".to_string(),
            color: "blue".to_string(),
            ..Default::default()
        };
        let _ = TimelineItem(props);
    }

    #[test]
    fn test_timeline_item_props_default() {
        let props = TimelineItemProps::default();
        assert_eq!(props.position, TimelinePosition::Alternate);
        assert_eq!(props.time, "");
        assert_eq!(props.title, "");
        assert!(props.icon.is_none());
        assert_eq!(props.color, "");
        assert!(!props.last);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    // ── Skeleton ───────────────────────────────────────────────

    #[test]
    fn test_skeleton_renders() {
        let _ = Skeleton(SkeletonProps::default());
    }

    #[test]
    fn test_skeleton_variant_variants() {
        assert_eq!(SkeletonVariant::default(), SkeletonVariant::Text);
        assert_eq!(SkeletonSize::default(), SkeletonSize::Medium);

        let _ = SkeletonVariant::Circular;
        let _ = SkeletonVariant::Rectangular;
        let _ = SkeletonVariant::Rounded;

        let _ = SkeletonSize::Small;
        let _ = SkeletonSize::Large;
    }

    #[test]
    fn test_skeleton_props_default() {
        let props = SkeletonProps::default();
        assert_eq!(props.variant, SkeletonVariant::Text);
        assert_eq!(props.size, SkeletonSize::Medium);
        assert!(props.width.is_none());
        assert!(props.height.is_none());
        assert!(props.animation);
        assert!(props.rows.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_skeleton_with_dimensions() {
        let props = SkeletonProps {
            variant: SkeletonVariant::Circular,
            size: SkeletonSize::Large,
            width: Some("100px".to_string()),
            height: Some("100px".to_string()),
            animation: false,
            ..Default::default()
        };
        assert_eq!(props.variant, SkeletonVariant::Circular);
        assert_eq!(props.size, SkeletonSize::Large);
        assert_eq!(props.width.as_deref().unwrap(), "100px");
        assert!(!props.animation);
    }

    // ── SkeletonCard ───────────────────────────────────────────

    #[test]
    fn test_skeleton_card_renders() {
        let _ = SkeletonCard(SkeletonCardProps::default());
    }

    #[test]
    fn test_skeleton_card_props_default() {
        let props = SkeletonCardProps::default();
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert!(props.show_header);
        assert!(props.show_avatar);
        assert_eq!(props.rows, 3);
    }

    // ── SkeletonTable ──────────────────────────────────────────

    #[test]
    fn test_skeleton_table_props_default() {
        let props = SkeletonTableProps::default();
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert_eq!(props.columns, 0);
        assert_eq!(props.rows, 0);
    }

    // ── QRCode ─────────────────────────────────────────────────

    #[test]
    fn test_qrcode_renders() {
        let props = QRCodeProps {
            value: "https://example.com".to_string(),
            ..Default::default()
        };
        let _ = QRCode(props);
    }

    #[test]
    fn test_qrcode_props_default() {
        let props = QRCodeProps::default();
        assert_eq!(props.value, "");
        assert_eq!(props.size, 200);
        assert_eq!(props.color, "#000000");
        assert_eq!(props.background, "#ffffff");
        assert!(props.title.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert_eq!(props.error_correction, "medium");
    }

    // ── Tag ────────────────────────────────────────────────────

    #[test]
    fn test_tag_renders() {
        let props = TagProps {
            children: VNode::Text(VText::new("Hello")),
            ..Default::default()
        };
        let _ = Tag(props);
    }

    #[test]
    fn test_tag_variant_variants() {
        assert_eq!(TagVariant::default(), TagVariant::Default);

        let _ = TagVariant::Primary;
        let _ = TagVariant::Success;
        let _ = TagVariant::Warning;
        let _ = TagVariant::Danger;
        let _ = TagVariant::Info;
    }

    #[test]
    fn test_tag_props_default() {
        let props = TagProps::default();
        assert_eq!(props.variant, TagVariant::Default);
        assert!(!props.closable);
        assert!(props.on_close.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_tag_closable() {
        let props = TagProps {
            variant: TagVariant::Success,
            closable: true,
            children: VNode::Text(VText::new("Closable")),
            ..Default::default()
        };
        assert_eq!(props.variant, TagVariant::Success);
        assert!(props.closable);
    }

    // ── Empty ──────────────────────────────────────────────────

    #[test]
    fn test_empty_renders() {
        let _ = Empty(EmptyProps::default());
    }

    #[test]
    fn test_empty_props_default() {
        let props = EmptyProps::default();
        assert!(props.image.is_none());
        assert!(props.title.is_none());
        assert_eq!(props.description, "");
        assert!(props.action.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_empty_with_content() {
        let props = EmptyProps {
            image: Some("empty.png".to_string()),
            title: Some("No Data".to_string()),
            description: "Nothing here".to_string(),
            ..Default::default()
        };
        assert_eq!(props.image.as_deref().unwrap(), "empty.png");
        assert_eq!(props.title.as_deref().unwrap(), "No Data");
        assert_eq!(props.description, "Nothing here");
    }

    // ── Comment ────────────────────────────────────────────────

    #[test]
    fn test_comment_renders() {
        let props = CommentProps {
            content: "Hello world".to_string(),
            ..Default::default()
        };
        let _ = Comment(props);
    }

    #[test]
    fn test_comment_props_default() {
        let props = CommentProps::default();
        assert!(props.author.is_none());
        assert!(props.avatar.is_none());
        assert_eq!(props.content, "");
        assert!(props.datetime.is_none());
        assert!(props.actions.is_none());
        assert!(props.nested.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_comment_with_metadata() {
        let props = CommentProps {
            author: Some("John".to_string()),
            avatar: Some("avatar.jpg".to_string()),
            content: "Great post!".to_string(),
            datetime: Some("2024-01-01".to_string()),
            ..Default::default()
        };
        assert_eq!(props.author.as_deref().unwrap(), "John");
        assert_eq!(props.avatar.as_deref().unwrap(), "avatar.jpg");
        assert_eq!(props.content, "Great post!");
    }
}
