// packages/components/src/hooks/use_audio_recorder.rs
// Real audio recording hook using Web Audio API
// Provides real-time audio visualization data and speech recognition

use dioxus::prelude::*;

/// Audio level data for visualization
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AudioLevelData {
    /// Array of 12 frequency band levels (0.0 - 1.0)
    pub levels: [f32; 12],
    /// Overall volume level (0.0 - 1.0)
    pub volume: f32,
}

/// Audio recorder state
#[derive(Clone, PartialEq, Debug)]
pub enum AudioRecorderState {
    Idle,
    RequestingPermission,
    Recording,
    Error(String),
}

/// Check if browser supports required APIs
pub fn is_audio_recording_supported() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        use web_sys::window;
        
        if let Some(win) = window() {
            // Check for getUserMedia
            let has_media_devices = js_sys::Reflect::has(
                &win.navigator(),
                &"mediaDevices".into()
            ).unwrap_or(false);
            
            // Check for AudioContext
            let has_audio_context = js_sys::Reflect::has(
                &win,
                &"AudioContext".into()
            ).unwrap_or(false) || js_sys::Reflect::has(
                &win,
                &"webkitAudioContext".into()
            ).unwrap_or(false);
            
            // Check for SpeechRecognition
            let has_speech = js_sys::Reflect::has(
                &win,
                &"SpeechRecognition".into()
            ).unwrap_or(false) || js_sys::Reflect::has(
                &win,
                &"webkitSpeechRecognition".into()
            ).unwrap_or(false);
            
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

/// Audio recorder hook
/// 
/// Returns (state, audio_levels, start_recording, stop_recording, transcript, is_supported)
pub fn use_audio_recorder() -> (
    Signal<AudioRecorderState>,
    Signal<AudioLevelData>,
    Callback<()>,
    Callback<()>,
    Signal<String>,
    bool,
) {
    let state = use_signal(|| AudioRecorderState::Idle);
    let mut audio_levels = use_signal(|| AudioLevelData::default());
    let transcript = use_signal(String::new);
    let final_transcript = use_signal(String::new);
    let is_supported = is_audio_recording_supported();
    
    // Store resources for cleanup
    let mut animation_frame_id = use_signal(|| None::<i32>);
    let mut media_stream = use_signal(|| None::<JsValue>);
    let mut recognition_instance = use_signal(|| None::<JsValue>);
    
    // Start recording callback
    let start_recording = {
        let mut state = state.clone();
        let audio_levels = audio_levels.clone();
        let transcript = transcript.clone();
        let final_transcript = final_transcript.clone();
        let animation_frame_id = animation_frame_id.clone();
        let media_stream = media_stream.clone();
        let recognition_instance = recognition_instance.clone();
        
        Callback::new(move |_| {
            #[cfg(target_arch = "wasm32")]
            {
                use wasm_bindgen::prelude::*;
                use wasm_bindgen::JsCast;
                use web_sys::window;
                use js_sys::{Reflect, Function, Array, Object, Promise};
                
                if !is_audio_recording_supported() {
                    state.set(AudioRecorderState::Error("Audio recording not supported".to_string()));
                    return;
                }
                
                state.set(AudioRecorderState::RequestingPermission);
                
                let win = window().expect("window not available");
                
                // Request microphone access
                let navigator = win.navigator();
                let media_devices = Reflect::get(&navigator, &"mediaDevices".into()).ok();
                
                if let Some(media_devices) = media_devices {
                    let get_user_media = Reflect::get(&media_devices, &"getUserMedia".into()).ok();
                    
                    if let Some(get_user_media) = get_user_media {
                        let get_user_media_fn: Function = get_user_media.unchecked_into();
                        
                        // Create constraints
                        let constraints = Object::new();
                        let audio_obj = Object::new();
                        Reflect::set(&audio_obj, &"echoCancellation".into(), &true.into()).ok();
                        Reflect::set(&audio_obj, &"noiseSuppression".into(), &true.into()).ok();
                        Reflect::set(&constraints, &"audio".into(), &audio_obj.into()).ok();
                        
                        let result = get_user_media_fn.call1(&media_devices, &constraints.into());
                        
                        if let Ok(promise_val) = result {
                            let promise: Promise = promise_val.unchecked_into();
                            
                            let success_callback = {
                                let mut state = state.clone();
                                let audio_levels = audio_levels.clone();
                                let mut animation_frame_id = animation_frame_id.clone();
                                let transcript = transcript.clone();
                                let final_transcript = final_transcript.clone();
                                let mut media_stream = media_stream.clone();
                                let mut recognition_instance = recognition_instance.clone();
                                let win = win.clone();
                                
                                Closure::wrap(Box::new(move |stream: JsValue| {
                                    web_sys::console::log_1(&"[use_audio_recorder] Microphone access granted, setting up audio...".into());
                                    
                                    // Store stream for cleanup
                                    media_stream.set(Some(stream.clone()));
                                    
                                    // Create AudioContext
                                    let audio_ctx_ctor = Reflect::get(&win, &"AudioContext".into())
                                        .or_else(|_| Reflect::get(&win, &"webkitAudioContext".into()))
                                        .ok();
                                    
                                    if let Some(ctor) = audio_ctx_ctor {
                                        let ctor_fn: Function = ctor.unchecked_into();
                                        if let Ok(audio_context) = Reflect::construct(&ctor_fn, &Array::new()) {
                                            // Resume audio context
                                            if let Some(resume) = Reflect::get(&audio_context, &"resume".into()).ok() {
                                                let resume_fn: Function = resume.unchecked_into();
                                                resume_fn.call0(&audio_context).ok();
                                            }
                                            
                                            // Create analyser
                                            if let Some(create_analyser) = Reflect::get(&audio_context, &"createAnalyser".into()).ok() {
                                                let create_fn: Function = create_analyser.unchecked_into();
                                                if let Ok(analyser) = create_fn.call0(&audio_context) {
                                                    // Configure analyser
                                                    Reflect::set(&analyser, &"fftSize".into(), &256.into()).ok();
                                                    Reflect::set(&analyser, &"smoothingTimeConstant".into(), &0.7.into()).ok();
                                                    
                                                    // Create source from stream
                                                    if let Some(create_source) = Reflect::get(&audio_context, &"createMediaStreamSource".into()).ok() {
                                                        let create_fn: Function = create_source.unchecked_into();
                                                        if let Ok(source) = create_fn.call1(&audio_context, &stream) {
                                                            // Connect source to analyser
                                                            if let Some(connect) = Reflect::get(&source, &"connect".into()).ok() {
                                                                let connect_fn: Function = connect.unchecked_into();
                                                                connect_fn.call1(&source, &analyser).ok();
                                                            }
                                                            
                                                            state.set(AudioRecorderState::Recording);
                                                            web_sys::console::log_1(&"[use_audio_recorder] Recording started, state set to Recording".into());
                                                            
                                                            // Create visualization loop
                                                            let visualize = {
                                                                let mut audio_levels = audio_levels.clone();
                                                                let mut animation_frame_id = animation_frame_id.clone();
                                                                let win = win.clone();
                                                                
                                                                Closure::wrap(Box::new(move || {
                                                                    // Create frequency data array
                                                                    let frequency_data = js_sys::Uint8Array::new_with_length(128);
                                                                    
                                                                    // Get frequency data
                                                                    if let Some(get_data) = Reflect::get(&analyser, &"getByteFrequencyData".into()).ok() {
                                                                        let get_data_fn: Function = get_data.unchecked_into();
                                                                        get_data_fn.call1(&analyser, &frequency_data).ok();
                                                                        
                                                                        // Read data into array
                                                                        let data: Vec<u8> = frequency_data.to_vec();
                                                                        
                                                                        // Calculate levels for 12 bars with sensitivity boost
                                                                        let mut levels = [0.0f32; 12];
                                                                        let mut total_volume = 0.0f32;
                                                                        
                                                                        // Sensitivity parameters
                                                                        const GAIN: f32 = 2.5;         // Amplification factor for quiet sounds
                                                                        const NOISE_FLOOR: f32 = 0.05; // Ignore very low noise
                                                                        
                                                                        for i in 0..12 {
                                                                            let start = i * 10;
                                                                            let end = start + 10;
                                                                            let mut sum = 0.0f32;
                                                                            
                                                                            for j in start..end {
                                                                                if j < 128 {
                                                                                    sum += data[j] as f32;
                                                                                }
                                                                            }
                                                                            
                                                                            let avg = sum / 10.0;
                                                                            let normalized = avg / 255.0;
                                                                            
                                                                            // Apply gain and clamp
                                                                            let level = if normalized > NOISE_FLOOR {
                                                                                // Amplify quiet sounds
                                                                                ((normalized - NOISE_FLOOR) * GAIN + NOISE_FLOOR).min(1.0)
                                                                            } else {
                                                                                // Below noise floor - show minimal activity
                                                                                normalized * 0.3
                                                                            };
                                                                            levels[i] = level;
                                                                            total_volume += level;
                                                                        }
                                                                        
                                                                        audio_levels.set(AudioLevelData {
                                                                            levels,
                                                                            volume: total_volume / 12.0,
                                                                        });
                                                                        
                                                                        // Debug log
                                                                        if total_volume > 0.1 {
                                                                            web_sys::console::log_1(&format!("[use_audio_recorder] Audio level: {:.2}", total_volume / 12.0).into());
                                                                        }
                                                                    }
                                                                    
                                                                    // Request next frame
                                                                    if let Some(req) = Reflect::get(&win, &"requestAnimationFrame".into()).ok() {
                                                                        let req_fn: Function = req.unchecked_into();
                                                                        if let Ok(id) = req_fn.call0(&win) {
                                                                            if let Some(id_num) = id.as_f64() {
                                                                                animation_frame_id.set(Some(id_num as i32));
                                                                            }
                                                                        }
                                                                    }
                                                                }) as Box<dyn FnMut()>)
                                                            };
                                                            
                                                            // Start visualization
                                                            if let Some(req) = Reflect::get(&win, &"requestAnimationFrame".into()).ok() {
                                                                let req_fn: Function = req.unchecked_into();
                                                                if let Ok(id) = req_fn.call1(&win, visualize.as_ref().unchecked_ref()) {
                                                                    if let Some(id_num) = id.as_f64() {
                                                                        animation_frame_id.set(Some(id_num as i32));
                                                                    }
                                                                }
                                                            }
                                                            
                                                            visualize.forget();
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    
                                    // Start speech recognition
                                    let speech_recognition = Reflect::get(&win, &"SpeechRecognition".into())
                                        .or_else(|_| Reflect::get(&win, &"webkitSpeechRecognition".into()))
                                        .ok();
                                    
                                    if let Some(sr) = speech_recognition {
                                        let constructor: Function = sr.unchecked_into();
                                        if let Ok(recognition) = Reflect::construct(&constructor, &Array::new()) {
                                            Reflect::set(&recognition, &"continuous".into(), &true.into()).ok();
                                            Reflect::set(&recognition, &"interimResults".into(), &true.into()).ok();
                                            Reflect::set(&recognition, &"lang".into(), &"zh-CN".into()).ok();
                                            
                                            // Store recognition instance
                                            recognition_instance.set(Some(recognition.clone()));
                                            
                                            // Result handler - accumulate final results and show interim
                                            let on_result = {
                                                let mut transcript = transcript.clone();
                                                let mut final_transcript = final_transcript.clone();
                                                Closure::wrap(Box::new(move |event: JsValue| {
                                                    if let Some(results) = Reflect::get(&event, &"results".into()).ok() {
                                                        if let Some(length) = Reflect::get(&results, &"length".into()).ok().and_then(|l| l.as_f64()) {
                                                            let length = length as u32;
                                                            
                                                            if length > 0 {
                                                                let mut new_final = String::new();
                                                                let mut interim = String::new();
                                                                
                                                                for i in 0..length {
                                                                    if let Some(result) = Reflect::get(&results, &i.into()).ok() {
                                                                        if let Some(is_final) = Reflect::get(&result, &"isFinal".into()).ok().and_then(|f| f.as_bool()) {
                                                                            if let Some(item) = Reflect::get(&result, &"0".into()).ok() {
                                                                                if let Some(text) = Reflect::get(&item, &"transcript".into()).ok().and_then(|t| t.as_string()) {
                                                                                    if is_final {
                                                                                        new_final.push_str(&text);
                                                                                    } else {
                                                                                        interim.push_str(&text);
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                
                                                                // Accumulate new final text
                                                                if !new_final.is_empty() {
                                                                    let mut current = final_transcript();
                                                                    current.push_str(&new_final);
                                                                    final_transcript.set(current);
                                                                }
                                                                
                                                                // Combine: accumulated final + current interim
                                                                let combined = format!("{}{}", final_transcript(), interim);
                                                                if !combined.is_empty() {
                                                                    transcript.set(combined);
                                                                }
                                                            }
                                                        }
                                                    }
                                                }) as Box<dyn FnMut(_)>)
                                            };
                                            
                                            Reflect::set(&recognition, &"onresult".into(), on_result.as_ref().unchecked_ref()).ok();
                                            on_result.forget();
                                            
                                            // Error handler
                                            let on_error = {
                                                Closure::wrap(Box::new(move |_event: JsValue| {
                                                    // Handle error silently
                                                }) as Box<dyn FnMut(_)>)
                                            };
                                            Reflect::set(&recognition, &"onerror".into(), on_error.as_ref().unchecked_ref()).ok();
                                            on_error.forget();
                                            
                                            // Start recognition
                                            if let Some(start) = Reflect::get(&recognition, &"start".into()).ok() {
                                                let start_fn: Function = start.unchecked_into();
                                                start_fn.call0(&recognition).ok();
                                            }
                                        }
                                    }
                                }) as Box<dyn FnMut(_)>)
                            };
                            
                            let error_callback = {
                                let mut state = state.clone();
                                Closure::wrap(Box::new(move |err: JsValue| {
                                    let error_msg = format!("Microphone access denied: {:?}", err);
                                    state.set(AudioRecorderState::Error(error_msg));
                                }) as Box<dyn FnMut(_)>)
                            };
                            
                            let _ = promise.then(&success_callback);
                            let _ = promise.catch(&error_callback);
                            
                            success_callback.forget();
                            error_callback.forget();
                        }
                    }
                }
            }
        })
    };
    
    // Stop recording callback
    let stop_recording = {
        let mut state = state.clone();
        let transcript = transcript.clone();
        let _audio_levels = audio_levels.clone();
        let _animation_frame_id = animation_frame_id.clone();
        let _media_stream = media_stream.clone();
        let _recognition_instance = recognition_instance.clone();
        let mut final_transcript = final_transcript.clone();
        
        Callback::new(move |_| {
            #[cfg(target_arch = "wasm32")]
            {
                use web_sys::window;
                use wasm_bindgen::JsCast;
                use js_sys::Reflect;
                
                web_sys::console::log_1(&"[use_audio_recorder] Stopping recording...".into());
                
                // Cancel animation frame
                if let Some(id) = animation_frame_id() {
                    if let Some(win) = window() {
                        if let Some(cancel) = Reflect::get(&win, &"cancelAnimationFrame".into()).ok() {
                            let cancel_fn: js_sys::Function = cancel.unchecked_into();
                            cancel_fn.call1(&win, &id.into()).ok();
                        }
                    }
                    animation_frame_id.set(None);
                }
                
                // Stop media stream tracks
                if let Some(stream) = media_stream() {
                    if let Some(get_tracks) = Reflect::get(&stream, &"getTracks".into()).ok() {
                        let get_tracks_fn: js_sys::Function = get_tracks.unchecked_into();
                        if let Ok(tracks) = get_tracks_fn.call0(&stream) {
                            if let Some(tracks_array) = tracks.dyn_ref::<js_sys::Array>() {
                                for i in 0..tracks_array.length() {
                                    if let Some(track) = tracks_array.get(i).dyn_ref::<JsValue>() {
                                        if let Some(stop) = Reflect::get(track, &"stop".into()).ok() {
                                            let stop_fn: js_sys::Function = stop.unchecked_into();
                                            stop_fn.call0(track).ok();
                                        }
                                    }
                                }
                            }
                        }
                    }
                    media_stream.set(None);
                }
                
                // Stop speech recognition
                if let Some(recognition) = recognition_instance() {
                    if let Some(stop) = Reflect::get(&recognition, &"stop".into()).ok() {
                        let stop_fn: js_sys::Function = stop.unchecked_into();
                        stop_fn.call0(&recognition).ok();
                    }
                    recognition_instance.set(None);
                }
                
                // Reset audio levels
                audio_levels.set(AudioLevelData::default());
                
                // Reset final transcript for next session
                final_transcript.set(String::new());
                
                // Reset transcript
                transcript.set(String::new());
                
                web_sys::console::log_1(&"[use_audio_recorder] Recording stopped, state reset to Idle".into());
            }
            
            state.set(AudioRecorderState::Idle);
        })
    };
    
    (state, audio_levels, start_recording, stop_recording, transcript, is_supported)
}

use wasm_bindgen::JsValue;
