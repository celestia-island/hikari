// packages/components/src/hooks/use_voice_input.rs
// Web Speech API hook for voice input functionality

use dioxus::prelude::*;

/// Voice input state
#[derive(Clone, PartialEq, Debug)]
pub enum VoiceInputState {
    /// Idle state, ready to start
    Idle,
    /// Listening for voice input
    Listening,
    /// Processing speech to text
    Processing,
    /// Error occurred
    Error(String),
}

/// Voice input result
#[derive(Clone, PartialEq, Debug)]
pub struct VoiceInputResult {
    /// Transcribed text
    pub text: String,
    /// Whether the result is final
    pub is_final: bool,
}

/// Check if browser supports Web Speech API
pub fn is_speech_recognition_supported() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        use web_sys::window;
        
        if let Some(win) = window() {
            // Check for SpeechRecognition or webkitSpeechRecognition
            let has_speech_recognition = js_sys::Reflect::has(
                &win,
                &"SpeechRecognition".into()
            ).unwrap_or(false);
            
            let has_webkit_speech = js_sys::Reflect::has(
                &win,
                &"webkitSpeechRecognition".into()
            ).unwrap_or(false);
            
            has_speech_recognition || has_webkit_speech
        } else {
            false
        }
    }
    
    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}

/// Voice input hook
/// 
/// Returns (state, start_listening, stop_listening, is_supported)
pub fn use_voice_input(
    on_result: Callback<VoiceInputResult>,
    on_error: Callback<String>,
) -> (Signal<VoiceInputState>, Callback<()>, Callback<()>, bool) {
    let state = use_signal(|| VoiceInputState::Idle);
    let is_supported = is_speech_recognition_supported();
    
    // Start listening callback
    let start_listening = {
        let mut state = state.clone();
        let _on_result = on_result.clone();
        let _on_error = on_error.clone();
        
        Callback::new(move |_| {
            #[cfg(target_arch = "wasm32")]
            {
                use wasm_bindgen::prelude::*;
                use wasm_bindgen::JsCast;
                use web_sys::window;
                use js_sys::{Reflect, Function};
                
                if !is_speech_recognition_supported() {
                    state.set(VoiceInputState::Error("Speech recognition not supported".to_string()));
                    on_error.call("Speech recognition not supported".to_string());
                    return;
                }
                
                state.set(VoiceInputState::Listening);
                
                // Get SpeechRecognition constructor
                let win = window().expect("window not available");
                let speech_recognition = Reflect::get(
                    &win,
                    &"SpeechRecognition".into()
                ).or_else(|_| {
                    Reflect::get(&win, &"webkitSpeechRecognition".into())
                });
                
                if let Ok(sr) = speech_recognition {
                    // Create new instance using Function constructor
                    let constructor: js_sys::Function = sr.unchecked_into();
                    let recognition = js_sys::Reflect::construct(
                        &constructor,
                        &js_sys::Array::new()
                    ).expect("Failed to create SpeechRecognition");
                    
                    // Configure recognition
                    Reflect::set(&recognition, &"continuous".into(), &true.into()).ok();
                    Reflect::set(&recognition, &"interimResults".into(), &true.into()).ok();
                    Reflect::set(&recognition, &"lang".into(), &"zh-CN".into()).ok();
                    
                    // Result handler
                    let on_result_callback = {
                        let mut state = state.clone();
                        let on_result = on_result.clone();
                        Closure::wrap(Box::new(move |event: JsValue| {
                            // Extract results from event
                            let results = Reflect::get(&event, &"results".into()).ok();
                            if let Some(results) = results {
                                let length = js_sys::Reflect::get(&results, &"length".into())
                                    .ok()
                                    .and_then(|l| l.as_f64())
                                    .unwrap_or(0.0) as u32;
                                
                                if length > 0 {
                                    let result = js_sys::Reflect::get(&results, &0.into()).ok();
                                    if let Some(result) = result {
                                        let transcript = js_sys::Reflect::get(&result, &"0".into())
                                            .ok()
                                            .and_then(|item| js_sys::Reflect::get(&item, &"transcript".into()).ok())
                                            .and_then(|t| t.as_string())
                                            .unwrap_or_default();
                                        
                                        let is_final = js_sys::Reflect::get(&result, &"isFinal".into())
                                            .ok()
                                            .and_then(|f| f.as_bool())
                                            .unwrap_or(false);
                                        
                                        on_result.call(VoiceInputResult {
                                            text: transcript,
                                            is_final,
                                        });
                                        
                                        if is_final {
                                            state.set(VoiceInputState::Idle);
                                        }
                                    }
                                }
                            }
                        }) as Box<dyn FnMut(_)>)
                    };
                    
                    Reflect::set(
                        &recognition,
                        &"onresult".into(),
                        on_result_callback.as_ref().unchecked_ref()
                    ).ok();
                    
                    // Error handler
                    let on_error_callback = {
                        let mut state = state.clone();
                        let on_error = on_error.clone();
                        Closure::wrap(Box::new(move |event: JsValue| {
                            let error = js_sys::Reflect::get(&event, &"error".into())
                                .ok()
                                .and_then(|e| e.as_string())
                                .unwrap_or_else(|| "Unknown error".to_string());
                            let error_msg = format!("Speech recognition error: {}", error);
                            state.set(VoiceInputState::Error(error_msg.clone()));
                            on_error.call(error_msg);
                        }) as Box<dyn FnMut(_)>)
                    };
                    
                    Reflect::set(
                        &recognition,
                        &"onerror".into(),
                        on_error_callback.as_ref().unchecked_ref()
                    ).ok();
                    
                    // Start recognition
                    let start_method = js_sys::Reflect::get(&recognition, &"start".into()).ok();
                    if let Some(start) = start_method {
                        let start_fn = start.unchecked_into::<Function>();
                        if let Err(e) = start_fn.call1(&recognition, &JsValue::undefined()) {
                            let error_msg = format!("Failed to start speech recognition: {:?}", e);
                            state.set(VoiceInputState::Error(error_msg.clone()));
                            on_error.call(error_msg);
                        }
                    }
                    
                    // Keep closures alive
                    on_result_callback.forget();
                    on_error_callback.forget();
                }
            }
        })
    };
    
    // Stop listening callback
    let stop_listening = {
        let mut state = state.clone();
        Callback::new(move |_| {
            state.set(VoiceInputState::Idle);
        })
    };
    
    (state, start_listening, stop_listening, is_supported)
}
