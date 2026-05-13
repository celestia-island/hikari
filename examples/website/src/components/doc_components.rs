use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

pub fn render_section(title: &str, content: VNode) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class("section mb-12")
            .child(VNode::Element(
                VElement::new("h2")
                    .class("text-2xl font-bold mb-4")
                    .child(txt(title)),
            ))
            .child(content),
    )
}

pub fn render_props_table(props: Vec<(&str, &str, &str, &str)>) -> VNode {
    let th_class = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
    let th_names = ["Name", "Type", "Default", "Description"];

    let header_cells: Vec<VNode> = th_names
        .iter()
        .map(|name| VNode::Element(VElement::new("th").class(th_class).child(txt(name))))
        .collect();

    let thead = VNode::Element(
        VElement::new("thead")
            .class("bg-gray-50")
            .child(VNode::Element(VElement::new("tr").children(header_cells))),
    );

    let td_mono = "px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono";
    let td_name = "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 font-mono";
    let td_desc = "px-6 py-4 text-sm text-gray-500";

    let rows: Vec<VNode> = props
        .iter()
        .map(|(name, prop_type, default, description)| {
            VNode::Element(
                VElement::new("tr")
                    .child(VNode::Element(
                        VElement::new("td").class(td_name).child(txt(name)),
                    ))
                    .child(VNode::Element(
                        VElement::new("td").class(td_mono).child(txt(prop_type)),
                    ))
                    .child(VNode::Element(
                        VElement::new("td").class(td_mono).child(txt(default)),
                    ))
                    .child(VNode::Element(
                        VElement::new("td").class(td_desc).child(txt(description)),
                    )),
            )
        })
        .collect();

    let tbody = VNode::Element(
        VElement::new("tbody")
            .class("bg-white divide-y divide-gray-200")
            .children(rows),
    );

    let table = VNode::Element(
        VElement::new("table")
            .class("min-w-full divide-y divide-gray-200")
            .child(thead)
            .child(tbody),
    );

    VNode::Element(
        VElement::new("div")
            .class("props-table overflow-x-auto")
            .child(table),
    )
}

pub fn render_example_card(title: &str, description: &str, code: VNode, preview: VNode) -> VNode {
    let info = VNode::Element(
        VElement::new("div")
            .class("p-4 border-b")
            .child(VNode::Element(
                VElement::new("h3")
                    .class("text-lg font-semibold mb-2")
                    .child(txt(title)),
            ))
            .child(VNode::Element(
                VElement::new("p")
                    .class("text-gray-600 text-sm")
                    .child(txt(description)),
            )),
    );

    let code_section = VNode::Element(
        VElement::new("div")
            .class("p-4 bg-gray-50")
            .child(VNode::Element(
                VElement::new("h4")
                    .class("text-sm font-medium mb-2")
                    .child(txt("Code")),
            ))
            .child(code),
    );

    let preview_section = VNode::Element(
        VElement::new("div")
            .class("p-4")
            .child(VNode::Element(
                VElement::new("h4")
                    .class("text-sm font-medium mb-2")
                    .child(txt("Preview")),
            ))
            .child(VNode::Element(
                VElement::new("div").class("preview").child(preview),
            )),
    );

    VNode::Element(
        VElement::new("div")
            .class("example-card mb-6")
            .child(VNode::Element(
                VElement::new("div")
                    .class("border rounded-lg overflow-hidden")
                    .child(info)
                    .child(code_section)
                    .child(preview_section),
            )),
    )
}
