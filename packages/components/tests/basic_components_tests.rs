#[cfg(test)]
mod tests {
    use hikari_components::basic::badge::{Badge, BadgeProps};
    use hikari_components::basic::button::{Button, ButtonProps};
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

    #[test]
    fn test_button_renders() {
        let _ = Button(ButtonProps::default());
    }

    #[test]
    fn test_input_renders() {
        let _ = Input(InputProps::default());
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
    fn test_badge_renders() {
        let _ = Badge(BadgeProps::default());
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
    fn test_textarea_renders() {
        let _ = Textarea(TextareaProps::default());
    }

    #[test]
    fn test_date_picker_renders() {
        let _ = DatePicker(DatePickerProps::default());
    }

    #[test]
    fn test_canvas_renders() {
        let _ = Canvas(CanvasProps::default());
    }
}
