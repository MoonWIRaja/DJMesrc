export type DeckId = "left" | "right";
export type PlaybackStatus = "playing" | "paused" | "stopped" | "fading" | "missing";
export interface Track { id: string; name: string; path: string; durationMs: number; missing?: boolean; }
export interface Deck { id: DeckId; tracks: Track[]; currentId: string | null; status: PlaybackStatus; positionMs: number; volume: number; muted: boolean; looping: boolean; }
export interface SoundEffect { id: string; name: string; path: string; durationMs: number; volume: number; color: string; missing?: boolean; }
export function reorder<T>(items: T[], from: number, to: number): T[] { if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items; const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }
export function rotateQueue(deck: Deck): Deck { if (deck.looping || deck.tracks.length < 2 || !deck.currentId) return deck; const index = deck.tracks.findIndex(track => track.id === deck.currentId); if (index < 0) return deck; const tracks = [...deck.tracks]; const [current] = tracks.splice(index, 1); tracks.push(current); return { ...deck, tracks, currentId: tracks[0].id, positionMs: 0, status: "playing" }; }
export function isDuplicatePath(tracks: Track[], path: string): boolean { const normalized = path.replaceAll("/", "\\").toLocaleLowerCase(); return tracks.some(track => track.path.replaceAll("/", "\\").toLocaleLowerCase() === normalized); }
