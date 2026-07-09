# Animation E2E Testing — 3-Round Implementation Plan

## Status: Ready for execution (exit plan mode to begin)

---

## Round 4: Infrastructure (est. 800+ lines, ~15 files)

### Part A: GlobalAnimationManager (real implementation)
**File:** `packages/animation/src/global_manager.rs`

Replace the 66-line no-op with a full singleton:
- `thread_local!` + `RefCell` singleton (WASM-safe)
- `HashMap<String, AnimationEngine>` registry
- Methods: `register(name, engine)`, `unregister(name)`, `pause_all()`, `resume_all()`, `freeze()`, `unfreeze()`, `seek_all(progress)`, `step_all(delta_ms)`, `kill_all()`, `get_state() -> AnimationDebugState`, `set_test_mode(bool)`, `is_test_mode()`, `is_frozen()`

Add types: `AnimationDebugState`, `EngineDebugInfo`, `TweenDebugInfo` (serde-serializable for E2E transport).

Also need to add missing methods to `AnimationEngine`: `get_all_ids()`, `tween_state(id)`, `seek_to_progress(id, progress)`, and `Tween.progress()`, `Tween.duration()`.

### Part B: AnimationDebugProvider (tairitsu Context)
**New file:** `packages/animation/src/debug.rs`

```rust
// Tairitsu Context-based debug provider
pub struct AnimationDebugProvider;

impl AnimationDebugProvider {
    pub fn init() { provide_context(Self); }
    pub fn freeze() { GlobalAnimationManager::freeze(); }
    pub fn unfreeze() { GlobalAnimationManager::unfreeze(); }
    pub fn seek_all(progress: f64) { ... }
    pub fn step_all(delta_ms: u64) { ... }
    pub fn get_state() -> AnimationDebugState { ... }
}

// Convenience hooks for components
pub fn use_animation_debug() -> AnimationDebugProvider { consume_context() }
```

**Export from** `packages/animation/src/lib.rs`: add `pub mod debug;`

### Part C: Add AnimationEngine missing API
**File:** `packages/animation/src/core/engine.rs`

Add methods:
```rust
pub fn get_all_ids(&self) -> Vec<TweenId>
pub fn tween_state(&self, id: TweenId) -> Option<AnimationState>
pub fn seek_to_progress(&self, id: TweenId, progress: f64)
```

**File:** `packages/animation/src/core/tween.rs`

Add to Tween:
```rust
pub fn progress(&self) -> f64
pub fn duration(&self) -> Duration
```

### Part D: Migrate 7 CSS @keyframes to RAF

Each component modified in its `styles()` method (remove `@keyframes`) and component body (add tween/RAF-based animation).

| # | Component | File | Keyframe | RAF replacement |
|---|-----------|------|----------|-----------------|
| 1 | **Spin** | `feedback/spin.rs:118` | `hi-spin-rotate` (rotate 0→360) | `use_animation_frame` + `style.transform` rotation increment |
| 2 | **Skeleton** | `display/skeleton.rs:328` | `hi-skeleton-pulse` (bg-position + opacity) | `use_animation_frame` + bg-position lerp |
| 3 | **Progress** | `feedback/progress.rs:185` | `hi-progress-active` (opacity pulse) | `use_animation_frame` + opacity lerp |
| 4 | **Drawer** | `feedback/drawer.rs:182-276` | 5 keyframes (mask fade, 4-direction slide) | Portal already handles appear/disappear; add RAF-based transform |
| 5 | **DragLayer** | `display/drag_layer.rs:126` | `hi-drag-preview-fade-in` (opacity + scale) | `use_animation_frame` + opacity/scale lerp |
| 6 | **UserGuide** | `display/user_guide.rs:257` | `hi-user-guide-fade-in` (opacity + translateY) | `use_animation_frame` + opacity/translateY lerp |
| 7 | **CodeHighlighter** | `extra/code_highlighter.rs:478` | `copy-success` (scale bounce) | `use_animation_frame` + scale lerp |

Each migration follows the pattern:
1. Remove `@keyframes <name> { ... }` block from `styles()`
2. Remove `animation: <name> ...` from the CSS class
3. Add `use_animation_frame()` hook in the component
4. Register the animation with `GlobalAnimationManager::register()`
5. Apply styles directly via `element.set_style()` each frame

### Part E: Integration
**File:** `examples/website/src/main.rs` or equivalent entry point

Add at startup:
```rust
hikari_animation::debug::AnimationDebugProvider::init();
```

