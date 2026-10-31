// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3); human-directed.
//! # Window geometry memory
//!
//! The second facility of this crate: a host's window reopens where the
//! player left it. Geometry (outer position + size + maximized flag,
//! physical pixels) is persisted per window label and reapplied on the next
//! launch, validated against the desktop that greets it — because a
//! remembered position can go stale in two ordinary ways:
//!
//! - the monitor it lived on was unplugged (a whole coordinate range
//!   vanished), or
//! - the window was closed hanging off the edge of the desktop.
//!
//! [`sanitize`] owns both cases:
//!
//! - A window that still lands on some monitor keeps its position, nudged
//!   by the minimal shift that pulls any overhanging edge back inside the
//!   **combined desktop** (the bounding box of every monitor's work area;
//!   side by side, that is the summed widths of all screens).
//! - A window that lands on NO monitor relocates into the monitor nearest
//!   its remembered spot, fully inside that monitor's work area — visible
//!   and grabbable, never beyond the reachable desktop.
//! - The size is bounded both ways by the host's [`SizePolicy`]: never
//!   below the floor (default 800×600 — a desktop shell smaller than that
//!   is unusable; override for special surfaces) and never beyond the
//!   ceiling (default: the combined desktop), so a remembered 4K window
//!   cannot swallow a laptop screen and a remembered thumbprint cannot
//!   reopen unusable.
//!
//! ## The pure core
//!
//! [`ScreenRect`], [`ScreenLayout`], [`WindowGeometry`] and `sanitize`
//! are plain arithmetic on rectangles — dependency-free and compiled for
//! every target (including the workspace's wasm32 gates), so the restore
//! policy is unit-testable without a window manager. Edge math runs in i64
//! (the squared-distance metric in i128) so a maximally-placed window cannot
//! overflow.
//!
//! ## The Tauri adapter (`tauri` feature)
//!
//! Enable the `tauri` feature and register the plugin with a state-file
//! path the host owns; forward the host's own window events into
//! `tauri_shell::handle_window_event` (the same split the close guard
//! uses — Tauri 2.12's plugin builder has no window-event hook, so the
//! plugin owns persistence and the host's `on_window_event` closure feeds
//! it):
//!
//! ```rust,ignore
//! tauri::Builder::default()
//!     .plugin(hikari_host::window_state::tauri_shell::init(
//!         hikari_host::window_state::tauri_shell::WindowStateConfig::new(
//!             app_config_dir.join("window-state.json"),
//!         ),
//!     ))
//!     .on_window_event(|window, event| {
//!         hikari_host::window_state::tauri_shell::handle_window_event(
//!             window.app_handle(),
//!             window,
//!             event,
//!         );
//!     })
//! ```
//!
//! The plugin restores tracked windows in its `on_window_ready` hook (which
//! fires for config-declared windows too — plugins initialize before the
//! event loop creates them), records move/resize events into an in-memory
//! snapshot flushed at most every `save_debounce` (default 800 ms —
//! interactive drags fire dozens of events a second) and always on close
//! requests and [`tauri::RunEvent::Exit`]. While a window is maximized only
//! the flag is updated — the last normal geometry survives, so an
//! un-maximize after restore still lands where the player expects. Minimized
//! windows are never recorded (Windows reports a (-32000, -32000) position
//! for them, which would poison the state).
//!
//! Hosts that want a zero-jump startup (the window never paints at its
//! default spot and jumps to the remembered one) declare the window
//! `visible: false` and show it from their own setup hook, which runs after
//! the plugin's ready hook has applied the geometry.
//!
//! While the exit flush mirrors the close-guard adapter, the plugin name
//! differs (`hikari-host-window-state`): the close guard owns `hikari-host`
//! because its ack command rides Tauri's `plugin:<name>|<command>`
//! namespace — this facility speaks no IPC, so its name is only the
//! internal registry key.

/// Default restore-size floor: a desktop shell smaller than 800×600 is
/// unusable. Hosts with special surfaces override it through
/// [`SizePolicy`]'s constructors or [`tauri_shell::WindowStateConfig`].
pub const DEFAULT_MIN_WIDTH: u32 = 800;
pub const DEFAULT_MIN_HEIGHT: u32 = 600;

/// A monitor's usable rectangle (its work area — the full bounds minus the
/// taskbar), in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScreenRect {
    /// Left edge, in the desktop-wide coordinate space (negative values are
    /// ordinary: monitors left of / above the primary).
    pub x: i32,
    /// Top edge.
    pub y: i32,
    /// Work-area width.
    pub width: u32,
    /// Work-area height.
    pub height: u32,
}

impl ScreenRect {
    /// Exclusive right edge (`x + width`), in the widened math domain.
    fn right(self) -> i64 {
        self.x as i64 + self.width as i64
    }

    /// Exclusive bottom edge (`y + height`), in the widened math domain.
    fn bottom(self) -> i64 {
        self.y as i64 + self.height as i64
    }

    /// Whether a window placed at (`x`, `y`) with `w`×`h` overlaps this
    /// screen at all — the "is the remembered spot still reachable" test.
    /// Touching edges only (zero overlap) does NOT count.
    fn overlaps(self, x: i64, y: i64, w: i64, h: i64) -> bool {
        x < self.right() && (self.x as i64) < x + w && y < self.bottom() && (self.y as i64) < y + h
    }

    /// Squared distance between this screen and a window rect (0 when they
    /// overlap) — the "which monitor deserves the relocated window" metric.
    /// Accumulated in i128: a crafted state file can carry i32::EXTREME
    /// coordinates against an opposite-sign monitor, and that square
    /// overflows i64 (a debug panic at restore, a wrong-but-valid monitor
    /// pick in release).
    fn distance_sq(self, x: i64, y: i64, w: i64, h: i64) -> i128 {
        let dx = (self.x as i64 - (x + w)).max(x - self.right()).max(0);
        let dy = (self.y as i64 - (y + h)).max(y - self.bottom()).max(0);
        i128::from(dx) * i128::from(dx) + i128::from(dy) * i128::from(dy)
    }
}

/// The desktop a restore runs against: every monitor's work area plus which
/// entry is the primary (the tie-break when a lost window is equidistant
/// from two screens).
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ScreenLayout {
    /// Every monitor's work area. Empty when a probe answered nothing.
    pub screens: Vec<ScreenRect>,
    /// Index into `screens` of the primary monitor, if it was seen.
    pub primary: usize,
}

