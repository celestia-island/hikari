// hikari-render-service/src/registry.rs
// StyleRegistry - 从 hikari-components 移植并简化

use std::collections::HashMap;

/// 样式注册表
///
/// 用于管理所有已注册组件的 CSS 样式
#[derive(Default, Clone, Debug)]
pub struct StyleRegistry {
    styles: HashMap<String, String>,
}

impl StyleRegistry {
    /// 注册单个组件的样式
    pub fn register(&mut self, name: &str, css: &str) {
        self.styles.insert(name.to_string(), css.to_string());
    }

    /// 获取聚合的 CSS 样式（所有已注册组件）
    pub fn css_bundle(&self) -> String {
        self.styles.values().cloned().collect::<Vec<_>>().join("\n")
    }

    /// 获取单个组件的 CSS 样式
    pub fn get(&self, name: &str) -> Option<&str> {
        self.styles.get(name).map(|s| s.as_str())
    }

    /// 检查组件是否已注册
    pub fn has(&self, name: &str) -> bool {
        self.styles.contains_key(name)
    }

    /// 获取已注册组件的数量
    pub fn len(&self) -> usize {
        self.styles.len()
    }

    /// 检查是否为空
    pub fn is_empty(&self) -> bool {
        self.styles.is_empty()
    }
}
