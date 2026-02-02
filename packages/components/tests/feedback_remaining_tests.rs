// hi-components/tests/feedback_remaining_tests.rs
// Remaining Layer 1 feedback components unit tests

#[cfg(test)]
mod tests {

    use hikari_components::feedback::{
        {ProgressProps, ProgressStatus, ProgressType}, {SkeletonProps, SkeletonShape},
        {SpinProps, SpinSize, SpinTip},
    };

    // ============= Skeleton Tests =============

    #[test]
    fn test_skeleton_props_default_values() {
        let props = SkeletonProps {
            loading: true,
            shape: SkeletonShape::Text,
            rows: 3,
            avatar_size: None,
            image_dimensions: None,
            active: true,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.loading, true);
        assert_eq!(props.rows, 3);
        assert_eq!(props.shape, SkeletonShape::Text);
        assert_eq!(props.active, true);
    }

    #[test]
    fn test_skeleton_props_loading() {
        let props = SkeletonProps {
            loading: false,
            shape: SkeletonShape::Text,
            rows: 3,
            avatar_size: None,
            image_dimensions: None,
            active: true,
            class: String::new(),
            style: String::new(),
        };

        assert!(!props.loading);
    }

    #[test]
    fn test_skeleton_props_with_rows() {
        let props = SkeletonProps {
            loading: true,
            shape: SkeletonShape::Text,
            rows: 5,
            avatar_size: None,
            image_dimensions: None,
            active: true,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.rows, 5);
    }

    #[test]
    fn test_skeleton_shape_text() {
        let props = SkeletonProps {
            loading: true,
            shape: SkeletonShape::Text,
            rows: 3,
            avatar_size: None,
            image_dimensions: None,
            active: true,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.shape, SkeletonShape::Text);
    }

    #[test]
    fn test_skeleton_shape_avatar() {
        let props = SkeletonProps {
            loading: true,
            shape: SkeletonShape::Avatar,
            rows: 3,
            avatar_size: None,
            image_dimensions: None,
            active: true,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.shape, SkeletonShape::Avatar);
    }

    #[test]
    fn test_skeleton_shape_image() {
        let props = SkeletonProps {
            loading: true,
            shape: SkeletonShape::Image,
            rows: 3,
            avatar_size: None,
            image_dimensions: None,
            active: true,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.shape, SkeletonShape::Image);
    }

    #[test]
    fn test_skeleton_props_with_custom_classes() {
        let props = SkeletonProps {
            loading: true,
            shape: SkeletonShape::Text,
            rows: 3,
            avatar_size: None,
            image_dimensions: None,
            active: true,
            class: "custom-skeleton".to_string(),
            style: String::new(),
        };

        assert_eq!(props.class, "custom-skeleton");
    }

    // ============= Progress Tests =============

    #[test]
    fn test_progress_props_default_values() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Normal,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.value, 50.0);
        assert_eq!(props.max, 100.0);
        assert_eq!(props.progress_type, ProgressType::Linear);
        assert_eq!(props.status, ProgressStatus::Normal);
        assert_eq!(props.show_info, false);
    }

    #[test]
    fn test_progress_props_with_value() {
        let props = ProgressProps {
            value: 75.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Normal,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.value, 75.0);
    }

    #[test]
    fn test_progress_props_with_max() {
        let props = ProgressProps {
            value: 50.0,
            max: 200.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Normal,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.max, 200.0);
    }

    #[test]
    fn test_progress_type_linear() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Normal,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.progress_type, ProgressType::Linear);
    }

    #[test]
    fn test_progress_type_circular() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Circular,
            status: ProgressStatus::Normal,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.progress_type, ProgressType::Circular);
    }

    #[test]
    fn test_progress_status_normal() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Normal,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.status, ProgressStatus::Normal);
    }

    #[test]
    fn test_progress_status_active() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Active,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.status, ProgressStatus::Active);
    }

    #[test]
    fn test_progress_status_exception() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Exception,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.status, ProgressStatus::Exception);
    }

    #[test]
    fn test_progress_status_success() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Success,
            show_info: false,
            class: String::new(),
            style: String::new(),
        };

        assert_eq!(props.status, ProgressStatus::Success);
    }

    #[test]
    fn test_progress_props_with_show_info() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Normal,
            show_info: true,
            class: String::new(),
            style: String::new(),
        };

        assert!(props.show_info);
    }

    #[test]
    fn test_progress_props_with_custom_classes() {
        let props = ProgressProps {
            value: 50.0,
            max: 100.0,
            progress_type: ProgressType::Linear,
            status: ProgressStatus::Normal,
            show_info: false,
            class: "custom-progress".to_string(),
            style: String::new(),
        };

        assert_eq!(props.class, "custom-progress");
    }

    // ============= Spin Tests =============

    #[test]
    fn test_spin_props_default_values() {
        let props = SpinProps {
            spinning: false,
            size: SpinSize::Medium,
            tip: SpinTip::None,
            custom_tip: None,
            delay: None,
            class: String::new(),
        };

        assert_eq!(props.spinning, false);
        assert_eq!(props.size, SpinSize::Medium);
        assert_eq!(props.tip, SpinTip::None);
    }

    #[test]
    fn test_spin_props_spinning() {
        let props = SpinProps {
            spinning: true,
            size: SpinSize::Medium,
            tip: SpinTip::None,
            custom_tip: None,
            delay: None,
            class: String::new(),
        };

        assert!(props.spinning);
    }

    #[test]
    fn test_spin_props_with_custom_classes() {
        let props = SpinProps {
            spinning: false,
            size: SpinSize::Medium,
            tip: SpinTip::None,
            custom_tip: None,
            delay: None,
            class: "custom-spin".to_string(),
        };

        assert_eq!(props.class, "custom-spin");
    }

    #[test]
    fn test_spin_size_small() {
        let props = SpinProps {
            spinning: false,
            size: SpinSize::Small,
            tip: SpinTip::None,
            custom_tip: None,
            delay: None,
            class: String::new(),
        };

        assert_eq!(props.size, SpinSize::Small);
    }

    #[test]
    fn test_spin_size_large() {
        let props = SpinProps {
            spinning: false,
            size: SpinSize::Large,
            tip: SpinTip::None,
            custom_tip: None,
            delay: None,
            class: String::new(),
        };

        assert_eq!(props.size, SpinSize::Large);
    }

    #[test]
    fn test_spin_with_custom_tip() {
        let props = SpinProps {
            spinning: false,
            size: SpinSize::Medium,
            tip: SpinTip::None,
            custom_tip: Some("Loading...".to_string()),
            delay: None,
            class: String::new(),
        };

        assert_eq!(props.custom_tip, Some("Loading...".to_string()));
    }
}
