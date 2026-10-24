import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip } from "@/components/ui/tooltip";
import { KeycapBadge } from "./KeycapBadge";

type Props = { value: number; bindings: Record<string, string>; onChange: (value: number) => void; onReset: () => void };

export function Crossfader({ value, bindings, onChange, onReset }: Props) {
  return (
    <section className="crossfader" aria-label="Deck crossfader">
      <div className="crossfader-heading"><span>BLEND</span><Tooltip content="Center the crossfader"><Button size="icon" variant="ghost" aria-label="Reset crossfader to center" data-keybind-action="CROSSFADER:RESET" onClick={onReset}><RotateCcw size={13} /><KeycapBadge code={bindings["CROSSFADER:RESET"]} /></Button></Tooltip></div>
      <div className="crossfader-control">
        <span className="mix-tag mix-a">A</span>
        <Slider aria-label="Crossfader" min={0} max={100} step={1} value={value} thumbLabel="Crossfader" onValueChange={onChange} />
        <span className="mix-tag mix-b">B</span>
      </div>
      <output className="crossfader-value">{Math.round(value)}%</output>
    </section>
  );
}
