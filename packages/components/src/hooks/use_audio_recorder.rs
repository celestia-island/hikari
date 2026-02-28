// packages/components/src/hooks/use_audio_recorder.rs
// Audio recorder with context-based state management
// Uses thread-local storage to allow access from callbacks

use dioxus::prelude::*;

#[derive(Clone, PartialEq, Debug, Default)]
pub struct AudioLevelData {
    pub levels: [f32; 12],
    pub volume: f32,
}

#[derive(Clone, PartialEq, Debug, Default)]
pub enum AudioRecorderState {
    #[default]
    Idle,
    RequestingPermission,
    Recording,
    Error(String),
}

#[derive(Clone, Copy)]
pub struct AudioRecorderContext {
    pub state: Signal<AudioRecorderState>,
    pub audio_levels: Signal<AudioLevelData>,
    pub transcript: Signal<String>,
    pub is_supported: bool,
}

thread_local! {
    static CONTEXT_STORE: std::cell::RefCell<Option<AudioRecorderContext>> = std::cell::RefCell::new(None);

    #[cfg(target_arch = "wasm32")]
    static AUDIO_STREAM: std::cell::RefCell<Option<wasm_bindgen::JsValue>> = std::cell::RefCell::new(None);

    #[cfg(target_arch = "wasm32")]
    static AUDIO_RECOGNITION: std::cell::RefCell<Option<wasm_bindgen::JsValue>> = std::cell::RefCell::new(None);

    #[cfg(target_arch = "wasm32")]
    static AUDIO_INTERVAL_ID: std::cell::RefCell<Option<i32>> = std::cell::RefCell::new(None);
}

fn get_context() -> Option<AudioRecorderContext> {
    CONTEXT_STORE.with(|s| s.borrow().clone())
}

fn set_context(ctx: AudioRecorderContext) {
    CONTEXT_STORE.with(|s| *s.borrow_mut() = Some(ctx));
}

pub fn is_audio_recording_supported() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        use web_sys::window;

        if let Some(win) = window() {
            let has_media_devices =
                js_sys::Reflect::has(&win.navigator(), &"mediaDevices".into()).unwrap_or(false);

            let has_audio_context = js_sys::Reflect::has(&win, &"AudioContext".into())
                .unwrap_or(false)
                || js_sys::Reflect::has(&win, &"webkitAudioContext".into()).unwrap_or(false);

            let has_speech = js_sys::Reflect::has(&win, &"SpeechRecognition".into())
                .unwrap_or(false)
                || js_sys::Reflect::has(&win, &"webkitSpeechRecognition".into()).unwrap_or(false);

            has_media_devices && has_audio_context && has_speech
        } else {
            false
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}

#[component]
pub fn AudioRecorderProvider(children: Element) -> Element {
    let state = use_signal(|| AudioRecorderState::Idle);
    let audio_levels = use_signal(|| AudioLevelData::default());
    let transcript = use_signal(String::new);
    let is_supported = is_audio_recording_supported();

    let ctx = AudioRecorderContext {
        state,
        audio_levels,
        transcript,
        is_supported,
    };

    set_context(ctx);
    use_context_provider(|| ctx);

    rsx! { {children} }
}

pub fn use_audio_recorder() -> AudioRecorderContext {
    use_context::<AudioRecorderContext>()
}

