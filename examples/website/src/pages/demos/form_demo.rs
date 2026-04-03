use tairitsu_vdom::{VElement, VNode, VText};

use crate::components::page_layout::{render_demo_section, render_page_container};

pub fn render_form_demo() -> VNode {
    let form_content = VNode::Element(
        VElement::new("div")
            .style("display:flex;justify-content:center;align-items:center;padding:2rem")
            .child(VNode::Element(
                VElement::new("div")
                    .class("card")
                    .style("width:100%;max-width:420px;padding:2rem")
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("form-header")
                            .style("margin-bottom:1.5rem;text-align:center")
                            .child(VNode::Element(
                                VElement::new("h2")
                                    .style("font-size:1.5rem;font-weight:700;margin-bottom:0.25rem;color:var(--hi-color-primary)")
                                    .child(VNode::Text(VText::new("Login"))),
                            ))
                            .child(VNode::Element(
                                VElement::new("p")
                                    .style("color:var(--hi-color-secondary);font-size:0.875rem")
                                    .child(VNode::Text(VText::new("Welcome back, please sign in to your account"))),
                            )),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .style("margin-bottom:1.5rem")
                            .child(VNode::Element(
                                VElement::new("div")
                                    .style("margin-bottom:1rem")
                                    .child(VNode::Element(
                                        VElement::new("label")
                                            .class("hi-label")
                                            .attr("for", "demo-email")
                                            .child(VNode::Text(VText::new("Email"))),
                                    ))
                                    .child(VNode::Element(
                                        VElement::new("input")
                                            .attr("id", "demo-email")
                                            .class("hi-input")
                                            .attr("type", "email")
                                            .attr("placeholder", "you@example.com")
                                            .attr("required", "true"),
                                    )),
                            ))
                            .child(VNode::Element(
                                VElement::new("div")
                                    .style("margin-bottom:1rem")
                                    .child(VNode::Element(
                                        VElement::new("label")
                                            .class("hi-label")
                                            .attr("for", "demo-password")
                                            .child(VNode::Text(VText::new("Password"))),
                                    ))
                                    .child(VNode::Element(
                                        VElement::new("input")
                                            .attr("id", "demo-password")
                                            .class("hi-input")
                                            .attr("type", "password")
                                            .attr("placeholder", "Enter your password")
                                            .attr("required", "true"),
                                    )),
                            ))
                            .child(VNode::Element(
                                VElement::new("div")
                                    .style("display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem")
                                    .child(VNode::Element(
                                        VElement::new("label")
                                            .style("display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer")
                                            .child(VNode::Element(
                                                VElement::new("input")
                                                    .attr("type", "checkbox")
                                                    .class("hi-switch__input"),
                                            ))
                                            .child(VNode::Text(VText::new("Remember me"))),
                                    ))
                                    .child(VNode::Element(
                                        VElement::new("a")
                                            .style("font-size:0.875rem;color:var(--hi-color-primary);text-decoration:none")
                                            .child(VNode::Text(VText::new("Forgot password?"))),
                                    )),
                            ))
                            .child(VNode::Element(
                                VElement::new("div")
                                    .style("display:flex;gap:0.75rem")
                                    .child(VNode::Element(
                                        VElement::new("button")
                                            .attr("type", "submit")
                                            .class("hi-btn hi-btn--primary hi-btn--lg")
                                            .style("flex:1")
                                            .child(VNode::Text(VText::new("Sign In"))),
                                    ))
                                    .child(VNode::Element(
                                        VElement::new("button")
                                            .attr("type", "button")
                                            .class("hi-btn hi-btn--secondary hi-btn--lg")
                                            .child(VNode::Text(VText::new("Cancel"))),
                                    )),
                            )),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .style("text-align:center;margin-top:1rem;font-size:0.875rem;color:var(--hi-color-secondary)")
                            .child(VNode::Text(VText::new("Don't have an account? ")))
                            .child(VNode::Element(
                                VElement::new("a")
                                    .style("color:var(--hi-color-primary);text-decoration:none")
                                    .child(VNode::Text(VText::new("Sign up"))),
                            )),
                    )),
            )),
    );

    let section = render_demo_section("Login Form", form_content);

    render_page_container(
        Some("Form Demo"),
        Some("Demonstrates how to build a complete login form using Layer 1 basic components."),
        VNode::Element(
            VElement::new("div")
                .attr("id", "page-demos-form")
                .class("hikari-page")
                .child(section),
        ),
    )
}
