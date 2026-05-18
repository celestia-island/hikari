#[cfg(test)]
mod tests {

    use hikari_components::basic::badge::{Badge, BadgeProps, BadgeVariant};
    use hikari_components::basic::button::{Button, ButtonProps, ButtonVariant};
    use hikari_components::basic::canvas::{Canvas, CanvasProps};
    use hikari_components::basic::card::{Card, CardProps};
    use hikari_components::basic::checkbox::{Checkbox, CheckboxProps};
    use hikari_components::basic::date_picker::{DatePicker, DatePickerProps};
    use hikari_components::basic::divider::{Divider, DividerProps};
    use hikari_components::basic::file_upload::{FileUpload, FileUploadProps};
    use hikari_components::basic::image::{Image, ImageProps};
    use hikari_components::basic::input::{Input, InputProps};
    use hikari_components::basic::radio_group::{RadioGroup, RadioGroupProps};
    use hikari_components::basic::select::{Select, SelectProps};
    use hikari_components::basic::slider::{Slider, SliderProps};
    use hikari_components::basic::switch::{Switch, SwitchProps};
    use hikari_components::basic::textarea::{Textarea, TextareaProps};
    use hikari_components::portal::{PortalContext, PortalEntry};
    use hikari_components::prelude::*;
    use tairitsu_vdom::vnode::VNode;

    fn find_elements_by_tag<'a>(
        node: &'a VNode,
        tag: &str,
    ) -> Vec<&'a tairitsu_vdom::vnode::VElement> {
        let mut results = Vec::new();
        find_elements_recursive(node, tag, &mut results);
        results
    }

    fn find_elements_recursive<'a>(
        node: &'a VNode,
        tag: &str,
        results: &mut Vec<&'a tairitsu_vdom::vnode::VElement>,
    ) {
        match node {
            VNode::Element(el) => {
                if el.tag == tag {
                    results.push(el);
                }
                for child in &el.children {
                    find_elements_recursive(child, tag, results);
                }
            }
            VNode::Fragment(children) => {
                for child in children {
                    find_elements_recursive(child, tag, results);
                }
            }
            VNode::Text(_) => {}
            VNode::DynamicText(_) => {}
        }
    }

    fn count_elements(node: &VNode) -> usize {
        match node {
            VNode::Element(el) => 1 + el.children.iter().map(count_elements).sum::<usize>(),
            VNode::Fragment(children) => children.iter().map(count_elements).sum(),
            VNode::Text(_) => 1,
            VNode::DynamicText(_) => 1,
        }
    }

    #[test]
    fn test_button_renders_with_inner_button_tag() {
        let node = Button(ButtonProps::default());
        let buttons = find_elements_by_tag(&node, "button");
        assert!(
            !buttons.is_empty(),
            "Button component should render a <button> element"
        );
    }

    #[test]
    fn test_button_variant_props() {
        assert_eq!(ButtonVariant::default(), ButtonVariant::Primary);
        let props = ButtonProps {
            variant: ButtonVariant::Danger,
            ..Default::default()
        };
        let node = Button(props);
        assert!(
            count_elements(&node) > 0,
            "Should produce at least one element"
        );
    }

    #[test]
    fn test_button_with_class_propagates() {
        let node = Button(ButtonProps {
            class: "custom-btn".to_string(),
            ..Default::default()
        });
        let buttons = find_elements_by_tag(&node, "button");
        assert!(!buttons.is_empty());
        let btn = &buttons[0];
        assert!(
            btn.class.to_string().contains("custom-btn"),
            "Custom class should propagate to <button>, got: {:?}",
            btn.class
        );
    }

    #[test]
    fn test_input_renders_with_inner_input_tag() {
        let node = Input(InputProps::default());
        let inputs = find_elements_by_tag(&node, "input");
        assert!(
            !inputs.is_empty(),
            "Input component should render an <input> element"
        );
    }

    #[test]
    fn test_input_with_placeholder() {
        let node = Input(InputProps {
            placeholder: Some("Type here".to_string()),
            ..Default::default()
        });
        let inputs = find_elements_by_tag(&node, "input");
        assert!(!inputs.is_empty());
        let input = &inputs[0];
        assert_eq!(
            input.attributes.get("placeholder").map(|s| s.as_str()),
            Some("Type here"),
            "Placeholder should be set on <input>"
        );
    }

    #[test]
    fn test_checkbox_renders() {
        let _ = Checkbox(CheckboxProps::default());
    }

    #[test]
    fn test_radio_group_renders() {
        let _ = RadioGroup(RadioGroupProps::default());
    }

    #[test]
    fn test_switch_renders() {
        let _ = Switch(SwitchProps::default());
    }

    #[test]
    fn test_badge_renders_non_empty() {
        let node = Badge(BadgeProps::default());
        assert!(
            count_elements(&node) > 0,
            "Badge should render at least one element"
        );
    }

    #[test]
    fn test_badge_variant_props() {
        let _ = Badge(BadgeProps {
            variant: BadgeVariant::Success,
            ..Default::default()
        });
    }

    #[test]
    fn test_card_renders() {
        let _ = Card(CardProps::default());
    }

    #[test]
    fn test_divider_renders() {
        let _ = Divider(DividerProps::default());
    }

    #[test]
    fn test_image_renders() {
        let _ = Image(ImageProps::default());
    }

    #[test]
    fn test_file_upload_renders() {
        let _ = FileUpload(FileUploadProps::default());
    }

    #[test]
    fn test_slider_renders() {
        let _ = Slider(SliderProps::default());
    }

    #[test]
    fn test_select_renders() {
        let entries = use_signal(Vec::<PortalEntry>::new);
        provide_context(PortalContext {
            entries: entries.clone(),
            add_entry: Callback::new(|_| {}),
            remove_entry: Callback::new(|_| {}),
            clear_all: Callback::new(|_| {}),
            start_close_animation: Callback::new(|_| {}),
        });
        let _ = Select(SelectProps::default());
    }

    #[test]
    fn test_textarea_renders_with_inner_textarea_tag() {
        let node = Textarea(TextareaProps::default());
        let textareas = find_elements_by_tag(&node, "textarea");
        assert!(
            !textareas.is_empty(),
            "Textarea component should render a <textarea> element"
        );
    }

    #[test]
    fn test_date_picker_renders() {
        let _ = DatePicker(DatePickerProps::default());
    }

    #[test]
    fn test_canvas_renders_with_inner_canvas_tag() {
        let node = Canvas(CanvasProps {
            width: Some(400),
            height: Some(300),
            ..Default::default()
        });
        let canvases = find_elements_by_tag(&node, "canvas");
        assert!(
            !canvases.is_empty(),
            "Canvas component should render a <canvas> element"
        );
    }
}