impl ScreenLayout {
    /// The combined desktop: the bounding box of every monitor. A window
    /// cannot usefully be larger than this, and nothing outside it is
    /// reachable — side-by-side monitors make its width the summed width of
    /// all screens.
    fn bounds(&self) -> ScreenRect {
        let left = self.screens.iter().map(|s| s.x as i64).min().unwrap_or(0);
        let top = self.screens.iter().map(|s| s.y as i64).min().unwrap_or(0);
        let right = self.screens.iter().map(|s| s.right()).max().unwrap_or(0);
        let bottom = self.screens.iter().map(|s| s.bottom()).max().unwrap_or(0);
        ScreenRect {
            x: left as i32,
            y: top as i32,
            width: (right - left).max(0) as u32,
            height: (bottom - top).max(0) as u32,
        }
    }

    /// The monitor a lost window relocates into: nearest by rect distance,
    /// ties broken toward the primary screen, then toward the earlier entry.
    fn nearest(&self, x: i64, y: i64, w: i64, h: i64) -> Option<ScreenRect> {
        self.screens
            .iter()
            .enumerate()
            .min_by_key(|(idx, screen)| {
                (
                    screen.distance_sq(x, y, w, h),
                    usize::from(*idx != self.primary),
                    *idx,
                )
            })
            .map(|(_, screen)| *screen)
    }
}

/// A remembered window geometry (physical pixels; `x`/`y` is the OUTER
/// position, matching what Tauri's `outer_position` reports and
/// `set_position` accepts).
///
/// Serialized only behind the `tauri` feature (the adapter's state file);
/// the default build stays dependency-free.
#[cfg_attr(feature = "tauri", derive(serde::Serialize, serde::Deserialize))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowGeometry {
    /// Outer left edge.
    pub x: i32,
    /// Outer top edge.
    pub y: i32,
    /// Outer width.
    pub width: u32,
    /// Outer height.
    pub height: u32,
    /// Whether the window was maximized; position and size stay the NORMAL
    /// geometry an un-maximize returns to.
    pub maximized: bool,
}

/// The host's restore-size policy.
///
/// The floor defaults to 800×600 ([`DEFAULT_MIN_WIDTH`] /
/// [`DEFAULT_MIN_HEIGHT`]); the ceiling defaults to the combined desktop,
/// which is also the hard upper bound even when a tighter ceiling is
/// configured — a window larger than the desktop can never be fully
/// visible.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SizePolicy {
    /// Smallest restored width.
    pub min_width: u32,
    /// Smallest restored height.
    pub min_height: u32,
    /// Largest restored width, if the host configured one.
    pub max_width: Option<u32>,
    /// Largest restored height, if the host configured one.
    pub max_height: Option<u32>,
}

impl Default for SizePolicy {
    fn default() -> Self {
        Self {
            min_width: DEFAULT_MIN_WIDTH,
            min_height: DEFAULT_MIN_HEIGHT,
            max_width: None,
            max_height: None,
        }
    }
}

impl SizePolicy {
    /// The effective width ceiling: the configured maximum, capped by the
    /// combined desktop.
    fn effective_max_width(&self, bounds: ScreenRect) -> i64 {
        match self.max_width {
            Some(configured) => (configured as i64).min(bounds.width as i64),
            None => bounds.width as i64,
        }
    }

    /// The effective height ceiling; see [`Self::effective_max_width`].
    fn effective_max_height(&self, bounds: ScreenRect) -> i64 {
        match self.max_height {
            Some(configured) => (configured as i64).min(bounds.height as i64),
            None => bounds.height as i64,
        }
    }
}

/// Validate a remembered geometry against the desktop that greets it.
///
/// Returns `None` when there is no screen to validate against (a monitor
/// probe that answered nothing); the caller then applies the raw geometry as
/// a best effort. Otherwise the returned geometry is fully inside the
/// combined desktop, on a reachable monitor, and sized within the policy.
pub fn sanitize(
    saved: WindowGeometry,
    layout: &ScreenLayout,
    policy: &SizePolicy,
) -> Option<WindowGeometry> {
    if layout.screens.is_empty() {
        return None;
    }
    let bounds = layout.bounds();

    // Size first: floor at the policy minimum, ceiling at the tighter of the
    // configured maximum and the combined desktop. A desktop SMALLER than
    // the floor (a sub-800×600 screen) wins — a fully visible window beats
    // an on-paper minimum the screen cannot show.
    let width = clamp_dim(
        saved.width as i64,
        policy.min_width as i64,
        policy.effective_max_width(bounds),
    );
    let height = clamp_dim(
        saved.height as i64,
        policy.min_height as i64,
        policy.effective_max_height(bounds),
    );

    let want_x = saved.x as i64;
    let want_y = saved.y as i64;

    // Position: keep the remembered spot when any monitor is still under it,
    // shifting only by what overhangs the combined desktop. Otherwise the
    // window is unreachable (unplugged monitor, closed off-screen) and
    // relocates into the nearest monitor, clamped fully inside its work
    // area.
    let (x, y) = if layout
        .screens
        .iter()
        .any(|s| s.overlaps(want_x, want_y, width, height))
    {
        (
            clamp_pos(want_x, bounds.x as i64, bounds.right() - width),
            clamp_pos(want_y, bounds.y as i64, bounds.bottom() - height),
        )
    } else {
        let target = layout.nearest(want_x, want_y, width, height)?;
        (
            clamp_pos(want_x, target.x as i64, target.right() - width),
            clamp_pos(want_y, target.y as i64, target.bottom() - height),
        )
    };

    Some(WindowGeometry {
        x: x as i32,
        y: y as i32,
        width: width as u32,
        height: height as u32,
        maximized: saved.maximized,
    })
}

/// Clamp a dimension into [`min`, `max`]; when the ceiling itself is below
/// the floor (a desktop smaller than the policy minimum) the ceiling wins.
fn clamp_dim(want: i64, min: i64, max: i64) -> i64 {
    if max < min { max } else { want.clamp(min, max) }
}

