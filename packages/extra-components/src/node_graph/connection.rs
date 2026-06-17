// node_graph/connection.rs
// Connection between node ports with Bezier curves - Framework Agnostic

pub type ConnectionId = String;

/// Connection between two ports
///
/// Previously had Dioxus rendering code. Now a pure data model.
#[derive(Clone, Debug, PartialEq)]
pub struct Connection {
    pub id: ConnectionId,
    pub from_node: String,
    pub from_port: String,
    pub to_node: String,
    pub to_port: String,
    pub path: Vec<(f64, f64)>,
    pub selected: bool,
}

impl Connection {
    #[must_use]
    pub fn new(from_node: &str, from_port: &str, to_node: &str, to_port: &str) -> Self {
        Self {
            id: format!("{from_node}_{from_port}_{to_node}_{to_port}"),
            from_node: from_node.to_string(),
            from_port: from_port.to_string(),
            to_node: to_node.to_string(),
            to_port: to_port.to_string(),
            path: Vec::new(),
            selected: false,
        }
    }

    #[must_use]
    pub const fn with_selected(mut self, selected: bool) -> Self {
        self.selected = selected;
        self
    }

    /// Calculate Bezier curve path
    #[must_use]
    pub fn calculate_bezier_path(
        from_pos: (f64, f64),
        to_pos: (f64, f64),
        from_side: &str,
        to_side: &str,
    ) -> Vec<(f64, f64)> {
        let (x1, y1) = from_pos;
        let (x2, y2) = to_pos;

        // Control points for smooth Bezier curve
        let control_offset = 50.0;
        let cp1 = match from_side {
            "right" => (x1 + control_offset, y1),
            "bottom" => (x1, y1 + control_offset),
            "left" => (x1 - control_offset, y1),
            "top" => (x1, y1 - control_offset),
            _ => (x1 + control_offset, y1),
        };

        let cp2 = match to_side {
            "left" => (x2 - control_offset, y2),
            "top" => (x2, y2 - control_offset),
            "right" => (x2 + control_offset, y2),
            "bottom" => (x2, y2 + control_offset),
            _ => (x2 - control_offset, y2),
        };

        // Generate Bezier curve points
        (0..=50)
            .map(|t| {
                let t = f64::from(t) / 50.0;
                let x = t.powi(3).mul_add(
                    x2,
                    (3.0 * (1.0 - t) * t.powi(2)).mul_add(
                        cp2.0,
                        (3.0 * (1.0 - t).powi(2) * t).mul_add(cp1.0, (1.0 - t).powi(3) * x1),
                    ),
                );
                let y = t.powi(3).mul_add(
                    y2,
                    (3.0 * (1.0 - t) * t.powi(2)).mul_add(
                        cp2.1,
                        (3.0 * (1.0 - t).powi(2) * t).mul_add(cp1.1, (1.0 - t).powi(3) * y1),
                    ),
                );
                (x, y)
            })
            .collect()
    }

    /// Generate SVG path data string for rendering
    #[must_use]
    pub fn svg_path_data(&self, from_pos: (f64, f64), to_pos: (f64, f64)) -> String {
        let path = Self::calculate_bezier_path(from_pos, to_pos, "right", "left");

        format!(
            "M {} {} C {} {} {} {} {} {} {} {}",
            from_pos.0,
            from_pos.1,
            path.get(12).map_or(from_pos.0, |p| p.0),
            path.get(12).map_or(from_pos.1, |p| p.1),
            path.get(25).map_or(from_pos.0, |p| p.0),
            path.get(25).map_or(from_pos.1, |p| p.1),
            path.get(37).map_or(to_pos.0, |p| p.0),
            path.get(37).map_or(to_pos.1, |p| p.1),
            to_pos.0,
            to_pos.1
        )
    }

    /// Get the CSS class string
    #[must_use]
    pub fn class_string(&self) -> String {
        if self.selected {
            "hi-connection hi-connection-selected".to_string()
        } else {
            "hi-connection".to_string()
        }
    }
}

