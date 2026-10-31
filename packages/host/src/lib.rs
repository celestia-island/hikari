// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
//! # Hikari Host
//!
//! Shell-lifecycle guards shared by hikari's native hosts. Today the crate owns
//! one facility: the **close-request acknowledgement / force-close state
//! machine** that keeps a frameless shell's window closable even when its
//! webview renderer is dead — plus an optional Tauri 2 adapter behind the
//! `tauri` feature.
//!
//! ## Why this exists (the 2026-10-31 incident)
//!
//! Hikari's native hosts are frameless shells (`decorations: false`): the OS
//! paints no title bar, so the window controls are drawn by the app itself.
//! When the user presses close — the in-app caption button, the OS close
//! gesture, or a window manager's `WM_CLOSE` — the shell must not destroy the
//! window immediately: it intercepts the close request, prevents the default
//! close, and asks the webview "quit or minimize to tray?". The frontend then
//! runs its teardown and only then tells the shell to exit (or to keep
//! running).
//!
//! That contract has a failure mode with no recovery of its own: if the
//! renderer is gone — WebView2 process death, a renderer hang, or a page that
//! crashed before it registered its listener — the request lands nowhere, no
//! frontend ever answers, and the window that already handled the close
//! request stays up forever. The user is left with an unclosable window whose
//! only way out is a task manager. That is the exact bug the 2026-10-31 wowsp
//! report filed (and wowsp's `close_guard` module fixed); this crate is the
//! generalised, publishable half of that fix, so every hikari host gets the
//! same behaviour instead of re-inventing it.
//!
//! The guard is a dead-man switch. Every intercepted close request arms an
//! epoch token ([`CloseGuard::arm`]) and a one-shot watchdog; the frontend's
//! listener acknowledges as its FIRST action, which disarms the token
//! ([`CloseGuard::ack`]); a watchdog that wakes up to a still-current token
//! knows nobody answered and force-exits the app. A stale token — the webview
//! did answer, or a newer close request superseded this one — makes the
//! watchdog stand down silently.
//!
//! ## The cross-language protocol
//!
//! The wire contract below is byte-identical on every side: this crate defines
//! the Rust constants, and the Vue runtime mirrors them in
//! `packages/vue/src/runtime/closeGuard.ts`.
//!
//! - [`CLOSE_REQUEST_EVENT`] — `hk:close-requested`: the event the host emits
//!   (to every webview) when it intercepts a close request.
//! - [`CLOSE_ACK_COMMAND`] — `plugin:hikari-host|ack_close`: the command the
//!   frontend's listener invokes, as its first statement, to acknowledge the
//!   request. The `plugin:<name>|<command>` shape is Tauri's plugin-command
//!   wire format; a plain command name would not resolve.
//! - [`DEFAULT_FORCE_CLOSE_AFTER`] — 5 s: how long the webview gets to
//!   acknowledge before the watchdog force-exits.
//!
//! The acknowledgement means "the renderer heard you and owns the decision",
//! nothing more: the frontend still decides between quitting and staying, and
//! an ack never closes anything. Because the ack is sent before the dialog is
//! shown, the force-close budget is NOT the user's decision time — it only
//! covers a renderer that died between the emit and the listener.
//!
//! ## Using the state machine directly
//!
//! Hosts that bring their own shell integration (or a mock shell in tests) use
//! [`CloseGuard`] alone; it is dependency-free and platform-independent.
//!
//! ```
//! use hikari_host::CloseGuard;
//!
//! let guard = CloseGuard::new();
//! let token = guard.arm();
//! assert!(guard.is_current(token));
//!
//! guard.ack(); // the webview answered in time ...
//! assert!(!guard.is_current(token)); // ... so the watchdog stands down
//! ```
//!
//! ## Tauri adapter (`tauri` feature)
//!
//! Enable the `tauri` feature, add the plugin, and forward the shell's window
//! events into `tauri_shell::handle_close_requested`:
//!
//! ```rust,ignore
//! tauri::Builder::default()
//!     .plugin(hikari_host::tauri_shell::init())
//!     .on_window_event(|window, event| {
//!         hikari_host::tauri_shell::handle_close_requested(window.app_handle(), window, event);
//!     })
//! ```
//!
//! The plugin owns the shared state, registers the `ack_close` command under
//! the `plugin:hikari-host|` namespace, and `tauri_shell::init_with` accepts a
//! `tauri_shell::CloseGuardConfig`: which window labels are intercepted, the
//! force-close budget, and an optional force-exit hook (hosts with a graceful
//! drain path pass their own instead of the default `app.exit(0)`). The module
//! docs explain why the window-event side is a helper rather than plugin-owned.
//!
//! ## Feature flags
//!
//! - `tauri` (off by default) — the Tauri 2 adapter, i.e. the `tauri_shell`
//!   module. The dependency is target-gated to non-WebAssembly targets, so
//!   workspace-wide `--all-features` checks for `wasm32-wasip2` neither pull
//!   Tauri in nor compile the adapter.
//!
//! ## Threading
//!
//! The core guard is a single atomic epoch: lock-free, `Send + Sync`, and
//! trivially shareable. The adapter spawns one short-lived named thread
//! (`hikari-close-watchdog`) per intercepted request; only the newest token
//! can ever force an exit, and every superseded watchdog wakes up, finds
//! itself stale, and returns. There is no process-global state: the epoch
//! lives in the plugin-managed state, so an application (or a test) may own
//! more than one guard without interference.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

