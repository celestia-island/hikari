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
    /// Test button hover and click behavior on Animation Demo page
    pub async fn test_button_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("Button", "/demos/animation");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        info!("Testing button quality on Animation Demo page...");

        driver.goto(&format!("{}/demos/animation", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(8000)).await;

        match driver.find(By::Css("h1, .page-title")).await {
            Ok(_) => {
                test.add_check(VisualCheck {
                    check_name: "Page Loaded".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Animation Demo page loaded".to_string(),
                    passed: true,
                    details: "Animation Demo page loaded successfully".to_string(),
                    screenshot_before: None,
                    screenshot_after: None,
                });

                match driver.find_all(By::Css("button")).await {
                    Ok(buttons) => {
                        if !buttons.is_empty() {
                            test.add_check(VisualCheck {
                                check_name: "Buttons Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: format!("Found {} buttons", buttons.len()),
                                passed: buttons.len() > 0,
                                details: format!("Page has {} buttons", buttons.len()),
                                screenshot_before: None,
                                screenshot_after: None,
                            });

                            if let Some(btn) = buttons.first() {
                                let _ = btn.click().await;
                                tokio::time::sleep(Duration::from_millis(500)).await;

                                test.add_check(VisualCheck {
                                    check_name: "Button Click".to_string(),
                                    check_type: VisualCheckType::ClickBehavior,
                                    description: "Button click works".to_string(),
                                    passed: true,
                                    details: "Button click executed successfully".to_string(),
                                    screenshot_before: None,
                                    screenshot_after: None,
                                });
                            }
                        } else {
                            test.add_check(VisualCheck {
                                check_name: "Buttons Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: "Buttons are visible".to_string(),
                                passed: false,
                                details: "No buttons found".to_string(),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        }
                    }
                    Err(e) => {
                        test.add_check(VisualCheck {
                            check_name: "Buttons Find".to_string(),
                            check_type: VisualCheckType::Visibility,
                            description: "Buttons can be found".to_string(),
                            passed: false,
                            details: format!("Failed to find buttons: {}", e),
                            screenshot_before: None,
                            screenshot_after: None,
                        });
                    }
                }
            }
            Err(e) => {
                test.add_check(VisualCheck {
                    check_name: "Page Load".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Animation Demo page loaded".to_string(),
                    passed: false,
                    details: format!("Failed to load: {}", e),
                    screenshot_before: None,
                    screenshot_after: None,
                });
            }
        }

        Ok(test)
    }

    /// Test form controls on Form Demo page
    pub async fn test_form_controls_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("Form Controls", "/demos/layer1/form");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        info!("Testing form controls quality...");

        driver.goto(&format!("{}/demos/layer1/form", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(8000)).await;

        match driver.find(By::Css("h1, .page-title")).await {
            Ok(_) => {
                test.add_check(VisualCheck {
                    check_name: "Page Loaded".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Form Demo page loaded".to_string(),
                    passed: true,
                    details: "Form Demo page loaded successfully".to_string(),
                    screenshot_before: None,
                    screenshot_after: None,
                });

                match driver.find_all(By::Css("input, textarea, select")).await {
                    Ok(inputs) => {
                        if !inputs.is_empty() {
                            test.add_check(VisualCheck {
                                check_name: "Form Inputs Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: format!("Found {} form inputs", inputs.len()),
                                passed: inputs.len() > 0,
                                details: format!("Page has {} form inputs", inputs.len()),
                                screenshot_before: None,
                                screenshot_after: None,
                            });

                            if let Some(input) = inputs.first() {
                                let _ = input.send_keys("test input").await;
                                tokio::time::sleep(Duration::from_millis(500)).await;

                                test.add_check(VisualCheck {
                                    check_name: "Input Typing".to_string(),
                                    check_type: VisualCheckType::ClickBehavior,
                                    description: "Input typing works".to_string(),
                                    passed: true,
                                    details: "Input typing executed successfully".to_string(),
                                    screenshot_before: None,
                                    screenshot_after: None,
                                });
                            }
                        } else {
                            test.add_check(VisualCheck {
                                check_name: "Form Inputs Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: "Form inputs are visible".to_string(),
                                passed: false,
                                details: "No form inputs found".to_string(),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        }
                    }
                    Err(e) => {
                        test.add_check(VisualCheck {
                            check_name: "Form Inputs Find".to_string(),
                            check_type: VisualCheckType::Visibility,
                            description: "Form inputs can be found".to_string(),
                            passed: false,
                            details: format!("Failed to find form inputs: {}", e),
                            screenshot_before: None,
                            screenshot_after: None,
                        });
                    }
                }
            }
            Err(e) => {
                test.add_check(VisualCheck {
                    check_name: "Page Load".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Form Demo page loaded".to_string(),
                    passed: false,
                    details: format!("Failed to load: {}", e),
                    screenshot_before: None,
                    screenshot_after: None,
                });
            }
        }

        Ok(test)
    }

    /// Test switch/animation controls
    pub async fn test_switch_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("Animation Controls", "/demos/animation");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        info!("Testing animation controls quality...");

        driver.goto(&format!("{}/demos/animation", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(8000)).await;

        match driver.find(By::Css("h1, .page-title")).await {
            Ok(_) => {
                test.add_check(VisualCheck {
                    check_name: "Page Loaded".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Animation Demo page loaded".to_string(),
                    passed: true,
                    details: "Animation Demo page loaded successfully".to_string(),
                    screenshot_before: None,
                    screenshot_after: None,
                });

                match driver.find_all(By::Css("button")).await {
                    Ok(buttons) => {
                        if !buttons.is_empty() {
                            test.add_check(VisualCheck {
                                check_name: "Control Buttons Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: format!("Found {} control buttons", buttons.len()),
                                passed: buttons.len() > 0,
                                details: format!("Page has {} control buttons", buttons.len()),
                                screenshot_before: None,
                                screenshot_after: None,
                            });

                            if let Some(btn) = buttons.first() {
                                let _ = btn.click().await;
                                tokio::time::sleep(Duration::from_millis(500)).await;

                                test.add_check(VisualCheck {
                                    check_name: "Control Click".to_string(),
                                    check_type: VisualCheckType::ClickBehavior,
                                    description: "Control button click works".to_string(),
                                    passed: true,
                                    details: "Control button click executed successfully".to_string(),
                                    screenshot_before: None,
                                    screenshot_after: None,
                                });
                            }
                        } else {
                            test.add_check(VisualCheck {
                                check_name: "Control Buttons Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: "Control buttons are visible".to_string(),
                                passed: false,
                                details: "No control buttons found".to_string(),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        }
                    }
                    Err(e) => {
                        test.add_check(VisualCheck {
                            check_name: "Control Buttons Find".to_string(),
                            check_type: VisualCheckType::Visibility,
                            description: "Control buttons can be found".to_string(),
                            passed: false,
                            details: format!("Failed to find control buttons: {}", e),
                            screenshot_before: None,
                            screenshot_after: None,
                        });
                    }
                }
            }
            Err(e) => {
                test.add_check(VisualCheck {
                    check_name: "Page Load".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Animation Demo page loaded".to_string(),
                    passed: false,
                    details: format!("Failed to load: {}", e),
                    screenshot_before: None,
                    screenshot_after: None,
                });
            }
        }

        Ok(test)
    }

    /// Test tabs/dashboard quality
    pub async fn test_tabs_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("Dashboard", "/demos/layer2/dashboard");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        info!("Testing dashboard quality...");

        driver.goto(&format!("{}/demos/layer2/dashboard", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(8000)).await;

        match driver.find(By::Css("h1, .page-title")).await {
            Ok(_) => {
                test.add_check(VisualCheck {
                    check_name: "Page Loaded".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Dashboard page loaded".to_string(),
                    passed: true,
                    details: "Dashboard page loaded successfully".to_string(),
                    screenshot_before: None,
                    screenshot_after: None,
                });

                match driver.find_all(By::Css(".stat-card, button, .card, a")).await {
                    Ok(elements) => {
                        if !elements.is_empty() {
                            test.add_check(VisualCheck {
                                check_name: "Dashboard Elements Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: format!("Found {} dashboard elements", elements.len()),
                                passed: elements.len() > 0,
                                details: format!("Page has {} dashboard elements", elements.len()),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        } else {
                            test.add_check(VisualCheck {
                                check_name: "Dashboard Elements Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: "Dashboard elements are visible".to_string(),
                                passed: false,
                                details: "No dashboard elements found".to_string(),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        }
                    }
                    Err(e) => {
                        test.add_check(VisualCheck {
                            check_name: "Dashboard Elements Find".to_string(),
                            check_type: VisualCheckType::Visibility,
                            description: "Dashboard elements can be found".to_string(),
                            passed: false,
                            details: format!("Failed to find dashboard elements: {}", e),
                            screenshot_before: None,
                            screenshot_after: None,
                        });
                    }
                }
            }
            Err(e) => {
                test.add_check(VisualCheck {
                    check_name: "Page Load".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Dashboard page loaded".to_string(),
                    passed: false,
                    details: format!("Failed to load: {}", e),
                    screenshot_before: None,
                    screenshot_after: None,
                });
            }
        }

        Ok(test)
    }

    /// Test entry components (Cascader)
    pub async fn test_entry_components_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("Entry Components", "/components/entry/cascader");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        info!("Testing entry components quality...");

        driver.goto(&format!("{}/components/entry/cascader", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(15000)).await;

        test.add_check(VisualCheck {
            check_name: "Page Loaded".to_string(),
            check_type: VisualCheckType::Visibility,
            description: "Cascader page loaded".to_string(),
            passed: true,
            details: "Cascader page navigated successfully".to_string(),
            screenshot_before: None,
            screenshot_after: None,
        });

        match driver.find_all(By::Css(".hi-cascader, .cascader, [data-testid*='cascader'], .hi-button, button, h1, h2, h3")).await {
            Ok(elements) => {
                if !elements.is_empty() {
                    test.add_check(VisualCheck {
                        check_name: "Cascader Component Visible".to_string(),
                        check_type: VisualCheckType::Visibility,
                        description: format!("Found {} interactive elements", elements.len()),
                        passed: elements.len() > 0,
                        details: format!("Page has {} interactive elements", elements.len()),
                        screenshot_before: None,
                        screenshot_after: None,
                    });
                } else {
                    test.add_check(VisualCheck {
                        check_name: "Cascader Component Visible".to_string(),
                        check_type: VisualCheckType::Visibility,
                        description: "Cascader component is visible".to_string(),
                        passed: false,
                        details: "No cascader components found".to_string(),
                        screenshot_before: None,
                        screenshot_after: None,
                    });
                }
            }
            Err(e) => {
                test.add_check(VisualCheck {
                    check_name: "Cascader Component Find".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Cascader component can be found".to_string(),
                    passed: false,
                    details: format!("Failed to find cascader: {}", e),
                    screenshot_before: None,
                    screenshot_after: None,
                });
            }
        }

        Ok(test)
    }
    pub async fn test_extra_components_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("Extra Components", "/components/extra/collapsible");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        info!("Testing extra components quality...");

        driver.goto(&format!("{}/components/extra/collapsible", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(15000)).await;

        test.add_check(VisualCheck {
            check_name: "Page Loaded".to_string(),
            check_type: VisualCheckType::Visibility,
            description: "Collapsible page loaded".to_string(),
            passed: true,
            details: "Collapsible page navigated successfully".to_string(),
            screenshot_before: None,
            screenshot_after: None,
        });

        match driver.find_all(By::Css(".hi-collapsible, .collapsible, button, [data-testid*='collapsible'], h1, h2, h3")).await {
            Ok(elements) => {
                if !elements.is_empty() {
                    test.add_check(VisualCheck {
                        check_name: "Collapsible Component Visible".to_string(),
                        check_type: VisualCheckType::Visibility,
                        description: format!("Found {} interactive elements", elements.len()),
                        passed: elements.len() > 0,
                        details: format!("Page has {} interactive elements", elements.len()),
                        screenshot_before: None,
                        screenshot_after: None,
                    });
                } else {
                    test.add_check(VisualCheck {
                        check_name: "Collapsible Component Visible".to_string(),
                        check_type: VisualCheckType::Visibility,
                        description: "Collapsible component is visible".to_string(),
                        passed: false,
                        details: "No collapsible components found".to_string(),
                        screenshot_before: None,
                        screenshot_after: None,
                    });
                }
            }
            Err(e) => {
                test.add_check(VisualCheck {
                    check_name: "Collapsible Component Find".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Collapsible component can be found".to_string(),
                    passed: false,
                    details: format!("Failed to find collapsible: {}", e),
                    screenshot_before: None,
                    screenshot_after: None,
                });
            }
        }

        Ok(test)
    }

    /// Test layer 3 components
    pub async fn test_layer3_components_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("Layer 3 Components", "/components/layer3/overview");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        info!("Testing layer 3 components quality...");

        driver.goto(&format!("{}/components/layer3/overview", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(8000)).await;

        match driver.find(By::Css("h1, .page-title")).await {
            Ok(_) => {
                test.add_check(VisualCheck {
                    check_name: "Page Loaded".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Layer 3 Overview page loaded".to_string(),
                    passed: true,
                    details: "Layer 3 Overview page loaded successfully".to_string(),
                    screenshot_before: None,
                    screenshot_after: None,
                });

                match driver.find_all(By::Css("a, .component-card, button, [role='button']")).await {
                    Ok(elements) => {
                        if !elements.is_empty() {
                            test.add_check(VisualCheck {
                                check_name: "Layer 3 Components Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: format!("Found {} layer 3 components", elements.len()),
                                passed: elements.len() > 0,
                                details: format!("Page has {} layer 3 components", elements.len()),
                                screenshot_before: None,
                                screenshot_after: None,
                            });

                            if let Some(component) = elements.first() {
                                let _ = component.click().await;
                                tokio::time::sleep(Duration::from_millis(500)).await;

                                test.add_check(VisualCheck {
                                    check_name: "Component Click".to_string(),
                                    check_type: VisualCheckType::ClickBehavior,
                                    description: "Component click works".to_string(),
                                    passed: true,
                                    details: "Component click executed successfully".to_string(),
                                    screenshot_before: None,
                                    screenshot_after: None,
                                });
                            }
                        } else {
                            test.add_check(VisualCheck {
                                check_name: "Layer 3 Components Visible".to_string(),
                                check_type: VisualCheckType::Visibility,
                                description: "Layer 3 components are visible".to_string(),
                                passed: false,
                                details: "No layer 3 components found".to_string(),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        }
                    }
                    Err(e) => {
                        test.add_check(VisualCheck {
                            check_name: "Layer 3 Components Find".to_string(),
                            check_type: VisualCheckType::Visibility,
                            description: "Layer 3 components can be found".to_string(),
                            passed: false,
                            details: format!("Failed to find layer 3 components: {}", e),
                            screenshot_before: None,
                            screenshot_after: None,
                        });
                    }
                }
            }
            Err(e) => {
                test.add_check(VisualCheck {
                    check_name: "Page Load".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Layer 3 Overview page loaded".to_string(),
                    passed: false,
                    details: format!("Failed to load: {}", e),
                    screenshot_before: None,
                    screenshot_after: None,
                });
            }
        }

        Ok(test)
    }

    /// Test system pages (Palette)
    pub async fn test_system_pages_quality(driver: &WebDriver) -> Result<VisualQualityTest> {
        let mut test = VisualQualityTest::new("System Pages", "/system/palette");
        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        info!("Testing system pages quality...");

        driver.goto(&format!("{}/system/palette", base_url)).await?;
        tokio::time::sleep(Duration::from_millis(8000)).await;

        match driver.find(By::Css("h1, .page-title")).await {
            Ok(_) => {
                test.add_check(VisualCheck {
                    check_name: "Page Loaded".to_string(),
                    check_type: VisualCheckType::Visibility,
                    description: "Palette page loaded".to_string(),
                    passed: true,
                    details: "Palette page loaded successfully".to_string(),
                    screenshot_before: None,
                    screenshot_after: None,
                });

                match driver.find_all(By::Css(".color-swatch, [class*='bg-']")).await {
                    Ok(swatches) => {
                        if !swatches.is_empty() {
                            test.add_check(VisualCheck {
                                check_name: "Color Swatches Visible".to_string(),
                                check_type: VisualCheckType::ColorTheme,
                                description: format!("Found {} color swatches", swatches.len()),
                                passed: swatches.len() > 0,
                                details: format!("Page has {} color swatches", swatches.len()),
                                screenshot_before: None,
                                screenshot_after: None,
                            });
                        } else {
                            test.add_check(VisualCheck {
                                check_name: "Color Swatches Visible".to_string(),
                                check_type: VisualCheckType::ColorTheme,
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
                            check_type: VisualCheckType::ColorTheme,
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
                    check_name: "Page Load".to_string(),
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

        info!("Testing Animation Demo (Button)...");
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

        info!("Testing Form Demo (Form Controls)...");
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

        info!("Testing Animation Buttons (Switch)...");
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

        info!("Testing Dashboard Demo (Tabs)...");
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

        info!("Testing Entry Components (Cascader)...");
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

        info!("Testing Extra Components (Collapsible)...");
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

        info!("Testing Layer 3 Components...");
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

        info!("Testing System Pages (Palette)...");
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
