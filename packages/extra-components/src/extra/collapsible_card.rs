use super::collapsible::{CollapsiblePosition, CollapsibleState};

#[derive(Clone, PartialEq, Debug)]
pub struct CollapsibleCardState {
    pub inner: CollapsibleState,
}

impl CollapsibleCardState {
    pub fn new(title: String) -> Self {
        Self {
            inner: CollapsibleState::new(title),
        }
    }

    pub fn with_expanded(mut self, expanded: bool) -> Self {
        self.inner = self.inner.with_expanded(expanded);
        self
    }

    pub fn with_collapsible(mut self, collapsible: bool) -> Self {
        self.inner = self.inner.with_collapsible(collapsible);
        self
    }

    pub fn with_position(mut self, position: CollapsiblePosition) -> Self {
        self.inner = self.inner.with_position(position);
        self
    }

    pub fn with_width(mut self, width: u32) -> Self {
        self.inner = self.inner.with_width(width);
        self
    }

    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.inner = self.inner.with_class(class);
        self
    }

    pub fn toggle(&mut self) {
        self.inner.toggle();
    }
}

impl Default for CollapsibleCardState {
    fn default() -> Self {
        Self::new(String::new())
    }
}

pub fn render_collapsible_card(state: &CollapsibleCardState) -> tairitsu_vdom::VNode {
    super::collapsible::render_collapsible(&state.inner)
}