/// Clamp a coordinate so a `dim` sized window fits inside [`low`, `high`];
/// when the window is wider than the range it pins to `low` (left/top
/// aligned — the OS clips what cannot fit).
fn clamp_pos(want: i64, low: i64, high: i64) -> i64 {
    want.clamp(low, high.max(low))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn screen(x: i32, y: i32, width: u32, height: u32) -> ScreenRect {
        ScreenRect {
            x,
            y,
            width,
            height,
        }
    }

    fn geometry(x: i32, y: i32, width: u32, height: u32) -> WindowGeometry {
        WindowGeometry {
            x,
            y,
            width,
            height,
            maximized: false,
        }
    }

    fn single_screen() -> ScreenLayout {
        ScreenLayout {
            screens: vec![screen(0, 0, 1920, 1040)],
            primary: 0,
        }
    }

    fn side_by_side() -> ScreenLayout {
        ScreenLayout {
            screens: vec![screen(0, 0, 1920, 1040), screen(1920, 0, 2560, 1400)],
            primary: 0,
        }
    }

    /// A window fully on a screen that still exists comes back EXACTLY as
    /// saved — restore must be invisible to the player.
    #[test]
    fn on_screen_geometry_is_kept_verbatim() {
        let saved = geometry(100, 50, 1280, 820);
        assert_eq!(
            sanitize(saved, &single_screen(), &SizePolicy::default()),
            Some(saved),
        );
    }

    /// A window spanning two monitors is legitimate and stays put.
    #[test]
    fn spanning_two_screens_is_kept() {
        let saved = geometry(1500, 100, 1000, 600);
        assert_eq!(
            sanitize(saved, &side_by_side(), &SizePolicy::default()),
            Some(saved),
        );
    }

    /// Negative coordinates are ordinary (a monitor left of the primary)
    /// and restore verbatim.
    #[test]
    fn negative_coordinates_restore_verbatim() {
        let layout = ScreenLayout {
            screens: vec![screen(-1920, 0, 1920, 1040), screen(0, 0, 1920, 1040)],
            primary: 1,
        };
        let saved = geometry(-1900, 30, 1280, 820);
        assert_eq!(
            sanitize(saved, &layout, &SizePolicy::default()),
            Some(saved)
        );
    }

    /// A window overhanging the desktop edge is pulled back by exactly the
    /// overhang — minimal shift, same screen.
    #[test]
    fn overhanging_edge_is_pulled_back_minimally() {
        let policy = SizePolicy::default();
        // 1920-wide screen, window at x=1500 w=800 → 380px past the edge.
        let fixed = sanitize(geometry(1500, 0, 800, 600), &single_screen(), &policy).unwrap();
        assert_eq!(
            (fixed.x, fixed.y, fixed.width, fixed.height),
            (1120, 0, 800, 600)
        );
        // Same from the top: y=-100 lands at 0.
        let fixed = sanitize(geometry(10, -100, 800, 600), &single_screen(), &policy).unwrap();
        assert_eq!(fixed.y, 0);
    }

    /// The unplugged-monitor case: the second screen is GONE and the window
    /// that lived on it relocates fully inside the remaining (nearest)
    /// screen.
    #[test]
    fn unplugged_monitor_relocates_onto_the_nearest_screen() {
        let alone = single_screen();
        // Saved at x=2400 (on the now-missing 2560-wide second monitor).
        let fixed = sanitize(
            geometry(2400, 100, 1280, 820),
            &alone,
            &SizePolicy::default(),
        )
        .unwrap();
        // Clamped into the primary's work area, fully visible.
        assert_eq!(fixed.x, 1920 - 1280);
        assert_eq!((fixed.y, fixed.width, fixed.height), (100, 1280, 820));
    }

    /// A window closed fully off-screen (none of it on any monitor) is the
    /// same case as the unplugged monitor: relocate, fully visible.
    #[test]
    fn fully_off_screen_relocates() {
        let fixed = sanitize(
            geometry(-5000, 4000, 800, 600),
            &side_by_side(),
            &SizePolicy::default(),
        )
        .unwrap();
        assert!(fixed.x >= 0 && fixed.x + fixed.width as i32 <= 1920);
        assert!(fixed.y >= 0 && fixed.y + fixed.height as i32 <= 1040);
    }

    /// Between two monitors there can be a hole with real coordinates on
    /// no screen; a window saved there relocates to the NEAREST screen
    /// (rect distance decides, not coordinate ranges).
    #[test]
    fn hole_between_screens_relocates_to_the_nearest() {
        // A 1480px gap between the two screens; the 1280-wide window fits
        // in it on no screen and sits nearer the first screen's right edge.
        let layout = ScreenLayout {
            screens: vec![screen(0, 0, 1920, 1040), screen(3400, 0, 1920, 1040)],
            primary: 0,
        };
        let fixed = sanitize(
            geometry(2000, 200, 1280, 820),
            &layout,
            &SizePolicy::default(),
        )
        .unwrap();
        assert_eq!((fixed.x, fixed.y), (1920 - 1280, 200));
    }

    /// Equidistant relocation ties break toward the primary screen.
    #[test]
    fn relocation_tie_breaks_to_primary() {
        // Two screens stacked with a gap; the lost window sits exactly
        // halfway between them, so only the primary flag breaks the tie.
        let layout = ScreenLayout {
            screens: vec![screen(-960, 0, 1920, 1040), screen(-960, 2200, 1920, 1040)],
            primary: 1,
        };
        let fixed = sanitize(
            geometry(-960, 1320, 800, 600),
            &layout,
            &SizePolicy::default(),
        )
        .unwrap();
        // Landed fully inside the PRIMARY (lower) screen.
        assert_eq!((fixed.x, fixed.y), (-960, 2200));
    }

    /// The 800×600 floor applies on restore — a thumbprint-sized memory
    /// reopens usable.
    #[test]
    fn undersized_geometry_is_raised_to_the_minimum() {
        let fixed = sanitize(
            geometry(10, 10, 320, 200),
            &single_screen(),
            &SizePolicy::default(),
        )
        .unwrap();
        assert_eq!(
            (fixed.width, fixed.height),
            (DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT)
        );
        assert_eq!((fixed.x, fixed.y), (10, 10));
    }

    /// A host-configured tighter floor replaces the default.
    #[test]
    fn policy_floor_is_configurable() {
        let policy = SizePolicy {
            min_width: 480,
            min_height: 320,
            ..SizePolicy::default()
        };
        let fixed = sanitize(geometry(10, 10, 320, 200), &single_screen(), &policy).unwrap();
        assert_eq!((fixed.width, fixed.height), (480, 320));
    }

    /// The combined desktop is the ceiling — a 4K-sized memory cannot
    /// swallow a laptop screen (side-by-side layouts: the summed width;
    /// height stays the tallest single screen).
    #[test]
    fn oversized_geometry_is_capped_at_the_combined_desktop() {
        let fixed = sanitize(
            geometry(0, 0, 6000, 4000),
            &side_by_side(),
            &SizePolicy::default(),
        )
        .unwrap();
        // 1920 + 2560 wide, max(1040, 1400) tall.
        assert_eq!((fixed.width, fixed.height), (4480, 1400));
    }

    /// A configured ceiling tighter than the desktop wins; one LOOSER than
    /// the desktop is still capped by it (a window larger than the desktop
    /// can never be fully visible).
    #[test]
    fn configured_ceiling_wins_up_to_the_desktop() {
        let tight = SizePolicy {
            max_width: Some(1000),
            max_height: Some(700),
            ..SizePolicy::default()
        };
        let fixed = sanitize(geometry(0, 0, 6000, 4000), &single_screen(), &tight).unwrap();
        assert_eq!((fixed.width, fixed.height), (1000, 700));

        let loose = SizePolicy {
            max_width: Some(9999),
            max_height: Some(9999),
            ..SizePolicy::default()
        };
        let fixed = sanitize(geometry(0, 0, 6000, 4000), &single_screen(), &loose).unwrap();
        assert_eq!((fixed.width, fixed.height), (1920, 1040));
    }

    /// A desktop physically smaller than the policy floor (sub-netbook
    /// screens, some VMs) sizes to the desktop instead — fully visible
    /// beats an on-paper minimum.
    #[test]
    fn tiny_desktop_wins_over_the_minimum() {
        let layout = ScreenLayout {
            screens: vec![screen(0, 0, 640, 480)],
            primary: 0,
        };
        let fixed = sanitize(geometry(0, 0, 800, 600), &layout, &SizePolicy::default()).unwrap();
        assert_eq!((fixed.width, fixed.height), (640, 480));
    }

    /// A window bigger than the monitor it relocates into pins to that
    /// monitor's top-left (the OS clips the overhang).
    #[test]
    fn relocation_of_an_oversized_window_pins_to_the_screen_edge() {
        let fixed = sanitize(
            geometry(5000, 0, 2400, 900),
            &single_screen(),
            &SizePolicy::default(),
        )
        .unwrap();
        assert_eq!((fixed.x, fixed.y), (0, 0));
    }

    /// No monitors answered the probe: no opinion (the caller applies the
    /// raw geometry).
    #[test]
    fn empty_layout_is_none() {
        let layout = ScreenLayout::default();
        assert_eq!(
            sanitize(geometry(10, 10, 1280, 820), &layout, &SizePolicy::default()),
            None
        );
    }

    /// The maximized flag survives sanitize untouched — position and size
    /// are the NORMAL geometry the un-maximize returns to.
    #[test]
    fn maximized_flag_passes_through() {
        let saved = WindowGeometry {
            x: 5,
            y: 5,
            width: 1280,
            height: 820,
            maximized: true,
        };
        let fixed = sanitize(saved, &single_screen(), &SizePolicy::default()).unwrap();
        assert!(fixed.maximized);
        assert_eq!(
            (fixed.x, fixed.y, fixed.width, fixed.height),
            (5, 5, 1280, 820)
        );
    }

    /// The combined-desktop bounds are the union, not the sum of heights:
    /// staggered monitors contribute their extremes.
    #[test]
    fn bounds_are_the_union_of_all_screens() {
        let layout = ScreenLayout {
            screens: vec![
                screen(0, 0, 1920, 1080),
                screen(1920, -600, 1280, 1024),
                screen(-1280, 0, 1280, 720),
            ],
            primary: 0,
        };
        assert_eq!(
            layout.bounds(),
            ScreenRect {
                x: -1280,
                y: -600,
                width: 4480,
                height: 1680,
            }
        );
    }

    /// Extreme-but-valid coordinates from a crafted state file must not
    /// overflow the distance metric: saved at i32::MIN against a monitor at
    /// the opposite end squares past i64::MAX, which panicked in debug
    /// builds before the metric moved to i128.
    #[test]
    fn extreme_coordinates_do_not_overflow_the_distance_metric() {
        let far = 2_000_000_000;
        let layout = ScreenLayout {
            screens: vec![ScreenRect {
                x: far,
                y: far,
                width: 1920,
                height: 1080,
            }],
            primary: 0,
        };
        let fixed = sanitize(
            WindowGeometry {
                x: i32::MIN,
                y: i32::MIN,
                width: 800,
                height: 600,
                maximized: false,
            },
            &layout,
            &SizePolicy::default(),
        )
        .unwrap();
        // Relocated fully inside the far monitor (the window is smaller than
        // the screen, so it pins at the work area's top-left).
        assert_eq!(
            (fixed.x, fixed.y, fixed.width, fixed.height),
            (far, far, 800, 600)
        );
    }

    /// Touching an edge is NOT overlapping: a window whose left edge sits
    /// exactly at the only screen's right edge (zero shared pixels)
    /// relocates like a gone-monitor window — pins the strict-`<` semantics.
    #[test]
    fn edge_touching_is_not_overlapping() {
        let fixed = sanitize(
            geometry(1920, 0, 1280, 820),
            &single_screen(),
            &SizePolicy::default(),
        )
        .unwrap();
        assert_eq!((fixed.x, fixed.y), (1920 - 1280, 0));
    }
}

