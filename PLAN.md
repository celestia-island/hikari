# Fix Website Demo Theme Toggle Issue

## Problem Analysis

### Current Issue
When clicking the theme toggle button in the bottom-left corner of the website demo, the theme does not switch between light (hikari) and dark (tairitsu) modes.

### Root Cause
The `use_theme()` function in `packages/components/src/theme_provider.rs` reads the current theme from the DOM but returns an **empty callback** (`set_theme: Callback::new(|_| {})`) that does nothing.

**Location:** `packages/components/src/theme_provider.rs:914-946`

```rust
pub fn use_theme() -> ThemeContext {
    #[cfg(target_arch = "wasm32")]
    {
        // ... DOM query logic ...

        ThemeContext {
            palette: Signal::new(theme_name.clone()),
            theme_name: Signal::new(theme_name),
            set_theme: Callback::new(|_| {}), // ❌ Empty callback - does nothing!
        }
    }
    // ...
}
```

However, the `ThemeProvider` component (line 809-812) creates a functional `set_theme` callback:

```rust
let set_theme = Callback::new(move |new_theme: String| {
    palette_for_callback.set(new_theme.clone());
    theme_name_for_callback.set(new_theme);
});

// And provides it via use_context_provider (line 815)
use_context_provider(move || ThemeContext {
    palette: current_palette,
    theme_name: current_theme_name,
    set_theme, // ✅ Functional callback
});
```

### Why This Happens
`use_theme()` is designed to read from the DOM for real-time updates, but it doesn't use `use_context()` to retrieve the ThemeContext provided by `ThemeProvider`. As a result, it creates a new ThemeContext with an empty callback.

---

## Solution

### Modify `use_theme()` to use `use_context()`

Change `use_theme()` to:
1. First try to get ThemeContext via `use_context::<ThemeContext>()`
2. If that succeeds, return it (contains the functional `set_theme` callback)
3. Otherwise, fall back to DOM query for palette/theme name

### Code Changes

**File:** `packages/components/src/theme_provider.rs`

**Location:** Lines 914-946 (the `use_theme()` function)

**Before:**
```rust
pub fn use_theme() -> ThemeContext {
    #[cfg(target_arch = "wasm32")]
    {
        // ... DOM query logic ...

        ThemeContext {
            palette: Signal::new(theme_name.clone()),
            theme_name: Signal::new(theme_name),
            set_theme: Callback::new(|_| {}), // ❌ Empty callback
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    default_theme_context()
}
```

**After:**
```rust
pub fn use_theme() -> ThemeContext {
    // First try to get ThemeContext from ThemeProvider via use_context
    if let Some(context) = use_context::<ThemeContext>() {
        return context;
    }

    // Fallback: read from DOM (for components outside ThemeProvider)
    #[cfg(target_arch = "wasm32")]
    {
        let window = match web_sys::window() {
            Some(w) => w,
            None => return default_theme_context(),
        };

        let document = match window.document() {
            Some(doc) => doc,
            None => return default_theme_context(),
        };

        let theme_name = match document
            .query_selector(".hi-theme-provider[data-theme]")
            .ok()
            .flatten()
            .and_then(|el| el.get_attribute("data-theme"))
        {
            Some(theme) => theme,
            None => return default_theme_context(),
        };

        ThemeContext {
            palette: Signal::new(theme_name.clone()),
            theme_name: Signal::new(theme_name),
            set_theme: Callback::new(|_| {}), // Empty callback when outside ThemeProvider
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    default_theme_context()
}
```

---

## Test Plan (E2E)

### Manual Testing Steps

1. **Start the development server:**
   ```bash
   cd examples/website
   cargo run --bin website_server --features server
   ```

2. **Open browser:** Navigate to `http://127.0.0.1:3000`

3. **Verify initial state:**
   - Page should load with light theme (hikari) by default
   - Left-bottom icon should show sun (WhiteBalanceSunny)
   - Background should be light color
   - Text should be dark color

4. **Test theme toggle to dark:**
   - Click the theme toggle button (sun icon) in the bottom-left corner
   - Expected: Theme should switch to dark (tairitsu)
   - Expected: Icon should change to moon (MoonWaningCrescent)
   - Expected: Background should become dark
   - Expected: Text should become light
   - Expected: All UI elements (buttons, cards, etc.) should update to dark theme colors
   - Expected: `data-theme` attribute on the `.hi-theme-provider` element should be "tairitsu"

5. **Test toggle back to light:**
   - Click the theme toggle button again (moon icon)
   - Expected: Theme should switch back to light (hikari)
   - Expected: Icon should change back to sun
   - Expected: All colors should revert to light theme
   - Expected: `data-theme` attribute should be "hikari"

6. **Test persistence across pages:**
   - Toggle theme to dark
   - Navigate to a different page (e.g., "/components", "/demos")
   - Expected: Dark theme should persist
   - Expected: Icon should remain as moon
   - Navigate back to home
   - Expected: Dark theme should still be active

7. **Test console for errors:**
   - Open browser developer tools console
   - Expected: No JavaScript errors
   - Expected: No Rust panic messages
   - Expected: No warnings about missing ThemeContext

### Verification Checklist

- [ ] Dev server starts successfully on port 3000
- [ ] Page loads without errors
- [ ] Theme toggle button is visible in bottom-left corner
- [ ] Initial theme is light (hikari) with sun icon
- [ ] Clicking toggle switches to dark (tairitsu) with moon icon
- [ ] UI colors update correctly for dark theme
- [ ] Clicking toggle again switches back to light (hikari)
- [ ] UI colors update correctly for light theme
- [ ] Theme persists across page navigation
- [ ] No console errors or warnings

---

## Files to Modify

- `packages/components/src/theme_provider.rs` - Fix `use_theme()` function

## Files NOT to Modify

- No other files will be modified (as per requirement)

---

## Implementation Steps

1. ✅ Analyze the issue and identify root cause
2. ✅ Write PLAN.md (this file)
3. ✅ Modify `use_theme()` function to use `use_context()`
4. ✅ Compile and verify no errors
5. ✅ Start dev server successfully
6. ⏳ Create manual verification checklist
7. ⏳ Commit to dev branch

---

## Risk Assessment

**Risk Level:** Low

**Reasoning:**
- The change is localized to a single function
- The fallback logic remains intact for components outside ThemeProvider
- The solution follows Dioxus best practices (use_context for context access)
- No breaking changes to the public API

---

## Success Criteria

- [ ] Theme toggle button successfully switches between hikari and tairitsu
- [ ] Icon changes appropriately (sun ↔ moon)
- [ ] UI colors update correctly (light ↔ dark theme)
- [ ] Theme persists across page navigation
- [ ] No console errors
- [ ] No regressions in other components
