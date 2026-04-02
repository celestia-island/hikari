use super::drag_layer::{DragConstraints, DragLayerState};

#[derive(Clone, PartialEq, Debug)]
pub struct DraggableCardState {
    pub inner: DragLayerState,
}

impl DraggableCardState {
    pub fn new() -> Self {
        Self {
            inner: DragLayerState::new(),
        }
    }

    pub fn with_position(mut self, x: f64, y: f64) -> Self {
        self.inner = self.inner.with_position(x, y);
        self
    }

    pub fn with_constraints(mut self, constraints: DragConstraints) -> Self {
        self.inner = self.inner.with_constraints(constraints);
        self
    }

    pub fn with_z_index(mut self, z_index: i32) -> Self {
        self.inner = self.inner.with_z_index(z_index);
        self
    }

    pub fn with_draggable(mut self, draggable: bool) -> Self {
        self.inner = self.inner.with_draggable(draggable);
        self
    }

    pub fn with_class(mut self, class: impl Into<String>) -> Self {
        self.inner = self.inner.with_class(class);
        self
    }
}

impl Default for DraggableCardState {
    fn default() -> Self {
        Self::new()
    }
}
