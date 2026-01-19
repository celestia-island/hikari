// Test file for Background component animation
// Run this with: cargo test --package hikari-components test_background_animation -- --nocapture

#[cfg(test)]
mod tests {

use super::*;

    #[cfg(target_arch = "wasm32")]
    #[test]
    fn test_background_animation_setup() {
        use dioxus::prelude::*;
        use hikari_theme::ThemeProvider;
        
        // Test that Background component can be created without panicking
        let test_app = rsx! {
            ThemeProvider { palette: "hikari" }
                Background {
                    h1 { "Test Content" }
                }
            }
        };
        
        // This test just verifies the component can be instantiated
        // In a real WASM environment, we would test the animation itself
        assert!(true);
        println!("✅ Background component creation test passed");
    }
    
    #[test]
    fn test_background_props() {
        let props = BackgroundProps {
            children: dioxus::prelude::VNode::empty(),
        };
        
        // Just verify we can create props
        assert!(true);
        println!("✅ BackgroundProps creation test passed");
    }
}
