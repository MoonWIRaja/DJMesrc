import { AudioLines, Check, CircleHelp, LocateFixed, Pencil, Play, Plus, Square, Trash2, Volume2, X } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { SoundEffect } from "@djmesrc/domain";
import type { ActiveSoundEffect } from "../lib/audio";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip } from "@/components/ui/tooltip";
import { KeycapBadge } from "./KeycapBadge";

type Props = {
  effects: SoundEffect[];
  active: Record<string, ActiveSoundEffect>;
  bindings: Record<string, string>;
  editingId: string | null;
  editingName: string;
  onAdd: () => void;
  onPlay: (id: string) => void;
  onStop: () => void;
  onEdit: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onSaveName: () => void;
  onHelp: () => void;
  onVolume: (id: string, value: number) => void;
  onColor: (id: string, color: string) => void;
  onRemove: (effect: SoundEffect) => void;
  onLocate: (effect: SoundEffect) => void;
  onEffectContextMenu: (event: ReactMouseEvent<HTMLElement>, effect: SoundEffect) => void;
};

export function Soundboard({ effects, active, bindings, editingId, editingName, onAdd, onPlay, onStop, onEdit, onRename, onSaveName, onHelp, onVolume, onColor, onRemove, onLocate, onEffectContextMenu }: Props) {
  return (
    <section className="soundboard" data-tutorial-steps="5" data-drop-sfx="true" onPointerDown={event => {
      const target = event.target as HTMLElement;
      if (editingId && !target.closest(".sfx-name-popover") && !target.closest("[aria-haspopup='dialog']")) onEdit(null);
    }}>
      <div className="soundboard-heading">
        <div className="soundboard-title"><AudioLines size={16} /><h2>SOUND FX</h2><span>{effects.length}</span></div>
        <div className="soundboard-actions">
          <Tooltip content="Open the guided tutorial"><Button className="help-button" variant="ghost" size="sm" aria-label="Help and tutorial" data-keybind-action="HELP:TUTORIAL" onClick={onHelp}><CircleHelp size={14} /><span>HELP</span><KeycapBadge code={bindings["HELP:TUTORIAL"]} /></Button></Tooltip>
          <Button className="stop-all-button" size="sm" variant="outline" data-keybind-action="SFX:STOP_ALL" onClick={onStop}><Square size={12} fill="currentColor" /><span>STOP ALL</span><KeycapBadge code={bindings["SFX:STOP_ALL"]} /></Button>
          <Button className="add-button" size="sm" variant="secondary" data-keybind-action="SFX:ADD" onClick={onAdd}><Plus size={14} /><span>ADD SOUND</span><KeycapBadge code={bindings["SFX:ADD"]} /></Button>
        </div>
      </div>
      {effects.length === 0 ? (
        <Button className="sfx-empty" variant="ghost" data-keybind-action="SFX:ADD" onClick={onAdd}><Plus size={15} /> ADD FIRST SOUND</Button>
      ) : (
        <div className="sfx-grid">
          {effects.map((effect, index) => {
            const playback = active[effect.id];
            return (
              <article key={effect.id} tabIndex={-1} className={`sfx-card ${playback ? "sfx-playing" : ""} ${effect.missing ? "sfx-missing" : ""} ${editingId === effect.id ? "sfx-editing" : ""}`} style={{ "--pad-color": effect.color } as React.CSSProperties} onContextMenu={event => {
                const target = event.target as HTMLElement;
                if (target.closest(".sfx-tools, .sfx-name-popover, input, textarea, [contenteditable='true']")) return;
                onEffectContextMenu(event, effect);
              }}>
                <Button className="sfx-pad" variant="outline" disabled={effect.missing} aria-label={`Play ${effect.name}${playback ? `, ${playback.count} playing` : ""}`} aria-haspopup="menu" data-keybind-action={`SFX:${effect.id}`} onClick={() => onPlay(effect.id)}>
                  <span className="sfx-pad-heading">
                    <span className="sfx-index">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{effect.name}</strong>
                    {playback && playback.count > 1 && <span className="sfx-count">{playback.count}x</span>}
                    {effect.missing && <small>FILE MISSING</small>}
                  </span>
              <span className="sfx-pad-center" aria-hidden="true"><span className="sfx-play-icon"><Play size={22} fill="currentColor" /></span></span>
                  <KeycapBadge code={bindings[`SFX:${effect.id}`]} />
                </Button>
                <div className="sfx-progress" role="progressbar" aria-label={`${effect.name} playback progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={playback ? Math.round(playback.progress * 100) : 0}><span style={{ width: `${playback ? playback.progress * 100 : 0}%` }} /></div>
                <div className="sfx-tools">
                  <div className="sfx-level-control"><Volume2 size={13} /><Slider className="sfx-volume" aria-label={`${effect.name} volume`} min={0} max={100} step={1} value={Math.round(effect.volume * 100)} thumbLabel={`${effect.name} volume`} onValueChange={value => onVolume(effect.id, value / 100)} /></div>
                  <input className="sfx-color" type="color" value={effect.color} aria-label={`${effect.name} pad color`} onChange={event => onColor(effect.id, event.target.value)} />
                  {effect.missing ? (
                    <Tooltip content="Locate this sound file"><Button className="sfx-tool" size="icon" variant="ghost" aria-label={`Locate ${effect.name}`} data-keybind-action={`SFX:${effect.id}:LOCATE`} onClick={() => onLocate(effect)}><LocateFixed size={13} /><KeycapBadge code={bindings[`SFX:${effect.id}:LOCATE`]} /></Button></Tooltip>
                  ) : (
                    <Tooltip content="Rename sound"><Button className="sfx-tool" size="icon" variant="ghost" aria-label={`Rename ${effect.name}`} aria-expanded={editingId === effect.id} aria-haspopup="dialog" data-keybind-action={`SFX:${effect.id}:RENAME`} onClick={() => onEdit(editingId === effect.id ? null : effect.id)}><Pencil size={13} /><KeycapBadge code={bindings[`SFX:${effect.id}:RENAME`]} /></Button></Tooltip>
                  )}
                  <Tooltip content="Remove sound"><Button className="sfx-tool remove-action" size="icon" variant="ghost" aria-label={`Remove ${effect.name}`} data-keybind-action={`SFX:${effect.id}:REMOVE`} onClick={() => onRemove(effect)}><Trash2 size={13} /><KeycapBadge code={bindings[`SFX:${effect.id}:REMOVE`]} /></Button></Tooltip>
                </div>
                {editingId === effect.id && <div className="sfx-name-popover" role="dialog" aria-label={`Rename ${effect.name}`} onPointerDown={event => event.stopPropagation()}>
                  <label htmlFor={`sfx-name-${effect.id}`}>SOUND NAME</label>
                  <input id={`sfx-name-${effect.id}`} autoFocus maxLength={48} value={editingName} onChange={event => onRename(effect.id, event.target.value)} onKeyDown={event => {
                    if (event.key === "Enter") { event.preventDefault(); onSaveName(); }
                    if (event.key === "Escape") { event.preventDefault(); onEdit(null); }
                  }} />
                  <div><Button size="sm" variant="ghost" aria-label="Cancel name edit" onClick={() => onEdit(null)}><X size={13} /><span>CANCEL</span></Button><Button size="sm" variant="secondary" aria-label="Save sound name" disabled={!editingName.trim()} onClick={onSaveName}><Check size={13} /><span>SAVE</span></Button></div>
                </div>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