Optionally expose `window.__HIKARI_ANIM__` for Playwright direct access:
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn hikari_debug_freeze() { GlobalAnimationManager::freeze(); }
// ... etc
```

---

## Round 5: E2E Capture v4 (est. 400 lines)

### New file: `scripts/e2e/capture_v4.py`

Builds on `capture_v3.py`. New Playwright operations:

```python
def anim_freeze(page):     # page.evaluate("window.__HIKARI_ANIM__.freeze()")
def anim_unfreeze(page):   # page.evaluate("window.__HIKARI_ANIM__.unfreeze()")
def anim_seek(page, p):    # page.evaluate(f"window.__HIKARI_ANIM__.seekAll({p})")
def anim_step(page, ms):   # page.evaluate(f"window.__HIKARI_ANIM__.stepAll({ms})")
def anim_state(page):      # page.evaluate("window.__HIKARI_ANIM__.getState()")
```

### Test plan — animation-specific captures:

**Spin component** (`/components/layer1`):
- Spin initial (spinning) → freeze → screenshot "spin_freeze_0%"
- seek 0.25 → screenshot "spin_seek_25%"
- seek 0.50 → screenshot "spin_seek_50%"
- seek 0.75 → screenshot "spin_seek_75%"
- seek 1.00 → screenshot "spin_seek_100%"
- unfreeze → wait 1s → verify continues

**Drawer component**:
- Open drawer → freeze at open start → screenshot "drawer_open_start"
- Open drawer → step 150ms (halfway) → screenshot "drawer_open_mid"
- Close drawer → freeze → step 150ms → screenshot "drawer_close_mid"

**Progress component** (Active state):
- Set progress to 50% active → freeze → screenshot
- seek 0.5 → screenshot "progress_active_mid_pulse"

**Skeleton component**:
- Skeleton page → freeze → seek 0.5 → screenshot "skeleton_mid_pulse"

**Portal animations** (Modal/Dropdown):
- Open dropdown → freeze at mid-transition → screenshot
- Open modal → step 100ms → screenshot

**Full regression** (re-run v3 screenshots with animations running):
- All 35 routes with scroll + type + click (baseline validation)

---

## Round 6: Verification & Cleanup (est. 1-2 hours)

### Visual review checklist:
1. [ ] All 7 migrated components look identical to CSS version at start/end states
2. [ ] Mid-transition freeze screenshots show visually distinct states (not all black/white)
3. [ ] No visual regressions from v3 baselines (compare pixel diff < 1%)
4. [ ] Animations resume correctly after freeze/unfreeze
5. [ ] No console errors during animation control

### Regression comparison:
```bash
python3 scripts/e2e/compare.py --baseline test_samples_v3 --actual test_samples_v4
```

### Documentation:
- Update `docs/en/system/animation.md` — add "E2E Testing" section
- Add `packages/animation/README.md` — debug API usage example

---

## Files to modify (estimated)

| File | Action | Lines |
|------|--------|-------|
| `packages/animation/src/global_manager.rs` | Rewrite (real impl) | +200 |
| `packages/animation/src/debug.rs` | **New** | +80 |
| `packages/animation/src/lib.rs` | Add `pub mod debug` | +2 |
| `packages/animation/src/core/engine.rs` | Add missing API | +20 |
| `packages/animation/src/core/tween.rs` | Add progress/duration getters | +10 |
| `packages/components/src/feedback/spin.rs` | Migrate CSS→RAF | +30 |
| `packages/components/src/feedback/progress.rs` | Migrate CSS→RAF | +25 |
| `packages/components/src/feedback/drawer.rs` | Migrate CSS→RAF | +40 |
| `packages/components/src/display/skeleton.rs` | Migrate CSS→RAF | +25 |
| `packages/components/src/display/drag_layer.rs` | Migrate CSS→RAF | +20 |
| `packages/components/src/display/user_guide.rs` | Migrate CSS→RAF | +20 |
| `packages/extra-components/src/extra/code_highlighter.rs` | Migrate CSS→RAF | +20 |
| `examples/website/src/main.rs` | Debug provider init | +5 |
| `scripts/e2e/capture_v4.py` | **New** | +400 |
| `docs/en/system/animation.md` | E2E section | +30 |
| **TOTAL** | | **~900** |

---

## Dependencies / Prerequisites

- `serde` features enabled on `hikari-animation` crate (for `AnimationDebugState` serialization)
- `wasm-bindgen` already available (used by tairitsu)
- Playwright already working (v3 confirmed)
- Dev server running on port 52847

## Risks

1. **Spin migration**: Infinite rotation tween needs careful handling (not 0→360→0, but continuous increment). Use `use_animation_frame` + `transform = rotate(Xdeg)` where X increments by delta_time × speed.

2. **Drawer complexity**: 4-direction slide + mask fade = 5 keyframe pairs. Most complex migration. The Portal system already handles appear/disappear timing — may just need to replace the CSS with RAF-driven inline styles.

3. **Performance**: RAF callbacks run at 60fps. Adding 7 components with RAF hooks is negligible since they already had CSS animations running at 60fps.

4. **Cross-browser**: The `use_animation_frame` API is standard. No compatibility issues.