#[cfg(all(feature = "tauri", not(target_family = "wasm")))]
pub mod tauri_shell {
    //! Tauri 2 adapter for the window geometry memory.
    //!
    //! ## What a host wires
    //!
    //! Two pieces, both required (the same split as the close guard —
    //! Tauri 2.12's plugin builder has no window-event hook, so the host's
    //! own `on_window_event` closure feeds the tracker):
    //!
    //! 1. [`init`] as a Tauri plugin, with a [`WindowStateConfig`] naming
    //!    the state file the host owns. The plugin restores tracked windows
    //!    in its `on_window_ready` hook (config-declared windows included —
    //!    plugins initialize before the event loop creates them) and saves
    //!    on [`tauri::RunEvent::Exit`].
    //! 2. [`handle_window_event`] inside the host's
    //!    `tauri::Builder::on_window_event` closure, which records
    //!    move/resize events (debounced) and flushes on close requests.
    //!
    //! Hosts attaching the listener to a `WebviewWindow` directly use
    //! [`handle_window_event_webview`] instead (same semantics).
    //!
    //! ## Persistence
    //!
    //! One JSON file, one entry per tracked label:
    //! `{"version":1,"windows":{"main":{"x":..,"y":..,"width":..,`
    //! `"height":..,"maximized":..}}}`, written through a temp-file +
    //! rename replace. An unreadable, corrupt or future-versioned file
    //! starts a fresh state (a warning, never a crash); entries for labels
    //! the host no longer tracks survive rewrites untouched.
    //!
    //! ## Diagnostics
    //!
    //! The crate carries no logging dependency (same decision as the close
    //! guard), so the adapter writes its sparse lifecycle lines to stderr
    //! with the shared `[hikari-host]` prefix: WARN for a failed save,
    //! DEBUG (debug builds only) for restores.

