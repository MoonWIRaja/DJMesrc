import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const extensions = ["mp3", "wav", "flac", "ogg", "aac", "m4a"];
export async function chooseAudioFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  const selected = await open({ multiple: true, filters: [{ name: "Audio files", extensions }] });
  return selected ? Array.isArray(selected) ? selected : [selected] : [];
}
export async function chooseAudioFile(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({ multiple: false, filters: [{ name: "Audio files", extensions }] });
  return typeof selected === "string" ? selected : null;
}
export type AudioMeter = { positionMs: number; peak: number; clipping: boolean };
export type ActiveSoundEffect = { id: string; count: number; progress: number };
export const audio = {
  status: () => invoke<void>("audio_output_status"),
  load: (deckId: string, filePath: string) => invoke<void>("audio_load_track", { deckId, filePath }),
  clear: (deckId: string) => invoke<void>("audio_clear_deck", { deckId }),
  duration: (filePath: string) => invoke<number>("audio_track_duration", { filePath }),
  control: (deckId: string, action: "PLAY" | "PAUSE" | "STOP" | "RESTART") => invoke<void>("audio_deck_control", { deckId, action }),
  finished: (deckId: string) => invoke<boolean>("audio_is_finished", { deckId }),
  meter: (deckId: string) => invoke<AudioMeter>("audio_deck_meter", { deckId }),
  volume: (deckId: string, volume: number) => invoke<void>("audio_set_volume", { deckId, volume }),
  fadeGain: (deckId: string, gain: number) => invoke<void>("audio_set_fade_gain", { deckId, gain }),
  crossfade: (value: number) => invoke<void>("audio_set_crossfade", { value }),
  loop: (deckId: string, enabled: boolean) => invoke<void>("audio_set_loop", { deckId, enabled }),
  seek: (deckId: string, positionMs: number) => invoke<void>("audio_seek", { deckId, positionMs }),
  registerSfx: (id: string, filePath: string, volume: number) => invoke<void>("audio_register_sfx", { id, filePath, volume }),
  setSfxVolume: (id: string, volume: number) => invoke<void>("audio_set_sfx_volume", { id, volume }),
  playSfx: (id: string) => invoke<void>("audio_trigger_sfx", { id }),
  activeSfx: () => invoke<ActiveSoundEffect[]>("audio_active_sfx"),
  removeSfx: (id: string) => invoke<void>("audio_remove_sfx", { id }),
  stopSfx: () => invoke<void>("audio_stop_all_sfx"),
};