pub fn start_audio_recording() {
    #[cfg(target_arch = "wasm32")]
    {
        use js_sys::{Array, Function, Object, Promise, Reflect};
        use wasm_bindgen::JsCast;
        use wasm_bindgen::prelude::*;
        use web_sys::window;

        let mut ctx = match get_context() {
            Some(c) => c,
            None => {
                web_sys::console::log_1(&"[start_audio_recording] No context available".into());
                return;
            }
        };

        web_sys::console::log_1(&"[start_audio_recording] Starting...".into());

        if !ctx.is_supported {
            web_sys::console::log_1(&"[start_audio_recording] Not supported".into());
            ctx.state.set(AudioRecorderState::Error(
                "Audio recording not supported".to_string(),
            ));
            return;
        }

        web_sys::console::log_1(
            &"[start_audio_recording] Setting state to RequestingPermission".into(),
        );

        ctx.transcript.set(String::new());
        ctx.state.set(AudioRecorderState::RequestingPermission);

        let win = match window() {
            Some(w) => w,
            None => {
                web_sys::console::log_1(&"[start_audio_recording] No window".into());
                ctx.state
                    .set(AudioRecorderState::Error("No window".to_string()));
                return;
            }
        };

        let navigator = win.navigator();
        let media_devices = match Reflect::get(&navigator, &"mediaDevices".into()).ok() {
            Some(md) => md,
            None => {
                web_sys::console::log_1(&"[start_audio_recording] No media devices".into());
                ctx.state
                    .set(AudioRecorderState::Error("No media devices".to_string()));
                return;
            }
        };

        let get_user_media = match Reflect::get(&media_devices, &"getUserMedia".into()).ok() {
            Some(gum) => gum,
            None => {
                web_sys::console::log_1(&"[start_audio_recording] No getUserMedia".into());
                ctx.state
                    .set(AudioRecorderState::Error("No getUserMedia".to_string()));
                return;
            }
        };

        web_sys::console::log_1(&"[start_audio_recording] Calling getUserMedia".into());

        let get_user_media_fn: Function = get_user_media.unchecked_into();

        let constraints = Object::new();
        let audio_obj = Object::new();
        let _ = Reflect::set(&audio_obj, &"echoCancellation".into(), &true.into());
        let _ = Reflect::set(&audio_obj, &"noiseSuppression".into(), &true.into());
        let _ = Reflect::set(&constraints, &"audio".into(), &audio_obj.into());

        let result = get_user_media_fn.call1(&media_devices, &constraints.into());

        if let Ok(promise_val) = result {
            let promise: Promise = promise_val.unchecked_into();

            let success_callback = {
                let win = win.clone();

                Closure::wrap(Box::new(move |stream: JsValue| {
                    web_sys::console::log_1(
                        &"[use_audio_recorder] Microphone access granted".into(),
                    );

                    AUDIO_STREAM.with(|s| *s.borrow_mut() = Some(stream.clone()));

                    let audio_ctx_ctor = Reflect::get(&win, &"AudioContext".into())
                        .or_else(|_| Reflect::get(&win, &"webkitAudioContext".into()))
                        .ok();

                    if let Some(ctor) = audio_ctx_ctor {
                        let ctor_fn: Function = ctor.unchecked_into();
                        if let Ok(audio_context) = Reflect::construct(&ctor_fn, &Array::new()) {
                            if let Some(resume) =
                                Reflect::get(&audio_context, &"resume".into()).ok()
                            {
                                let resume_fn: Function = resume.unchecked_into();
                                let _ = resume_fn.call0(&audio_context);
                            }

                            if let Some(create_analyser) =
                                Reflect::get(&audio_context, &"createAnalyser".into()).ok()
                            {
                                let create_fn: Function = create_analyser.unchecked_into();
                                if let Ok(analyser) = create_fn.call0(&audio_context) {
                                    let _ = Reflect::set(&analyser, &"fftSize".into(), &256.into());
                                    let _ = Reflect::set(
                                        &analyser,
                                        &"smoothingTimeConstant".into(),
                                        &0.7.into(),
                                    );

                                    if let Some(create_source) = Reflect::get(
                                        &audio_context,
                                        &"createMediaStreamSource".into(),
                                    )
                                    .ok()
                                    {
                                        let create_src_fn: Function =
                                            create_source.unchecked_into();
                                        if let Ok(source) =
                                            create_src_fn.call1(&audio_context, &stream)
                                        {
                                            if let Some(connect) =
                                                Reflect::get(&source, &"connect".into()).ok()
                                            {
                                                let connect_fn: Function = connect.unchecked_into();
                                                let _ = connect_fn.call1(&source, &analyser);
                                            }
                                        }
                                    }

                                    let analyser_clone = analyser.clone();
                                    let update_levels = Closure::wrap(Box::new(move || {
                                        let mut data = [0u8; 128];
                                        if let Some(get_byte) = Reflect::get(
                                            &analyser_clone,
                                            &"getByteFrequencyData".into(),
                                        )
                                        .ok()
                                        {
                                            let get_fn: Function = get_byte.unchecked_into();
                                            let data_array =
                                                js_sys::Uint8Array::new_with_length(128);
                                            let _ = get_fn.call1(&analyser_clone, &data_array);
                                            data_array.copy_to(&mut data);
                                        }

                                        let mut levels = [0.0f32; 12];
                                        let bin_size = 128 / 12;
                                        for i in 0..12 {
                                            let start = i * bin_size;
                                            let end = start + bin_size;
                                            let sum: u32 =
                                                data[start..end].iter().map(|&v| v as u32).sum();
                                            levels[i] =
                                                (sum as f32 / (bin_size as f32 * 128.0)).min(1.0);
                                        }

                                        let volume = levels.iter().sum::<f32>() / 12.0;
                                        if let Some(mut ctx) = get_context() {
                                            ctx.audio_levels.set(AudioLevelData { levels, volume });
                                        }
                                    })
                                        as Box<dyn FnMut()>);

                                    let id = win
                                        .set_interval_with_callback_and_timeout_and_arguments_0(
                                            update_levels.as_ref().unchecked_ref(),
                                            50,
                                        )
                                        .ok();
                                    AUDIO_INTERVAL_ID.with(|i| *i.borrow_mut() = id);
                                    update_levels.forget();
                                }
                            }
                        }
                    }

                    let SpeechRecognition = Reflect::get(&win, &"SpeechRecognition".into())
                        .or_else(|_| Reflect::get(&win, &"webkitSpeechRecognition".into()))
                        .ok();

                    if let Some(sr_ctor) = SpeechRecognition {
                        let sr_ctor_fn: Function = sr_ctor.unchecked_into();
                        if let Ok(recognition) = Reflect::construct(&sr_ctor_fn, &Array::new()) {
                            let _ = Reflect::set(&recognition, &"continuous".into(), &true.into());
                            let _ =
                                Reflect::set(&recognition, &"interimResults".into(), &true.into());
                            
                            // Use browser's current language setting for speech recognition
                            let speech_lang = if let Some(lang) = web_sys::window().and_then(|w| w.navigator().language()) {
                                lang
                            } else {
                                "en-US".to_string() // Fallback to English
                            };
                            let _ = Reflect::set(&recognition, &"lang".into(), &speech_lang.into());

                            let recognition_clone = recognition.clone();
                            let onresult = Closure::wrap(Box::new(move |event: JsValue| {
                                if let Some(results) = Reflect::get(&event, &"results".into()).ok()
                                {
                                    let length = Reflect::get(&results, &"length".into())
                                        .ok()
                                        .and_then(|l| l.as_f64())
                                        .unwrap_or(0.0)
                                        as u32;

                                    let mut final_text = String::new();
                                    let mut interim_text = String::new();

                                    for i in 0..length {
                                        if let Some(result) = Reflect::get(&results, &i.into()).ok()
                                        {
                                            let is_final = Reflect::get(&result, &"isFinal".into())
                                                .ok()
                                                .and_then(|v| v.as_bool())
                                                .unwrap_or(false);

                                            let transcript =
                                                Reflect::get(&result, &"transcript".into())
                                                    .ok()
                                                    .and_then(|t| t.as_string())
                                                    .unwrap_or_default();

                                            if is_final {
                                                final_text.push_str(&transcript);
                                            } else {
                                                interim_text.push_str(&transcript);
                                            }
                                        }
                                    }

                                    if let Some(mut ctx) = get_context() {
                                        let current = ctx.transcript.read().clone();
                                        let new_transcript = if final_text.is_empty() {
                                            format!("{}{}", current, interim_text)
                                        } else {
                                            format!("{}{}", current, final_text)
                                        };
                                        ctx.transcript.set(new_transcript);
                                    }
                                } else {
                                    web_sys::console::log_1(
                                        &"[SpeechRecognition] No results found in event".into(),
                                    );
                                }
                            })
                                as Box<dyn FnMut(JsValue)>);

                            // Register callbacks and keep them alive using forget()
                            let onresult_js = onresult.as_ref();
                            let _ =
                                Reflect::set(&recognition_clone, &"onresult".into(), &onresult_js);
                            onresult.forget();

                            let recognition_for_end = recognition.clone();
                            let onend = Closure::wrap(Box::new(move || {
                                if let Some(ctx) = get_context() {
                                    ctx.state.set(AudioRecorderState::Idle);
                                    ctx.transcript.set(String::new());
                                    ctx.audio_levels.set(AudioLevelData {
                                        levels: [0.0; 12],
                                        volume: 0.0,
                                    });
                                }
                            })
                                as Box<dyn FnMut()>);

                            let onend_js = onend.as_ref();
                            let _ = Reflect::set(&recognition, &"onend".into(), &onend_js);
                            onend.forget();

                            let onstart = Closure::wrap(Box::new(move || {}) as Box<dyn FnMut()>);
                            let onstart_js = onstart.as_ref();
                            let _ = Reflect::set(&recognition, &"onstart".into(), &onstart_js);
                            onstart.forget();

                            if let Some(start) = Reflect::get(&recognition, &"start".into()).ok() {
                                let start_fn: Function = start.unchecked_into();
                                let _ = start_fn.call0(&recognition);
                            }

                            AUDIO_RECOGNITION.with(|r| *r.borrow_mut() = Some(recognition));
                        }
                    }

                    if let Some(mut ctx) = get_context() {
                        ctx.state.set(AudioRecorderState::Recording);
                        web_sys::console::log_1(
                            &"[use_audio_recorder] State set to Recording".into(),
                        );
                    }
                }) as Box<dyn FnMut(JsValue)>)
            };

            let error_callback = {
                Closure::wrap(Box::new(move |_error: JsValue| {
                    if let Some(mut ctx) = get_context() {
                        ctx.state.set(AudioRecorderState::Error(
                            "Microphone access denied".to_string(),
                        ));
                    }
                }) as Box<dyn FnMut(JsValue)>)
            };

            let _ = promise.then2(&success_callback, &error_callback);
            success_callback.forget();
            error_callback.forget();
        }
    }
}

