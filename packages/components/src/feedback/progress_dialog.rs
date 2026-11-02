// hi-components/src/feedback/progress_dialog.rs
// ProgressDialog — mirror of the canonical Vue `HkProgressDialog` + its
// singleton service (`useProgressDialog` / `showProgressDialog`).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkProgressDialog.scss`, vendored under
// `src/styles/vue-mirror/`); `.s-progress-dialog-log` is the log pane's
// chrome. DOM contract (mirrors Vue):
//
//   Modal(width="30rem", closable=false, title=state.title)
//     div[flex column, gap .75rem, padding .25rem 0]
//       ProgressBar(value, max, show_label, size=sm)   (value known)
//       div[centered] > Spinner                         (indeterminate)
//       div.s-progress-dialog-log > ul > li*            (log tail)
//
// ONE SCROLLBAR PER WINDOW (2026-09-08 audit): the log pane is NOT a
// scroll region; logs grow unbounded inside the modal body scroller.
// Delta vs Vue (documented): the tailing auto-scroll watcher (which
// scrolls `.hk-modal-body-scroll` to the bottom on each new line) needs
// DOM measurement; the mirror keeps the unbounded log and leaves
// scrolling to the host.
//
// The service is a thread-local singleton (wasm is single-threaded): the
// first `show_progress_dialog` call creates the store, every call resets
// it; the component reads it reactively. Vue's `state.open` singleton is
// preserved; `MAX_LOG_LINES` (200) trims the head exactly like Vue.

use std::cell::RefCell;

use crate::prelude::*;
use crate::styled::StyledComponent;

use super::modal::Modal;
use super::progress_bar::{ProgressBar, ProgressBarSize};
use super::spinner::Spinner;

pub struct ProgressDialogComponent;

/// Cap on retained log lines (Vue: `MAX_LOG_LINES = 200`).
pub const MAX_LOG_LINES: usize = 200;

/// The single global task-progress surface state (Vue:
/// `ProgressDialogState`).
#[derive(Clone, PartialEq, Debug)]
pub struct ProgressDialogState {
    pub open: bool,
    pub title: String,
    pub logs: Vec<String>,
    pub value: Option<f64>,
    pub max: f64,
}

impl Default for ProgressDialogState {
    fn default() -> Self {
        Self {
            open: false,
            title: String::new(),
            logs: Vec::new(),
            value: None,
            max: 100.0,
        }
    }
}

thread_local! {
    static PROGRESS_DIALOG_STATE: RefCell<Option<Signal<ProgressDialogState>>> =
        const { RefCell::new(None) };
}

/// The singleton store; created on first use (thread-local, wasm is
/// single-threaded). Returns a clone of the shared `Signal`.
pub fn use_progress_dialog() -> Signal<ProgressDialogState> {
    PROGRESS_DIALOG_STATE.with(|slot| {
        let mut slot = slot.borrow_mut();
        if let Some(state) = slot.as_ref() {
            return state.clone();
        }
        let state = Signal::new(ProgressDialogState::default());
        *slot = Some(state.clone());
        state
    })
}

/// The imperative handle returned by [`show_progress_dialog`] (Vue:
/// `ProgressDialogHandle`).
#[derive(Clone)]
pub struct ProgressDialogHandle {
    state: Signal<ProgressDialogState>,
}

impl ProgressDialogHandle {
    /// Append one log line; the head is trimmed past [`MAX_LOG_LINES`].
    pub fn log(&self, line: impl Into<String>) {
        let mut current = self.state.read();
        current.logs.push(line.into());
        if current.logs.len() > MAX_LOG_LINES {
            let drain = current.logs.len() - MAX_LOG_LINES;
            current.logs.drain(0..drain);
        }
        self.state.set(current);
    }

