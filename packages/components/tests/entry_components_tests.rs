#[cfg(test)]
mod tests {

    use hikari_components::entry::{
        AutoCompleteProps, Cascader, CascaderOption, CascaderProps, CascaderSize, NumberInput,
        NumberInputProps, NumberInputSize, SearchProps, SelectChangeEvent, Transfer, TransferItem,
        TransferProps,
    };

    // ── AutoComplete ────────────────────────────────────────────

    // Note: AutoComplete render test requires use_signal hooks (runtime context)
    // Props-based tests below cover the API surface

    #[test]
    fn test_auto_complete_props_default() {
        let props = AutoCompleteProps::default();
        assert_eq!(props.value, "");
        assert!(props.options.is_empty());
        assert_eq!(props.placeholder, "");
        assert!(!props.disabled);
        assert!(!props.allow_clear);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_auto_complete_with_options() {
        let props = AutoCompleteProps {
            value: "app".to_string(),
            options: vec![
                "apple".to_string(),
                "application".to_string(),
                "apply".to_string(),
            ],
            placeholder: "Search...".to_string(),
            allow_clear: true,
            ..Default::default()
        };
        assert_eq!(props.value, "app");
        assert_eq!(props.options.len(), 3);
        assert!(props.allow_clear);
    }

    // ── Cascader ────────────────────────────────────────────────

    #[test]
    fn test_cascader_renders() {
        let props = CascaderProps {
            options: vec![],
            ..Default::default()
        };
        let _ = Cascader(props);
    }

    #[test]
    fn test_cascader_option_default() {
        let opt = CascaderOption::default();
        assert_eq!(opt.label, "");
        assert_eq!(opt.value, "");
        assert!(opt.children.is_none());
        assert!(!opt.disabled);
    }

    #[test]
    fn test_cascader_size_variants() {
        assert_eq!(CascaderSize::default(), CascaderSize::Md);
        let _ = CascaderSize::Sm;
        let _ = CascaderSize::Lg;
    }

    #[test]
    fn test_cascader_props_default() {
        let props = CascaderProps::default();
        assert!(props.options.is_empty());
        assert!(props.value.is_none());
        assert!(props.placeholder.is_none());
        assert_eq!(props.size, CascaderSize::Md);
        assert!(!props.disabled);
        assert!(!props.allow_clear);
        assert_eq!(props.class, "");
        assert!(props.on_change.is_none());
    }

    #[test]
    fn test_cascader_with_nested_options() {
        let options = vec![CascaderOption {
            label: "China".to_string(),
            value: "cn".to_string(),
            children: Some(vec![CascaderOption {
                label: "Beijing".to_string(),
                value: "bj".to_string(),
                children: None,
                disabled: false,
            }]),
            disabled: false,
        }];
        let props = CascaderProps {
            options,
            value: Some(vec!["cn".to_string(), "bj".to_string()]),
            placeholder: Some("Select location".to_string()),
            allow_clear: true,
            ..Default::default()
        };
        assert_eq!(props.options.len(), 1);
        assert!(props.value.is_some());
        assert!(props.allow_clear);
    }

    // ── NumberInput ─────────────────────────────────────────────

    #[test]
    fn test_number_input_renders() {
        let _ = NumberInput(NumberInputProps::default());
    }

    #[test]
    fn test_number_input_size_variants() {
        assert_eq!(NumberInputSize::default(), NumberInputSize::Medium);
        let _ = NumberInputSize::Small;
        let _ = NumberInputSize::Large;
    }

    #[test]
    fn test_number_input_props_default() {
        let props = NumberInputProps::default();
        assert_eq!(props.value, 0);
        assert!(props.min.is_none());
        assert!(props.max.is_none());
        assert_eq!(props.step, 1);
        assert!(!props.disabled);
        assert_eq!(props.size, NumberInputSize::Medium);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert!(props.glow);
    }

    #[test]
    fn test_number_input_with_constraints() {
        let props = NumberInputProps {
            value: 50,
            min: Some(0),
            max: Some(100),
            step: 5,
            disabled: false,
            ..Default::default()
        };
        assert_eq!(props.value, 50);
        assert_eq!(props.min.unwrap(), 0);
        assert_eq!(props.max.unwrap(), 100);
        assert_eq!(props.step, 5);
    }

    // ── Search ──────────────────────────────────────────────────

    // Note: Search render test requires portal/use_portal hooks (runtime context)
    // Props-based tests below cover the API surface

    #[test]
    fn test_search_props_default() {
        let props = SearchProps::default();
        assert_eq!(props.value, "");
        assert_eq!(props.placeholder, "");
        assert!(!props.disabled);
        assert!(!props.loading);
        assert!(props.allow_clear);
        assert!(props.suggestions.is_empty());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert!(props.glow);
        assert!(props.on_clear.is_none());
        assert!(props.on_suggestion_click.is_none());
    }

    #[test]
    fn test_search_with_suggestions() {
        let props = SearchProps {
            value: "rust".to_string(),
            placeholder: "Search...".to_string(),
            loading: true,
            suggestions: vec!["rust lang".to_string(), "rustacean".to_string()],
            ..Default::default()
        };
        assert_eq!(props.value, "rust");
        assert!(props.loading);
        assert_eq!(props.suggestions.len(), 2);
    }

    // ── Transfer ───────────────────────────────────────────────

    #[test]
    fn test_transfer_renders() {
        let props = TransferProps {
            data: vec![],
            target_keys: vec![],
            source_selected_keys: vec![],
            target_selected_keys: vec![],
            ..Default::default()
        };
        let _ = Transfer(props);
    }

    #[test]
    fn test_transfer_item_default() {
        let item = TransferItem::default();
        assert_eq!(item.item_key, "");
        assert_eq!(item.label, "");
        assert!(!item.disabled);
    }

    #[test]
    fn test_transfer_select_change_event() {
        let event = SelectChangeEvent {
            list_type: 0,
            keys: vec!["a".to_string(), "b".to_string()],
        };
        assert_eq!(event.list_type, 0);
        assert_eq!(event.keys.len(), 2);
    }

    #[test]
    fn test_transfer_props_default() {
        let props = TransferProps::default();
        assert!(props.data.is_empty());
        assert!(props.target_keys.is_empty());
        assert!(props.source_selected_keys.is_empty());
        assert!(props.target_selected_keys.is_empty());
        assert!(props.titles.is_none());
        assert!(!props.show_search);
        assert!(!props.one_way);
        assert!(!props.disabled);
        assert_eq!(props.class, "");
        assert!(props.on_select_change.is_none());
        assert!(props.on_change.is_none());
    }

    #[test]
    fn test_transfer_with_data() {
        let data = vec![
            TransferItem {
                item_key: "1".to_string(),
                label: "Option 1".to_string(),
                disabled: false,
            },
            TransferItem {
                item_key: "2".to_string(),
                label: "Option 2".to_string(),
                disabled: true,
            },
            TransferItem {
                item_key: "3".to_string(),
                label: "Option 3".to_string(),
                disabled: false,
            },
        ];
        let props = TransferProps {
            data: data.clone(),
            target_keys: vec!["2".to_string()],
            titles: Some(["Available".to_string(), "Selected".to_string()]),
            show_search: true,
            one_way: false,
            ..Default::default()
        };
        assert_eq!(props.data.len(), 3);
        assert_eq!(props.target_keys.len(), 1);
        assert!(props.show_search);
        assert!(!props.one_way);
    }
}