pub fn stop_audio_recording() {
    #[cfg(target_arch = "wasm32")]
    {
        use js_sys::{Function, Reflect};
        use wasm_bindgen::JsCast;

        AUDIO_STREAM.with(|s| {
            if let Some(stream) = s.borrow().clone() {
                if let Some(tracks) = Reflect::get(&stream, &"getTracks".into()).ok() {
                    let tracks_fn: Function = tracks.unchecked_into();
                    if let Ok(tracks_array) = tracks_fn.call0(&stream) {
                        let tracks_arr: js_sys::Array = tracks_array.unchecked_into();
                        for i in 0..tracks_arr.length() {
                            if let Some(track) = tracks_arr.get(i).dyn_into::<js_sys::Object>().ok()
                            {
                                if let Some(stop) = Reflect::get(&track, &"stop".into()).ok() {
                                    let stop_fn: Function = stop.unchecked_into();
                                    let _ = stop_fn.call0(&track);
                                }
                            }
                        }
                    }
                }
            }
            *s.borrow_mut() = None;
        });

        AUDIO_RECOGNITION.with(|r| {
            if let Some(recognition) = r.borrow().clone() {
                if let Some(stop) = Reflect::get(&recognition, &"stop".into()).ok() {
                    let stop_fn: Function = stop.unchecked_into();
                    let _ = stop_fn.call0(&recognition);
                }
            }
            *r.borrow_mut() = None;
        });

        AUDIO_INTERVAL_ID.with(|i| {
            if let Some(id) = *i.borrow() {
                if let Some(win) = web_sys::window() {
                    let _ = win.clear_interval_with_handle(id);
                }
            }
            *i.borrow_mut() = None;
        });

        if let Some(mut ctx) = get_context() {
            ctx.state.set(AudioRecorderState::Idle);
        }
    }
}

pub fn clear_transcript() {
    if let Some(ctx) = get_context() {
        let mut ctx = ctx;
        ctx.transcript.set(String::new());
    }
}

pub fn get_transcript() -> String {
    if let Some(ctx) = get_context() {
        ctx.transcript.read().clone()
    } else {
        String::new()
    }
}

pub fn get_audio_state() -> AudioRecorderState {
    if let Some(ctx) = get_context() {
        ctx.state.read().clone()
    } else {
        AudioRecorderState::Idle
    }
}

pub fn is_recording_active() -> bool {
    if let Some(ctx) = get_context() {
        matches!(
            ctx.state.read().clone(),
            AudioRecorderState::Recording | AudioRecorderState::RequestingPermission
        )
    } else {
        false
    }
}
