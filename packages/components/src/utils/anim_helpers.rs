use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_hooks::ReactiveSignal;

use crate::platform;

struct OneShotState {
    start_ts: Option<f64>,
    stopped: bool,
}

struct LoopState {
    phase: f64,
    last_ts: Option<f64>,
    stopped: bool,
}

pub fn run_ease_out(duration_ms: f64, power: i32, signal: ReactiveSignal<f64>) {
    let state = Rc::new(RefCell::new(OneShotState {
        start_ts: None,
        stopped: false,
    }));
    let s_ref = state.clone();
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = s_ref.borrow_mut();
        if s.stopped {
            return;
        }
        s.start_ts = Some(ts);
        drop(s);
        ease_out_tick(s_ref, duration_ms, power, signal);
    });
}

fn ease_out_tick(
    state: Rc<RefCell<OneShotState>>,
    duration_ms: f64,
    power: i32,
    signal: ReactiveSignal<f64>,
) {
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = state.borrow_mut();
        if s.stopped {
            return;
        }
        let start = s.start_ts.unwrap_or(ts);
        if s.start_ts.is_none() {
            s.start_ts = Some(ts);
        }
        let elapsed = ts - start;
        let progress = (elapsed / duration_ms).min(1.0);
        drop(s);

        let eased = 1.0 - (1.0 - progress).powi(power);
        signal.set(eased);

        if progress < 1.0 {
            ease_out_tick(state, duration_ms, power, signal);
        }
    });
}

pub fn run_phase_loop<F>(period_ms: f64, signal: ReactiveSignal<f64>, compute: F)
where
    F: Fn(f64) -> f64 + 'static,
{
    let state = Rc::new(RefCell::new(LoopState {
        phase: 0.0,
        last_ts: None,
        stopped: false,
    }));
    let s_ref = state.clone();
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = s_ref.borrow_mut();
        if s.stopped {
            return;
        }
        s.last_ts = Some(ts);
        drop(s);
        phase_loop_tick(s_ref, period_ms, signal, compute);
    });
}

fn phase_loop_tick<F>(
    state: Rc<RefCell<LoopState>>,
    period_ms: f64,
    signal: ReactiveSignal<f64>,
    compute: F,
) where
    F: Fn(f64) -> f64 + 'static,
{
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = state.borrow_mut();
        if s.stopped {
            return;
        }
        let prev = s.last_ts.unwrap_or(ts);
        let delta = ts - prev;
        s.last_ts = Some(ts);
        s.phase = (s.phase + delta / period_ms) % 1.0;
        let phase = s.phase;
        drop(s);

        signal.set(compute(phase));
        phase_loop_tick(state, period_ms, signal, compute);
    });
}

pub fn run_dual_phase_loop<F1, F2>(
    period_ms: f64,
    signal_a: ReactiveSignal<f64>,
    signal_b: ReactiveSignal<f64>,
    compute_a: F1,
    compute_b: F2,
) where
    F1: Fn(f64) -> f64 + 'static,
    F2: Fn(f64) -> f64 + 'static,
{
    let state = Rc::new(RefCell::new(LoopState {
        phase: 0.0,
        last_ts: None,
        stopped: false,
    }));
    let s_ref = state.clone();
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = s_ref.borrow_mut();
        if s.stopped {
            return;
        }
        s.last_ts = Some(ts);
        drop(s);
        dual_phase_loop_tick(s_ref, period_ms, signal_a, signal_b, compute_a, compute_b);
    });
}

fn dual_phase_loop_tick<F1, F2>(
    state: Rc<RefCell<LoopState>>,
    period_ms: f64,
    signal_a: ReactiveSignal<f64>,
    signal_b: ReactiveSignal<f64>,
    compute_a: F1,
    compute_b: F2,
) where
    F1: Fn(f64) -> f64 + 'static,
    F2: Fn(f64) -> f64 + 'static,
{
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = state.borrow_mut();
        if s.stopped {
            return;
        }
        let prev = s.last_ts.unwrap_or(ts);
        let delta = ts - prev;
        s.last_ts = Some(ts);
        s.phase = (s.phase + delta / period_ms) % 1.0;
        let phase = s.phase;
        drop(s);

        signal_a.set(compute_a(phase));
        signal_b.set(compute_b(phase));
        dual_phase_loop_tick(state, period_ms, signal_a, signal_b, compute_a, compute_b);
    });
}
