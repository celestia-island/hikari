//! Macro for building SVG from IconData

/// Build SVG string from IconData
#[macro_export]
macro_rules! build_svg {
    ($data:expr) => {{
        let data = $data;

        // Start SVG element
        let mut svg = String::from("<svg xmlns=\"http://www.w3.org/2000/svg\"");

        // Add viewBox
        if let Some(vb) = data.view_box {
            svg.push_str(" viewBox=\"");
            svg.push_str(vb);
            svg.push_str("\"");
        }

        // Add width
        if let Some(w) = data.width {
            svg.push_str(" width=\"");
            svg.push_str(w);
            svg.push_str("\"");
        }

        // Add height
        if let Some(h) = data.height {
            svg.push_str(" height=\"");
            svg.push_str(h);
            svg.push_str("\"");
        }

        svg.push_str(">");

        // Add main path
        if let Some(path_d) = data.path {
            svg.push_str("<path d=\"");
            svg.push_str(path_d);
            svg.push_str("\" />");
        }

        // Add additional paths
        for path in data.paths {
            svg.push_str("<path");
            if let Some(d) = path.d {
                svg.push_str(" d=\"");
                svg.push_str(d);
                svg.push_str("\"");
            }
            if let Some(fill) = path.fill {
                svg.push_str(" fill=\"");
                svg.push_str(fill);
                svg.push_str("\"");
            }
            if let Some(stroke) = path.stroke {
                svg.push_str(" stroke=\"");
                svg.push_str(stroke);
                svg.push_str("\"");
            }
            if let Some(stroke_width) = path.stroke_width {
                svg.push_str(" stroke-width=\"");
                svg.push_str(stroke_width);
                svg.push_str("\"");
            }
            if let Some(stroke_linecap) = path.stroke_linecap {
                svg.push_str(" stroke-linecap=\"");
                svg.push_str(stroke_linecap);
                svg.push_str("\"");
            }
            if let Some(stroke_linejoin) = path.stroke_linejoin {
                svg.push_str(" stroke-linejoin=\"");
                svg.push_str(stroke_linejoin);
                svg.push_str("\"");
            }
            if let Some(transform) = path.transform {
                svg.push_str(" transform=\"");
                svg.push_str(transform);
                svg.push_str("\"");
            }
            svg.push_str(" />");
        }

        // Add other elements
        for elem in data.elements {
            svg.push_str("<");
            svg.push_str(elem.tag);
            for (key, value) in elem.attributes {
                svg.push_str(" ");
                svg.push_str(key);
                svg.push_str("=\"");
                svg.push_str(value);
                svg.push_str("\"");
            }
            svg.push_str(" />");
        }

        // Close SVG
        svg.push_str("</svg>");

        svg
    }};
}

/// Build SVG string with additional attributes
#[macro_export]
macro_rules! build_svg_with_attrs {
    ($data:expr, $attrs:expr) => {{
        let data = $data;
        let attrs = $attrs;

        // Start SVG element
        let mut svg = String::from("<svg xmlns=\"http://www.w3.org/2000/svg\"");

        // Add viewBox
        if let Some(vb) = data.view_box {
            svg.push_str(" viewBox=\"");
            svg.push_str(vb);
            svg.push_str("\"");
        }

        // Add width
        if let Some(w) = data.width {
            svg.push_str(" width=\"");
            svg.push_str(w);
            svg.push_str("\"");
        }

        // Add height
        if let Some(h) = data.height {
            svg.push_str(" height=\"");
            svg.push_str(h);
            svg.push_str("\"");
        }

        // Add custom attributes
        for (key, value) in attrs {
            svg.push_str(" ");
            svg.push_str(key);
            svg.push_str("=\"");
            svg.push_str(value);
            svg.push_str("\"");
        }

        svg.push_str(">");

        // Add main path
        if let Some(path_d) = data.path {
            svg.push_str("<path d=\"");
            svg.push_str(path_d);
            svg.push_str("\" />");
        }

        // Add additional paths
        for path in data.paths {
            svg.push_str("<path");
            if let Some(d) = path.d {
                svg.push_str(" d=\"");
                svg.push_str(d);
                svg.push_str("\"");
            }
            if let Some(fill) = path.fill {
                svg.push_str(" fill=\"");
                svg.push_str(fill);
                svg.push_str("\"");
            }
            if let Some(stroke) = path.stroke {
                svg.push_str(" stroke=\"");
                svg.push_str(stroke);
                svg.push_str("\"");
            }
            if let Some(stroke_width) = path.stroke_width {
                svg.push_str(" stroke-width=\"");
                svg.push_str(stroke_width);
                svg.push_str("\"");
            }
            if let Some(stroke_linecap) = path.stroke_linecap {
                svg.push_str(" stroke-linecap=\"");
                svg.push_str(stroke_linecap);
                svg.push_str("\"");
            }
            if let Some(stroke_linejoin) = path.stroke_linejoin {
                svg.push_str(" stroke-linejoin=\"");
                svg.push_str(stroke_linejoin);
                svg.push_str("\"");
            }
            if let Some(transform) = path.transform {
                svg.push_str(" transform=\"");
                svg.push_str(transform);
                svg.push_str("\"");
            }
            svg.push_str(" />");
        }

        // Add other elements
        for elem in data.elements {
            svg.push_str("<");
            svg.push_str(elem.tag);
            for (key, value) in elem.attributes {
                svg.push_str(" ");
                svg.push_str(key);
                svg.push_str("=\"");
                svg.push_str(value);
                svg.push_str("\"");
            }
            svg.push_str(" />");
        }

        // Close SVG
        svg.push_str("</svg>");

        svg
    }};
}
