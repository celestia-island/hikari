//! Dynamic icon fetching tests
//!
//! Basic tests for icon validation and cache functionality.

#[cfg(test)]
mod tests {

    use std::{collections::HashMap, sync::OnceLock};

    /// Test icon name validation (kebab-case)
    #[test]
    fn test_icon_name_validation() {
        fn is_safe_icon_name(name: &str) -> bool {
            if name.is_empty() || name.len() > 100 {
                return false;
            }

            // Only allow lowercase letters, numbers, and hyphens (kebab-case)
            name.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        }

        let valid_names = vec![
            "home",
            "user-circle",
            "alert-circle",
            "arrow-left",
            "settings-2",
            "info",
        ];

        let invalid_names = vec![
            "",
            "Home",       // uppercase
            "home/icon",  // slash
            "home@icon",  // at symbol
            "home.icon",  // dot
            "home space", // space
            "home_icon",  // underscore
            "home//icon", // double slash
        ];

        // Test valid names should pass
        for name in valid_names {
            assert!(is_safe_icon_name(name), "{} should be valid", name);
        }

        // Test invalid names should fail
        for name in invalid_names {
            assert!(!is_safe_icon_name(name), "{} should be invalid", name);
        }

        // Test boundary conditions
        assert!(!is_safe_icon_name("a".repeat(101).as_str())); // too long
        assert!(!is_safe_icon_name("")); // empty
    }

    /// Test color validation
    #[test]
    fn test_color_validation() {
        fn is_safe_color(color: &str) -> bool {
            match color {
                "none" | "currentColor" => true,
                c if c.starts_with("#") && c.len() == 4 => {
                    c[1..].chars().all(|c| c.is_ascii_hexdigit())
                }
                c if c.starts_with("#") && c.len() == 7 => {
                    c[1..].chars().all(|c| c.is_ascii_hexdigit())
                }
                c if c.starts_with("rgb(") && c.ends_with(')') => {
                    c[4..c.len() - 1].split(',').count() == 3
                }
                c if c.starts_with("rgba(") && c.ends_with(')') => {
                    c[5..c.len() - 1].split(',').count() == 4
                }
                _ => false,
            }
        }

        let valid_colors = vec![
            "none",
            "currentColor",
            "#000",
            "#000000",
            "#fff",
            "#FFFFFF",
            "rgb(255,0,0)",
            "rgba(255,0,0,0.5)",
            "rgb(255, 0, 0)",
        ];

        let invalid_colors = vec![
            "#ZZZ",             // invalid hex
            "#12345",           // invalid hex length
            "rgb(255)",         // invalid rgb format
            "rgba(255,0,0)",    // missing alpha
            "red",              // named color (not supported)
            "rgb(255,0,0,0,0)", // too many values
        ];

        // Test valid colors should pass
        for color in valid_colors {
            assert!(is_safe_color(color), "{} should be valid", color);
        }

        // Test invalid colors should fail
        for color in invalid_colors {
            assert!(!is_safe_color(color), "{} should be invalid", color);
        }
    }

    /// Test cache functionality
    #[test]
    fn test_icon_cache() {
        let cache: OnceLock<std::sync::RwLock<HashMap<String, String>>> = OnceLock::new();

        // Test cache initialization
        let cache_ref = cache.get_or_init(|| std::sync::RwLock::new(HashMap::new()));
        let mut cache = cache_ref.write().unwrap();

        // Test cache set and get
        cache.insert("test-icon".to_string(), "test-data".to_string());
        assert_eq!(cache.get("test-icon"), Some(&"test-data".to_string()));

        // Test cache miss
        assert!(cache.get("nonexistent-icon").is_none());

        // Test cache size
        assert_eq!(cache.len(), 1);
    }

    /// Test boundary conditions
    #[test]
    fn test_boundary_conditions() {
        fn is_safe_icon_name(name: &str) -> bool {
            if name.is_empty() || name.len() > 100 {
                return false;
            }
            name.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        }

        // Test maximum valid length
        let max_valid_name = "a".repeat(100);
        assert!(is_safe_icon_name(&max_valid_name));

        // Test minimum invalid length
        let min_invalid_name = "a".repeat(101);
        assert!(!is_safe_icon_name(&min_invalid_name));

        // Test edge case names
        assert!(is_safe_icon_name("a"));
        assert!(is_safe_icon_name("z"));
        assert!(is_safe_icon_name("0"));
        assert!(is_safe_icon_name("9"));
        assert!(is_safe_icon_name("a-b"));
        assert!(is_safe_icon_name("a1-b2-c3"));

        // Test invalid characters
        assert!(!is_safe_icon_name("A")); // uppercase
        assert!(!is_safe_icon_name("A-b")); // uppercase
        assert!(!is_safe_icon_name("a_b")); // underscore
        assert!(!is_safe_icon_name("a b")); // space
        assert!(!is_safe_icon_name("a.b")); // dot
        assert!(!is_safe_icon_name("a@b")); // at
        assert!(!is_safe_icon_name("a/b")); // slash
    }

    /// Test basic functionality smoke test
    #[test]
    fn test_basic_functionality() {
        // Test that basic validation works
        assert!(is_safe_icon_name("home"));
        assert!(!is_safe_icon_name("Home"));
        assert!(is_safe_color("#000000"));
        assert!(!is_safe_color("#ZZZ"));

        // Test cache works
        let cache: OnceLock<std::sync::RwLock<HashMap<String, String>>> = OnceLock::new();
        let cache_ref = cache.get_or_init(|| std::sync::RwLock::new(HashMap::new()));

        {
            let mut cache = cache_ref.write().unwrap();
            cache.insert("test".to_string(), "value".to_string());
        }

        {
            let cache = cache_ref.read().unwrap();
            assert_eq!(cache.get("test"), Some(&"value".to_string()));
        }
    }

    // Helper functions for testing
    fn is_safe_icon_name(name: &str) -> bool {
        if name.is_empty() || name.len() > 100 {
            return false;
        }
        name.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    }

    fn is_safe_color(color: &str) -> bool {
        match color {
            "none" | "currentColor" => true,
            c if c.starts_with("#") && c.len() == 4 => {
                c[1..].chars().all(|c| c.is_ascii_hexdigit())
            }
            c if c.starts_with("#") && c.len() == 7 => {
                c[1..].chars().all(|c| c.is_ascii_hexdigit())
            }
            c if c.starts_with("rgb(") && c.ends_with(')') => {
                c[4..c.len() - 1].split(',').count() == 3
            }
            c if c.starts_with("rgba(") && c.ends_with(')') => {
                c[5..c.len() - 1].split(',').count() == 4
            }
            _ => false,
        }
    }
}
