// hikari-render-service/src/models.rs
// Type-safe models for HTTP responses

use serde::Serialize;

/// Style information response
#[derive(Debug, Serialize)]
pub struct StyleInfo {
    pub total_components: usize,
    pub components: ComponentCategories,
}

impl StyleInfo {
    /// Create a new StyleInfo with no components
    pub fn empty() -> Self {
        Self {
            total_components: 0,
            components: ComponentCategories::empty(),
        }
    }
}

/// Component categories
#[derive(Debug, Serialize)]
pub struct ComponentCategories {
    pub basic: BasicComponents,
    pub data: DataComponents,
    pub feedback: FeedbackComponents,
    pub navigation: NavigationComponents,
    pub display: DisplayComponents,
    pub entry: EntryComponents,
}

impl ComponentCategories {
    /// Create empty component categories
    pub fn empty() -> Self {
        Self {
            basic: BasicComponents::empty(),
            data: DataComponents::empty(),
            feedback: FeedbackComponents::empty(),
            navigation: NavigationComponents::empty(),
            display: DisplayComponents::empty(),
            entry: EntryComponents::empty(),
        }
    }
}

/// Basic components
#[derive(Debug, Serialize)]
pub struct BasicComponents {
    pub arrow: bool,
    pub background: bool,
    pub button: bool,
    pub input: bool,
    pub card: bool,
    pub badge: bool,
    pub checkbox: bool,
    pub radio_group: bool,
    pub select: bool,
    pub switch: bool,
    pub slider: bool,
    pub textarea: bool,
    pub icon_button: bool,
    pub divider: bool,
    pub file_upload: bool,
    pub form_field: bool,
    pub date_picker: bool,
}

impl BasicComponents {
    /// Create empty basic components
    pub fn empty() -> Self {
        Self {
            arrow: false,
            background: false,
            button: false,
            input: false,
            card: false,
            badge: false,
            checkbox: false,
            radio_group: false,
            select: false,
            switch: false,
            slider: false,
            textarea: false,
            icon_button: false,
            divider: false,
            file_upload: false,
            form_field: false,
            date_picker: false,
        }
    }
}

/// Data components
#[derive(Debug, Serialize)]
pub struct DataComponents {
    pub table: bool,
    pub tree: bool,
    pub pagination: bool,
    pub pagination_button: bool,
    pub virtual_scroll: bool,
    pub collapse: bool,
    pub drag: bool,
    pub sort: bool,
    pub filter: bool,
    pub selection: bool,
}

impl DataComponents {
    /// Create empty data components
    pub fn empty() -> Self {
        Self {
            table: false,
            tree: false,
            pagination: false,
            pagination_button: false,
            virtual_scroll: false,
            collapse: false,
            drag: false,
            sort: false,
            filter: false,
            selection: false,
        }
    }
}

/// Feedback components
#[derive(Debug, Serialize)]
pub struct FeedbackComponents {
    pub alert: bool,
    pub toast: bool,
    pub tooltip: bool,
    pub modal: bool,
    pub drawer: bool,
    pub dropdown: bool,
    pub popover: bool,
    pub progress: bool,
    pub skeleton: bool,
    pub spin: bool,
}

impl FeedbackComponents {
    /// Create empty feedback components
    pub fn empty() -> Self {
        Self {
            alert: false,
            toast: false,
            tooltip: false,
            modal: false,
            drawer: false,
            dropdown: false,
            popover: false,
            progress: false,
            skeleton: false,
            spin: false,
        }
    }
}

/// Navigation components
#[derive(Debug, Serialize)]
pub struct NavigationComponents {
    pub menu: bool,
    pub tabs: bool,
    pub breadcrumb: bool,
    pub sidebar: bool,
    pub steps: bool,
}

impl NavigationComponents {
    /// Create empty navigation components
    pub fn empty() -> Self {
        Self {
            menu: false,
            tabs: false,
            breadcrumb: false,
            sidebar: false,
            steps: false,
        }
    }
}

/// Display components
#[derive(Debug, Serialize)]
pub struct DisplayComponents {
    pub tag: bool,
    pub empty: bool,
    pub comment: bool,
    pub description_list: bool,
    pub qrcode: bool,
}

impl DisplayComponents {
    /// Create empty display components
    pub fn empty() -> Self {
        Self {
            tag: false,
            empty: false,
            comment: false,
            description_list: false,
            qrcode: false,
        }
    }
}

/// Entry components
#[derive(Debug, Serialize)]
pub struct EntryComponents {
    pub number_input: bool,
    pub search: bool,
    pub auto_complete: bool,
    pub cascader: bool,
    pub transfer: bool,
}

impl EntryComponents {
    /// Create empty entry components
    pub fn empty() -> Self {
        Self {
            number_input: false,
            search: false,
            auto_complete: false,
            cascader: false,
            transfer: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_style_info_empty() {
        let info = StyleInfo::empty();
        assert_eq!(info.total_components, 0);
        assert!(!info.components.basic.button);
    }

    #[test]
    fn test_basic_components_empty() {
        let basic = BasicComponents::empty();
        assert!(!basic.button);
        assert!(!basic.input);
        assert!(!basic.card);
        assert!(!basic.badge);
        assert!(!basic.checkbox);
        assert!(!basic.select);
        assert!(!basic.divider);
    }

    #[test]
    fn test_all_categories_empty() {
        let categories = ComponentCategories::empty();
        assert!(!categories.basic.button);
        assert!(!categories.data.table);
        assert!(!categories.feedback.alert);
        assert!(!categories.navigation.menu);
        assert!(!categories.display.tag);
        assert!(!categories.entry.search);
    }

    #[test]
    fn test_serialization() {
        let info = StyleInfo {
            total_components: 1,
            components: ComponentCategories {
                basic: BasicComponents {
                    button: true,
                    ..BasicComponents::empty()
                },
                data: DataComponents::empty(),
                feedback: FeedbackComponents::empty(),
                navigation: NavigationComponents::empty(),
                display: DisplayComponents::empty(),
                entry: EntryComponents::empty(),
            },
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains(r#""total_components":1"#));
        assert!(json.contains(r#""button":true"#));
    }
}
