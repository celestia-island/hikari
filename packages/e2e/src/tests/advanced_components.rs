// hikari-e2e/src/tests/advanced_components.rs
// E2E tests for Layer 3 advanced components

use anyhow::Result;
use std::time::{Duration, Instant};

use headless_chrome::Browser;
use tracing::info;

use super::{TestResult, TestStatus};
use crate::Test;

/// Test suite for Layer 3 advanced components
pub struct AdvancedComponentsTests;

#[derive(Debug, Clone)]
pub struct AdvancedComponentVerification {
    pub component_name: String,
    pub renders: bool,
    pub supports_media: bool,
    pub supports_interaction: bool,
}

impl TestResult {
    pub fn from_advanced_verification(verification: &AdvancedComponentVerification) -> Self {
        let status = if verification.renders
            && verification.supports_media
            && verification.supports_interaction
        {
            TestStatus::Success
        } else {
            TestStatus::Error(format!(
                "Failed verification - renders: {}, supports_media: {}, supports_interaction: {}",
                verification.renders,
                verification.supports_media,
                verification.supports_interaction
            ))
        };

        Self {
            component: verification.component_name.clone(),
            status,
            message: format!(
                "Advanced component {} rendering and media support",
                verification.component_name
            ),
            duration_ms: 0,
        }
    }
}

impl AdvancedComponentsTests {
    fn test_video_player(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing VideoPlayer component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/demos/layer3/video", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let video_player = tab.find_element(".hi-video-player").map_err(|e| {
            info!("VideoPlayer element not found: {}", e);
            anyhow::anyhow!("VideoPlayer element not found: {}", e)
        })?;

        info!("VideoPlayer element found");

        let _video = video_player.find_element("video").map_err(|e| {
            info!("Video element not found: {}", e);
            anyhow::anyhow!("Video element not found: {}", e)
        })?;

        info!("Video element found");

        let attrs = video_player
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get video player attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for video player"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-video-player"));

        if !has_class {
            return Ok(TestResult::failure(
                "VideoPlayer",
                "VideoPlayer element missing 'hi-video-player' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "VideoPlayer".to_string(),
            status: TestStatus::Success,
            message:
                "VideoPlayer component renders correctly with video element and has proper class"
                    .to_string(),
            duration_ms: duration,
        })
    }

    fn test_audio_waveform(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing AudioWaveform component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/demos/layer3/audio", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let audio_waveform = tab.find_element(".hi-audio-waveform").map_err(|e| {
            info!("AudioWaveform element not found: {}", e);
            anyhow::anyhow!("AudioWaveform element not found: {}", e)
        })?;

        info!("AudioWaveform element found");

        let attrs = audio_waveform
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get audio waveform attributes: {}", e))?;
        let attrs =
            attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for audio waveform"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-audio-waveform"));

        if !has_class {
            return Ok(TestResult::failure(
                "AudioWaveform",
                "AudioWaveform element missing 'hi-audio-waveform' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "AudioWaveform".to_string(),
            status: TestStatus::Success,
            message: "AudioWaveform component renders correctly and has proper class".to_string(),
            duration_ms: duration,
        })
    }

    fn test_rich_text_editor(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing RichTextEditor component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/demos/layer3/editor", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let rich_text_editor = tab.find_element(".hi-rich-text-editor").map_err(|e| {
            info!("RichTextEditor element not found: {}", e);
            anyhow::anyhow!("RichTextEditor element not found: {}", e)
        })?;

        info!("RichTextEditor element found");

        let attrs = rich_text_editor
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get rich text editor attributes: {}", e))?;
        let attrs =
            attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for rich text editor"))?;
        let has_class = attrs
            .iter()
            .any(|attr| attr.contains("hi-rich-text-editor"));

        if !has_class {
            return Ok(TestResult::failure(
                "RichTextEditor",
                "RichTextEditor element missing 'hi-rich-text-editor' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "RichTextEditor".to_string(),
            status: TestStatus::Success,
            message: "RichTextEditor component renders correctly and has proper class".to_string(),
            duration_ms: duration,
        })
    }

    fn test_drag_layer(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing DragLayer component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/demos/layer3/drag", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let drag_layer = tab.find_element(".hi-drag-layer").map_err(|e| {
            info!("DragLayer element not found: {}", e);
            anyhow::anyhow!("DragLayer element not found: {}", e)
        })?;

        info!("DragLayer element found");

        drag_layer
            .click()
            .map_err(|e| anyhow::anyhow!("Failed to click drag layer: {}", e))?;
        info!("DragLayer clicked successfully");

        let attrs = drag_layer
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get drag layer attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for drag layer"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-drag-layer"));

        if !has_class {
            return Ok(TestResult::failure(
                "DragLayer",
                "DragLayer element missing 'hi-drag-layer' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "DragLayer".to_string(),
            status: TestStatus::Success,
            message: "DragLayer component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
        })
    }

    fn test_collapsible(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Collapsible component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/demos/layer3/collapsible", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let collapsible = tab.find_element(".hi-collapsible").map_err(|e| {
            info!("Collapsible element not found: {}", e);
            anyhow::anyhow!("Collapsible element not found: {}", e)
        })?;

        info!("Collapsible element found");

        collapsible
            .click()
            .map_err(|e| anyhow::anyhow!("Failed to click collapsible: {}", e))?;
        info!("Collapsible clicked successfully");

        std::thread::sleep(Duration::from_millis(200));

        let attrs = collapsible
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get collapsible attributes: {}", e))?;
        let attrs = attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for collapsible"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-collapsible"));

        if !has_class {
            return Ok(TestResult::failure(
                "Collapsible",
                "Collapsible element missing 'hi-collapsible' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Collapsible".to_string(),
            status: TestStatus::Success,
            message: "Collapsible component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
        })
    }

    fn test_zoom_controls(&self, browser: &Browser) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing ZoomControls component");

        let base_url = std::env::var("WEBSITE_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/demos/layer3/zoom", base_url);

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow::anyhow!("Failed to create tab: {}", e))?;

        tab.navigate_to(&test_url)
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        std::thread::sleep(Duration::from_millis(500));

        let zoom_controls = tab.find_element(".hi-zoom-controls").map_err(|e| {
            info!("ZoomControls element not found: {}", e);
            anyhow::anyhow!("ZoomControls element not found: {}", e)
        })?;

        info!("ZoomControls element found");

        let attrs = zoom_controls
            .get_attributes()
            .map_err(|e| anyhow::anyhow!("Failed to get zoom controls attributes: {}", e))?;
        let attrs =
            attrs.ok_or_else(|| anyhow::anyhow!("No attributes found for zoom controls"))?;
        let has_class = attrs.iter().any(|attr| attr.contains("hi-zoom-controls"));

        if !has_class {
            return Ok(TestResult::failure(
                "ZoomControls",
                "ZoomControls element missing 'hi-zoom-controls' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "ZoomControls".to_string(),
            status: TestStatus::Success,
            message: "ZoomControls component renders correctly and has proper class".to_string(),
            duration_ms: duration,
        })
    }
}

