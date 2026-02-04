// hikari-e2e/src/tests/advanced_components.rs
// E2E tests for Layer 3 advanced components

use anyhow::Result;
use std::time::{Duration, Instant};

use thirtyfour::{By, WebDriver};
use tracing::{info, warn};

use super::TestResult;
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

impl AdvancedComponentsTests {
    async fn test_video_player(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing VideoPlayer component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/demos/layer3/video", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let video_player = driver.find(By::Css(".hi-video-player")).await.map_err(|e| {
            warn!("VideoPlayer element not found: {}", e);
            anyhow::anyhow!("VideoPlayer element not found: {}", e)
        })?;

        info!("VideoPlayer element found");

        let class_attr = video_player
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get video player attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for video player"))?;

        if !class_attr.contains("hi-video-player") {
            return Ok(TestResult::failure(
                "VideoPlayer",
                "VideoPlayer element missing 'hi-video-player' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "VideoPlayer".to_string(),
            status: super::TestStatus::Success,
            message: "VideoPlayer component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_audio_waveform(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing AudioWaveform component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // AudioWaveform demo is in the video demo page
        let test_url = format!("{}/demos/layer3/video", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let audio_waveform = driver.find(By::Css(".hi-audio-waveform")).await.map_err(|e| {
            warn!("AudioWaveform element not found: {}", e);
            anyhow::anyhow!("AudioWaveform element not found: {}", e)
        })?;

        info!("AudioWaveform element found");

        let class_attr = audio_waveform
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get audio waveform attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for audio waveform"))?;

        if !class_attr.contains("hi-audio-waveform") {
            return Ok(TestResult::failure(
                "AudioWaveform",
                "AudioWaveform element missing 'hi-audio-waveform' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "AudioWaveform".to_string(),
            status: super::TestStatus::Success,
            message: "AudioWaveform component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_rich_text_editor(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing RichTextEditor component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // RichTextEditor is in the editor overview page
        let test_url = format!("{}/components/layer3/editor", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let rich_text_editor = driver.find(By::Css(".hi-rich-text-editor")).await.map_err(|e| {
            warn!("RichTextEditor element not found: {}", e);
            anyhow::anyhow!("RichTextEditor element not found: {}", e)
        })?;

        info!("RichTextEditor element found");

        let class_attr = rich_text_editor
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get rich text editor attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for rich text editor"))?;

        if !class_attr.contains("hi-rich-text-editor") {
            return Ok(TestResult::failure(
                "RichTextEditor",
                "RichTextEditor element missing 'hi-rich-text-editor' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "RichTextEditor".to_string(),
            status: super::TestStatus::Success,
            message: "RichTextEditor component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_drag_layer(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing DragLayer component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // DragLayer is demonstrated in the layer3/visualization page
        let test_url = format!("{}/components/layer3/visualization", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let drag_layer = driver.find(By::Css(".hi-drag-layer")).await.map_err(|e| {
            warn!("DragLayer element not found: {}", e);
            anyhow::anyhow!("DragLayer element not found: {}", e)
        })?;

        info!("DragLayer element found");

        drag_layer
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click drag layer: {}", e))?;
        info!("DragLayer clicked successfully");

        let class_attr = drag_layer
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get drag layer attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for drag layer"))?;

        if !class_attr.contains("hi-drag-layer") {
            return Ok(TestResult::failure(
                "DragLayer",
                "DragLayer element missing 'hi-drag-layer' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "DragLayer".to_string(),
            status: super::TestStatus::Success,
            message: "DragLayer component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_collapsible(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Collapsible component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // Collapsible is in components/extra/collapsible page
        let test_url = format!("{}/components/extra/collapsible", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let collapsible = driver.find(By::Css(".hi-collapsible")).await.map_err(|e| {
            warn!("Collapsible element not found: {}", e);
            anyhow::anyhow!("Collapsible element not found: {}", e)
        })?;

        info!("Collapsible element found");

        collapsible
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click collapsible: {}", e))?;
        info!("Collapsible clicked successfully");

        tokio::time::sleep(Duration::from_millis(200)).await;

        let class_attr = collapsible
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get collapsible attributes: {}", e))?;
        let class_attr = class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for collapsible"))?;

        if !class_attr.contains("hi-collapsible") {
            return Ok(TestResult::failure(
                "Collapsible",
                "Collapsible element missing 'hi-collapsible' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Collapsible".to_string(),
            status: super::TestStatus::Success,
            message: "Collapsible component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_zoom_controls(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing ZoomControls component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // ZoomControls is in components/extra/zoom_controls page
        let test_url = format!("{}/components/extra/zoom_controls", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let zoom_controls = driver.find(By::Css(".hi-zoom-controls")).await.map_err(|e| {
            warn!("ZoomControls element not found: {}", e);
            anyhow::anyhow!("ZoomControls element not found: {}", e)
        })?;

        info!("ZoomControls element found");

        let class_attr = zoom_controls
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get zoom controls attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for zoom controls"))?;

        if !class_attr.contains("hi-zoom-controls") {
            return Ok(TestResult::failure(
                "ZoomControls",
                "ZoomControls element missing 'hi-zoom-controls' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "ZoomControls".to_string(),
            status: super::TestStatus::Success,
            message: "ZoomControls component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_user_guide(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing UserGuide component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // UserGuide is in components/extra/user_guide page
        let test_url = format!("{}/components/extra/user_guide", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        // Find and click "Start Guide" button to show UserGuide
        // Use XPath to find button with specific text
        let start_button = driver
            .find(By::XPath("//button[contains(text(), 'Start Guide')]"))
            .await
            .map_err(|e| {
                warn!("Start Guide button not found: {}", e);
                anyhow::anyhow!("Start Guide button not found: {}", e)
            })?;

        start_button
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click Start Guide button: {}", e))?;
        info!("Start Guide button clicked");

        tokio::time::sleep(Duration::from_millis(300)).await;

        // Verify UserGuide element exists
        let user_guide = driver.find(By::Css(".hi-user-guide")).await.map_err(|e| {
            warn!("UserGuide element not found: {}", e);
            anyhow::anyhow!("UserGuide element not found: {}", e)
        })?;

        info!("UserGuide element found");

        let class_attr = user_guide
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get user guide attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for user guide"))?;

        if !class_attr.contains("hi-user-guide") {
            return Ok(TestResult::failure(
                "UserGuide",
                "UserGuide element missing 'hi-user-guide' class",
            ));
        }

        // Check for guide content elements
        let _guide_content = driver.find(By::Css(".hi-user-guide-content")).await.map_err(|e| {
            warn!("UserGuide content not found: {}", e);
            anyhow::anyhow!("UserGuide content not found: {}", e)
        })?;

        info!("UserGuide content found");

        // Verify progress badge exists
        let _progress_badge = driver
            .find(By::Css(".hi-badge"))
            .await
            .map_err(|e| {
                warn!("Progress badge not found: {}", e);
                anyhow::anyhow!("Progress badge not found: {}", e)
            })?;

        info!("Progress badge found");

        // Click Next button to test navigation
        let next_button = driver
            .find(By::XPath("//button[contains(text(), 'Next')]"))
            .await
            .map_err(|e| {
                warn!("Next button not found: {}", e);
                anyhow::anyhow!("Next button not found: {}", e)
            })?;

        next_button
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click Next button: {}", e))?;
        info!("Next button clicked");

        tokio::time::sleep(Duration::from_millis(200)).await;

        // Click Skip button to test dismissal
        let skip_button = driver
            .find(By::XPath("//button[contains(text(), 'Skip')]"))
            .await
            .map_err(|e| {
                warn!("Skip button not found: {}", e);
                anyhow::anyhow!("Skip button not found: {}", e)
            })?;

        skip_button
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click Skip button: {}", e))?;
        info!("Skip button clicked");

        tokio::time::sleep(Duration::from_millis(200)).await;

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "UserGuide".to_string(),
            status: super::TestStatus::Success,
            message: "UserGuide component renders correctly and responds to interactions".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_timeline(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing Timeline component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // Timeline is in components/extra/timeline page
        let test_url = format!("{}/components/extra/timeline", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        // Verify Timeline element exists
        let timeline = driver.find(By::Css(".hi-timeline")).await.map_err(|e| {
            warn!("Timeline element not found: {}", e);
            anyhow::anyhow!("Timeline element not found: {}", e)
        })?;

        info!("Timeline element found");

        let class_attr = timeline
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get timeline attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for timeline"))?;

        if !class_attr.contains("hi-timeline") {
            return Ok(TestResult::failure(
                "Timeline",
                "Timeline element missing 'hi-timeline' class",
            ));
        }

        // Verify timeline items exist
        let timeline_items = driver.find_all(By::Css(".hi-timeline-item")).await.map_err(|e| {
            warn!("Timeline items not found: {}", e);
            anyhow::anyhow!("Timeline items not found: {}", e)
        })?;

        info!("Found {} timeline items", timeline_items.len());

        if timeline_items.len() < 2 {
            return Ok(TestResult::failure(
                "Timeline",
                &format!("Expected at least 2 timeline items, found {}", timeline_items.len()),
            ));
        }

        // Verify timeline dots exist
        let timeline_dots = driver.find_all(By::Css(".hi-timeline-dot")).await.map_err(|e| {
            warn!("Timeline dots not found: {}", e);
            anyhow::anyhow!("Timeline dots not found: {}", e)
        })?;

        info!("Found {} timeline dots", timeline_dots.len());

        if timeline_dots.len() != timeline_items.len() {
            return Ok(TestResult::failure(
                "Timeline",
                &format!("Timeline items ({}) and dots ({}) count mismatch",
                         timeline_items.len(),
                         timeline_dots.len()),
            ));
        }

        // Click on a timeline header to test expand/collapse
        let timeline_header = driver.find(By::Css(".hi-timeline-header")).await.map_err(|e| {
            warn!("Timeline header not found: {}", e);
            anyhow::anyhow!("Timeline header not found: {}", e)
        })?;

        timeline_header
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click timeline header: {}", e))?;
        info!("Timeline header clicked");

        tokio::time::sleep(Duration::from_millis(200)).await;

        // Verify different status types exist
        let status_classes = vec![
            "hi-timeline-completed",
            "hi-timeline-in-progress",
            "hi-timeline-pending",
        ];

        let mut found_statuses = Vec::new();
        for status_class in &status_classes {
            if driver.find(By::Css(format!(".{}", status_class))).await.is_ok() {
                found_statuses.push(status_class);
                info!("Found timeline item with status: {}", status_class);
            }
        }

        if found_statuses.len() < 2 {
            return Ok(TestResult::failure(
                "Timeline",
                &format!("Expected at least 2 different status types, found {}", found_statuses.len()),
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "Timeline".to_string(),
            status: super::TestStatus::Success,
            message: format!(
                "Timeline component renders correctly with {} items, {} dots, and {} status types",
                timeline_items.len(),
                timeline_dots.len(),
                found_statuses.len()
            ),
            duration_ms: duration,
            screenshot_path: None,
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

    async fn run_with_driver(&self, driver: &WebDriver) -> Result<TestResult> {
        info!("Running advanced components E2E tests");

        let mut results = vec![];

        match self.test_video_player(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("VideoPlayer test failed: {}", e);
                results.push(TestResult::error("VideoPlayer", &e.to_string()));
            }
        }

        match self.test_audio_waveform(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("AudioWaveform test failed: {}", e);
                results.push(TestResult::error("AudioWaveform", &e.to_string()));
            }
        }

        match self.test_rich_text_editor(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("RichTextEditor test failed: {}", e);
                results.push(TestResult::error("RichTextEditor", &e.to_string()));
            }
        }

        match self.test_drag_layer(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("DragLayer test failed: {}", e);
                results.push(TestResult::error("DragLayer", &e.to_string()));
            }
        }

        match self.test_collapsible(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Collapsible test failed: {}", e);
                results.push(TestResult::error("Collapsible", &e.to_string()));
            }
        }

        match self.test_zoom_controls(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("ZoomControls test failed: {}", e);
                results.push(TestResult::error("ZoomControls", &e.to_string()));
            }
        }

        match self.test_user_guide(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("UserGuide test failed: {}", e);
                results.push(TestResult::error("UserGuide", &e.to_string()));
            }
        }

        match self.test_timeline(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("Timeline test failed: {}", e);
                results.push(TestResult::error("Timeline", &e.to_string()));
            }
        }

        Ok(TestResult::aggregate(results))
    }
}