    use std::collections::BTreeMap;
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{Duration, Instant};

    use tauri::plugin::{Builder as PluginBuilder, TauriPlugin};
    use tauri::{AppHandle, Manager, RunEvent, Runtime, Window, WindowEvent};

    use super::{ScreenLayout, SizePolicy, WindowGeometry, sanitize};

    /// The Tauri plugin name (registry key only — this facility speaks no
    /// IPC, unlike the close guard whose `ack_close` command rides the
    /// `plugin:<name>|<command>` namespace that owns the plain
    /// `hikari-host` name).
    pub const PLUGIN_NAME: &str = "hikari-host-window-state";

    /// How long a geometry change may sit in memory before the debounced
    /// disk flush runs. Interactive drags fire dozens of events a second;
    /// the close-request and exit flushes always capture the last word.
    pub const DEFAULT_SAVE_DEBOUNCE: Duration = Duration::from_millis(800);

    /// On-disk state format version; a file carrying any other starts
    /// fresh instead of guessing at a layout it does not know.
    const STATE_FORMAT_VERSION: u32 = 1;

    /// Host policy for the geometry memory.
    ///
    /// [`WindowStateConfig::new`] is the common default: track the `main`
    /// window, the 800×600 restore floor, the combined-desktop ceiling, and
    /// the 800 ms save debounce. The `with_*` methods adjust one field at a
    /// time.
    #[derive(Debug, Clone)]
    pub struct WindowStateConfig {
        /// Window labels whose geometry is remembered, matched EXACTLY
        /// (no prefix/suffix/glob semantics).
        pub labels: Vec<String>,
        /// Where the state file lives; the host owns its data-dir layout.
        pub path: PathBuf,
        /// Restore-size floor, as [`SizePolicy`]'s minimums.
        pub min_size: (u32, u32),
        /// Restore-size ceiling; `None` caps at the combined desktop.
        pub max_size: Option<(u32, u32)>,
        /// Minimum spacing between disk flushes.
        pub save_debounce: Duration,
    }

    impl WindowStateConfig {
        /// The common configuration for one state file: the `main` window,
        /// default size policy, default debounce.
        pub fn new(path: impl Into<PathBuf>) -> Self {
            Self {
                labels: vec![crate::tauri_shell::DEFAULT_WINDOW_LABEL.to_string()],
                path: path.into(),
                min_size: (super::DEFAULT_MIN_WIDTH, super::DEFAULT_MIN_HEIGHT),
                max_size: None,
                save_debounce: DEFAULT_SAVE_DEBOUNCE,
            }
        }

        /// Replace the set of tracked window labels.
        pub fn with_labels(mut self, labels: impl IntoIterator<Item = impl Into<String>>) -> Self {
            self.labels = labels.into_iter().map(Into::into).collect();
            self
        }

        /// Replace the restore-size floor.
        pub fn with_min_size(mut self, width: u32, height: u32) -> Self {
            self.min_size = (width, height);
            self
        }

        /// Replace the restore-size ceiling (`None` caps at the combined
        /// desktop).
        pub fn with_max_size(mut self, size: Option<(u32, u32)>) -> Self {
            self.max_size = size;
            self
        }

        /// Replace the disk-flush debounce.
        pub fn with_save_debounce(mut self, debounce: Duration) -> Self {
            self.save_debounce = debounce;
            self
        }

        /// Whether a window with this label is tracked. Exact match.
        fn tracks(&self, label: &str) -> bool {
            self.labels.iter().any(|entry| entry == label)
        }

        /// The size policy this configuration restores under.
        fn policy(&self) -> SizePolicy {
            SizePolicy {
                min_width: self.min_size.0,
                min_height: self.min_size.1,
                max_width: self.max_size.map(|size| size.0),
                max_height: self.max_size.map(|size| size.1),
            }
        }
    }

    /// The persisted state file: one geometry per tracked label.
    #[derive(serde::Serialize, serde::Deserialize, Default)]
    struct StateFile {
        version: u32,
        #[serde(default)]
        windows: BTreeMap<String, WindowGeometry>,
    }

    /// In-memory snapshot between disk flushes, guarded by the host state's
    /// mutex: the window-event hook, close requests and the exit hook run
    /// on different threads of the Tauri event loop.
    struct Persisted {
        windows: BTreeMap<String, WindowGeometry>,
        dirty: bool,
        last_flush: Instant,
    }

    /// Plugin-managed state, installed by [`init`]'s setup hook.
    struct WindowStateHost {
        config: WindowStateConfig,
        persisted: Mutex<Persisted>,
    }

    impl WindowStateHost {
        /// Load the state file (a missing file is a fresh start; a corrupt
        /// or future-versioned one warns and starts fresh too).
        fn load(config: WindowStateConfig) -> Self {
            let windows = std::fs::read(&config.path)
                .ok()
                .and_then(|bytes| parse_state(&bytes))
                .unwrap_or_default();
            Self {
                config,
                persisted: Mutex::new(Persisted {
                    windows,
                    dirty: false,
                    last_flush: Instant::now(),
                }),
            }
        }

        /// The remembered geometry for one label, if any.
        fn saved(&self, label: &str) -> Option<WindowGeometry> {
            self.persisted
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .windows
                .get(label)
                .copied()
        }
    }

    /// Parse state-file bytes; `None` for anything unreadable, corrupt, or
    /// written by a format version this build does not know.
    fn parse_state(bytes: &[u8]) -> Option<BTreeMap<String, WindowGeometry>> {
        match serde_json::from_slice::<StateFile>(bytes) {
            Ok(file) if file.version == STATE_FORMAT_VERSION => Some(file.windows),
            Ok(file) => {
                warn_line(format_args!(
                    "window-state file carries unknown version {}; starting fresh",
                    file.version,
                ));
                None
            }
            Err(err) => {
                warn_line(format_args!(
                    "window-state file unreadable ({err}); starting fresh",
                ));
                None
            }
        }
    }

    /// Install the window geometry memory plugin.
    ///
    /// The plugin loads the state file in its setup hook, restores tracked
    /// windows in `on_window_ready`, and flushes on [`tauri::RunEvent::Exit`].
    /// The host still has to forward its window events to
    /// [`handle_window_event`] — see the module docs.
    pub fn init<R: Runtime>(config: WindowStateConfig) -> TauriPlugin<R> {
        PluginBuilder::new(PLUGIN_NAME)
            .setup(move |app, _api| {
                app.manage(WindowStateHost::load(config));
                Ok(())
            })
            .on_window_ready(|window| restore_window(&window))
            .on_event(|app, event| {
                if let RunEvent::Exit = event {
                    save_now(app);
                }
            })
            .build()
    }

