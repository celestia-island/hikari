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
}

impl ComponentCategories {
    /// Create empty component categories
    pub fn empty() -> Self {
        Self {
            basic: BasicComponents::empty(),
            data: DataComponents::empty(),
            feedback: FeedbackComponents::empty(),
            navigation: NavigationComponents::empty(),
        }
    }
}

/// Basic components
#[derive(Debug, Serialize)]
pub struct BasicComponents {
    pub button: bool,
    pub input: bool,
    pub card: bool,
    pub badge: bool,
}

impl BasicComponents {
    /// Create empty basic components
    pub fn empty() -> Self {
        Self {
            button: false,
            input: false,
            card: false,
            badge: false,
        }
    }
}

/// Data components
#[derive(Debug, Serialize)]
pub struct DataComponents {
    pub table: bool,
    pub tree: bool,
    pub pagination: bool,
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
}

impl FeedbackComponents {
    /// Create empty feedback components
    pub fn empty() -> Self {
        Self {
            alert: false,
            toast: false,
            tooltip: false,
        }
    }
}

/// Navigation components
#[derive(Debug, Serialize)]
pub struct NavigationComponents {
    pub menu: bool,
    pub tabs: bool,
    pub breadcrumb: bool,
}

impl NavigationComponents {
    /// Create empty navigation components
    pub fn empty() -> Self {
        Self {
            menu: false,
            tabs: false,
            breadcrumb: false,
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
    }

    #[test]
    fn test_serialization() {
        let info = StyleInfo {
            total_components: 1,
            components: ComponentCategories {
                basic: BasicComponents {
                    button: true,
                    input: false,
                    card: false,
                    badge: false,
                },
                data: DataComponents::empty(),
                feedback: FeedbackComponents::empty(),
                navigation: NavigationComponents::empty(),
            },
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains(r#""total_components":1"#));
        assert!(json.contains(r#""button":true"#));
    }
}
