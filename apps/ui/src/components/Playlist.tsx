import { CirclePlay, Keyboard, ListMusic, LocateFixed, Plus, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { DeckId, Track } from "@djmesrc/domain";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip } from "@/components/ui/tooltip";
import { KeycapBadge } from "./KeycapBadge";

type Props = {
  deckId: DeckId;
  tracks: Track[];
  currentId: string | null;
  bindings: Record<string, string>;
  keybindMode: boolean;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onLocate: (track: Track) => void;
  onMove: (from: number, to: number) => void;
  onPlayNow: (id: string) => void;
  onTrackContextMenu: (event: ReactMouseEvent<HTMLElement>, track: Track) => void;
};

const duration = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function Playlist({ deckId, tracks, currentId, bindings, keybindMode, onAdd, onSelect, onRemove, onLocate, onMove, onPlayNow, onTrackContextMenu }: Props) {
  const [draggingTrack, setDraggingTrack] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; from: number; startX: number; startY: number; active: boolean } | null>(null);
  const suppressNextClickRef = useRef(false);
  const animateNextReorderRef = useRef(false);
  const previousTrackRectsRef = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const container = document.querySelector<HTMLElement>(`.playlist-scroll[data-playlist="${deckId}"]`);
    const rows = Array.from(container?.querySelectorAll<HTMLElement>("[data-track-id]") ?? []);
    const nextRects = new Map(rows.map(row => [row.dataset.trackId!, row.getBoundingClientRect()]));

    if (animateNextReorderRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const row of rows) {
        const previous = previousTrackRectsRef.current.get(row.dataset.trackId!);
        if (!previous) continue;
        const offsetY = previous.top - nextRects.get(row.dataset.trackId!)!.top;
        if (Math.abs(offsetY) < 1) continue;
        row.animate(
          [{ transform: `translateY(${offsetY}px)` }, { transform: "translateY(0)" }],
          { duration: 180, easing: "cubic-bezier(.2,.7,.3,1)" },
        );
      }
    }

    previousTrackRectsRef.current = nextRects;
    animateNextReorderRef.current = false;
  }, [tracks, deckId]);

  return (
    <section className="playlist" data-tutorial-steps="3">
      <div className="section-title">
        <span><ListMusic size={14} aria-hidden="true" /> QUEUE <b>{tracks.length}</b></span>
        <div className="queue-actions">
          {keybindMode && <Tooltip content="Assign a shortcut to add a track"><Button className="queue-bind-button" size="icon" variant="ghost" aria-label={`Assign add track shortcut for Deck ${deckId === "left" ? "A" : "B"}`} data-keybind-action={`DECK:${deckId}:ADD_MUSIC`} onClick={() => undefined}><Keyboard size={13} /></Button></Tooltip>}
          <Button className="add-button" size="sm" variant="secondary" data-tutorial-steps="0" data-keybind-action={`DECK:${deckId}:ADD_MUSIC`} data-keybind-ignore={keybindMode ? "true" : undefined} onClick={onAdd}><Plus size={14} /> ADD TRACK<KeycapBadge code={bindings[`DECK:${deckId}:ADD_MUSIC`]} /></Button>
        </div>
      </div>
      {tracks.length === 0 ? (
        <Button className="empty-state" variant="ghost" data-keybind-action={`DECK:${deckId}:ADD_MUSIC`} data-keybind-ignore={keybindMode ? "true" : undefined} onClick={onAdd}><ListMusic size={17} /> ADD MUSIC</Button>
      ) : (
        <ScrollArea className="playlist-scroll" data-playlist={deckId}>
          <ol>
            {tracks.map((track, index) => (
              <li
                key={track.id}
                data-track-id={track.id}
                data-track-index={index}
                tabIndex={-1}
                className={`track ${track.id === currentId ? "current-track" : ""} ${track.missing ? "missing-track" : ""} ${draggingTrack === track.id ? "dragging" : ""} ${dropTarget === track.id ? "drop-target" : ""}`}
                onContextMenu={event => {
                  if ((event.target as HTMLElement).closest(".track-actions")) return;
                  onTrackContextMenu(event, track);
                }}
              >
                <Button className="track-select" variant="ghost" title={index > 0 ? "Drag to reorder, click to play now, or right-click for actions" : `Play ${track.name} now`} aria-label={`Play ${track.name} now`} aria-haspopup="menu" data-keybind-action={`TRACK:${deckId}:${track.id}:SELECT`} data-keybind-ignore={keybindMode ? "true" : undefined}
                  onPointerDown={event => {
                    if (event.button !== 0 || index === 0 && track.id === currentId) return;
                    animateNextReorderRef.current = false;
                    dragRef.current = { pointerId: event.pointerId, from: index, startX: event.clientX, startY: event.clientY, active: false };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={event => {
                    const drag = dragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId) return;
                    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 6) {
                      drag.active = true;
                      setDraggingTrack(track.id);
                    }
                    if (!drag.active) return;
                    event.preventDefault();
                    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-track-index]");
                    const nextIndex = target ? Number(target.dataset.trackIndex) : null;
                    dropTargetIndexRef.current = nextIndex;
                    setDropTarget(target?.dataset.trackId ?? null);
                  }}
                  onPointerUp={event => {
                    const drag = dragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId) return;
                    if (drag.active) {
                      event.preventDefault();
                      suppressNextClickRef.current = true;
                      if (dropTargetIndexRef.current !== null && dropTargetIndexRef.current !== drag.from) {
                        animateNextReorderRef.current = true;
                        onMove(drag.from, dropTargetIndexRef.current);
                      }
                      window.setTimeout(() => { suppressNextClickRef.current = false; }, 150);
                    }
                    dragRef.current = null;
                    dropTargetIndexRef.current = null;
                    setDraggingTrack(null);
                    setDropTarget(null);
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null;
                    dropTargetIndexRef.current = null;
                    setDraggingTrack(null);
                    setDropTarget(null);
                  }}
                  onClick={() => {
                    if (suppressNextClickRef.current) { suppressNextClickRef.current = false; return; }
                    onSelect(track.id);
                  }}>
                  <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
                  {track.id === currentId ? <span className="track-current-mark" aria-label="Current track" /> : <span className="track-cue" />}
                  <span className="track-name">{track.name}{track.missing ? <small>FILE MISSING</small> : null}</span>
                  <span className="track-duration">{track.durationMs ? duration(track.durationMs) : "--:--"}</span>
                  <KeycapBadge code={bindings[`TRACK:${deckId}:${track.id}:SELECT`]} />
                </Button>
                <div className="track-actions">
                  {keybindMode && <Tooltip content="Assign a shortcut to play this track"><Button size="icon" variant="ghost" aria-label={`Assign play shortcut for ${track.name}`} data-keybind-action={`TRACK:${deckId}:${track.id}:SELECT`} onClick={() => undefined}><Keyboard size={13} /></Button></Tooltip>}
                  <Tooltip content={index === 0 ? "Play or resume this track" : "Play this track now"}><Button size="icon" variant="ghost" aria-label={index === 0 ? `Play ${track.name}` : `Play ${track.name} now`} data-keybind-action={`TRACK:${deckId}:${track.id}:PLAY_NOW`} data-keybind-ignore={keybindMode ? "true" : undefined} onClick={() => onPlayNow(track.id)}><CirclePlay size={14} /><KeycapBadge code={bindings[`TRACK:${deckId}:${track.id}:PLAY_NOW`]} /></Button></Tooltip>
                  {track.missing && <Tooltip content="Locate this audio file"><Button size="icon" variant="ghost" aria-label={`Locate ${track.name}`} data-keybind-action={`TRACK:${deckId}:${track.id}:LOCATE`} onClick={() => onLocate(track)}><LocateFixed size={14} /><KeycapBadge code={bindings[`TRACK:${deckId}:${track.id}:LOCATE`]} /></Button></Tooltip>}
                  <Tooltip content={track.id === currentId ? "Remove current track" : "Remove from queue"}><Button size="icon" variant="ghost" aria-label={`Remove ${track.name}`} className="remove-action" data-keybind-action={`TRACK:${deckId}:${track.id}:REMOVE`} onClick={() => onRemove(track.id)}><Trash2 size={14} /><KeycapBadge code={bindings[`TRACK:${deckId}:${track.id}:REMOVE`]} /></Button></Tooltip>
                </div>
              </li>
            ))}
          </ol>
        </ScrollArea>
      )}
    </section>
  );
}