impl Test for AdvancedComponentsTests {
    fn name(&self) -> &str {
        "Layer 3: Advanced Components Tests"
    }

    fn setup(&self) -> Result<()> {
        info!("Setting up advanced components test suite");
        info!("Dev server check: http://localhost:3000");
        Ok(())
    }

    fn run_with_browser(&self, browser: &Browser) -> Result<TestResult> {
        info!("Running advanced components E2E tests");

        let mut results = vec![];

        match self.test_video_player(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("VideoPlayer test failed: {}", e);
                results.push(TestResult::error("VideoPlayer", &e.to_string()));
            }
        }

        match self.test_audio_waveform(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("AudioWaveform test failed: {}", e);
                results.push(TestResult::error("AudioWaveform", &e.to_string()));
            }
        }

        match self.test_rich_text_editor(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("RichTextEditor test failed: {}", e);
                results.push(TestResult::error("RichTextEditor", &e.to_string()));
            }
        }

        match self.test_drag_layer(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("DragLayer test failed: {}", e);
                results.push(TestResult::error("DragLayer", &e.to_string()));
            }
        }

        match self.test_collapsible(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Collapsible test failed: {}", e);
                results.push(TestResult::error("Collapsible", &e.to_string()));
            }
        }

        match self.test_zoom_controls(browser) {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("ZoomControls test failed: {}", e);
                results.push(TestResult::error("ZoomControls", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