/// Connection line rendering data
///
/// Prepared data for rendering a connection line.
#[derive(Clone, Debug, PartialEq)]
pub struct ConnectionLine {
    pub id: ConnectionId,
    pub from_pos: (f64, f64),
    pub to_pos: (f64, f64),
    pub from_side: String,
    pub to_side: String,
    pub selected: bool,
}

impl ConnectionLine {
    #[must_use]
    pub const fn new(
        id: ConnectionId,
        from_pos: (f64, f64),
        to_pos: (f64, f64),
        from_side: String,
        to_side: String,
    ) -> Self {
        Self {
            id,
            from_pos,
            to_pos,
            from_side,
            to_side,
            selected: false,
        }
    }

    #[must_use]
    pub const fn with_selected(mut self, selected: bool) -> Self {
        self.selected = selected;
        self
    }

    /// Get the SVG path data
    #[must_use]
    pub fn path_data(&self) -> String {
        let path = Connection::calculate_bezier_path(
            self.from_pos,
            self.to_pos,
            &self.from_side,
            &self.to_side,
        );

        format!(
            "M {} {} C {} {} {} {} {} {} {} {}",
            self.from_pos.0,
            self.from_pos.1,
            path.get(12).map_or(self.from_pos.0, |p| p.0),
            path.get(12).map_or(self.from_pos.1, |p| p.1),
            path.get(25).map_or(self.from_pos.0, |p| p.0),
            path.get(25).map_or(self.from_pos.1, |p| p.1),
            path.get(37).map_or(self.to_pos.0, |p| p.0),
            path.get(37).map_or(self.to_pos.1, |p| p.1),
            self.to_pos.0,
            self.to_pos.1
        )
    }
}

use tairitsu_vdom::svg::SafeSvg;
use tairitsu_vdom::{VElement, VNode};

