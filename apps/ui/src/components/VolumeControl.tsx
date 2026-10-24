import { Minus, Plus, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip } from "@/components/ui/tooltip";
import { KeycapBadge } from "./KeycapBadge";

type Props = {
  deckId: string;
  value: number;
  muted: boolean;
  bindings: Record<string, string>;
  onChange: (value: number) => void;
  onMute: () => void;
};

export function VolumeControl({ deckId, value, muted, bindings, onChange, onMute }: Props) {
  const step = (amount: number) => onChange(Math.max(0, Math.min(1, Math.round((value + amount) * 20) / 20)));
  return (
    <div className="volume-control" data-tutorial-steps="2">
      <div className="volume-label"><span>LEVEL</span><strong>{muted ? "MUTED" : `${Math.round(value * 100)}%`}</strong></div>
      <div className="volume-row">
        <Tooltip content={muted ? "Unmute deck" : "Mute deck"}>
          <Button className="mute-button" size="icon" variant="ghost" aria-label={muted ? "Unmute deck" : "Mute deck"} data-keybind-action={`DECK:${deckId}:MUTE`} onClick={onMute}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}<KeycapBadge code={bindings[`DECK:${deckId}:MUTE`]} />
          </Button>
        </Tooltip>
        <Button className="volume-step" size="icon" variant="ghost" aria-label="Lower volume" title="Lower volume" data-keybind-action={`DECK:${deckId}:VOLUME_DOWN`} onClick={() => step(-0.05)}><Minus size={13} /><KeycapBadge code={bindings[`DECK:${deckId}:VOLUME_DOWN`]} /></Button>
        <Slider aria-label={`${deckId} deck volume`} min={0} max={100} step={1} value={Math.round(value * 100)} thumbLabel={`${deckId} deck volume`} onValueChange={next => onChange(next / 100)} />
        <Button className="volume-step" size="icon" variant="ghost" aria-label="Raise volume" title="Raise volume" data-keybind-action={`DECK:${deckId}:VOLUME_UP`} onClick={() => step(0.05)}><Plus size={13} /><KeycapBadge code={bindings[`DECK:${deckId}:VOLUME_UP`]} /></Button>
      </div>
    </div>
  );
}
