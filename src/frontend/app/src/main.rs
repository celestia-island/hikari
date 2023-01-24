#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;

#[tauri::command]
fn my_custom_command(window: tauri::Window, app_handle: tauri::AppHandle) -> String {
    println!("{}", window.label());
    let app_path = app_handle.path_resolver().app_data_dir();
    match app_path {
        Some(dir) => {
            println!("{}", dir.display())
        }
        None => {}
    };
    window.set_always_on_top(true).unwrap();
    // window
    //     .set_decorations(!window.is_decorated().unwrap())
    //     .unwrap();
    window.set_ignore_cursor_events(true).unwrap();
    // window.set_cursor_grab(true).unwrap();
    "Hello from Rust".into()
}

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![my_custom_command])
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.center().unwrap();

            #[cfg(feature = "devtools")]
            window.open_devtools();

            Ok(())
        })
        .run(tauri::generate_context!("./tauri.conf.json"))
        .unwrap();
}