/// The event a host emits when it intercepts a close request.
///
/// The host emits it after arming the watchdog and preventing the default
/// close; the webview's listener acknowledges it through
/// [`CLOSE_ACK_COMMAND`] and then runs its quit/minimize flow.
pub const CLOSE_REQUEST_EVENT: &str = "hk:close-requested";

/// The command a webview invokes to acknowledge a [`CLOSE_REQUEST_EVENT`].
///
/// This is Tauri's plugin-command wire format — `plugin:<plugin name>|<command
/// name>` — which is why the acknowledgement has to be registered through the
/// `hikari-host` TauriPlugin (see the `tauri_shell` module) rather than as a
/// plain application command. The Vue runtime (the mirror contract in
/// `packages/vue/src/runtime/closeGuard.ts`) invokes this exact string.
pub const CLOSE_ACK_COMMAND: &str = "plugin:hikari-host|ack_close";

/// How long the webview gets to acknowledge a close request before the shell
/// force-exits, unless the host configures its own budget.
///
/// The ack is the listener's first statement, so this is not the user's
/// decision time: acknowledging disarms the watchdog before the quit dialog
/// even appears. It only covers the round trip plus a renderer that died
/// between the emit and the listener. Five seconds is an order of magnitude
/// above a healthy round trip and still reads as "a slow quit" rather than
/// "a hang" when the renderer is gone.
pub const DEFAULT_FORCE_CLOSE_AFTER: Duration = Duration::from_secs(5);

/// Epoch-based arming state for the close guard.
///
/// Both sides bump the same counter: [`arm`](Self::arm) hands out the next
/// epoch value as a token, and [`ack`](Self::ack) bumps the epoch again. Only
/// a token equal to the CURRENT epoch is a live arm, so any later arm or ack
/// invalidates every earlier token without the guard having to track them.
/// Epoch 0 is the "nothing armed" state and is never handed out as a token.
///
/// All accesses are `SeqCst`: the epoch is the only shared state, and the
/// arm / emit / ack / wake-up sequence genuinely spans threads (the window
/// event handler, Tauri's IPC dispatch for the command, and the watchdog
/// thread), so a single total order is both the simplest argument and
/// effectively free at this once-per-close rate.
pub struct CloseGuard {
    epoch: AtomicU64,
    timeout: Duration,
}

impl CloseGuard {
    /// A guard with the [`DEFAULT_FORCE_CLOSE_AFTER`] budget and nothing
    /// armed.
    pub const fn new() -> Self {
        Self::with_timeout(DEFAULT_FORCE_CLOSE_AFTER)
    }

    /// A guard with a custom force-close budget; [`timeout`](Self::timeout)
    /// hands it back to the shell integration that runs the watchdog.
    pub const fn with_timeout(timeout: Duration) -> Self {
        Self {
            epoch: AtomicU64::new(0),
            timeout,
        }
    }

    /// The force-close budget this guard was created with.
    pub fn timeout(&self) -> Duration {
        self.timeout
    }