    /// Intercept one window event from the host's app-level
    /// `tauri::Builder::on_window_event` hook: move/resize events of
    /// tracked windows update the debounced snapshot, close requests and
    /// destruction flush it to disk. Every other event and label is
    /// ignored.
    pub fn handle_window_event<R: Runtime>(
        app: &AppHandle<R>,
        window: &Window<R>,
        event: &WindowEvent,
    ) {
        observe(app, window.label(), event, || snapshot(window));
    }

    /// [`handle_window_event`] for hosts that attach the listener to a
    /// `WebviewWindow` directly.
    pub fn handle_window_event_webview<R: Runtime>(
        app: &AppHandle<R>,
        window: &tauri::WebviewWindow<R>,
        event: &WindowEvent,
    ) {
        observe(app, window.label(), event, || snapshot_webview(window));
    }

    /// Shared body of both window-event entry points. The snapshot closure
    /// is lazy: only geometry events pay for the window queries.
    fn observe<F, R: Runtime>(app: &AppHandle<R>, label: &str, event: &WindowEvent, live: F)
    where
        F: FnOnce() -> Option<WindowGeometry>,
    {
        let Some(host) = app.try_state::<WindowStateHost>() else {
            warn_line(format_args!(
                "window event ignored: plugin state missing; register window_state::tauri_shell::init",
            ));
            return;
        };
        if !host.config.tracks(label) {
            return;
        }
        match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                if let Some(geometry) = live() {
                    update(&host, label, geometry);
                }
            }
            // A close request is intercepted or honoured, but either way
            // the geometry just stopped changing — the flush must not wait
            // out the debounce. Destroyed covers programmatic teardown.
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
                save_now(app);
            }
            _ => {}
        }
    }

    /// Read one window's live geometry. `None` when the window cannot be
    /// queried — a minimized window (Windows reports a (-32000, -32000)
    /// position for it, which would poison the state) or a zero-size
    /// intermediate state.
    fn snapshot<R: Runtime>(window: &Window<R>) -> Option<WindowGeometry> {
        if window.is_minimized().unwrap_or(false) {
            return None;
        }
        let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) else {
            return None;
        };
        if size.width == 0 || size.height == 0 {
            return None;
        }
        Some(WindowGeometry {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            maximized: window.is_maximized().unwrap_or(false),
        })
    }

    /// [`snapshot`] for the `WebviewWindow` handle (Tauri ships the
    /// queries on both types with no shared trait between them).
    fn snapshot_webview<R: Runtime>(window: &tauri::WebviewWindow<R>) -> Option<WindowGeometry> {
        if window.is_minimized().unwrap_or(false) {
            return None;
        }
        let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) else {
            return None;
        };
        if size.width == 0 || size.height == 0 {
            return None;
        }
        Some(WindowGeometry {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            maximized: window.is_maximized().unwrap_or(false),
        })
    }

    /// Fold one live geometry into the snapshot, then maybe flush. While
    /// the window is maximized only the flag moves: the maximized frame is
    /// the OS's business, and the last normal geometry is what an
    /// un-maximize after restore returns to.
    fn update(host: &WindowStateHost, label: &str, live: WindowGeometry) {
        let mut persisted = host.persisted.lock().unwrap_or_else(|e| e.into_inner());
        match persisted.windows.get_mut(label) {
            Some(entry) => {
                if live.maximized {
                    entry.maximized = true;
                } else {
                    *entry = live;
                }
            }
            // A window BORN maximized (no prior state) has no normal geometry
            // to remember yet — seeding from the maximized frame would make
            // an un-maximize after restore land on a work-area-sized window
            // instead of the configured default. The first un-maximized
            // move/resize seeds the entry.
            None if !live.maximized => {
                persisted.windows.insert(label.to_string(), live);
            }
            None => {}
        }
        persisted.dirty = true;
        if persisted.last_flush.elapsed() >= host.config.save_debounce {
            flush_locked(&host.config.path, &mut persisted);
        }
    }

    /// Flush the snapshot to disk NOW (close requests, destruction, app
    /// exit, or a host that wants the file settled). A no-op when nothing
    /// was ever tracked.
    pub fn save_now<R: Runtime>(app: &AppHandle<R>) {
        let Some(host) = app.try_state::<WindowStateHost>() else {
            return;
        };
        let mut persisted = host.persisted.lock().unwrap_or_else(|e| e.into_inner());
        flush_locked(&host.config.path, &mut persisted);
    }

    /// Write one snapshot through the temp-file + rename replace,
    /// throttled by the caller. Failures throttle like successes: a
    /// read-only data dir must not re-attempt a write on every drag frame.
    fn flush_locked(path: &Path, persisted: &mut Persisted) {
        let file = StateFile {
            version: STATE_FORMAT_VERSION,
            windows: persisted.windows.clone(),
        };
        let outcome = serde_json::to_string(&file)
            .map_err(|err| err.to_string())
            .and_then(|json| atomic_write(path, &json).map_err(|err| err.to_string()));
        persisted.last_flush = Instant::now();
        match outcome {
            Ok(()) => persisted.dirty = false,
            Err(err) => warn_line(format_args!("window-state save failed ({err})")),
        }
    }

    /// Restore one window's remembered geometry, if the plugin tracks it
    /// and something was remembered.
    fn restore_window<R: Runtime>(window: &Window<R>) {
        let app = window.app_handle();
        let Some(host) = app.try_state::<WindowStateHost>() else {
            warn_line(format_args!(
                "window ready ignored: plugin state missing; register window_state::tauri_shell::init",
            ));
            return;
        };
        if !host.config.tracks(window.label()) {
            return;
        }
        let Some(saved) = host.saved(window.label()) else {
            return;
        };
        // A monitor probe that answers nothing applies the raw geometry
        // unvalidated: the position was reachable when it was saved, and
        // there is no desktop evidence against it.
        let geometry = match probe_layout(window) {
            Ok(layout) => sanitize(saved, &layout, &host.config.policy()).unwrap_or(saved),
            Err(_) => saved,
        };
        // Size before position: the position clamps against the new size.
        let applied = window
            .set_size(tauri::PhysicalSize::new(geometry.width, geometry.height))
            .and_then(|()| {
                window.set_position(tauri::PhysicalPosition::new(geometry.x, geometry.y))
            })
            .and_then(|()| {
                // Mobile tauri::Window has no maximize() and no maximized
                // geometry to restore — the phone webview is always
                // fullscreen. Gate on the TARGET, not cfg(mobile): that cfg
                // is emitted by tauri-build for the APP crate only and is
                // never defined for a dependency like this one, so an
                // ungated maximize() breaks every downstream Android/iOS
                // build (wowsp 2026-10-31).
                if !geometry.maximized {
                    return Ok(());
                }
                #[cfg(any(target_os = "android", target_os = "ios"))]
                {
                    return Ok(());
                }
                #[cfg(not(any(target_os = "android", target_os = "ios")))]
                {
                    return window.maximize();
                }
                #[allow(unreachable_code)]
                Ok(())
            });
        match applied {
            Ok(()) => debug_line(format_args!(
                "window {:?} geometry restored to {:?}",
                window.label(),
                geometry,
            )),
            Err(err) => warn_line(format_args!(
                "window {:?} geometry restore failed ({err})",
                window.label(),
            )),
        }
    }

    /// Probe the live desktop through a window handle: every monitor's
    /// work area, with the primary marked.
    fn probe_layout<R: Runtime>(window: &Window<R>) -> tauri::Result<ScreenLayout> {
        let monitors = window.available_monitors()?;
        let primary = window.primary_monitor().ok().flatten().map(|m| {
            (
                m.position().x,
                m.position().y,
                m.size().width,
                m.size().height,
            )
        });
        let mut screens = Vec::with_capacity(monitors.len());
        let mut primary_idx = 0;
        for monitor in &monitors {
            let area = monitor.work_area();
            if Some((
                monitor.position().x,
                monitor.position().y,
                monitor.size().width,
                monitor.size().height,
            )) == primary
            {
                primary_idx = screens.len();
            }
            screens.push(super::ScreenRect {
                x: area.position.x,
                y: area.position.y,
                width: area.size.width,
                height: area.size.height,
            });
        }
        Ok(ScreenLayout {
            screens,
            primary: primary_idx,
        })
    }

    /// Replace a data file without a shared temporary: write a sibling
    /// temp file, rename over the destination (Rust's rename replaces an
    /// existing destination on Windows), clean up on failure.
    fn atomic_write(path: &Path, content: &str) -> std::io::Result<()> {
        let parent = path.parent().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "state file has no parent directory",
            )
        })?;
        std::fs::create_dir_all(parent)?;
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let tmp = parent.join(format!(
            ".{}-{}-{}.tmp",
            PLUGIN_NAME,
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed),
        ));
        std::fs::write(&tmp, content)?;
        match std::fs::rename(&tmp, path) {
            Ok(()) => Ok(()),
            Err(err) => {
                let _ = std::fs::remove_file(&tmp);
                Err(err)
            }
        }
    }

    /// Emit one WARN-level diagnostic line to stderr (mirrors the close
    /// guard adapter's helper; the crate deliberately carries no logging
    /// dependency).
    fn warn_line(message: std::fmt::Arguments<'_>) {
        eprintln!("[hikari-host] WARN  {message}");
    }

    /// Emit one DEBUG-level diagnostic line to stderr, debug builds only.
    fn debug_line(message: std::fmt::Arguments<'_>) {
        if cfg!(debug_assertions) {
            eprintln!("[hikari-host] DEBUG {message}");
        }
    }

    #[cfg(test)]
    mod tests {
        use std::path::PathBuf;
        use std::time::Duration;

        use super::{
            DEFAULT_SAVE_DEBOUNCE, PLUGIN_NAME, STATE_FORMAT_VERSION, WindowStateConfig,
            atomic_write, parse_state,
        };
        use crate::window_state::WindowGeometry;

        /// The defaults ARE the common host policy: the main window, the
        /// shared 800×600 floor, the combined-desktop ceiling, the 800 ms
        /// debounce.
        #[test]
        fn config_defaults_match_the_common_policy() {
            let config = WindowStateConfig::new(PathBuf::from("/tmp/state.json"));
            assert_eq!(config.labels, vec!["main".to_string()]);
            assert_eq!(config.path, PathBuf::from("/tmp/state.json"));
            assert_eq!(config.min_size, (800, 600));
            assert_eq!(config.max_size, None);
            assert_eq!(config.save_debounce, DEFAULT_SAVE_DEBOUNCE);
        }

        /// The `with_*` setters replace exactly one field and leave the
        /// rest at their defaults; label tracking is exact.
        #[test]
        fn builder_overrides_replace_defaults() {
            let config = WindowStateConfig::new("state.json")
                .with_labels(["overview".to_string()])
                .with_min_size(480, 320)
                .with_max_size(Some((1920, 1080)))
                .with_save_debounce(Duration::from_millis(250));
            assert_eq!(config.labels, vec!["overview".to_string()]);
            assert!(config.tracks("overview"));
            assert!(!config.tracks("main"));
            assert!(!config.tracks("main-window"));
            assert!(!config.tracks(""));
            assert_eq!(config.min_size, (480, 320));
            assert_eq!(config.max_size, Some((1920, 1080)));
            assert_eq!(config.save_debounce, Duration::from_millis(250));
        }

        /// An empty label list tracks nothing (a host that only wants the
        /// save/restore plumbing for windows it names later).
        #[test]
        fn empty_label_list_tracks_nothing() {
            let config = WindowStateConfig::new("state.json").with_labels([] as [String; 0]);
            assert!(!config.tracks("main"));
        }

        /// The size policy derives from the config fields one-to-one.
        #[test]
        fn policy_derives_from_the_config() {
            let config = WindowStateConfig::new("state.json")
                .with_min_size(640, 480)
                .with_max_size(Some((2560, 1440)));
            let policy = config.policy();
            assert_eq!(policy.min_width, 640);
            assert_eq!(policy.min_height, 480);
            assert_eq!(policy.max_width, Some(2560));
            assert_eq!(policy.max_height, Some(1440));
        }

        /// The on-disk shape is pinned: one version field plus one flat
        /// geometry object per label, keys in map order. Hosts (and
        /// support bundles) read this file; the format is a contract.
        #[test]
        fn state_file_shape_is_pinned() {
            let mut windows = std::collections::BTreeMap::new();
            windows.insert(
                "main".to_string(),
                WindowGeometry {
                    x: -1920,
                    y: 42,
                    width: 1280,
                    height: 820,
                    maximized: true,
                },
            );
            let file = super::StateFile {
                version: STATE_FORMAT_VERSION,
                windows,
            };
            let json = serde_json::to_string(&file).unwrap();
            assert_eq!(
                json,
                "{\"version\":1,\"windows\":{\"main\":{\"x\":-1920,\"y\":42,\"width\":1280,\"height\":820,\"maximized\":true}}}"
            );
        }

        /// parse_state accepts the pinned shape, tolerates unknown labels,
        /// and rejects corruption and future versions.
        #[test]
        fn parse_state_accepts_known_and_rejects_unknown() {
            let good = b"{\"version\":1,\"windows\":{\"main\":{\"x\":1,\"y\":2,\"width\":800,\"height\":600,\"maximized\":false}}}";
            let parsed = parse_state(good).unwrap();
            assert_eq!(parsed.len(), 1);
            assert_eq!(
                parsed["main"],
                WindowGeometry {
                    x: 1,
                    y: 2,
                    width: 800,
                    height: 600,
                    maximized: false,
                }
            );

            let future = b"{\"version\":2,\"windows\":{}}";
            assert!(parse_state(future).is_none());
            assert!(parse_state(b"not json at all").is_none());
            assert!(parse_state(b"").is_none());
        }

        /// The temp-file + rename replace round-trips through a scratch
        /// file and leaves no temp sibling behind.
        #[test]
        fn atomic_write_round_trips() {
            let dir = std::env::temp_dir().join(format!("{}-{}", PLUGIN_NAME, std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            let path = dir.join("state.json");
            atomic_write(&path, "{\"version\":1}").unwrap();
            assert_eq!(std::fs::read_to_string(&path).unwrap(), "{\"version\":1}");
            // rewrite replaces, and no temp siblings remain
            atomic_write(&path, "{\"version\":2}").unwrap();
            assert_eq!(std::fs::read_to_string(&path).unwrap(), "{\"version\":2}");
            let siblings = std::fs::read_dir(&dir)
                .unwrap()
                .filter_map(|entry| entry.ok())
                .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
                .count();
            assert_eq!(siblings, 0);
            let _ = std::fs::remove_dir_all(&dir);
        }

        /// A window BORN maximized (no prior state) seeds nothing — the
        /// maximized frame is not a normal geometry to remember. The first
        /// un-maximized move/resize seeds the entry; a later maximized event
        /// only flips the flag and keeps the normal geometry.
        #[test]
        fn maximized_windows_never_seed_or_overwrite_normal_geometry() {
            let dir =
                std::env::temp_dir().join(format!("{}-policy-{}", PLUGIN_NAME, std::process::id()));
            let config = WindowStateConfig::new(dir.join("state.json"))
                .with_save_debounce(Duration::from_secs(3600));
            let host = super::WindowStateHost::load(config);
            let maximized_live = WindowGeometry {
                x: 0,
                y: 0,
                width: 1920,
                height: 1040,
                maximized: true,
            };
            super::update(&host, "main", maximized_live);
            assert_eq!(host.saved("main"), None);

            let normal_live = WindowGeometry {
                x: 12,
                y: 34,
                width: 1280,
                height: 820,
                maximized: false,
            };
            super::update(&host, "main", normal_live);
            assert_eq!(host.saved("main"), Some(normal_live));

            // A subsequent maximized session keeps the normal geometry.
            super::update(&host, "main", maximized_live);
            assert_eq!(
                host.saved("main"),
                Some(WindowGeometry {
                    maximized: true,
                    ..normal_live
                })
            );
            let _ = std::fs::remove_dir_all(&dir);
        }

        /// The debounce holds writes back; an explicit flush writes the
        /// LATEST geometry exactly once (the state file only appears after
        /// the flush and carries the second update's values).
        #[test]
        fn debounced_updates_write_once_on_flush() {
            let dir = std::env::temp_dir().join(format!(
                "{}-debounce-{}",
                PLUGIN_NAME,
                std::process::id()
            ));
            let config = WindowStateConfig::new(dir.join("state.json"))
                .with_save_debounce(Duration::from_secs(3600));
            let path = config.path.clone();
            let host = super::WindowStateHost::load(config);
            super::update(
                &host,
                "main",
                WindowGeometry {
                    x: 1,
                    y: 2,
                    width: 800,
                    height: 600,
                    maximized: false,
                },
            );
            super::update(
                &host,
                "main",
                WindowGeometry {
                    x: 9,
                    y: 8,
                    width: 1024,
                    height: 768,
                    maximized: false,
                },
            );
            assert!(!path.exists(), "debounce must hold the write back");

            let mut persisted = host.persisted.lock().unwrap_or_else(|e| e.into_inner());
            super::flush_locked(&path, &mut persisted);
            drop(persisted);
            let json = std::fs::read_to_string(&path).unwrap();
            assert!(json.contains("\"x\":9"), "the latest geometry wins: {json}");
            assert!(
                !json.contains("\"x\":1"),
                "the stale geometry is gone: {json}"
            );
            let _ = std::fs::remove_dir_all(&dir);
        }

        /// atomic_write fails clean when the destination's parent is a
        /// regular file: an error out, and no temp sibling left behind.
        #[test]
        fn atomic_write_fails_clean_on_a_file_parent() {
            let dir = std::env::temp_dir().join(format!(
                "{}-errpath-{}",
                PLUGIN_NAME,
                std::process::id()
            ));
            std::fs::create_dir_all(&dir).unwrap();
            let blocker = dir.join("blocker");
            std::fs::write(&blocker, b"file, not a directory").unwrap();
            let path = blocker.join("state.json");
            assert!(atomic_write(&path, "{}").is_err());
            let siblings = std::fs::read_dir(&dir)
                .unwrap()
                .filter_map(|entry| entry.ok())
                .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
                .count();
            assert_eq!(siblings, 0);
            let _ = std::fs::remove_dir_all(&dir);
        }

        /// parse_state pins its forward-compat policy: a missing or
        /// zero version starts fresh, unknown EXTRA fields (a future
        /// format adding a field) still parse.
        #[test]
        fn parse_state_version_policy_is_pinned() {
            assert!(
                parse_state(b"{\"windows\":{}}").is_none(),
                "missing version"
            );
            assert!(parse_state(b"{\"version\":0,\"windows\":{}}").is_none());
            let future_field =
                b"{\"version\":1,\"future\":{\"note\":\"added later\"},\"windows\":{}}";
            assert!(
                parse_state(future_field).is_some(),
                "unknown fields are tolerated"
            );
        }
    }
}
