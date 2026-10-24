mod audio;

#[cfg(windows)]
use tauri::Manager;
#[cfg(windows)]
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    ICON_BIG, IMAGE_ICON, LR_DEFAULTCOLOR, LR_SHARED, LoadImageW, SendMessageW, WM_SETICON,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio = audio::AudioService::new().unwrap_or_else(audio::AudioService::offline);
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            #[cfg(windows)]
            {
                let icon = tauri::image::Image::from_app_icon_resource(128)?;

                // set_icon updates ICON_SMALL; set ICON_BIG too so the taskbar uses the same resource.
                if let Some(window) = app.get_webview_window("main") {
                    window.set_icon(icon)?;

                    unsafe {
                        let instance = GetModuleHandleW(std::ptr::null());
                        let big_icon = LoadImageW(
                            instance,
                            tauri::utils::platform::WINDOWS_APP_ICON_RESOURCE_ID as usize as *const u16,
                            IMAGE_ICON,
                            256,
                            256,
                            LR_DEFAULTCOLOR | LR_SHARED,
                        );

                        if !big_icon.is_null() {
                            SendMessageW(
                                window.hwnd()?.0 as _,
                                WM_SETICON,
                                ICON_BIG as usize,
                                big_icon as isize,
                            );
                        }
                    }
                }
            }

            #[cfg(not(windows))]
            let _ = app;
            Ok(())
        })
        .manage(audio)
        .invoke_handler(tauri::generate_handler![
            audio::commands::audio_output_status,
            audio::commands::audio_load_track,
            audio::commands::audio_clear_deck,
            audio::commands::audio_track_duration,
            audio::commands::audio_deck_control,
            audio::commands::audio_is_finished,
            audio::commands::audio_deck_meter,
            audio::commands::audio_set_volume,
            audio::commands::audio_set_fade_gain,
            audio::commands::audio_set_crossfade,
            audio::commands::audio_set_loop,
            audio::commands::audio_seek,
            audio::commands::audio_register_sfx,
            audio::commands::audio_set_sfx_volume,
            audio::commands::audio_remove_sfx,
            audio::commands::audio_trigger_sfx,
            audio::commands::audio_active_sfx,
            audio::commands::audio_stop_all_sfx
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
