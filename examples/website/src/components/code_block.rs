use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

pub fn render_code_block(language: String, code: String, class: Option<String>) -> VNode {
    let mut class_str = String::from("hi-code-block");
    if let Some(c) = &class {
        class_str.push(' ');
        class_str.push_str(c);
    }

    let header = VNode::Element(
        VElement::new("div")
            .class("hi-code-block-header")
            .child(VNode::Element(
                VElement::new("span")
                    .class("hi-code-block-language")
                    .child(txt(&language)),
            )),
    );

    let code_content = VNode::Element(
        VElement::new("pre")
            .class("hi-code-block-content")
            .child(VNode::Element(
                VElement::new("code")
                    .class("hi-code-block-code")
                    .child(txt(&code)),
            )),
    );

    VNode::Element(
        VElement::new("div")
            .class(class_str)
            .child(header)
            .child(code_content),
    )
}
