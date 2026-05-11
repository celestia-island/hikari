#[cfg(test)]
mod tests {
    use super::*;
    use crate::styled::StyledComponent;

    #[test]
    fn test_background_component_name() {
        assert_eq!(BackgroundComponent::name(), "background");
    }

    #[test]
    fn test_background_styles_loaded() {
        let styles = BackgroundComponent::styles();
        assert!(!styles.is_empty());
    }
}
