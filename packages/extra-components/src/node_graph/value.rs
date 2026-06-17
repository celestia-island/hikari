// node_graph/value.rs
// Strongly-typed node value system

use serde::{Deserialize, Serialize};

/// Strongly-typed value for node graph data flow
///
/// This replaces `serde_json::Value` to provide type safety
/// and better error messages in the node graph system.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum NodeValue {
    Number(f64),
    Text(String),
    Boolean(bool),
    #[default]
    Null,
}

impl NodeValue {
    #[must_use]
    pub const fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }

    #[must_use]
    pub const fn is_number(&self) -> bool {
        matches!(self, Self::Number(_))
    }

    #[must_use]
    pub const fn is_text(&self) -> bool {
        matches!(self, Self::Text(_))
    }

    #[must_use]
    pub const fn is_boolean(&self) -> bool {
        matches!(self, Self::Boolean(_))
    }

    #[must_use]
    pub const fn as_f64(&self) -> Option<f64> {
        match self {
            Self::Number(n) => Some(*n),
            _ => None,
        }
    }

    #[must_use]
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::Text(s) => Some(s),
            _ => None,
        }
    }

    #[must_use]
    pub const fn as_bool(&self) -> Option<bool> {
        match self {
            Self::Boolean(b) => Some(*b),
            _ => None,
        }
    }

    #[must_use]
    pub fn to_display_string(&self) -> String {
        match self {
            Self::Number(n) => {
                if n.fract() == 0.0 {
                    format!("{}", *n as i64)
                } else {
                    format!("{n}")
                }
            }
            Self::Text(s) => s.clone(),
            Self::Boolean(b) => b.to_string(),
            Self::Null => "null".to_string(),
        }
    }
}

impl From<f64> for NodeValue {
    fn from(value: f64) -> Self {
        if value.is_nan() || value.is_infinite() {
            Self::Number(0.0)
        } else {
            Self::Number(value)
        }
    }
}

impl From<i64> for NodeValue {
    fn from(value: i64) -> Self {
        Self::Number(value as f64)
    }
}

impl From<i32> for NodeValue {
    fn from(value: i32) -> Self {
        Self::Number(f64::from(value))
    }
}

impl From<String> for NodeValue {
    fn from(value: String) -> Self {
        Self::Text(value)
    }
}

impl From<&str> for NodeValue {
    fn from(value: &str) -> Self {
        Self::Text(value.to_string())
    }
}

impl From<bool> for NodeValue {
    fn from(value: bool) -> Self {
        Self::Boolean(value)
    }
}

