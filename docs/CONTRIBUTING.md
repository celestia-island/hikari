# Contributing to Hikari

Thank you for your interest in contributing to Hikari! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Git Workflow](#git-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Standards](#documentation-standards)
- [Pull Request Process](#pull-request-process)
- [Community Guidelines](#community-guidelines)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful, constructive, and professional in all interactions.

### Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Rust 1.52+**: Install from [rustup.rs](https://rustup.rs/)
- **Python 3.11+**: For development tooling
- **Just**: Install with `cargo install just`
- **Git**: For version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/hikari.git
cd hikari
```

3. Add upstream remote:

```bash
git remote add upstream https://github.com/celestia-island/hikari.git
```

## Development Setup

### Install Dependencies

```bash
# Install Rust toolchain
rustup update

# Install Just
cargo install just

# Install Python dependencies (for tooling)
pip install -r requirements-dev.txt  # if available
```

### Build the Project

```bash
# Build all packages
just build

# Or use cargo directly
cargo build --workspace
```

### Run Examples

```bash
# Run the demo app
cd examples/demo-app
cargo run

# Run SSR demo
cd examples/ssr-demo
cargo run
```

### Development Mode

```bash
# Start development server (if configured)
just dev
```

## Code Style Guidelines

### Rust Code Style

We follow standard Rust conventions:

1. **Formatting**: Use `rustfmt`

```bash
just fmt
# or
cargo fmt --all
```

2. **Linting**: Use `clippy`

```bash
just lint
# or
cargo clippy --all -- -D warnings
```

3. **Naming Conventions**:

- **Structs/Enums**: `PascalCase`
- **Functions/Variables**: `snake_case`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Chinese Constants**: Use Chinese characters (e.g., `石青`)

```rust
pub struct ButtonProps { }  // PascalCase

pub fn render_button() { }  // snake_case

pub const MAX_SIZE: usize = 100;  // SCREAMING_SNAKE_CASE

pub const 石青: ChineseColor = ChineseColor { };  // Chinese (for palette)
```

### Dioxus Component Style

Components should follow these patterns:

```rust
#[component]  // Always use component attribute
pub fn Button(props: ButtonProps) -> Element {  // PascalCase for components
    rsx! {  // Use rsx! macro
        button {
            class: "{props.class}",  // Use string formatting for classes
            onclick: move |e| {  // Use move closures for event handlers
                if let Some(handler) = props.onclick.as_ref() {
                    handler.call(e);
                }
            },
            {props.children}  // Always include children
        }
    }
}
```

### SCSS Style

Follow SCSS best practices:

```scss
// Use variables for all values
.my-component {
    background-color: var(--hi-color-surface);
    padding: var(--hi-spacing-md);
    border-radius: var(--hi-radius-lg);
}

// Use nesting for related styles
.my-component {
    &.modifier {
        // Modifier styles
    }

    &:hover {
        // Hover styles
    }

    .child-element {
        // Child styles
    }
}
```

### Documentation Style

All public items must be documented:

```rust
/// Button component with multiple variants.
///
/// # Examples
///
/// ```rust
/// use hikari_components::Button;
///
/// rsx! {
///     Button { variant: ButtonVariant::Primary, "Click Me" }
/// }
/// ```
///
/// # Props
///
/// - `variant`: Button style variant
/// - `size`: Button size (Small, Medium, Large)
/// - `disabled`: Whether the button is disabled
/// - `loading`: Show loading spinner
#[component]
pub fn Button(props: ButtonProps) -> Element {
    // ...
}
```

## Git Workflow

### Branch Naming

Use descriptive branch names:

- `feature/add-table-component`
- `fix/button-loading-state`
- `docs/update-readme`
- `refactor/theme-system`

### Commit Messages

Follow the emoji + one-liner format (as defined in PLAN.md):

```
emoji one-sentence english description
```

Examples:
- `feat: Add table component with pagination`
- `fix: Resolve button disabled state bug`
- `docs: Update installation instructions`
- `refactor: Improve theme provider performance`

Common emojis:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

### Commit Workflow

1. **Create a feature branch**:

```bash
git checkout -b feature/your-feature-name
```

2. **Make changes and commit**:

```bash
git add .
git commit -m "feat: Add your feature description"
```

3. **Push to your fork**:

```bash
git push origin feature/your-feature-name
```

4. **Create Pull Request**: Go to GitHub and create a PR

### Keeping Your Fork Updated

```bash
git fetch upstream
git rebase upstream/master
git push origin feature/your-feature-name --force-with-lease
```

## Testing Guidelines

### Write Tests

All new features must include tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_button_renders() {
        // Test implementation
    }

    #[test]
    fn test_button_disabled_state() {
        // Test implementation
    }
}
```

### Run Tests

```bash
# Run all tests
just test
# or
cargo test --workspace

# Run tests for specific package
cargo test -p hikari-components

# Run tests with output
cargo test --workspace -- --nocapture
```

### Test Coverage

- Aim for >80% code coverage
- Test edge cases and error conditions
- Test component props and state
- Test async code properly

## Documentation Standards

### Code Documentation

- All public items must have doc comments
- Include examples for complex APIs
- Document panics, errors, and safety considerations
- Use proper Markdown formatting

### README Documentation

Each package should have a README with:

1. **Overview**: What the package does
2. **Installation**: How to add as dependency
3. **Quick Start**: Basic usage example
4. **API Reference**: Detailed API docs
5. **Examples**: Advanced usage patterns

### Example Applications

Examples should be:

- **Complete**: Fully functional applications
- **Documented**: Well-commented code
- **Idiomatic**: Follow best practices
- **Independent**: Can run standalone

## Pull Request Process

### Before Submitting

1. **Code Quality**:
   - Run `just fmt` to format code
   - Run `just lint` to check for issues
   - Run `just test` to ensure tests pass
   - Update documentation if needed

2. **Commits**:
   - Squash related commits
   - Ensure commit messages follow guidelines
   - Remove outdated or debug commits

3. **Documentation**:
   - Update relevant README files
   - Add/update code documentation
   - Update CHANGELOG if applicable

### Creating a Pull Request

1. Go to the Hikari repository on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill in the PR template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No merge conflicts
```

### Review Process

1. **Automated Checks**: CI will run tests and linters
2. **Code Review**: Maintainers will review your code
3. **Feedback**: Address review comments
4. **Approval**: Once approved, your PR will be merged

### After Merge

- Delete your feature branch
- Update your local master branch
- Celebrate! Thank you for your contribution

## Project Structure Guidelines

### Adding a New Component

When adding a new component:

1. **Location**: Place in appropriate module (basic, feedback, navigation, data)
2. **File Structure**:
   ```
   packages/hikari-components/src/
   ├── category/
   │   ├── mod.rs       # Export the component
   │   └── component.rs # Component implementation
   ```

3. **Exports**: Add to `mod.rs` and `lib.rs`

4. **Documentation**: Document in package README

5. **Example**: Add to demo-app or create dedicated example

### Adding a New Package

When adding a new package:

1. **Update Workspace**: Add to `Cargo.toml`
2. **Create Structure**: Follow existing package structure
3. **Documentation**: Create comprehensive README
4. **Examples**: Provide usage examples
5. **Tests**: Include thorough tests

## Community Guidelines

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code contributions

### Getting Help

1. Check existing documentation
2. Search existing issues
3. Ask in GitHub Discussions
4. Join community chat (if available)

### Reporting Issues

When reporting bugs:

1. **Use Issue Template**: Fill out all required fields
2. **Minimal Reproduction**: Provide code that reproduces the issue
3. **Environment**: Include Rust version, OS, etc.
4. **Expected vs Actual**: Describe what you expected vs what happened

### Feature Requests

When requesting features:

1. **Use Case**: Describe the problem you're solving
2. **Proposed Solution**: How you envision it working
3. **Alternatives**: Other approaches you considered
4. **Willingness to Contribute**: Indicate if you can implement it

## Recognition

Contributors will be:

- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in relevant documentation
- Invited to become maintainers (for consistent contributors)

## License

By contributing, you agree that your contributions will be licensed under the MIT OR Apache-2.0 license.

## Questions?

If you have questions:

1. Check this document
2. Review existing issues and PRs
3. Start a GitHub Discussion
4. Contact maintainers

Thank you for contributing to Hikari! Your contributions help make Hikari better for everyone.
