// hikari-components/src/styled.rs
// StyledComponent trait 和 StyleRegistry

use std::collections::HashMap;

/// 样式注册表
///
/// 用于管理所有已注册组件的 CSS 样式
#[derive(Default, Clone)]
pub struct StyleRegistry {
    styles: HashMap<&'static str, &'static str>,
}

impl StyleRegistry {
    /// 注册单个组件的样式
    pub fn register(&mut self, name: &'static str, css: &'static str) {
        self.styles.insert(name, css);
    }

    /// 获取聚合的 CSS 样式（所有已注册组件）
    pub fn css_bundle(&self) -> String {
        self.styles
            .values()
            .copied()
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// 获取单个组件的 CSS 样式
    pub fn get(&self, name: &str) -> Option<&'static str> {
        self.styles.get(name).copied()
    }

    /// 获取所有已注册的样式
    pub fn get_all(&self) -> HashMap<&'static str, &'static str> {
        self.styles.clone()
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

    /// 批量注册：基础组件
    pub fn register_basic_components(&mut self) {
        use crate::basic::{BadgeComponent, ButtonComponent, CardComponent, InputComponent};
        ButtonComponent::register(self);
        InputComponent::register(self);
        CardComponent::register(self);
        BadgeComponent::register(self);
    }

    /// 批量注册：数据组件
    pub fn register_data_components(&mut self) {
        use crate::data::{CollapseComponent, DragComponent, FilterComponent, PaginationComponent,
                           SelectionComponent, SortComponent, TableComponent, TreeComponent,
                           VirtualScrollComponent};
        TableComponent::register(self);
        TreeComponent::register(self);
        PaginationComponent::register(self);
        VirtualScrollComponent::register(self);
        CollapseComponent::register(self);
        DragComponent::register(self);
        SortComponent::register(self);
        FilterComponent::register(self);
        SelectionComponent::register(self);
    }

    /// 批量注册：反馈组件
    pub fn register_feedback_components(&mut self) {
        use crate::feedback::{AlertComponent, ToastComponent, TooltipComponent};
        AlertComponent::register(self);
        ToastComponent::register(self);
        TooltipComponent::register(self);
    }

    /// 批量注册：导航组件
    pub fn register_navigation_components(&mut self) {
        use crate::navigation::{BreadcrumbComponent, MenuComponent, TabsComponent};
        MenuComponent::register(self);
        TabsComponent::register(self);
        BreadcrumbComponent::register(self);
    }

    /// 批量注册：所有组件
    pub fn register_all(&mut self) {
        self.register_basic_components();
        self.register_data_components();
        self.register_feedback_components();
        self.register_navigation_components();
    }
}

/// 样式化组件 trait
///
/// 所有提供样式的组件都应该实现此 trait
pub trait StyledComponent: Sized {
    /// 获取组件的 CSS 样式
    fn styles() -> &'static str;

    /// 注册到样式表
    fn register(registry: &mut StyleRegistry) {
        registry.register(Self::name(), Self::styles());
    }

    /// 组件名称（默认使用类型名的小写形式）
    fn name() -> &'static str;
}
