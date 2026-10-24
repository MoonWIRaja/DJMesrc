import { Repeat2 } from "lucide-react";
import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Deck, Track } from "@djmesrc/domain";
import type { AudioMeter } from "../lib/audio";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { KeycapBadge } from "./KeycapBadge";
import { Playlist } from "./Playlist";
import { RecordPlatter } from "./RecordPlatter";
import { TransportControls } from "./TransportControls";
import { VolumeControl } from "./VolumeControl";

type Props = {
  deck: Deck;
  meter: AudioMeter;
  bindings: Record<string, string>;
  keybindMode: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onLocate: (track: Track) => void;
  onMove: (from: number, to: number) => void;
  onPlayNow: (id: string) => void;
  onTrackContextMenu: (event: ReactMouseEvent<HTMLElement>, track: Track) => void;
  onSelect: (id: string) => void;
  onControl: (action: "PLAY" | "PAUSE" | "STOP" | "RESTART") => void;
  onVolume: (volume: number) => void;
  onMuteChange: (muted: boolean) => void;
  onLoop: (enabled: boolean) => void;
  onSeek: (positionMs: number) => void;
};

const formatTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function DeckPanel({ deck, meter, bindings, keybindMode, onAdd, onRemove, onLocate, onMove, onPlayNow, onTrackContextMenu, onSelect, onControl, onVolume, onMuteChange, onLoop, onSeek }: Props) {
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const current = deck.tracks.find(track => track.id === deck.currentId);
  const positionMs = deck.status === "stopped" || deck.status === "missing" ? deck.positionMs : meter.positionMs;
  const seekValue = Math.min(seekDraft ?? positionMs, current?.durationMs ?? 0);

  return (
    <article className={`deck-panel deck-${deck.id}`} data-drop-deck={deck.id}>
      <div className="deck-upper">
        <RecordPlatter deckId={deck.id} spinning={deck.status === "playing" || deck.status === "fading"} />
        <div className="deck-control-column">
          <div className="now-playing">
            <div className="now-title"><span className="eyebrow">NOW PLAYING</span><h3 title={current?.name}>{current?.name ?? "—"}</h3></div>
            <strong className="timecode">{formatTime(positionMs)} <span>/ {formatTime(current?.durationMs ?? 0)}</span></strong>
          </div>
          <div className="progress-track" aria-label="Track progress">
            <Slider
              className="seek-slider"
              aria-label={`Seek ${current?.name ?? "track"}`}
              min={0}
              max={Math.max(1, current?.durationMs ?? 0)}
              step={500}
              value={seekValue}
              thumbLabel="Track position"
              disabled={!current || current.missing || deck.status === "missing"}
              onValueChange={setSeekDraft}
              onValueCommit={position => { onSeek(position); setSeekDraft(null); }}
            />
          </div>
          <TransportControls deckId={deck.id} bindings={bindings} status={deck.status} onPlay={() => onControl("PLAY")} onPause={() => onControl("PAUSE")} onStop={() => onControl("STOP")} onRestart={() => onControl("RESTART")} />
          <div className="deck-mix-controls">
            <VolumeControl deckId={deck.id} value={deck.volume} muted={deck.muted} bindings={bindings} onChange={onVolume} onMute={() => onMuteChange(!deck.muted)} />
            <Button className={deck.looping ? "loop-toggle active" : "loop-toggle"} size="sm" variant="outline" data-tutorial-steps="4" data-keybind-action={`DECK:${deck.id}:LOOP`} aria-pressed={deck.looping} onClick={() => onLoop(!deck.looping)}>
              <Repeat2 size={14} /><span>LOOP</span><KeycapBadge code={bindings[`DECK:${deck.id}:LOOP`]} />
            </Button>
          </div>
        </div>
      </div>
      <Playlist deckId={deck.id} tracks={deck.tracks} currentId={deck.currentId} bindings={bindings} keybindMode={keybindMode} onAdd={onAdd} onSelect={onSelect} onRemove={onRemove} onLocate={onLocate} onMove={onMove} onPlayNow={onPlayNow} onTrackContextMenu={onTrackContextMenu} />
    </article>
  );
}
