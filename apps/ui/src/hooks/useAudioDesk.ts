import { useCallback, useEffect, useRef, useState } from "react";
import { isDuplicatePath, reorder, rotateQueue } from "@djmesrc/domain";
import type { Deck, DeckId, SoundEffect, Track } from "@djmesrc/domain";
import { isTauri } from "@tauri-apps/api/core";
import { audio, chooseAudioFile, chooseAudioFiles } from "../lib/audio";
import type { ActiveSoundEffect, AudioMeter } from "../lib/audio";

const savedKey = "djmesrc-session";
const blankDeck = (id: DeckId): Deck => ({ id, tracks: [], currentId: null, status: "stopped", positionMs: 0, volume: 0.72, muted: false, looping: false });
const nameFromPath = (path: string) => (path.split(/[\\/]/).pop() ?? path).replace(/\.[^.]+$/, "").toUpperCase();
const messageFor = (error: unknown) => error instanceof Error ? error.message : String(error);
const isAudioOutputError = (error: unknown) => /audio output is unavailable|no default audio|audio device.*(?:unavailable|not found)|failed to open.*audio/i.test(messageFor(error));
const initialMeters: Record<DeckId, AudioMeter> = {
  left: { positionMs: 0, peak: 0, clipping: false },
  right: { positionMs: 0, peak: 0, clipping: false },
};