#[must_use]
pub fn render_connection(connection: &Connection) -> VNode {
    let stroke_color = if connection.selected {
        "var(--hi-color-primary, #EEA2A4)"
    } else {
        "var(--hi-color-connection, rgba(0,0,0,0.3))"
    };

    let path_data = if connection.path.is_empty() {
        String::new()
    } else {
        connection
            .path
            .iter()
            .enumerate()
            .map(|(i, &(x, y))| {
                if i == 0 {
                    format!("M {x} {y}")
                } else {
                    format!("L {x} {y}")
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    };

    let svg_content = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" class="{}" style="overflow:visible;"><defs><marker id="arrowhead-{}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="{}"/></marker></defs><path d="{}" stroke="{}" stroke-width="2" fill="none" marker-end="url(#arrowhead-{})"/></svg>"#,
        connection.class_string(),
        connection.id,
        stroke_color,
        path_data,
        stroke_color,
        connection.id,
    );

    VNode::Element(
        VElement::new("div")
            .class("hi-connection-container")
            .key(&connection.id)
            .safe_svg(SafeSvg::new(&svg_content)),
    )
}

#[must_use]
pub fn render_connection_line(line: &ConnectionLine) -> VNode {
    let path_data = line.path_data();
    let stroke_color = if line.selected {
        "var(--hi-color-primary, #EEA2A4)"
    } else {
        "var(--hi-color-connection, rgba(0,0,0,0.3))"
    };
    let stroke_width = if line.selected { "2.5" } else { "2" };
    let class = if line.selected {
        "hi-connection hi-connection-selected"
    } else {
        "hi-connection"
    };

    let svg_content = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" class="{}" style="overflow:visible;"><defs><marker id="arrowhead-{}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="{}"/></marker></defs><path d="{}" stroke="{}" stroke-width="{}" fill="none" marker-end="url(#arrowhead-{})"/></svg>"#,
        class, line.id, stroke_color, path_data, stroke_color, stroke_width, line.id,
    );

    VNode::Element(
        VElement::new("div")
            .class("hi-connection-container")
            .key(&line.id)
            .safe_svg(SafeSvg::new(&svg_content)),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_new() {
        let connection = Connection::new("node1", "out1", "node2", "in1");

        assert_eq!(connection.id, "node1_out1_node2_in1");
        assert_eq!(connection.from_node, "node1");
        assert_eq!(connection.from_port, "out1");
        assert_eq!(connection.to_node, "node2");
        assert_eq!(connection.to_port, "in1");
        assert!(connection.path.is_empty());
    }

    #[test]
    fn test_connection_equality() {
        let conn1 = Connection::new("node1", "out1", "node2", "in1");
        let conn2 = Connection::new("node1", "out1", "node2", "in1");
        let conn3 = Connection::new("node1", "out2", "node2", "in1");

        assert_eq!(conn1, conn2);
        assert_ne!(conn1, conn3);
    }

    #[test]
    fn test_connection_clone() {
        let conn1 = Connection::new("node1", "out1", "node2", "in1");
        let conn2 = conn1.clone();

        assert_eq!(conn1, conn2);
        assert_eq!(conn1.id, conn2.id);
    }

    #[test]
    fn test_connection_with_selected() {
        let conn = Connection::new("node1", "out1", "node2", "in1").with_selected(true);
        assert!(conn.selected);
        assert!(conn.class_string().contains("selected"));
    }

    #[test]
    fn test_calculate_bezier_path_right_to_left() {
        let from_pos = (100.0, 100.0);
        let to_pos = (200.0, 100.0);

        let path = Connection::calculate_bezier_path(from_pos, to_pos, "right", "left");

        assert!(!path.is_empty());
        assert_eq!(path.len(), 51);
        assert_eq!(path[0], from_pos);
        assert_eq!(path[50], to_pos);
    }

    #[test]
    fn test_calculate_bezier_path_left_to_right() {
        let from_pos = (100.0, 100.0);
        let to_pos = (200.0, 100.0);

        let path = Connection::calculate_bezier_path(from_pos, to_pos, "left", "right");

        assert!(!path.is_empty());
        assert_eq!(path.len(), 51);
        assert_eq!(path[0], from_pos);
        assert_eq!(path[50], to_pos);
    }

    #[test]
    fn test_svg_path_data() {
        let conn = Connection::new("node1", "out1", "node2", "in1");
        let path_data = conn.svg_path_data((100.0, 100.0), (200.0, 100.0));

        assert!(path_data.starts_with("M 100 100 C"));
    }

    #[test]
    fn test_connection_line_new() {
        let line = ConnectionLine::new(
            "conn1".to_string(),
            (100.0, 100.0),
            (200.0, 200.0),
            "right".to_string(),
            "left".to_string(),
        );

        assert_eq!(line.id, "conn1");
        assert_eq!(line.from_pos, (100.0, 100.0));
        assert_eq!(line.to_pos, (200.0, 200.0));
    }

    #[test]
    fn test_connection_id_format() {
        let conn = Connection::new("nodeA", "portX", "nodeB", "portY");
        assert_eq!(conn.id, "nodeA_portX_nodeB_portY");
    }

    #[test]
    fn test_connection_id_with_empty_strings() {
        let conn = Connection::new("", "", "", "");
        assert_eq!(conn.id, "___");
    }

    #[test]
    fn test_connection_with_selected_false() {
        let conn = Connection::new("n1", "out", "n2", "in").with_selected(false);
        assert!(!conn.selected);
        assert_eq!(conn.class_string(), "hi-connection");
    }

    #[test]
    fn test_class_string_unselected() {
        let conn = Connection::new("n1", "out", "n2", "in");
        assert_eq!(conn.class_string(), "hi-connection");
    }

    #[test]
    fn test_class_string_selected() {
        let conn = Connection::new("n1", "out", "n2", "in").with_selected(true);
        let cls = conn.class_string();
        assert!(cls.contains("hi-connection-selected"));
    }

    #[test]
    fn test_bezier_path_same_position() {
        let pos = (100.0, 100.0);
        let path = Connection::calculate_bezier_path(pos, pos, "right", "left");
        assert_eq!(path.len(), 51);
        assert_eq!(path[0], pos);
        assert_eq!(path[50], pos);
    }

    #[test]
    fn test_bezier_path_zero_distance() {
        let from = (0.0, 0.0);
        let to = (0.0, 0.0);
        let path = Connection::calculate_bezier_path(from, to, "right", "left");
        assert_eq!(path.len(), 51);
    }

    #[test]
    fn test_bezier_path_very_large_distance() {
        let from = (0.0, 0.0);
        let to = (1e6, 1e6);
        let path = Connection::calculate_bezier_path(from, to, "right", "left");
        assert_eq!(path.len(), 51);
        assert_eq!(path[0], from);
        assert_eq!(path[50], to);
    }

    #[test]
    fn test_bezier_path_negative_coordinates() {
        let from = (-500.0, -300.0);
        let to = (-100.0, -100.0);
        let path = Connection::calculate_bezier_path(from, to, "right", "left");
        assert_eq!(path[0], from);
        assert_eq!(path[50], to);
        for &(x, y) in &path {
            assert!(x.is_finite());
            assert!(y.is_finite());
        }
    }

    #[test]
    fn test_bezier_path_all_sides() {
        let from = (0.0, 0.0);
        let to = (100.0, 100.0);
        for side in &["right", "left", "top", "bottom"] {
            let path = Connection::calculate_bezier_path(from, to, side, side);
            assert_eq!(path.len(), 51, "failed for from_side={side}");
        }
    }

    #[test]
    fn test_bezier_path_unknown_side_uses_default() {
        let from = (0.0, 0.0);
        let to = (100.0, 100.0);
        let path = Connection::calculate_bezier_path(from, to, "unknown", "unknown");
        assert_eq!(path.len(), 51);
        assert_eq!(path[0], from);
        assert_eq!(path[50], to);
    }

    #[test]
    fn test_bezier_path_backwards_connection() {
        let from = (500.0, 100.0);
        let to = (100.0, 100.0);
        let path = Connection::calculate_bezier_path(from, to, "right", "left");
        assert_eq!(path[0], from);
        assert_eq!(path[50], to);
    }

    #[test]
    fn test_svg_path_data_starts_with_m() {
        let conn = Connection::new("n1", "out", "n2", "in");
        let data = conn.svg_path_data((0.0, 0.0), (100.0, 0.0));
        assert!(data.starts_with("M 0 0 C"));
    }

    #[test]
    fn test_svg_path_data_same_position() {
        let conn = Connection::new("n1", "out", "n2", "in");
        let data = conn.svg_path_data((50.0, 50.0), (50.0, 50.0));
        assert!(data.starts_with("M 50 50"));
    }

    #[test]
    fn test_connection_line_with_selected() {
        let line = ConnectionLine::new(
            "c1".to_string(),
            (0.0, 0.0),
            (100.0, 100.0),
            "right".to_string(),
            "left".to_string(),
        )
        .with_selected(true);
        assert!(line.selected);
    }

    #[test]
    fn test_connection_line_path_data() {
        let line = ConnectionLine::new(
            "c1".to_string(),
            (0.0, 0.0),
            (200.0, 100.0),
            "right".to_string(),
            "left".to_string(),
        );
        let data = line.path_data();
        assert!(data.starts_with("M 0 0 C"));
    }

    #[test]
    fn test_connection_line_equality() {
        let l1 = ConnectionLine::new(
            "c1".to_string(),
            (0.0, 0.0),
            (100.0, 100.0),
            "right".to_string(),
            "left".to_string(),
        );
        let l2 = ConnectionLine::new(
            "c1".to_string(),
            (0.0, 0.0),
            (100.0, 100.0),
            "right".to_string(),
            "left".to_string(),
        );
        assert_eq!(l1, l2);
    }

    #[test]
    fn test_connection_path_initially_empty() {
        let conn = Connection::new("n1", "out", "n2", "in");
        assert!(conn.path.is_empty());
    }

    #[test]
    fn test_connection_default_fields() {
        let conn = Connection::new("a", "b", "c", "d");
        assert!(!conn.selected);
        assert!(conn.path.is_empty());
        assert_eq!(conn.from_node, "a");
        assert_eq!(conn.from_port, "b");
        assert_eq!(conn.to_node, "c");
        assert_eq!(conn.to_port, "d");
    }

    #[test]
    fn test_multiple_connections_independent() {
        let c1 = Connection::new("n1", "out1", "n2", "in1");
        let c2 = Connection::new("n1", "out2", "n3", "in1");
        assert_ne!(c1.id, c2.id);
        assert_ne!(c1, c2);
    }
}