impl From<Option<f64>> for NodeValue {
    fn from(value: Option<f64>) -> Self {
        match value {
            Some(n) => Self::from(n),
            None => Self::Null,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_number_value() {
        let val = NodeValue::Number(42.0);
        assert!(val.is_number());
        assert_eq!(val.as_f64(), Some(42.0));
        assert_eq!(val.to_display_string(), "42");
    }

    #[test]
    fn test_text_value() {
        let val = NodeValue::Text("hello".to_string());
        assert!(val.is_text());
        assert_eq!(val.as_str(), Some("hello"));
        assert_eq!(val.to_display_string(), "hello");
    }

    #[test]
    fn test_boolean_value() {
        let val = NodeValue::Boolean(true);
        assert!(val.is_boolean());
        assert_eq!(val.as_bool(), Some(true));
        assert_eq!(val.to_display_string(), "true");
    }

    #[test]
    fn test_null_value() {
        let val = NodeValue::Null;
        assert!(val.is_null());
        assert_eq!(val.to_display_string(), "null");
    }

    #[test]
    fn test_from_f64() {
        let val = NodeValue::from(2.71);
        assert_eq!(val.as_f64(), Some(2.71));
    }

    #[test]
    fn test_from_nan() {
        let val = NodeValue::from(f64::NAN);
        assert_eq!(val.as_f64(), Some(0.0));
    }

    #[test]
    fn test_from_infinity() {
        let val = NodeValue::from(f64::INFINITY);
        assert_eq!(val.as_f64(), Some(0.0));
    }

    #[test]
    fn test_serialization() {
        let val = NodeValue::Number(42.5);
        let json = serde_json::to_string(&val).unwrap();
        let deserialized: NodeValue = serde_json::from_str(&json).unwrap();
        assert_eq!(val, deserialized);
    }

    #[test]
    fn test_round_trip_all_variants() {
        let variants = vec![
            NodeValue::Number(0.0),
            NodeValue::Number(-1.0),
            NodeValue::Number(f64::MIN_POSITIVE),
            NodeValue::Number(1e300),
            NodeValue::Text(String::new()),
            NodeValue::Text("hello world".to_string()),
            NodeValue::Text("unicode: 日本語 🦀".to_string()),
            NodeValue::Boolean(true),
            NodeValue::Boolean(false),
            NodeValue::Null,
        ];
        for val in variants {
            let json = serde_json::to_string(&val).unwrap();
            let de: NodeValue = serde_json::from_str(&json).unwrap();
            assert_eq!(val, de, "round-trip failed for {val:?}");
        }
    }

    #[test]
    fn test_as_f64_returns_none_for_non_number() {
        assert!(NodeValue::Text("1".to_string()).as_f64().is_none());
        assert!(NodeValue::Null.as_f64().is_none());
        assert!(NodeValue::Boolean(true).as_f64().is_none());
        assert_eq!(
            NodeValue::Number(std::f64::consts::PI).as_f64(),
            Some(std::f64::consts::PI)
        );
    }

    #[test]
    fn test_as_str_returns_none_for_non_text() {
        assert!(NodeValue::Number(1.0).as_str().is_none());
        assert!(NodeValue::Null.as_str().is_none());
        assert!(NodeValue::Boolean(false).as_str().is_none());
        assert_eq!(NodeValue::Text("abc".to_string()).as_str(), Some("abc"));
    }

    #[test]
    fn test_as_bool_returns_none_for_non_boolean() {
        assert!(NodeValue::Number(1.0).as_bool().is_none());
        assert!(NodeValue::Null.as_bool().is_none());
        assert!(NodeValue::Text("true".to_string()).as_bool().is_none());
        assert_eq!(NodeValue::Boolean(true).as_bool(), Some(true));
    }

    #[test]
    fn test_to_display_string_all_variants() {
        assert_eq!(NodeValue::Number(42.0).to_display_string(), "42");
        assert_eq!(
            NodeValue::Number(std::f64::consts::FRAC_PI_4).to_display_string(),
            "0.7853981633974483"
        );
        assert_eq!(NodeValue::Number(0.5).to_display_string(), "0.5");
        assert_eq!(NodeValue::Number(-7.0).to_display_string(), "-7");
        assert_eq!(NodeValue::Number(-0.1).to_display_string(), "-0.1");
        assert_eq!(
            NodeValue::Text("hello".to_string()).to_display_string(),
            "hello"
        );
        assert_eq!(NodeValue::Text(String::new()).to_display_string(), "");
        assert_eq!(NodeValue::Boolean(true).to_display_string(), "true");
        assert_eq!(NodeValue::Boolean(false).to_display_string(), "false");
        assert_eq!(NodeValue::Null.to_display_string(), "null");
    }

    #[test]
    fn test_number_text_not_equal() {
        assert_ne!(NodeValue::Number(1.0), NodeValue::Text("1".to_string()));
        assert_ne!(NodeValue::Number(0.0), NodeValue::Null);
        assert_ne!(NodeValue::Number(1.0), NodeValue::Boolean(true));
        assert_ne!(
            NodeValue::Text("true".to_string()),
            NodeValue::Boolean(true)
        );
        assert_ne!(NodeValue::Text("null".to_string()), NodeValue::Null);
    }

    #[test]
    fn test_default_is_null() {
        assert_eq!(NodeValue::default(), NodeValue::Null);
    }

    #[test]
    fn test_from_negative_infinity() {
        let val = NodeValue::from(f64::NEG_INFINITY);
        assert_eq!(val.as_f64(), Some(0.0));
    }

    #[test]
    fn test_from_option_f64() {
        assert_eq!(NodeValue::from(Some(5.0)), NodeValue::Number(5.0));
        assert_eq!(NodeValue::from(None::<f64>), NodeValue::Null);
        assert_eq!(NodeValue::from(Some(f64::NAN)), NodeValue::Number(0.0));
    }

    #[test]
    fn test_from_i64_and_i32() {
        assert_eq!(NodeValue::from(42i64), NodeValue::Number(42.0));
        assert_eq!(NodeValue::from(-1i32), NodeValue::Number(-1.0));
        assert_eq!(
            NodeValue::from(i32::MIN),
            NodeValue::Number(f64::from(i32::MIN))
        );
    }

    #[test]
    fn test_from_str_ref() {
        let val = NodeValue::from("hello");
        assert_eq!(val, NodeValue::Text("hello".to_string()));
    }

    #[test]
    fn test_is_predicates() {
        assert!(!NodeValue::Number(0.0).is_null());
        assert!(!NodeValue::Number(0.0).is_text());
        assert!(!NodeValue::Number(0.0).is_boolean());
        assert!(!NodeValue::Null.is_number());
        assert!(!NodeValue::Text("".to_string()).is_number());
        assert!(!NodeValue::Boolean(false).is_number());
    }

    #[test]
    fn test_number_large_integer_display() {
        let val = NodeValue::Number(1e15);
        let s = val.to_display_string();
        assert!(!s.contains('.'));
    }

    #[test]
    fn test_deserialize_invalid_json() {
        let result: Result<NodeValue, _> = serde_json::from_str("not valid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_to_display_string_zero() {
        assert_eq!(NodeValue::Number(0.0).to_display_string(), "0");
    }
}