export function useAudioDesk(onTutorialAction: (action: string) => void) {
  const [decks, setDecks] = useState<[Deck, Deck]>([blankDeck("left"), blankDeck("right")]);
  const [effects, setEffects] = useState<SoundEffect[]>([]);
  const [crossfade, setCrossfade] = useState(50);
  const [meters, setMeters] = useState(initialMeters);
  const [activeSfx, setActiveSfx] = useState<Record<string, ActiveSoundEffect>>({});
  const [notice, setNotice] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const decksRef = useRef(decks);
  const effectsRef = useRef(effects);
  const fadeTimers = useRef(new Map<DeckId, { timer: number; action: "PAUSE" | "STOP" }>());
  const trackSelectionGeneration = useRef(new Map<DeckId, number>());
  const finishingDecks = useRef(new Set<DeckId>());
  const advanceRef = useRef<(id: DeckId) => Promise<void>>(async () => undefined);
  decksRef.current = decks;
  effectsRef.current = effects;

  const notify = useCallback((message: string) => setNotice(message), []);
  const patchDeck = useCallback((id: DeckId, changes: Partial<Deck>) => {
    setDecks(previous => previous.map(deck => deck.id === id ? { ...deck, ...changes } : deck) as [Deck, Deck]);
  }, []);
  const updateDeck = useCallback((id: DeckId, next: Deck) => {
    setDecks(previous => previous.map(deck => deck.id === id ? next : deck) as [Deck, Deck]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      let saved: { decks?: Deck[]; effects?: SoundEffect[]; crossfade?: number } = {};
      try {
        const raw = localStorage.getItem(savedKey);
        if (raw) saved = JSON.parse(raw);
      } catch {
        setNotice("SAVED SESSION COULD NOT BE READ · STARTING A NEW SESSION");
      }

      const nextCrossfade = Number.isFinite(saved.crossfade) ? Math.max(0, Math.min(100, saved.crossfade!)) : 50;
      const desktop = isTauri();
      let audioOutputIssue = "";
      if (desktop) {
        try { await audio.status(); }
        catch (error) { audioOutputIssue = messageFor(error); }
        await audio.crossfade(nextCrossfade / 100).catch(() => undefined);
      }
      const audioAvailable = desktop && !audioOutputIssue;

      const decksToRestore = saved.decks?.length === 2 ? saved.decks : [blankDeck("left"), blankDeck("right")];
      const restoredDecks = await Promise.all(decksToRestore.map(async (storedDeck, index) => {
        const id: DeckId = index === 0 ? "left" : "right";
        let tracks = (storedDeck.tracks ?? []).map(track => ({ ...track }));
        let currentId = storedDeck.currentId ?? tracks[0]?.id ?? null;
        let status: Deck["status"] = "stopped";
        const deck: Deck = {
          ...blankDeck(id), ...storedDeck, id, tracks, currentId, status,
          positionMs: 0,
          volume: Number.isFinite(storedDeck.volume) ? Math.max(0, Math.min(1, storedDeck.volume)) : 0.72,
          muted: Boolean(storedDeck.muted),
          looping: Boolean(storedDeck.looping),
        };
        if (!desktop) return deck;

        tracks = await Promise.all(tracks.map(async track => {
          try {
            const durationMs = await audio.duration(track.path);
            return { ...track, durationMs: durationMs || track.durationMs, missing: false };
          } catch {
            return { ...track, missing: true };
          }
        }));
        const current = tracks.find(track => track.id === currentId);
        if (audioAvailable && current && !current.missing) {
          try {
            await audio.load(id, current.path);
            await audio.volume(id, deck.muted ? 0 : deck.volume);
            await audio.loop(id, deck.looping);
          } catch {
            tracks = tracks.map(track => track.id === current.id ? { ...track, missing: true } : track);
            await audio.clear(id).catch(() => undefined);
          }
        }
        const missingCurrent = tracks.find(track => track.id === currentId)?.missing;
        status = currentId && missingCurrent ? "missing" : "stopped";
        return { ...deck, tracks, currentId, status };
      })) as [Deck, Deck];

      const storedEffects = saved.effects ?? [];
      const restoredEffects = await Promise.all(storedEffects.map(async effect => {
        const restored: SoundEffect = { ...effect, volume: Number.isFinite(effect.volume) ? Math.max(0, Math.min(1, effect.volume)) : 0.8 };
        if (!desktop) return restored;
        try {
          const durationMs = await audio.duration(effect.path);
          if (audioAvailable) await audio.registerSfx(effect.id, effect.path, restored.volume);
          return { ...restored, durationMs: durationMs || effect.durationMs, missing: false };
        } catch {
          return { ...restored, missing: true };
        }
      }));

      if (cancelled) return;
      setDecks(restoredDecks);
      setEffects(restoredEffects);
      setCrossfade(nextCrossfade);
      if (audioOutputIssue) {
        setNotice(`AUDIO OUTPUT UNAVAILABLE · ${audioOutputIssue.slice(0, 120)}`);
      } else if (restoredDecks.some(deck => deck.tracks.some(track => track.missing)) || restoredEffects.some(effect => effect.missing)) {
        setNotice("MISSING AUDIO FILES FOUND · USE LOCATE TO RELINK THEM");
      } else if (!desktop && (restoredDecks.some(deck => deck.tracks.length) || restoredEffects.length)) {
        setNotice("SESSION RESTORED · USE THE DJMESRC DESKTOP APP FOR AUDIO");
      }
      setSessionLoaded(true);
    };
    void restore().catch(error => {
      setNotice(`SESSION RESTORE FAILED: ${messageFor(error).slice(0, 100)}`);
      setSessionLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (sessionLoaded) localStorage.setItem(savedKey, JSON.stringify({ decks, effects, crossfade }));
  }, [decks, effects, crossfade, sessionLoaded]);

  useEffect(() => {
    if (!sessionLoaded || !isTauri()) return;
    let stopped = false;
    let polling = false;
    const timer = window.setInterval(async () => {
      if (polling || stopped) return;
      polling = true;
      try {
        const [left, right, active] = await Promise.all([audio.meter("left"), audio.meter("right"), audio.activeSfx()]);
        if (!stopped) {
          setMeters(previous => {
            const next = { left, right };
            const changed = (["left", "right"] as const).some(id => Math.abs(next[id].positionMs - previous[id].positionMs) >= 50 || Math.abs(next[id].peak - previous[id].peak) >= 0.025 || next[id].clipping !== previous[id].clipping);
            return changed ? next : previous;
          });
          setActiveSfx(Object.fromEntries(active.map(item => [item.id, item])));
        }
      } catch {
        // Audio commands report their own actionable errors at the control that failed.
      } finally {
        polling = false;
      }
    }, 110);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [sessionLoaded]);

  useEffect(() => {
    if (!sessionLoaded || !isTauri()) return;
    const timer = window.setInterval(() => {
      for (const deck of decksRef.current) {
        if (deck.status !== "playing" || finishingDecks.current.has(deck.id)) continue;
        finishingDecks.current.add(deck.id);
        void audio.finished(deck.id)
          .then(finished => finished ? advanceRef.current(deck.id) : undefined)
          .catch(error => setNotice(`PLAYBACK ERROR: ${messageFor(error).slice(0, 80)}`))
          .finally(() => finishingDecks.current.delete(deck.id));
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [sessionLoaded]);

  advanceRef.current = async id => {
    const latest = decksRef.current.find(deck => deck.id === id);
    if (!latest || latest.status !== "playing") return;
    if (latest.looping || latest.tracks.length < 2) {
      patchDeck(id, { status: "stopped", positionMs: 0 });
      return;
    }
    let candidate = rotateQueue(latest);
    for (let attempt = 0; attempt < latest.tracks.length; attempt += 1) {
      const track = candidate.tracks.find(item => item.id === candidate.currentId);
      if (!track) break;
      if (track.missing) {
        candidate = rotateQueue(candidate);
        continue;
      }
      try {
        await audio.load(id, track.path);
        await audio.volume(id, candidate.muted ? 0 : candidate.volume);
        await audio.loop(id, candidate.looping);
        await audio.control(id, "PLAY");
        updateDeck(id, { ...candidate, status: "playing", positionMs: 0 });
        onTutorialAction("queue:advance");
        return;
      } catch {
        const failedTracks = candidate.tracks.map(item => item.id === track.id ? { ...item, missing: true } : item);
        candidate = rotateQueue({ ...candidate, tracks: failedTracks });
        setNotice(`${track.name} IS MISSING OR UNSUPPORTED · USE LOCATE FILE`);
      }
    }
    const current = candidate.tracks.find(track => track.id === candidate.currentId);
    updateDeck(id, { ...candidate, status: current?.missing ? "missing" : "stopped", positionMs: 0 });
  };

  const importTracks = useCallback(async (id: DeckId, suppliedPaths?: string[]) => {
    let paths: string[];
    try {
      paths = suppliedPaths ?? await chooseAudioFiles();
    } catch (error) {
      setNotice(`COULD NOT OPEN THE TRACK PICKER: ${messageFor(error)}`);
      return;
    }
    if (!paths.length) return;
    const deck = decksRef.current.find(item => item.id === id)!;
    const added: Track[] = [];
    const failures: string[] = [];
    let duplicates = 0;
    for (const path of paths) {
      if (isDuplicatePath([...deck.tracks, ...added], path)) { duplicates += 1; continue; }
      try {
        added.push({ id: crypto.randomUUID(), name: nameFromPath(path), path, durationMs: await audio.duration(path), missing: false });
      } catch (error) {
        failures.push(`${nameFromPath(path)}: ${messageFor(error)}`);
      }
    }
    let tracks = [...deck.tracks, ...added];
    let currentId = deck.currentId;
    let status = deck.status;
    if (!currentId && added.length) {
      currentId = added[0].id;
      try {
        await audio.load(id, added[0].path);
        await audio.volume(id, deck.muted ? 0 : deck.volume);
        await audio.loop(id, deck.looping);
        status = "stopped";
      } catch (error) {
        await audio.clear(id).catch(() => undefined);
        if (isAudioOutputError(error)) {
          status = "stopped";
          failures.push(`AUDIO OUTPUT UNAVAILABLE: ${messageFor(error)}`);
        } else {
          tracks = tracks.map(track => track.id === currentId ? { ...track, missing: true } : track);
          status = "missing";
          failures.push(`${added[0].name}: ${messageFor(error)}`);
        }
      }
    }
    updateDeck(id, { ...deck, tracks, currentId, status });
    if (added.length) onTutorialAction(`music:${id}`);
    const summary = `${added.length} TRACK${added.length === 1 ? "" : "S"} ADDED${duplicates ? ` · ${duplicates} DUPLICATE${duplicates === 1 ? "" : "S"} IGNORED` : ""}${failures.length ? ` · ${failures.length} FAILED: ${failures.join("; ")}` : ""}`;
    setNotice(summary.slice(0, 240));
  }, [onTutorialAction, updateDeck]);

  const importEffects = useCallback(async (suppliedPaths?: string[]) => {
    let paths: string[];
    try {
      paths = suppliedPaths ?? await chooseAudioFiles();
    } catch (error) {
      setNotice(`COULD NOT OPEN THE SOUND EFFECT PICKER: ${messageFor(error)}`);
      return;
    }
    if (!paths.length) return;
    const added: SoundEffect[] = [];
    const failures: string[] = [];
    for (const path of paths) {
      const effect: SoundEffect = { id: crypto.randomUUID(), name: nameFromPath(path), path, durationMs: 0, volume: 0.8, color: "#bd4f79", missing: false };
      try {
        effect.durationMs = await audio.duration(path);
        await audio.registerSfx(effect.id, path, effect.volume);
        added.push(effect);
      } catch (error) {
        failures.push(`${effect.name}: ${messageFor(error)}`);
      }
    }
    if (added.length) {
      setEffects(previous => [...previous, ...added]);
      onTutorialAction("sfx:add");
    }
    setNotice(`${added.length} SOUND EFFECT${added.length === 1 ? "" : "S"} ADDED${failures.length ? ` · ${failures.length} FAILED: ${failures.join("; ")}` : ""}`.slice(0, 240));
  }, [onTutorialAction]);

  const selectTrack = useCallback(async (deckId: DeckId, trackId: string) => {
    const deck = decksRef.current.find(item => item.id === deckId)!;
    const track = deck.tracks.find(item => item.id === trackId);
    if (!track) return;
    if (track.missing) {
      setNotice("THIS TRACK IS MISSING · USE LOCATE FILE BEFORE PLAYING");
      return;
    }

    const generation = (trackSelectionGeneration.current.get(deckId) ?? 0) + 1;
    trackSelectionGeneration.current.set(deckId, generation);
    const isCurrentSelection = () => trackSelectionGeneration.current.get(deckId) === generation;
    const activeFade = fadeTimers.current.get(deckId);
    if (activeFade) {
      window.clearInterval(activeFade.timer);
      fadeTimers.current.delete(deckId);
      await audio.fadeGain(deckId, 1).catch(() => undefined);
    }

    if (trackId === deck.currentId) {
      if (deck.status === "playing") return;
      try {
        await audio.fadeGain(deckId, 1).catch(() => undefined);
        await audio.control(deckId, "PLAY");
        if (!isCurrentSelection()) return;
        patchDeck(deckId, { status: "playing" });
        setNotice(`${deckId.toUpperCase()} DECK PLAYING`);
        onTutorialAction("transport:PLAY");
        onTutorialAction("queue:play_now");
      } catch (error) {
        setNotice(isAudioOutputError(error)
          ? `AUDIO OUTPUT UNAVAILABLE · CHECK YOUR WINDOWS SOUND OUTPUT · ${messageFor(error).slice(0, 65)}`
          : `PLAYBACK ERROR · ${messageFor(error).slice(0, 90)}`);
      }
      return;
    }

    try {
      await audio.load(deckId, track.path);
      if (!isCurrentSelection()) return;
      const latestBeforePlayback = decksRef.current.find(item => item.id === deckId)!;
      await audio.volume(deckId, latestBeforePlayback.muted ? 0 : latestBeforePlayback.volume);
      await audio.loop(deckId, latestBeforePlayback.looping);
      await audio.fadeGain(deckId, 1);
      if (!isCurrentSelection()) return;
      await audio.control(deckId, "PLAY");
      if (!isCurrentSelection()) return;
      const latest = decksRef.current.find(item => item.id === deckId)!;
      const tracks = [track, ...latest.tracks.filter(item => item.id !== trackId)];
      updateDeck(deckId, { ...latest, tracks: tracks.map(item => item.id === trackId ? { ...item, missing: false } : item), currentId: trackId, status: "playing", positionMs: 0 });
      setNotice(`${track.name} PLAYING NOW`);
      onTutorialAction("queue:play_now");
    } catch (error) {
      if (!isCurrentSelection()) return;
      if (isAudioOutputError(error)) {
        setNotice(`AUDIO OUTPUT UNAVAILABLE · CHECK YOUR WINDOWS SOUND OUTPUT · ${messageFor(error).slice(0, 65)}`);
        return;
      }
      const latest = decksRef.current.find(item => item.id === deckId)!;
      updateDeck(deckId, { ...latest, tracks: latest.tracks.map(item => item.id === trackId ? { ...item, missing: true } : item) });
      setNotice(`${track.name} COULD NOT BE LOADED · THE CURRENT TRACK KEEPS PLAYING · USE LOCATE FILE · ${messageFor(error).slice(0, 55)}`);
    }
  }, [onTutorialAction, patchDeck, updateDeck]);

  const locateTrack = useCallback(async (deckId: DeckId, target: Track) => {
    const path = await chooseAudioFile();
    if (!path) return;
    try {
      const durationMs = await audio.duration(path);
      const deck = decksRef.current.find(item => item.id === deckId)!;
      if (deck.currentId === target.id) {
        await audio.load(deckId, path);
        await audio.volume(deckId, deck.muted ? 0 : deck.volume);
        await audio.loop(deckId, deck.looping);
      }
      const tracks = deck.tracks.map(track => track.id === target.id ? { ...track, path, durationMs, missing: false } : track);
      updateDeck(deckId, { ...deck, tracks, status: deck.currentId === target.id ? "stopped" : deck.status, positionMs: deck.currentId === target.id ? 0 : deck.positionMs });
      setNotice(`${target.name} RELINKED`);
    } catch (error) {
      setNotice(`${nameFromPath(path)} COULD NOT BE USED · CHOOSE A VALID AUDIO FILE · ${messageFor(error).slice(0, 60)}`);
    }
  }, [updateDeck]);

  const locateEffect = useCallback(async (target: SoundEffect) => {
    const path = await chooseAudioFile();
    if (!path) return;
    try {
      const durationMs = await audio.duration(path);
      await audio.registerSfx(target.id, path, target.volume);
      setEffects(previous => previous.map(effect => effect.id === target.id ? { ...effect, path, durationMs, missing: false } : effect));
      setNotice(`${target.name} RELINKED`);
    } catch (error) {
      setNotice(`${nameFromPath(path)} COULD NOT BE USED · CHOOSE A VALID AUDIO FILE · ${messageFor(error).slice(0, 60)}`);
    }
  }, []);

  const control = useCallback(async (deckId: DeckId, action: "PLAY" | "PAUSE" | "STOP" | "RESTART") => {
    const deck = decksRef.current.find(item => item.id === deckId)!;
    const existingFade = fadeTimers.current.get(deckId);
    trackSelectionGeneration.current.set(deckId, (trackSelectionGeneration.current.get(deckId) ?? 0) + 1);
    if (!deck.currentId) {
      setNotice("NO TRACK SELECTED · ADD MUSIC TO THIS DECK TO GET STARTED");
      return;
    }
    if (deck.status === "missing" && action !== "STOP") {
      setNotice("THIS TRACK IS MISSING · USE LOCATE FILE BEFORE PLAYING");
      return;
    }
    if (existingFade) {
      if (action === "PLAY" || action === "RESTART") {
        window.clearInterval(existingFade.timer);
        fadeTimers.current.delete(deckId);
        await audio.fadeGain(deckId, 1).catch(() => undefined);
      } else if (action === "PAUSE" || action === "STOP") {
        existingFade.action = action;
        setNotice(`${action === "PAUSE" ? "PAUSE" : "STOP"} WILL START AFTER THE FADE`);
        return;
      }
    }

    if (deck.status === "fading" && !existingFade) await audio.fadeGain(deckId, 1).catch(() => undefined);

    if ((action === "PAUSE" || action === "STOP") && deck.status === "playing") {
      const startedAt = Date.now();
      setNotice(`FADING OUT BEFORE ${action} · PRESS PLAY TO CANCEL`);
      patchDeck(deckId, { status: "fading" });
      const timer = window.setInterval(() => {
        const fade = fadeTimers.current.get(deckId);
        if (!fade || fade.timer !== timer) return;
        const current = decksRef.current.find(item => item.id === deckId);
        if (!current) return;
        const progress = Math.min(1, (Date.now() - startedAt) / 2000);
        void audio.fadeGain(deckId, 1 - progress).catch(error => setNotice(`FADE FAILED · ${messageFor(error).slice(0, 70)}`));
        if (progress < 1) return;

        window.clearInterval(timer);
        fadeTimers.current.delete(deckId);
        const finalAction = fade.action;
        void (async () => {
          try {
            await audio.fadeGain(deckId, 0);
            await audio.control(deckId, finalAction);
            const positionMs = finalAction === "PAUSE" ? (await audio.meter(deckId)).positionMs : 0;
            await audio.fadeGain(deckId, 1);
            patchDeck(deckId, { status: finalAction === "PAUSE" ? "paused" : "stopped", positionMs });
            onTutorialAction(`transport:${finalAction}`);
            setNotice(finalAction === "PAUSE" ? "DECK PAUSED · POSITION SAVED" : "DECK STOPPED · POSITION RESET TO 00:00");
          } catch (error) {
            await audio.fadeGain(deckId, 1).catch(() => undefined);
            patchDeck(deckId, { status: "playing" });
            setNotice(`${finalAction} FAILED · ${messageFor(error).slice(0, 70)}`);
          }
        })();
      }, 30);
      fadeTimers.current.set(deckId, { timer, action });
      return;
    }
    try {
      if (action === "PLAY" || action === "RESTART") await audio.fadeGain(deckId, 1).catch(() => undefined);
      await audio.control(deckId, action);
      const status = action === "PLAY" || action === "RESTART" ? "playing" : action === "PAUSE" ? "paused" : "stopped";
      const positionMs = action === "STOP" || action === "RESTART" ? 0 : action === "PAUSE" ? (await audio.meter(deckId)).positionMs : deck.positionMs;
      if (action === "STOP") await audio.fadeGain(deckId, 1).catch(() => undefined);
      patchDeck(deckId, { status, positionMs });
      onTutorialAction(`transport:${action}`);
      setNotice(`${deckId.toUpperCase()} DECK ${action === "PLAY" ? "PLAYING" : action === "PAUSE" ? "PAUSED" : action === "STOP" ? "STOPPED" : "RESTARTED"}`);
    } catch (error) {
      setNotice(isAudioOutputError(error)
        ? `AUDIO OUTPUT UNAVAILABLE · CHECK YOUR WINDOWS SOUND OUTPUT · ${messageFor(error).slice(0, 65)}`
        : `PLAYBACK ERROR · ${messageFor(error).slice(0, 90)}`);
    }
  }, [onTutorialAction, patchDeck]);

  const setVolume = useCallback((deckId: DeckId, volume: number) => {
    const deck = decksRef.current.find(item => item.id === deckId)!;
    patchDeck(deckId, { volume });
    void audio.volume(deckId, deck.muted ? 0 : volume);
    onTutorialAction(`volume:${deckId}`);
  }, [onTutorialAction, patchDeck]);

  const setMute = useCallback((deckId: DeckId, muted: boolean) => {
    const deck = decksRef.current.find(item => item.id === deckId)!;
    patchDeck(deckId, { muted });
    void audio.volume(deckId, muted ? 0 : deck.volume);
    onTutorialAction(`mute:${deckId}`);
    setNotice(muted ? `${deckId.toUpperCase()} DECK MUTED` : `${deckId.toUpperCase()} DECK UNMUTED`);
  }, [onTutorialAction, patchDeck]);

  const setLoop = useCallback((deckId: DeckId, enabled: boolean) => {
    patchDeck(deckId, { looping: enabled });
    void audio.loop(deckId, enabled);
    onTutorialAction(enabled ? "loop:on" : "loop:off");
  }, [onTutorialAction, patchDeck]);

  const seek = useCallback(async (deckId: DeckId, positionMs: number) => {
    try {
      await audio.seek(deckId, Math.max(0, Math.floor(positionMs)));
      patchDeck(deckId, { positionMs });
    } catch (error) {
      setNotice(`SEEK FAILED · ${messageFor(error).slice(0, 80)}`);
    }
  }, [patchDeck]);

  const removeTrack = useCallback(async (deckId: DeckId, trackId: string) => {
    const deck = decksRef.current.find(item => item.id === deckId)!;
    const track = deck.tracks.find(item => item.id === trackId);
    if (!track) return;
    if (deck.currentId !== trackId) {
      patchDeck(deckId, { tracks: deck.tracks.filter(item => item.id !== trackId) });
      setNotice(`${track.name} REMOVED FROM QUEUE`);
      onTutorialAction("queue:remove");
      return;
    }

    const remaining = deck.tracks.filter(item => item.id !== trackId);
    const nextTrack = remaining[0];
    const shouldFade = deck.status === "playing" || deck.status === "fading";
    const shouldResume = deck.status === "playing" || (deck.status === "fading" && !fadeTimers.current.has(deckId));
    const generation = (trackSelectionGeneration.current.get(deckId) ?? 0) + 1;
    trackSelectionGeneration.current.set(deckId, generation);
    const isCurrentRemoval = () => trackSelectionGeneration.current.get(deckId) === generation;

    const activeFade = fadeTimers.current.get(deckId);
    if (activeFade) {
      window.clearInterval(activeFade.timer);
      fadeTimers.current.delete(deckId);
    }

    if (shouldFade) {
      patchDeck(deckId, { status: "fading" });
      setNotice(`FADING OUT ${track.name} BEFORE REMOVING IT`);
      const startedAt = Date.now();
      try {
        while (true) {
          if (!isCurrentRemoval()) return;
          const progress = Math.min(1, (Date.now() - startedAt) / 2000);
          await audio.fadeGain(deckId, 1 - progress);
          if (progress >= 1) break;
          await new Promise<void>(resolve => { window.setTimeout(resolve, 30); });
        }
        await audio.fadeGain(deckId, 0);
      } catch (error) {
        if (isCurrentRemoval()) {
          await audio.fadeGain(deckId, 1).catch(() => undefined);
          patchDeck(deckId, { status: "playing" });
          setNotice(`COULD NOT FADE ${track.name} OUT · ${messageFor(error).slice(0, 80)}`);
        }
        return;
      }
      if (!isCurrentRemoval()) return;
    }

    if (!nextTrack) {
      await audio.clear(deckId).catch(() => undefined);
      patchDeck(deckId, { tracks: remaining, currentId: null, status: "stopped", positionMs: 0 });
      setNotice(`${track.name} REMOVED · QUEUE IS EMPTY`);
      onTutorialAction("queue:remove");
      return;
    }

    if (nextTrack.missing) {
      await audio.clear(deckId).catch(() => undefined);
      patchDeck(deckId, { tracks: remaining, currentId: nextTrack.id, status: "missing", positionMs: 0 });
      setNotice(`${track.name} REMOVED · ${nextTrack.name} IS MISSING · USE LOCATE FILE`);
      onTutorialAction("queue:remove");
      return;
    }

    try {
      await audio.load(deckId, nextTrack.path);
      if (!isCurrentRemoval()) return;
      const latest = decksRef.current.find(item => item.id === deckId)!;
      await audio.volume(deckId, latest.muted ? 0 : latest.volume);
      await audio.loop(deckId, latest.looping);
      await audio.fadeGain(deckId, 1);
      if (shouldResume) await audio.control(deckId, "PLAY");
      if (!isCurrentRemoval()) return;
      patchDeck(deckId, { tracks: remaining, currentId: nextTrack.id, status: shouldResume ? "playing" : "stopped", positionMs: 0 });
      setNotice(`${track.name} REMOVED · ${nextTrack.name} ${shouldResume ? "IS PLAYING" : "IS READY"}`);
    } catch (error) {
      if (!isCurrentRemoval()) return;
      await audio.clear(deckId).catch(() => undefined);
      const outputUnavailable = isAudioOutputError(error);
      const remainingWithStatus = remaining.map(item => item.id === nextTrack.id ? { ...item, missing: !outputUnavailable } : item);
      patchDeck(deckId, { tracks: remainingWithStatus, currentId: nextTrack.id, status: outputUnavailable ? "stopped" : "missing", positionMs: 0 });
      setNotice(outputUnavailable
        ? `AUDIO OUTPUT UNAVAILABLE · ${track.name} REMOVED · CHECK YOUR WINDOWS SOUND OUTPUT`
        : `${track.name} REMOVED · ${nextTrack.name} COULD NOT BE LOADED · USE LOCATE FILE`);
    }
    onTutorialAction("queue:remove");
  }, [onTutorialAction, patchDeck]);

  const moveTrack = useCallback((deckId: DeckId, from: number, to: number) => {
    if (from === to) return;
    const deck = decksRef.current.find(item => item.id === deckId)!;
    const fixed = deck.currentId ? deck.tracks.filter(track => track.id === deck.currentId) : [];
    const queue = deck.tracks.filter(track => track.id !== deck.currentId);
    const offset = deck.currentId ? 1 : 0;
    const moved = reorder(queue, Math.max(0, from - offset), Math.max(0, to - offset));
    updateDeck(deckId, { ...deck, tracks: [...fixed, ...moved] });
    onTutorialAction("queue:reorder");
  }, [onTutorialAction, updateDeck]);

  const playNow = useCallback((deckId: DeckId, trackId: string) => selectTrack(deckId, trackId), [selectTrack]);

  const triggerSfx = useCallback(async (id: string) => {
    const effect = effectsRef.current.find(item => item.id === id);
    if (!effect || effect.missing) {
      setNotice("SOUND EFFECT FILE IS MISSING · USE LOCATE");
      return;
    }
    try {
      await audio.playSfx(id);
      setNotice(`${effect.name} PLAYING · MUSIC DUCKED`);
      onTutorialAction("sfx:play");
    } catch (error) {
      setNotice(`${effect.name} COULD NOT PLAY · ${messageFor(error).slice(0, 80)}`);
    }
  }, [onTutorialAction]);

  const stopSfx = useCallback(() => {
    void audio.stopSfx();
    setNotice("ALL SOUND EFFECTS STOPPED · MUSIC RESTORED");
  }, []);

  const setSfxVolume = useCallback((id: string, volume: number) => {
    setEffects(previous => previous.map(effect => effect.id === id ? { ...effect, volume } : effect));
    void audio.setSfxVolume(id, volume).catch(error => setNotice(`SOUND EFFECT VOLUME FAILED · ${messageFor(error).slice(0, 60)}`));
  }, []);

  const setSfxName = useCallback((id: string, name: string) => {
    setEffects(previous => previous.map(effect => effect.id === id ? { ...effect, name: name.slice(0, 48) } : effect));
  }, []);

  const setSfxColor = useCallback((id: string, color: string) => {
    setEffects(previous => previous.map(effect => effect.id === id ? { ...effect, color } : effect));
  }, []);

  const removeSfx = useCallback((effect: SoundEffect) => {
    audio.removeSfx(effect.id);
    setEffects(previous => previous.filter(item => item.id !== effect.id));
    setNotice(`${effect.name} REMOVED`);
  }, []);

  const setCrossfader = useCallback((value: number) => {
    const next = Math.max(0, Math.min(100, value));
    setCrossfade(next);
    void audio.crossfade(next / 100);
  }, []);

  useEffect(() => () => {
    for (const fade of fadeTimers.current.values()) window.clearInterval(fade.timer);
  }, []);

  return {
    decks, effects, crossfade, meters, activeSfx, notice, sessionLoaded,
    notify, updateDeck, importTracks, importEffects, selectTrack, locateTrack,
    locateEffect, control, setVolume, setMute, setLoop, seek, removeTrack,
    moveTrack, playNow, triggerSfx, stopSfx, setSfxVolume, setSfxName,
    setSfxColor, removeSfx, setCrossfader,
  };
}
