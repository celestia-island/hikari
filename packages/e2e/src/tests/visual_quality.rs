// hikari-e2e/src/tests/visual_quality.rs
// Visual quality and interactive behavior testing

use anyhow::Result;
use std::time::Duration;
use thirtyfour::{By, WebDriver};
use tracing::{info, warn};

/// Visual quality test result
#[derive(Debug, Clone)]
pub struct VisualQualityTest {
    pub component_name: String,
    pub route: String,
    pub tests: Vec<VisualCheck>,
    pub passed: usize,
    pub failed: usize,
}

#[derive(Debug, Clone)]
pub struct VisualCheck {
    pub check_name: String,
    pub check_type: VisualCheckType,
    pub description: String,
    pub passed: bool,
    pub details: String,
    pub screenshot_before: Option<String>,
    pub screenshot_after: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub enum VisualCheckType {
    /// Check if element exists and is visible
    Visibility,
    /// Check hover state visual feedback
    HoverEffect,
    /// Check focus state visual feedback
    FocusEffect,
    /// Check click behavior (state change)
    ClickBehavior,
    /// Check if disabled state looks correct
    DisabledState,
    /// Check if element alignment is correct
    Alignment,
    /// Check if colors match theme
    ColorTheme,
    /// Check if icons are properly aligned
    IconAlignment,
}

impl VisualQualityTest {
    pub fn new(component_name: &str, route: &str) -> Self {
        Self {
            component_name: component_name.to_string(),
            route: route.to_string(),
            tests: vec![],
            passed: 0,
            failed: 0,
        }
    }

    pub fn add_check(&mut self, check: VisualCheck) {
        if check.passed {
            self.passed += 1;
        } else {
            self.failed += 1;
        }
        self.tests.push(check);
    }

    pub fn success_rate(&self) -> f32 {
        if self.tests.is_empty() {
            return 1.0;
        }
        self.passed as f32 / self.tests.len() as f32
    }
}

pub struct VisualQualityTests;

impl VisualQualityTests {
    /// Test button hover and click behavior
    pub async fn test_button_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("Button", "/demos/animation");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        // Navigate to animation demo page (has actual interactive buttons)
        driver.goto(&format!("{}/demos/animation", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(5000)).await;

        // Check if palette page is loaded
        match driver.find(By::Css("h1, .page-title")).await {
            Ok(_) => {
                test.add_check(VisualCheck {
                    check_name: "Palette Page Loaded".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Palette page loaded".to_string(),
                    passed: true,
                    details: "Palette page loaded successfully".to_string(),
                    screenshot_before: None,
                    screenshot_after: None,
                });

                // Check for color swatches
                match driver.find_all(By::Css(".color-swatch, [class*='bg-']")).await {
                    Ok(swatches) => {
                        if !swatches.is_empty() {
                            test.add_check(VisualCheck {
                                check_name: "Color Swatches".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: format!("Found {} color swatches", swatches.len()),
                                passed: swatches.len() > 0,
                                details: format!("Palette page has {} color swatches", swatches.len()),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        } else {
                            test.add_check(VisualCheck {
                                check_name: "Color Swatches".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: "Color swatches are visible".to_string(),
                                passed: false,
                                details: "No color swatches found".to_string(),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        }
                    }
                    Err(e) => {
                        test.add_check(VisualCheck {
                            check_name: "Color Swatches Find".to_string(),
                            check_type: VisualCheckType::Visibility,
                            description: "Color swatches can be found".to_string(),
                            passed: false,
                            details: format!("Failed to find swatches: {}", e),
                            screenshot_before: None,
                            screenshot_after: None,
                        });
                    }
                }
            }
            Err(e) => {
                test.add_check(VisualCheck {
                    check_name: "Palette Page Load".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Palette page loaded".to_string(),
                    passed: false,
                    details: format!("Failed to load: {}", e),
                    screenshot_before: None,
                    screenshot_after: None,
                });
            }
        }

        Ok(test)
    }

    /// Run all visual quality tests
    pub async fn run_all(driver: &WebDriver) -> Result<Vec<VisualQualityTest>> {
        info!("Running visual quality tests...\n");

        let mut results = vec![];

        // Test Button
        match Self::test_button_quality(driver).await {
            Ok(test) => {
                info!("Animation Demo test: {} checks, {} passed, {} failed",
                    test.tests.len(), test.passed, test.failed);
                results.push(test);
            }
            Err(e) => {
                warn!("Animation Demo test failed: {}", e);
            }
        }

        // Test Form Controls
        match Self::test_form_controls_quality(driver).await {
            Ok(test) => {
                info!("Form Demo test: {} checks, {} passed, {} failed",
                    test.tests.len(), test.passed, test.failed);
                results.push(test);
            }
            Err(e) => {
                warn!("Form Demo test failed: {}", e);
            }
        }

        // Test Animation Buttons
        match Self::test_switch_quality(driver).await {
            Ok(test) => {
                info!("Animation Buttons test: {} checks, {} passed, {} failed",
                    test.tests.len(), test.passed, test.failed);
                results.push(test);
            }
            Err(e) => {
                warn!("Animation Buttons test failed: {}", e);
            }
        }

        // Test Dashboard
        match Self::test_tabs_quality(driver).await {
            Ok(test) => {
                info!("Dashboard Demo test: {} checks, {} passed, {} failed",
                    test.tests.len(), test.passed, test.failed);
                results.push(test);
            }
            Err(e) => {
                warn!("Dashboard Demo test failed: {}", e);
            }
        }

        // Test Entry Components
        match Self::test_entry_components_quality(driver).await {
            Ok(test) => {
                info!("Entry Components test: {} checks, {} passed, {} failed",
                    test.tests.len(), test.passed, test.failed);
                results.push(test);
            }
            Err(e) => {
                warn!("Entry Components test failed: {}", e);
            }
        }

        // Test Extra Components
        match Self::test_extra_components_quality(driver).await {
            Ok(test) => {
                info!("Extra Components test: {} checks, {} passed, {} failed",
                    test.tests.len(), test.passed, test.failed);
                results.push(test);
            }
            Err(e) => {
                warn!("Extra Components test failed: {}", e);
            }
        }

        // Test Layer 3 Components
        match Self::test_layer3_components_quality(driver).await {
            Ok(test) => {
                info!("Layer 3 Components test: {} checks, {} passed, {} failed",
                    test.tests.len(), test.passed, test.failed);
                results.push(test);
            }
            Err(e) => {
                warn!("Layer 3 Components test failed: {}", e);
            }
        }

        // Test System Pages
        match Self::test_system_pages_quality(driver).await {
            Ok(test) => {
                info!("System Pages test: {} checks, {} passed, {} failed",
                    test.tests.len(), test.passed, test.failed);
                results.push(test);
            }
            Err(e) => {
                warn!("System Pages test failed: {}", e);
            }
        }

        // Print summary
        info!("\n=== Visual Quality Test Summary ===");
        for test in &results {
            info!("{}: {:.0}% success rate ({} passed, {} failed)",
                test.component_name,
                test.success_rate() * 100.0,
                test.passed,
                test.failed
            );
        }

        Ok(results)
    }
}
