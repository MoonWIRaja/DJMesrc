import { Crossfader } from "./Crossfader";
import type { AudioMeter } from "../lib/audio";
import type { DeckId } from "@djmesrc/domain";

function LevelMeter({ deckId, meter }: { deckId: DeckId; meter: AudioMeter }) {
  const active = Math.round(meter.peak * 10);
  return (
    <div className={`mixer-level mixer-level-${deckId}`} role="meter" aria-label={`Deck ${deckId} output level`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(meter.peak * 100)}>
      {Array.from({ length: 10 }, (_, index) => <span key={index} className={`${index < active ? "level-active" : ""} ${index > 7 ? "level-hot" : ""}`} />)}
    </div>
  );
}

type Props = {
  value: number;
  bindings: Record<string, string>;
  meters: Record<DeckId, AudioMeter>;
  onChange: (value: number) => void;
  onReset: () => void;
};

export function MixerStrip({ value, bindings, meters, onChange, onReset }: Props) {
  return (
    <aside className="mixer-strip" aria-label="Mixer">
      <span className="mixer-title">MIX</span>
      <div className="mixer-meters">
        <div className="mixer-channel"><span className="mixer-channel-label">A</span><LevelMeter deckId="left" meter={meters.left} /><span className={meters.left.clipping ? "mixer-limit active" : "mixer-limit"}>LIMIT</span></div>
        <div className="mixer-channel"><span className="mixer-channel-label">B</span><LevelMeter deckId="right" meter={meters.right} /><span className={meters.right.clipping ? "mixer-limit active" : "mixer-limit"}>LIMIT</span></div>
      </div>
      <Crossfader value={value} bindings={bindings} onChange={onChange} onReset={onReset} />
    </aside>
  );
}