    /// Arm one close request and return its token: the epoch value this arm
    /// owns. Invalidates every token returned before it.
    pub fn arm(&self) -> u64 {
        // fetch_add returns the PREVIOUS value; the token is the new epoch.
        // The wrapping add only matters at the theoretical u64 wrap (never
        // reached in a real session) and keeps debug overflow checks quiet.
        self.epoch.fetch_add(1, Ordering::SeqCst).wrapping_add(1)
    }

    /// Disarm the current arm — the webview acknowledged the request. Any
    /// watchdog still sleeping now wakes up stale and stands down.
    pub fn ack(&self) {
        self.epoch.fetch_add(1, Ordering::SeqCst);
    }

    /// Whether `token` is still the current arm (no ack and no newer arm
    /// since it was taken).
    pub fn is_current(&self, token: u64) -> bool {
        self.epoch.load(Ordering::SeqCst) == token
    }
}

impl Default for CloseGuard {
    /// Equivalent to [`CloseGuard::new`]; present so the constructor keeps its
    /// const signature without tripping `clippy::new_without_default`.
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::{CloseGuard, DEFAULT_FORCE_CLOSE_AFTER};

    /// A fresh guard has no live arm: the first arm hands out epoch 1 (epoch 0
    /// is reserved as "nothing armed") and repeated arms strictly increase.
    #[test]
    fn arms_return_increasing_tokens() {
        let guard = CloseGuard::new();
        let first = guard.arm();
        let second = guard.arm();
        assert_eq!(first, 1);
        assert!(second > first);
        assert!(guard.is_current(second));
        assert!(!guard.is_current(first));
    }

    /// The acknowledgement must invalidate the armed token — this is what
    /// turns a webview that answered into a stood-down watchdog.
    #[test]
    fn ack_invalidates_the_armed_token() {
        let guard = CloseGuard::new();
        let token = guard.arm();
        assert!(guard.is_current(token));
        guard.ack();
        assert!(!guard.is_current(token));
    }

    /// An ack leaves NO token current, including tokens it never saw armed —
    /// and a repeated ack must not make a stale token current again.
    #[test]
    fn ack_never_revives_a_stale_token() {
        let guard = CloseGuard::new();
        let token = guard.arm();
        guard.ack();
        guard.ack();
        assert!(!guard.is_current(token));
    }

    /// A newer arm invalidates the older token: the stale watchdog must exit
    /// instead of force-quitting during the newer request's dialog.
    #[test]
    fn rearm_invalidates_the_previous_token() {
        let guard = CloseGuard::new();
        let first = guard.arm();
        let second = guard.arm();
        assert!(!guard.is_current(first));
        assert!(guard.is_current(second));
    }

    /// The budget is part of the guard's state: the default constructor uses
    /// [`DEFAULT_FORCE_CLOSE_AFTER`] and the custom constructor round-trips
    /// its input so the shell integration can read it back.
    #[test]
    fn timeout_is_exposed() {
        assert_eq!(CloseGuard::new().timeout(), DEFAULT_FORCE_CLOSE_AFTER);
        let custom = Duration::from_millis(250);
        assert_eq!(CloseGuard::with_timeout(custom).timeout(), custom);
    }
}