    /// Set the done count and (optionally) the total denominator; a
    /// missing total keeps the previous max (Vue semantics).
    pub fn set_progress(&self, done: f64, total: Option<f64>) {
        let mut current = self.state.read();
        if let Some(total) = total {
            current.max = total;
        }
        current.value = Some(done);
        self.state.set(current);
    }

    /// Close the dialog (the state stays mountable for the next open).
    pub fn close(&self) {
        let mut current = self.state.read();
        current.open = false;
        self.state.set(current);
    }
}

/// Open (or reset) the singleton progress dialog (Vue:
/// `showProgressDialog({ title })`).
pub fn show_progress_dialog(title: &str) -> ProgressDialogHandle {
    let state = use_progress_dialog();
    state.set(ProgressDialogState {
        open: true,
        title: title.to_string(),
        logs: Vec::new(),
        value: None,
        max: 100.0,
    });
    ProgressDialogHandle { state }
}

/// The dialog surface. Mount once in the app; it renders while the
/// singleton store is open.
#[component]
pub fn ProgressDialog() -> Element {
    let state = use_progress_dialog();
    let current = state.read();

    if !current.open {
        return empty_vnode();
    }

    // Vue: indeterminate spinner when `value` is null, bar otherwise.
    let progress = match current.value {
        Some(value) => rsx! {
            ProgressBar {
                value: Some(value),
                max: current.max,
                show_label: true,
                size: ProgressBarSize::Sm,
            }
        },
        None => rsx! {
            div {
                style: "display:flex;justify-content:center;padding:0.5rem 0",
                Spinner {}
            }
        },
    };

    let logs = if current.logs.is_empty() {
        empty_vnode()
    } else {
        rsx! {
            div { class: "s-progress-dialog-log",
                ul {
                    style: "list-style:none;margin:0;padding:0",
                    for (i, line) in current.logs.iter().enumerate() {
                        li { key: i, "{line}" }
                    }
                }
            }
        }
    };

    rsx! {
        Modal {
            open: true,
            title: Some(current.title.clone()),
            closable: false,
            width: "30rem".to_string(),
            children: rsx! {
                div {
                    style: "display:flex;flex-direction:column;gap:0.75rem;padding:0.25rem 0",
                    {progress}
                    {logs}
                }
            },
        }
    }
}

impl StyledComponent for ProgressDialogComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkProgressDialog.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "progress-dialog"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_dialog_defaults_match_the_vue_state() {
        let state = ProgressDialogState::default();
        assert!(!state.open);
        assert_eq!(state.title, "");
        assert!(state.logs.is_empty());
        assert_eq!(state.value, None);
        assert_eq!(state.max, 100.0);
    }

    #[test]
    fn progress_dialog_log_trims_to_the_vue_cap() {
        let handle = show_progress_dialog("test");
        for i in 0..(MAX_LOG_LINES + 5) {
            handle.log(format!("line {i}"));
        }
        let state = use_progress_dialog().read();
        assert_eq!(state.logs.len(), MAX_LOG_LINES);
        assert_eq!(state.logs[0], "line 5");
        assert_eq!(
            state.logs[MAX_LOG_LINES - 1],
            format!("line {}", MAX_LOG_LINES + 4)
        );
        handle.close();
    }

    #[test]
    fn progress_dialog_set_progress_semantics() {
        let handle = show_progress_dialog("test");
        handle.set_progress(10.0, None);
        let state = use_progress_dialog().read();
        assert_eq!(state.value, Some(10.0));
        assert_eq!(state.max, 100.0);
        handle.set_progress(10.0, Some(40.0));
        let state = use_progress_dialog().read();
        assert_eq!(state.max, 40.0);
        handle.close();
        assert!(!use_progress_dialog().read().open);
    }

    #[test]
    fn progress_dialog_styles_come_from_the_canonical_vue_sheet() {
        let css = ProgressDialogComponent::styles();
        assert!(
            css.contains(".s-progress-dialog-log"),
            "progress dialog css must carry the vue log-pane class"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored progress dialog sheet"
        );
    }
}
