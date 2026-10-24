import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { CirclePlay, LocateFixed, Pencil, Play, Trash2 } from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isTauri } from "@tauri-apps/api/core";
import type { DeckId, SoundEffect, Track } from "@djmesrc/domain";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DeckPanel } from "./components/DeckPanel";
import { ContextMenu } from "./components/ContextMenu";
import type { ContextMenuAction } from "./components/ContextMenu";
import { KeybindToolbar } from "./components/KeybindToolbar";
import { MixerStrip } from "./components/MixerStrip";
import { Soundboard } from "./components/Soundboard";
import { TooltipProvider } from "./components/ui/tooltip";
import { Tutorial } from "./components/Tutorial";
import { useAudioDesk } from "./hooks/useAudioDesk";
import { useKeybinds } from "./hooks/useKeybinds";

const blankActions = () => new Set<string>();

type ActiveContextMenu = {
  x: number;
  y: number;
  label: string;
  actions: ContextMenuAction[];
  returnFocus: HTMLElement | null;
};

type PendingConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function App() {
  const [tutorialChoice, setTutorialChoice] = useState<"start" | "skip" | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialActions, setTutorialActions] = useState<Set<string>>(blankActions);
  const [editingEffect, setEditingEffect] = useState<string | null>(null);
  const [editingEffectName, setEditingEffectName] = useState("");
  const [noticeToast, setNoticeToast] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ActiveContextMenu | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const keyActionRef = useRef<(action: string) => void>(() => undefined);
  const recordTutorialAction = useCallback((action: string) => {
    setTutorialActions(previous => new Set(previous).add(action));
  }, []);
  const desk = useAudioDesk(recordTutorialAction);
  useEffect(() => {
    if (!desk.notice || desk.notice === "READY FOR YOUR EVENT") { setNoticeToast(null); return; }
    setNoticeToast(desk.notice);
    const timer = window.setTimeout(() => setNoticeToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [desk.notice]);
  const reportKeybindNotice = useCallback((message: string) => {
    desk.notify(message);
    if (message.includes("ASSIGNED TO")) recordTutorialAction("keybind:assign");
  }, [desk.notify, recordTutorialAction]);
  const describeAction = useCallback((action: string) => {
    const [kind, target, itemId, operation] = action.split(":");
    if (kind === "DECK") return `${target?.toUpperCase()} DECK ${itemId?.replaceAll("_", " ")}`;
    if (kind === "TRACK") {
      const track = desk.decks.find(deck => deck.id === target)?.tracks.find(item => item.id === itemId);
      return `${track?.name ?? "TRACK"} ${operation === "SELECT" ? "PLAY NOW" : operation?.replaceAll("_", " ") ?? "PLAY NOW"}`;
    }
    if (kind === "SFX") {
      if (target === "ADD") return "ADD SOUND EFFECT";
      if (target === "STOP_ALL") return "STOP ALL SOUND EFFECTS";
      const effect = desk.effects.find(item => item.id === target);
      return `${effect?.name ?? "SOUND EFFECT"} ${itemId?.replaceAll("_", " ") ?? "PLAY"}`;
    }
    return action.replaceAll(":", " / ").replaceAll("_", " ");
  }, [desk.decks, desk.effects]);
  const keybinds = useKeybinds(action => keyActionRef.current(action), reportKeybindNotice, describeAction);

  useEffect(() => {
    const preventBrowserMenu = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input:not([type="range"]):not([type="color"]), textarea, [contenteditable="true"]')) return;
      event.preventDefault();
    };
    document.addEventListener("contextmenu", preventBrowserMenu, true);
    return () => document.removeEventListener("contextmenu", preventBrowserMenu, true);
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const showContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>, label: string, actions: ContextMenuAction[]) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    const candidate = target.closest<HTMLElement>("button");
    const trigger = candidate && !(candidate instanceof HTMLButtonElement && candidate.disabled) ? candidate : event.currentTarget;
    const bounds = trigger.getBoundingClientRect();
    const fromPointer = event.clientX !== 0 || event.clientY !== 0;
    setContextMenu({
      x: fromPointer ? event.clientX : bounds.left,
      y: fromPointer ? event.clientY : bounds.bottom,
      label,
      actions,
      returnFocus: trigger,
    });
  }, []);

  const requestTrackRemoval = useCallback((deckId: DeckId, trackId: string) => {
    const deck = desk.decks.find(item => item.id === deckId);
    const track = deck?.tracks.find(item => item.id === trackId);
    if (!deck || !track) return;
    const isCurrent = deck.currentId === trackId;
    const hasNext = deck.tracks.some(item => item.id !== trackId);
    const isPlaying = deck.status === "playing" || deck.status === "fading";
    const deckLabel = deckId === "left" ? "A" : "B";
    const message = isCurrent
      ? `Remove "${track.name}" from Deck ${deckLabel}? ${!hasNext ? "The deck will be cleared." : isPlaying ? "It will fade out, then the next track will play." : "The next track will be loaded and stay stopped."}`
      : `Remove "${track.name}" from Deck ${deckLabel}'s queue?`;
    setPendingConfirmation({
      title: isCurrent ? "REMOVE CURRENT TRACK?" : "REMOVE FROM QUEUE?",
      message,
      confirmLabel: "REMOVE TRACK",
      onConfirm: () => void desk.removeTrack(deckId, trackId),
    });
  }, [desk.decks, desk.removeTrack]);

  const requestEffectRemoval = useCallback((effect: SoundEffect) => {
    setPendingConfirmation({
      title: "REMOVE SOUND EFFECT?",
      message: `Remove "${effect.name}" from the soundboard? The original audio file will stay on your computer.`,
      confirmLabel: "REMOVE SOUND",
      onConfirm: () => desk.removeSfx(effect),
    });
  }, [desk.removeSfx]);

  const showTrackContextMenu = (deckId: DeckId, event: ReactMouseEvent<HTMLElement>, track: Track) => {
    const actions: ContextMenuAction[] = [];
    if (track.missing) {
      actions.push({ label: "LOCATE FILE", icon: <LocateFixed size={14} />, onSelect: () => void desk.locateTrack(deckId, track) });
    } else {
      actions.push({ label: "PLAY NOW", icon: <CirclePlay size={14} />, onSelect: () => desk.playNow(deckId, track.id) });
    }
    actions.push({ label: "REMOVE FROM QUEUE", icon: <Trash2 size={14} />, destructive: true, onSelect: () => requestTrackRemoval(deckId, track.id) });
    showContextMenu(event, `${track.name} actions`, actions);
  };

  const showEffectContextMenu = (event: ReactMouseEvent<HTMLElement>, effect: SoundEffect) => {
    const actions: ContextMenuAction[] = [];
    if (effect.missing) {
      actions.push({ label: "LOCATE FILE", icon: <LocateFixed size={14} />, onSelect: () => void desk.locateEffect(effect) });
    } else {
      actions.push({ label: "PLAY SOUND", icon: <Play size={14} />, onSelect: () => void desk.triggerSfx(effect.id) });
      actions.push({ label: "EDIT NAME", icon: <Pencil size={14} />, onSelect: () => {
        setEditingEffect(effect.id);
        setEditingEffectName(effect.name);
      } });
    }
    actions.push({ label: "REMOVE SOUND", icon: <Trash2 size={14} />, destructive: true, onSelect: () => requestEffectRemoval(effect) });
    showContextMenu(event, `${effect.name} actions`, actions);
  };

  useEffect(() => {
    if (!desk.sessionLoaded) return;
    const choice = localStorage.getItem("djmesrc-onboarding-choice");
    if (!choice) setTutorialVisible(true);
    else if (choice === "start" && localStorage.getItem("djmesrc-tutorial-complete") !== "true") {
      setTutorialChoice("start");
      setTutorialVisible(true);
    }
  }, [desk.sessionLoaded]);

  useEffect(() => {
    if (!keybinds.pending) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-keybind-action]"));
    const target = targets.find(element => element.dataset.keybindAction === keybinds.pending);
    target?.classList.add("learning-control");
    return () => target?.classList.remove("learning-control");
  }, [keybinds.pending]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview().onDragDropEvent(event => {
      if (event.payload.type !== "drop") return;
      const scale = window.devicePixelRatio || 1;
      const target = document.elementFromPoint(event.payload.position.x / scale, event.payload.position.y / scale);
      if (target?.closest("[data-drop-sfx]")) {
        void desk.importEffects(event.payload.paths);
        return;
      }
      const deckElement = target?.closest<HTMLElement>("[data-drop-deck]");
      const deckId = deckElement?.dataset.dropDeck;
      if (deckId === "left" || deckId === "right") void desk.importTracks(deckId, event.payload.paths);
    }).then(stop => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch(error => desk.notify(`FILE DROP UNAVAILABLE / ${String(error).slice(0, 70)}`));
    return () => { disposed = true; unlisten?.(); };
  }, [desk.importEffects, desk.importTracks, desk.notify]);

  const handleLearnClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!keybinds.enabled) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-keybind-action]");
    if (!target || target.dataset.keybindIgnore === "true") return;
    const action = target.dataset.keybindAction;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    keybinds.learn(action);
  };

  const handleAction = (action: string) => {
    const [kind, target, itemId, operation] = action.split(":");
    if (kind === "HELP" && target === "TUTORIAL") {
      setTutorialChoice("start");
      setTutorialActions(blankActions());
      setTutorialVisible(true);
      return;
    }
    if (kind === "CROSSFADER" && target === "RESET") {
      desk.setCrossfader(50);
      return;
    }
    if (kind === "DECK" && (target === "left" || target === "right")) {
      const deck = desk.decks.find(item => item.id === target)!;
      if (["PLAY", "PAUSE", "STOP", "RESTART"].includes(itemId)) {
        void desk.control(target as DeckId, itemId as "PLAY" | "PAUSE" | "STOP" | "RESTART");
      } else if (itemId === "LOOP") desk.setLoop(deck.id, !deck.looping);
      else if (itemId === "MUTE") desk.setMute(deck.id, !deck.muted);
      else if (itemId === "VOLUME_UP") desk.setVolume(deck.id, Math.min(1, deck.volume + 0.05));
      else if (itemId === "VOLUME_DOWN") desk.setVolume(deck.id, Math.max(0, deck.volume - 0.05));
      else if (itemId === "ADD_MUSIC") void desk.importTracks(deck.id);
      return;
    }
    if (kind === "TRACK" && (target === "left" || target === "right") && itemId) {
      const track = desk.decks.find(deck => deck.id === target)?.tracks.find(item => item.id === itemId);
      if (operation === "SELECT") void desk.selectTrack(target as DeckId, itemId);
      else if (operation === "PLAY_NOW") desk.playNow(target as DeckId, itemId);
      else if (operation === "REMOVE") requestTrackRemoval(target as DeckId, itemId);
      else if (operation === "LOCATE" && track) void desk.locateTrack(target as DeckId, track);
      else if ((operation === "MOVE_UP" || operation === "MOVE_DOWN") && track) {
        const index = desk.decks.find(deck => deck.id === target)!.tracks.findIndex(item => item.id === itemId);
        desk.moveTrack(target as DeckId, index, index + (operation === "MOVE_UP" ? -1 : 1));
      }
      return;
    }
    if (kind === "SFX") {
      if (target === "ADD") void desk.importEffects();
      else if (target === "STOP_ALL") desk.stopSfx();
      else if (itemId === "LOCATE") {
        const effect = desk.effects.find(item => item.id === target);
        if (effect) void desk.locateEffect(effect);
      } else if (itemId === "REMOVE") {
        const effect = desk.effects.find(item => item.id === target);
        if (effect) requestEffectRemoval(effect);
      } else if (itemId === "RENAME") setEditingEffect(target);
      else void desk.triggerSfx(target);
    }
  };
  keyActionRef.current = handleAction;

  const chooseTutorial = (choice: "start" | "skip") => {
    setTutorialChoice(choice);
    localStorage.setItem("djmesrc-onboarding-choice", choice);
    if (choice === "start") setTutorialActions(blankActions);
    else setTutorialVisible(false);
  };

  const renderDeck = (deckId: DeckId) => {
    const deck = desk.decks.find(item => item.id === deckId)!;
    return <DeckPanel
      key={deckId}
      deck={deck}
      meter={desk.meters[deckId]}
      bindings={keybinds.bindings}
      keybindMode={keybinds.enabled}
      onAdd={() => void desk.importTracks(deckId)}
      onRemove={id => requestTrackRemoval(deckId, id)}
      onLocate={track => void desk.locateTrack(deckId, track)}
      onMove={(from, to) => desk.moveTrack(deckId, from, to)}
      onPlayNow={id => desk.playNow(deckId, id)}
      onTrackContextMenu={(event, track) => showTrackContextMenu(deckId, event, track)}
      onSelect={id => void desk.selectTrack(deckId, id)}
      onControl={operation => void desk.control(deckId, operation)}
      onVolume={volume => desk.setVolume(deckId, volume)}
      onMuteChange={muted => desk.setMute(deckId, muted)}
      onLoop={enabled => desk.setLoop(deckId, enabled)}
      onSeek={position => void desk.seek(deckId, position)}
    />;
  };

  return <TooltipProvider>
    <main className="app-shell" onClickCapture={handleLearnClick}>
      <KeybindToolbar
        enabled={keybinds.enabled}
        pending={keybinds.pending}
        pendingLabel={keybinds.pending ? describeAction(keybinds.pending) : ""}
        count={Object.keys(keybinds.bindings).length}
        binding={keybinds.pending ? keybinds.bindings[keybinds.pending] : undefined}
        onToggle={keybinds.toggleMode}
        onCancel={keybinds.cancel}
        onClear={() => keybinds.pending && keybinds.clear(keybinds.pending)}
      />
      <section className="performance-area" aria-label="Two-deck audio console">
        {renderDeck("left")}
        <MixerStrip value={desk.crossfade} bindings={keybinds.bindings} meters={desk.meters} onChange={desk.setCrossfader} onReset={() => desk.setCrossfader(50)} />
        {renderDeck("right")}
      </section>
      <Soundboard
        effects={desk.effects}
        active={desk.activeSfx}
        bindings={keybinds.bindings}
        editingId={editingEffect}
        editingName={editingEffectName}
        onAdd={() => void desk.importEffects()}
        onPlay={id => void desk.triggerSfx(id)}
        onStop={desk.stopSfx}
        onEdit={id => {
          setEditingEffect(id);
          setEditingEffectName(id ? desk.effects.find(effect => effect.id === id)?.name ?? "" : "");
        }}
        onRename={(_, name) => setEditingEffectName(name)}
        onSaveName={() => {
          if (editingEffect && editingEffectName.trim()) desk.setSfxName(editingEffect, editingEffectName.trim());
          setEditingEffect(null);
        }}
        onHelp={() => {
          setTutorialChoice("start");
          setTutorialActions(blankActions());
          setTutorialVisible(true);
        }}
        onVolume={desk.setSfxVolume}
        onColor={desk.setSfxColor}
        onRemove={requestEffectRemoval}
        onLocate={desk.locateEffect}
        onEffectContextMenu={showEffectContextMenu}
      />
    </main>
    {contextMenu && <ContextMenu {...contextMenu} onClose={closeContextMenu} />}
    {pendingConfirmation && <ConfirmDialog
      title={pendingConfirmation.title}
      message={pendingConfirmation.message}
      confirmLabel={pendingConfirmation.confirmLabel}
      onCancel={() => setPendingConfirmation(null)}
      onConfirm={() => {
        const confirm = pendingConfirmation.onConfirm;
        setPendingConfirmation(null);
        confirm();
      }}
    />}
    {noticeToast && <div className="notice-toast" role="status" aria-live="polite">{noticeToast}</div>}
    {tutorialVisible && <Tutorial
      choice={tutorialChoice}
      completedActions={tutorialActions}
      hasAudioForStep={step => step === 0 ? desk.decks.some(deck => deck.tracks.length > 0) : step === 5 ? desk.effects.length > 0 : false}
      onChoose={chooseTutorial}
      onSkipStep={step => {
        if (step === 0) { recordTutorialAction("music:left"); recordTutorialAction("music:right"); }
        if (step === 5) { recordTutorialAction("sfx:add"); recordTutorialAction("sfx:play"); }
      }}
      onFinish={() => { localStorage.setItem("djmesrc-tutorial-complete", "true"); desk.notify("TUTORIAL COMPLETE"); }}
      onClose={() => setTutorialVisible(false)}
    />}
  </TooltipProvider>;
}

export default App;