#[cfg(all(feature = "tauri", not(target_family = "wasm")))]
pub mod tauri_shell {
    //! Tauri 2 adapter for the close guard.
    //!
    //! ## What a host wires
    //!
    //! Two pieces, both required:
    //!
    //! 1. [`init`] (or [`init_with`]) as a Tauri plugin. It manages the guard
    //!    state and registers the `ack_close` command, which the webview calls
    //!    as [`crate::CLOSE_ACK_COMMAND`] (`plugin:hikari-host|ack_close`).
    //! 2. [`handle_close_requested`] inside the host's own
    //!    `tauri::Builder::on_window_event` closure. It is the piece that
    //!    intercepts, arms, emits, and prevents the default close.
    //!
    //! ```rust,ignore
    //! tauri::Builder::default()
    //!     .plugin(hikari_host::tauri_shell::init())
    //!     .on_window_event(|window, event| {
    //!         hikari_host::tauri_shell::handle_close_requested(window.app_handle(), window, event);
    //!     })
    //! ```
    //!
    //! Hosts that create a `WebviewWindow` directly and attach the listener to
    //! it use [`handle_close_requested_webview`] instead (same semantics).
    //!
    //! ## Why the window-event side is a helper, not plugin-owned
    //!
    //! Tauri 2.12's plugin builder has no window-event hook. Its public
    //! surface is `new`, `invoke_handler`, `js_init_script`,
    //! `js_init_script_on_all_frames`, `setup`, `on_navigation`,
    //! `on_page_load`, `on_window_ready`, `on_webview_ready`, `on_event`,
    //! `on_drop`, the URI-scheme registrations and `build`
    //! (`tauri-2.12.2/src/plugin.rs:279-758`) — nothing that hands a plugin a
    //! `WindowEvent` or the `CloseRequestApi`. The callback exists on the
    //! application builder instead: `Builder::on_window_event` takes
    //! `Fn(&Window<R>, &WindowEvent)` (`tauri-2.12.2/src/app.rs:2197`), and
    //! only the host owns that builder. So the plugin ships what a plugin CAN
    //! own — state plus the `ack_close` command, which must live in a plugin
    //! because Tauri addresses plugin commands as
    //! `plugin:<name>|<command>` (`tauri-2.12.2/src/app.rs:1930`) — and the
    //! window-event interception is this module's helper.
    //!
    //! `Plugin::on_event` is not an alternative that was overlooked: in
    //! 2.12.2 plugins are notified of `RunEvent`s inside the event-loop
    //! conversion (`tauri-2.12.2/src/app.rs:2811`), i.e. as a global observer
    //! whose ordering against host window listeners is not a documented
    //! contract. Building the interception there would duplicate the guard the
    //! host's own handler must run and couple every plugin to `WindowEvent`
    //! details. The explicit helper stays the supported route.
    //!
    //! ## Force exit
    //!
    //! When the watchdog fires it calls the configured
    //! [`CloseGuardConfig::force_exit`] hook, or `AppHandle::exit(0)` when no
    //! hook was supplied. Hosts whose shutdown has a graceful path (drain
    //! background tasks, flush a ledger, stop pollers) MUST pass their own
    //! hook: the watchdog only knows "the window is wedged" and cannot run the
    //! host's teardown. The hook runs on the watchdog thread, so a Tauri exit
    //! requested from it is exactly as safe as any other cross-thread exit.
    //!
    //! ## Diagnostics
    //!
    //! The crate deliberately has no logging dependency, so the adapter writes
    //! its sparse lifecycle lines to stderr with a fixed prefix:
    //! `[hikari-host] WARN  ...` is always emitted (a force-close and a failed
    //! watchdog spawn are both worth surfacing); `[hikari-host] DEBUG ...`
    //! (a watchdog standing down, a non-intercepted window) is compiled into
    //! debug builds only. A host with structured logging should surface the
    //! WARN lines from stderr, which is where this family's shells capture
    //! their own diagnostics.

    use std::sync::Arc;
    use std::time::Duration;

