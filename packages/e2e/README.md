# Hikari E2E Testing Framework

> Pure Rust E2E testing framework for Hikari UI components
>
> **Technology**: Rust + headless_chrome (Chrome DevTools Protocol)
> **Goal**: Automated testing of Hikari components in real browser environment

## Overview

Hikari E2E provides a Rust-native end-to-end testing framework for verifying Hikari UI components. It uses `headless_chrome` to control headless Chrome browser and perform real user interactions.

### Why headless_chrome?

- **Pure Rust**: No JavaScript or TypeScript required
- **CDP Support**: Full Chrome DevTools Protocol access
- **Type Safety**: Leverages Rust's type system
- **Performance**: Fast and efficient test execution

## Features

### Core Framework

- ✅ **Trait-based Testing**: `Test` trait for defining test suites
- ✅ **Test Result Aggregation**: Automatic result collection and reporting
- ✅ **Logging Integration**: Structured logging with `tracing`
- ✅ **Async/Await**: Modern async Rust with `tokio`

### Browser Automation

- ✅ **Headless Chrome**: Automated browser control
- ✅ **CDP Protocol**: Chrome DevTools Protocol for fine-grained control
- ✅ **Event Simulation**: Click, input, keyboard events
- ✅ **DOM Inspection**: Element queries and attribute verification

## Architecture

```rust
// Define test suite
struct BasicComponentsTests;

// Implement Test trait
impl Test for BasicComponentsTests {
    fn name(&self) -> &str {
        "Layer 1: Basic Components Tests"
    }

    fn setup(&self) -> Result<()> {
        // Setup: launch browser, navigate to page
        Ok(())
    }

    async fn run(&self) -> Result<TestResult> {
        // Run tests, return aggregated results
        Ok(TestResult::aggregate(results))
    }
}
```

## Project Structure

```
packages/e2e/
├── Cargo.toml              # Package configuration
├── README.md               # This file
└── src/
    ├── main.rs             # CLI entry point
    ├── lib.rs             # Library entry point
    └── tests/
        ├── mod.rs          # Test trait and exports
        └── basic_components.rs  # Test implementations
```

## Usage

### Running All Tests

```bash
cargo run --bin e2e
```

### Using the Library

```rust
use hikari_e2e::run_all_tests;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let results = run_all_tests().await?;

    for result in &results {
        println!("{}: {}", result.component, result.message);
    }

    Ok(())
}
```

## Test Coverage

### Current Tests

| Test Suite | Components Covered | Status |
|-----------|------------------|---------|
| BasicComponentsTests | Button, Input, Card | ✅ Implemented |
| FormComponentsTests | Form, Select, Checkbox, Radio, Switch | ✅ Implemented |
| DataComponentsTests | Table, Tree, Pagination, Dropdown | ✅ Implemented |
| AdvancedComponentsTests | VideoPlayer, AudioWaveform, RichTextEditor, DragLayer, Collapsible, ZoomControls | ✅ Implemented |
| ThemeTests | Theme switching, responsive | ⏳ Planned |
| AccessibilityTests | ARIA, keyboard navigation | ⏳ Planned |
| PerformanceTests | Bundle size, rendering performance | ⏳ Planned |

## Verification Criteria

Each component test verifies:

1. **Rendering**: Component renders with correct classes
2. **Props**: Component accepts and uses props correctly
3. **Events**: Component triggers events (click, change, etc.)
4. **States**: Component supports different states (hover, active, disabled)
5. **Accessibility**: Component has proper ARIA attributes
6. **Responsive**: Component displays correctly at different viewports

## Example Test

```rust
async fn test_button(&self) -> Result<TestResult> {
    info!("Testing Button component");

    // Verification criteria:
    // 1. Button renders with class: "hi-button"
    // 2. Button responds to click events
    // 3. Button supports variant prop (primary, secondary, ghost)
    // 4. Button supports size prop (small, medium, large)
    // 5. Button can be disabled
    // 6. Button has hover/active states

    Ok(TestResult::success(
        "Button",
        "Button component renders, accepts props, responds to clicks"
    ))
}
```

## Development

### Adding New Test Suites

1. Create test struct:
   ```rust
   pub struct MyComponentTests;
   ```

2. Implement test methods:
   ```rust
   impl MyComponentTests {
       async fn test_component(&self) -> Result<TestResult> {
           // Test implementation
       }
   }
   ```

3. Implement Test trait:
   ```rust
   impl Test for MyComponentTests {
       fn name(&self) -> &str { "My Component Tests" }
       fn setup(&self) -> Result<()> { Ok(()) }
       async fn run(&self) -> Result<TestResult> { /* ... */ }
   }
   ```

4. Register in `lib.rs`:
   ```rust
   match MyComponentTests.run().await {
       Ok(result) => results.push(result),
       Err(e) => results.push(TestResult::error("MyComponent", &e.to_string())),
   }
   ```

## Requirements

- Rust 1.70+
- Google Chrome (for headless_chrome)
- tokio (async runtime)
- tracing (logging)

## Integration with Hikari Dev Server

For full E2E testing:

1. Start Hikari dev server:
   ```bash
   cd examples/website
   trunk serve --port 3000
   ```

2. In a separate terminal, run E2E tests:
   ```bash
   cd packages/e2e
   cargo run --bin e2e
   ```

3. Tests will navigate to `http://localhost:3000` and verify components

## Future Enhancements

- [ ] Visual regression testing (screenshot comparison)
- [ ] Performance metrics collection
- [ ] Network request mocking
- [ ] Multiple browser support (Firefox, Safari via WebDriver)
- [ ] Parallel test execution
- [ ] CI/CD integration

## License

MIT OR Apache-2.0

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.
