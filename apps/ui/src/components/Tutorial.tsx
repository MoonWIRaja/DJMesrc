import { useEffect, useState } from "react";

type TutorialStep = { title: string; description: string; required: string[]; canSkip?: boolean };

const steps: TutorialStep[] = [
  { title: "ADD MUSIC TO BOTH DECKS", description: "Add one track to each deck. Each playlist is separate, and you choose which deck carries background or event music.", required: ["music:left", "music:right"], canSkip: true },
  { title: "PLAYBACK CONTROLS", description: "On either deck, try Play, Pause and resume, Restart, and Stop. Pause and Stop both fade out smoothly before changing playback.", required: ["transport:PLAY", "transport:PAUSE", "transport:RESTART", "transport:STOP"] },
  { title: "CONTROL EACH DECK", description: "Adjust both deck faders and try Mute. Each deck keeps its own level, including while sound effects duck the music.", required: ["volume:left", "volume:right", "mute:left", "mute:right"] },
  { title: "MANAGE THE QUEUE", description: "Drag a waiting track to reorder it, use Play Now to set the next track, then remove a waiting track.", required: ["queue:reorder", "queue:play_now", "queue:remove"] },
  { title: "LOOP", description: "Turn Loop on and off. With Loop off, a finished track moves to the bottom and the next one plays.", required: ["loop:on", "loop:off"] },
  { title: "SOUND EFFECTS", description: "Add a sound effect and play it. Try another before it ends to hear both overlap while the music ducks.", required: ["sfx:add", "sfx:play"], canSkip: true },
  { title: "SHORTCUT KEYS", description: "Turn Keybind Mode on, click a control, and press a unique key. Escape clears the selected binding; duplicate keys are rejected.", required: ["keybind:assign"] },
] as const;

type Props = {
  choice: "start" | "skip" | null;
  completedActions: Set<string>;
  hasAudioForStep: (step: number) => boolean;
  onChoose: (choice: "start" | "skip") => void;
  onSkipStep: (step: number) => void;
  onFinish: () => void;
  onClose: () => void;
};

export function Tutorial({ choice, completedActions, hasAudioForStep, onChoose, onSkipStep, onFinish, onClose }: Props) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const missingActions = current.required.filter(action => !completedActions.has(action));

  useEffect(() => {
    if (choice !== "start") return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial-steps~="${step}"]`));
    targets.forEach(target => target.classList.add("tutorial-focus"));
    return () => targets.forEach(target => target.classList.remove("tutorial-focus"));
  }, [choice, step]);

  if (!choice) {
    return <div className="tutorial-backdrop"><section className="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <span className="eyebrow">FIRST-TIME SETUP</span><h2 id="tutorial-title">LEARN THE AUDIO DESK</h2>
      <p>A short hands-on walkthrough will show you the main controls and let you try them.</p>
      <div className="tutorial-actions"><button onClick={() => onChoose("skip")}>SKIP</button><button className="transport-main" onClick={() => { setStep(0); onChoose("start"); }}>START TUTORIAL</button></div>
    </section></div>;
  }
  if (choice === "skip") return null;

  const goNext = () => {
    if (step === steps.length - 1) {
      onFinish();
      onClose();
      return;
    }
    setStep(previous => previous + 1);
  };
  const canAdvance = missingActions.length === 0;

  return <div className="tutorial-backdrop tutorial-active"><section className="tutorial-card" role="dialog" aria-modal="false" aria-labelledby="tutorial-title" aria-describedby="tutorial-description">
    <span className="eyebrow">GUIDED TUTORIAL · STEP {step + 1} OF {steps.length}</span>
    <h2 id="tutorial-title">{current.title}</h2><p id="tutorial-description">{current.description}</p>
    <p className="tutorial-checklist">{missingActions.length === 0 ? "STEP COMPLETE · READY TO CONTINUE" : `TRY THE HIGHLIGHTED CONTROL${missingActions.length > 1 ? "S" : ""} TO CONTINUE`}</p>
    <div className="tutorial-progress"><span style={{ width: `${(step + 1) / steps.length * 100}%` }} /></div>
    <div className="tutorial-actions">
      <button disabled={step === 0} onClick={() => setStep(previous => Math.max(0, previous - 1))}>BACK</button>
      {current.canSkip && !hasAudioForStep(step) && <button onClick={() => { onSkipStep(step); goNext(); }}>NO AUDIO FILES · NEXT</button>}
      <button className="transport-main" disabled={!canAdvance} onClick={goNext}>{step + 1 === steps.length ? "FINISH TUTORIAL" : "NEXT"}</button>
    </div>
  </section></div>;
}