    use tauri::plugin::{Builder as PluginBuilder, TauriPlugin};
    use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow, Window, WindowEvent};

    use crate::{CLOSE_REQUEST_EVENT, CloseGuard, DEFAULT_FORCE_CLOSE_AFTER};

    /// The Tauri plugin name; also the left half of [`crate::CLOSE_ACK_COMMAND`].
    pub const PLUGIN_NAME: &str = "hikari-host";

    /// The window label intercepted when a [`CloseGuardConfig`] does not say
    /// otherwise. The main application window is the only one whose close
    /// means "quit or minimize" — overlay/utility windows have their own
    /// lifecycle and are never intercepted by default.
    pub const DEFAULT_WINDOW_LABEL: &str = "main";

    /// The thread name of the watchdog the adapter spawns per close request.
    pub const WATCHDOG_THREAD_NAME: &str = "hikari-close-watchdog";

    /// Force-exit hook the watchdog calls when the webview never answers.
    ///
    /// The default ([`CloseGuardConfig::force_exit`] is `None`) is
    /// `AppHandle::exit(0)`. Hosts with a graceful shutdown must pass their
    /// own hook; see the module docs.
    pub type ForceExit<R> = Arc<dyn Fn(&AppHandle<R>) + Send + Sync>;

    /// Host policy for the Tauri adapter.
    ///
    /// [`CloseGuardConfig::new`] is the protocol default: intercept the
    /// [`DEFAULT_WINDOW_LABEL`] window, force-close after
    /// [`crate::DEFAULT_FORCE_CLOSE_AFTER`], plain `app.exit(0)`. The
    /// `with_*` methods adjust one field at a time.
    pub struct CloseGuardConfig<R: Runtime> {
        /// Window labels to intercept, matched EXACTLY ([`Window::label`]
        /// semantics). An empty list intercepts nothing, which is useful for a
        /// host that only wants the plugin's state and ack command.
        pub intercept_labels: Vec<String>,
        /// Budget handed to the [`CloseGuard`]; the watchdog sleeps this long
        /// before deciding whether the request was answered.
        pub force_close_after: Duration,
        /// Optional force-exit hook; `None` means `AppHandle::exit(0)`.
        pub force_exit: Option<ForceExit<R>>,
    }

    impl<R: Runtime> CloseGuardConfig<R> {
        /// The protocol-default configuration.
        pub fn new() -> Self {
            Self::default()
        }

        /// Replace the set of intercepted window labels.
        pub fn with_intercept_labels(
            mut self,
            labels: impl IntoIterator<Item = impl Into<String>>,
        ) -> Self {
            self.intercept_labels = labels.into_iter().map(Into::into).collect();
            self
        }

        /// Replace the force-close budget.
        pub fn with_force_close_after(mut self, after: Duration) -> Self {
            self.force_close_after = after;
            self
        }

        /// Replace the force-exit hook (see the module docs: hosts with a
        /// graceful drain must pass one).
        pub fn with_force_exit<F>(mut self, hook: F) -> Self
        where
            F: Fn(&AppHandle<R>) + Send + Sync + 'static,
        {
            self.force_exit = Some(Arc::new(hook));
            self
        }

        /// Whether a window with this label is intercepted. Exact match: no
        /// prefix/suffix/glob semantics.
        fn intercepts(&self, label: &str) -> bool {
            self.intercept_labels.iter().any(|entry| entry == label)
        }
    }

    impl<R: Runtime> Default for CloseGuardConfig<R> {
        fn default() -> Self {
            Self {
                intercept_labels: vec![DEFAULT_WINDOW_LABEL.to_string()],
                force_close_after: DEFAULT_FORCE_CLOSE_AFTER,
                force_exit: None,
            }
        }
    }

    /// Plugin-managed state shared by the window-event helper and the ack
    /// command.
    ///
    /// Managed by [`init`]/[`init_with`] from the plugin setup hook; hosts
    /// never construct it. The epoch machine sits behind an `Arc` because the
    /// watchdog thread outlives the close-request callback by the force-close
    /// budget.
    pub struct CloseGuardHost<R: Runtime> {
        config: CloseGuardConfig<R>,
        guard: Arc<CloseGuard>,
    }

    /// Install the protocol-default close guard plugin.
    ///
    /// Equivalent to [`init_with(CloseGuardConfig::default())`](init_with):
    /// intercept the `main` window, force-close after five seconds, exit with
    /// `app.exit(0)`. A host with a graceful shutdown or additional windows
    /// to intercept uses [`init_with`].
    pub fn init<R: Runtime>() -> TauriPlugin<R> {
        init_with(CloseGuardConfig::default())
    }

    /// Install the close guard plugin with explicit host policy.
    ///
    /// The plugin manages the guard state in its setup hook and registers the
    /// `ack_close` command, so the webview can acknowledge the request through
    /// [`crate::CLOSE_ACK_COMMAND`]. The host still has to forward its window
    /// events to [`handle_close_requested`] — see the module docs for why.
    ///
    /// ```rust,ignore
    /// use std::time::Duration;
    ///
    /// use hikari_host::tauri_shell::{self, CloseGuardConfig};
    ///
    /// tauri::Builder::default()
    ///     .plugin(tauri_shell::init_with(
    ///         CloseGuardConfig::new()
    ///             .with_intercept_labels(["main".to_string(), "overview".to_string()])
    ///             .with_force_close_after(Duration::from_secs(3))
    ///             .with_force_exit(|app| {
    ///                 // Flush the host's own teardown, then exit.
    ///                 app.exit(0);
    ///             }),
    ///     ))
    ///     .on_window_event(|window, event| {
    ///         tauri_shell::handle_close_requested(window.app_handle(), window, event);
    ///     })
    /// ```
    pub fn init_with<R: Runtime>(config: CloseGuardConfig<R>) -> TauriPlugin<R> {
        let timeout = config.force_close_after;
        PluginBuilder::new(PLUGIN_NAME)
            .setup(move |app, _api| {
                app.manage(CloseGuardHost {
                    config,
                    guard: Arc::new(CloseGuard::with_timeout(timeout)),
                });
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![ack_close])
            .build()
    }

    /// The `ack_close` IPC command: the webview's acknowledgement of a
    /// [`crate::CLOSE_REQUEST_EVENT`].
    ///
    /// Registered by [`init`]/[`init_with`] under the `hikari-host` plugin
    /// namespace and invoked as [`crate::CLOSE_ACK_COMMAND`]. It is
    /// idempotent and intentionally cannot fail: a late or spurious ack only
    /// advances the epoch, so it can never release an exit that is already in
    /// flight.
    #[tauri::command]
    pub fn ack_close<R: Runtime>(app: AppHandle<R>) {
        acknowledge_close(&app);
    }

    /// Rust-side equivalent of the webview's acknowledgement.
    ///
    /// Hosts that decide the close in native code (a native confirmation
    /// dialog, a headless test) call this after the decision instead of
    /// waiting for the webview's `ack_close` IPC round trip. The first action
    /// of the frontend listener is the normal path; this exists for its
    /// native counterpart.
    pub fn acknowledge_close<R: Runtime>(app: &AppHandle<R>) {
        match app.try_state::<CloseGuardHost<R>>() {
            Some(state) => state.guard.ack(),
            None => debug_line(format_args!(
                "acknowledge_close called without the hikari-host plugin installed",
            )),
        }
    }

    /// Intercept one window event from the host's app-level
    /// `tauri::Builder::on_window_event` hook.
    ///
    /// This is the real entry point of the guard. For an intercepted label it
    /// arms the watchdog BEFORE emitting [`crate::CLOSE_REQUEST_EVENT`],
    /// prevents the window's default close, and returns; every other event and
    /// label is ignored. The `Window` (not `WebviewWindow`) parameter is what
    /// Tauri 2.12's builder callback supplies
    /// (`tauri-2.12.2/src/app.rs:2197`); hosts that attach their own listener
    /// to a `WebviewWindow` use [`handle_close_requested_webview`].
    pub fn handle_close_requested<R: Runtime>(
        app: &AppHandle<R>,
        window: &Window<R>,
        event: &WindowEvent,
    ) {
        guard_close_request(app, window.label(), event);
    }

    /// Intercept one window event for hosts that attach the listener to a
    /// `WebviewWindow` directly (`WebviewWindow::on_window_event`, see
    /// `tauri-2.12.2/src/webview/webview_window.rs:1643`).
    pub fn handle_close_requested_webview<R: Runtime>(
        app: &AppHandle<R>,
        window: &WebviewWindow<R>,
        event: &WindowEvent,
    ) {
        guard_close_request(app, window.label(), event);
    }

    /// Shared body of both window-event entry points. Only needs the label:
    /// both Tauri window handles expose the same `label()`.
    fn guard_close_request<R: Runtime>(app: &AppHandle<R>, label: &str, event: &WindowEvent) {
        let WindowEvent::CloseRequested { api, .. } = event else {
            return;
        };
        let Some(state) = app.try_state::<CloseGuardHost<R>>() else {
            warn_line(format_args!(
                "close request ignored: plugin state missing; add .plugin(hikari_host::tauri_shell::init())",
            ));
            return;
        };
        if !state.config.intercepts(label) {
            debug_line(format_args!(
                "window {label:?} is not intercepted by hikari-host",
            ));
            return;
        }

        // Arm BEFORE the emit: the ack can only arrive after the emit, so
        // arming first guarantees the ack's epoch bump is newer than this
        // token. The reverse order would let an ack land in between and then
        // be overwritten by the arm, leaving the watchdog armed against a
        // webview that DID answer.
        let token = state.guard.arm();
        let guard = Arc::clone(&state.guard);
        let timeout = guard.timeout();
        let force_exit = state.config.force_exit.clone();
        let app_for_thread = app.clone();
        let spawned = std::thread::Builder::new()
            .name(WATCHDOG_THREAD_NAME.into())
            .spawn(move || {
                std::thread::sleep(timeout);
                if !guard.is_current(token) {
                    debug_line(format_args!(
                        "close watchdog stood down: the webview acknowledged the request",
                    ));
                    return;
                }
                warn_line(format_args!(
                    "close-requested went unanswered after {timeout:?}; force-quitting the shell",
                ));
                match force_exit {
                    Some(hook) => hook(&app_for_thread),
                    None => app_for_thread.exit(0),
                }
            });
        if let Err(err) = spawned {
            // The normal dialog path is unaffected; only a dead renderer would
            // leave the window unclosable again, so this is a warning.
            warn_line(format_args!(
                "close watchdog thread did not spawn ({err}); an unresponsive webview would leave the window unclosable",
            ));
        }

        api.prevent_close();
        let _ = app.emit(CLOSE_REQUEST_EVENT, ());
    }

    /// Emit one WARN-level diagnostic line to stderr (see the module docs for
    /// why this crate carries no logging dependency).
    fn warn_line(message: std::fmt::Arguments<'_>) {
        eprintln!("[hikari-host] WARN  {message}");
    }

    /// Emit one DEBUG-level diagnostic line to stderr. Compiled into debug
    /// builds only: release hosts capture WARN lines, not the per-close
    /// chatter.
    fn debug_line(message: std::fmt::Arguments<'_>) {
        if cfg!(debug_assertions) {
            eprintln!("[hikari-host] DEBUG {message}");
        }
    }

    #[cfg(test)]
    mod tests {
        use std::time::Duration;

        use tauri::test::MockRuntime;

        use super::{CloseGuardConfig, DEFAULT_WINDOW_LABEL, PLUGIN_NAME};
        use crate::{CLOSE_ACK_COMMAND, DEFAULT_FORCE_CLOSE_AFTER};

        /// The default config IS the protocol: the main window, five seconds,
        /// and the plain exit fallback.
        #[test]
        fn config_defaults_match_the_protocol() {
            let config = CloseGuardConfig::<MockRuntime>::new();
            assert_eq!(
                config.intercept_labels,
                vec![DEFAULT_WINDOW_LABEL.to_string()]
            );
            assert_eq!(config.force_close_after, DEFAULT_FORCE_CLOSE_AFTER);
            assert!(config.force_exit.is_none());
            assert_eq!(DEFAULT_WINDOW_LABEL, "main");
        }

        /// Label interception is exact: no prefix, suffix or glob matching, and
        /// an empty list intercepts nothing.
        #[test]
        fn interception_is_exact_label_matching() {
            let mut config = CloseGuardConfig::<MockRuntime>::new();
            assert!(config.intercepts("main"));
            for other in ["Main", "main-window", "overlay", ""] {
                assert!(!config.intercepts(other), "label {other:?} must not match");
            }
            config.intercept_labels = vec!["overlay".to_string()];
            assert!(!config.intercepts("main"));
            assert!(config.intercepts("overlay"));
            config.intercept_labels.clear();
            assert!(!config.intercepts("overlay"));
        }

        /// The `with_*` setters replace exactly one field and leave the rest
        /// at their defaults.
        #[test]
        fn builder_overrides_replace_defaults() {
            let config = CloseGuardConfig::<MockRuntime>::new()
                .with_intercept_labels(["overview".to_string()])
                .with_force_close_after(Duration::from_millis(750));
            assert_eq!(config.intercept_labels, vec!["overview".to_string()]);
            assert!(config.intercepts("overview"));
            assert!(!config.intercepts("main"));
            assert_eq!(config.force_close_after, Duration::from_millis(750));
            assert!(config.force_exit.is_none());
        }

        /// The command contract is split across two constants (the plugin name
        /// and the wire string); they must never drift apart.
        #[test]
        fn ack_command_matches_the_plugin_name() {
            assert_eq!(format!("plugin:{PLUGIN_NAME}|ack_close"), CLOSE_ACK_COMMAND);
        }
    }
}
