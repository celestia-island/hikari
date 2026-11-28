//! Helpers shared by the components' test modules.

use tairitsu_vdom::{ChangeEvent, EventData, InputEvent, VNode};

/// Fire an `input` event at the first element tagged `tag` whose class
/// contains `class_part` and that has an input listener — the way a keystroke
/// lands on a field.
///
/// The event carries two different strings on purpose: `data` is the fragment
/// the keystroke inserted, `value` is the field's whole value afterwards (the
/// DOM `InputEvent.data` and its target's `value`). A controlled field stores
/// the value; a handler that forwards the fragment is caught, because the
/// tests pass a fragment that differs from the value.
///
/// Serialization drops handlers, so the tree is walked and the listener is
/// invoked in place; a field without the wiring is not matched.
pub(crate) fn type_into(
    node: &VNode,
    tag: &str,
    class_part: &str,
    data: &str,
    value: &str,
) -> bool {
    match node {
        VNode::Element(element) => {
            if element.tag == tag
                && element.class.to_string().contains(class_part)
                && let Some(handler) = element.event_handlers.get("input")
            {
                handler.borrow_mut()(
                    Box::new(InputEvent::new().data(data).value(value)) as Box<dyn EventData>
                );
                return true;
            }
            element
                .children
                .iter()
                .any(|child| type_into(child, tag, class_part, data, value))
        }
        VNode::Fragment(children) => children
            .iter()
            .any(|child| type_into(child, tag, class_part, data, value)),
        _ => false,
    }
}

/// Fire a `change` event at the first element tagged `tag` whose class
/// contains `class_part` and that has a change listener — the way a commit
/// (a blur after an edit, a picked option) lands on a field. `value` is the
/// committed value (`ChangeEvent.value`).
///
/// As with [`type_into`], the tree is walked and the listener is invoked in
/// place; a field without the wiring is not matched, which is what catches a
/// mirror that takes an `onchange` prop and never wires it to its element.
pub(crate) fn commit_on(node: &VNode, tag: &str, class_part: &str, value: &str) -> bool {
    match node {
        VNode::Element(element) => {
            if element.tag == tag
                && element.class.to_string().contains(class_part)
                && let Some(handler) = element.event_handlers.get("change")
            {
                handler.borrow_mut()(
                    Box::new(ChangeEvent::new().value(value)) as Box<dyn EventData>
                );
                return true;
            }
            element
                .children
                .iter()
                .any(|child| commit_on(child, tag, class_part, value))
        }
        VNode::Fragment(children) => children
            .iter()
            .any(|child| commit_on(child, tag, class_part, value)),
        _ => false,
    }
}
