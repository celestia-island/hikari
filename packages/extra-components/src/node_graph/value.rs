// node_graph/value.rs
// Strongly-typed node value system

use serde::{Deserialize, Serialize};

/// Strongly-typed value for node graph data flow
///
/// This replaces `serde_json::Value` to provide type safety
/// and better error messages in the node graph system.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum NodeValue {
    Number(f64),
    Text(String),
    Boolean(bool),
    Null,
}

impl Default for NodeValue {
    fn default() -> Self {
        NodeValue::Null
    }
}

impl NodeValue {
    pub fn is_null(&self) -> bool {
        matches!(self, NodeValue::Null)
    }

    pub fn is_number(&self) -> bool {
        matches!(self, NodeValue::Number(_))
    }

    pub fn is_text(&self) -> bool {
        matches!(self, NodeValue::Text(_))
    }

    pub fn is_boolean(&self) -> bool {
        matches!(self, NodeValue::Boolean(_))
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            NodeValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            NodeValue::Text(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            NodeValue::Boolean(b) => Some(*b),
            _ => None,
        }
    }

    pub fn to_display_string(&self) -> String {
        match self {
            NodeValue::Number(n) => {
                if n.fract() == 0.0 {
                    format!("{}", *n as i64)
                } else {
                    format!("{}", n)
                }
            }
            NodeValue::Text(s) => s.clone(),
            NodeValue::Boolean(b) => b.to_string(),
            NodeValue::Null => "null".to_string(),
        }
    }
}

impl From<f64> for NodeValue {
    fn from(value: f64) -> Self {
        if value.is_nan() || value.is_infinite() {
            NodeValue::Number(0.0)
        } else {
            NodeValue::Number(value)
        }
    }
}

impl From<i64> for NodeValue {
    fn from(value: i64) -> Self {
        NodeValue::Number(value as f64)
    }
}

impl From<i32> for NodeValue {
    fn from(value: i32) -> Self {
        NodeValue::Number(value as f64)
    }
}

impl From<String> for NodeValue {
    fn from(value: String) -> Self {
        NodeValue::Text(value)
    }
}

impl From<&str> for NodeValue {
    fn from(value: &str) -> Self {
        NodeValue::Text(value.to_string())
    }
}

impl From<bool> for NodeValue {
    fn from(value: bool) -> Self {
        NodeValue::Boolean(value)
    }
}

impl From<Option<f64>> for NodeValue {
    fn from(value: Option<f64>) -> Self {
        match value {
            Some(n) => NodeValue::from(n),
            None => NodeValue::Null,
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
        let val = NodeValue::from(3.14);
        assert_eq!(val.as_f64(), Some(3.14));
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
}
