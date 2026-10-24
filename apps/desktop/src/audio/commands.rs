use super::{ActiveSfx, AudioService, DeckAction, DeckId, DeckMeter};
use rodio::Source;
use std::path::PathBuf;
use tauri::State;

fn parse_deck(value: &str) -> Result<DeckId, String> {
    match value.to_ascii_lowercase().as_str() {
        "left" | "a" => Ok(DeckId::Left),
        "right" | "b" => Ok(DeckId::Right),
        _ => Err("Invalid deck identifier".into()),
    }
}

#[tauri::command]
pub fn audio_output_status(audio: State<'_, AudioService>) -> Result<(), String> {
    audio.status()
}
#[tauri::command]
pub fn audio_load_track(
    audio: State<'_, AudioService>,
    deck_id: String,
    file_path: String,
) -> Result<(), String> {
    audio.load(parse_deck(&deck_id)?, PathBuf::from(file_path))
}

#[tauri::command]
pub fn audio_clear_deck(audio: State<'_, AudioService>, deck_id: String) -> Result<(), String> {
    audio.clear(parse_deck(&deck_id)?);
    Ok(())
}

#[tauri::command]
pub fn audio_track_duration(file_path: String) -> Result<u64, String> {
    let file = std::fs::File::open(file_path).map_err(|e| e.to_string())?;
    let decoder = rodio::Decoder::try_from(file).map_err(|e| e.to_string())?;
    decoder
        .total_duration()
        .map(|duration| duration.as_millis() as u64)
        .ok_or_else(|| "Track duration is unavailable".into())
}
#[tauri::command]
pub fn audio_deck_control(
    audio: State<'_, AudioService>,
    deck_id: String,
    action: String,
) -> Result<(), String> {
    let action = match action.as_str() {
        "PLAY" => DeckAction::Play,
        "PAUSE" => DeckAction::Pause,
        "STOP" => DeckAction::Stop,
        "RESTART" => DeckAction::Restart,
        _ => return Err("Invalid playback action".into()),
    };
    audio.control(parse_deck(&deck_id)?, action)
}

#[tauri::command]
pub fn audio_is_finished(audio: State<'_, AudioService>, deck_id: String) -> Result<bool, String> {
    Ok(audio.finished(parse_deck(&deck_id)?))
}

#[tauri::command]
pub fn audio_deck_meter(
    audio: State<'_, AudioService>,
    deck_id: String,
) -> Result<DeckMeter, String> {
    Ok(audio.meter(parse_deck(&deck_id)?))
}
#[tauri::command]
pub fn audio_set_volume(
    audio: State<'_, AudioService>,
    deck_id: String,
    volume: f32,
) -> Result<(), String> {
    if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
        return Err("Volume must be between 0 and 1".into());
    }
    audio.volume(parse_deck(&deck_id)?, volume);
    Ok(())
}
#[tauri::command]
pub fn audio_set_fade_gain(
    audio: State<'_, AudioService>,
    deck_id: String,
    gain: f32,
) -> Result<(), String> {
    if !gain.is_finite() || !(0.0..=1.0).contains(&gain) {
        return Err("Fade gain must be between 0 and 1".into());
    }
    audio.fade_gain(parse_deck(&deck_id)?, gain)
}
#[tauri::command]
pub fn audio_set_crossfade(audio: State<'_, AudioService>, value: f32) -> Result<(), String> {
    if !value.is_finite() || !(0.0..=1.0).contains(&value) {
        return Err("Crossfader must be between 0 and 1".into());
    }
    audio.crossfade(value);
    Ok(())
}
#[tauri::command]
pub fn audio_set_loop(
    audio: State<'_, AudioService>,
    deck_id: String,
    enabled: bool,
) -> Result<(), String> {
    audio.looping(parse_deck(&deck_id)?, enabled);
    Ok(())
}
#[tauri::command]
pub fn audio_seek(
    audio: State<'_, AudioService>,
    deck_id: String,
    position_ms: u64,
) -> Result<(), String> {
    audio.seek(parse_deck(&deck_id)?, position_ms)
}
#[tauri::command]
pub fn audio_register_sfx(
    audio: State<'_, AudioService>,
    id: String,
    file_path: String,
    volume: f32,
) -> Result<(), String> {
    if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
        return Err("Sound effect volume must be between 0 and 1".into());
    }
    audio.add_sfx(id, PathBuf::from(file_path), volume)
}

#[tauri::command]
pub fn audio_set_sfx_volume(
    audio: State<'_, AudioService>,
    id: String,
    volume: f32,
) -> Result<(), String> {
    if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
        return Err("Sound effect volume must be between 0 and 1".into());
    }
    audio.sfx_volume(id, volume)
}

#[tauri::command]
pub fn audio_remove_sfx(audio: State<'_, AudioService>, id: String) -> Result<(), String> {
    audio.remove_sfx(id);
    Ok(())
}
#[tauri::command]
pub fn audio_trigger_sfx(audio: State<'_, AudioService>, id: String) -> Result<(), String> {
    audio.play_sfx(id)
}

#[tauri::command]
pub fn audio_active_sfx(audio: State<'_, AudioService>) -> Vec<ActiveSfx> {
    audio.active_sfx()
}
#[tauri::command]
pub fn audio_stop_all_sfx(audio: State<'_, AudioService>) -> Result<(), String> {
    audio.stop_sfx();
    Ok(())
}
