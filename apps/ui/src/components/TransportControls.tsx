import { Pause, Play, RotateCcw, Square } from "lucide-react";
import type { PlaybackStatus } from "@djmesrc/domain";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { KeycapBadge } from "./KeycapBadge";

type Props = {
  deckId: string;
  bindings: Record<string, string>;
  status: PlaybackStatus;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRestart: () => void;
};

export function TransportControls({ deckId, bindings, status, onPlay, onPause, onStop, onRestart }: Props) {
  const isPlaying = status === "playing";
  const playAction = isPlaying ? "PAUSE" : "PLAY";
  return (
    <div className="transport" data-tutorial-steps="1">
      <Tooltip content={isPlaying ? "Fade out for 2 seconds, then pause at this position" : status === "fading" ? "Cancel the fade and continue playing" : "Play or resume this track"}>
        <Button className="transport-play" variant="default" data-keybind-action={`DECK:${deckId}:${playAction}`} onClick={isPlaying ? onPause : onPlay}>
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          <span>{isPlaying ? "PAUSE" : status === "fading" ? "RESUME" : "PLAY"}</span><KeycapBadge code={bindings[`DECK:${deckId}:${playAction}`]} />
        </Button>
      </Tooltip>
      <Tooltip content="Fade out for 2 seconds, then stop at 00:00">
        <Button variant="outline" data-keybind-action={`DECK:${deckId}:STOP`} onClick={onStop}><Square size={13} fill="currentColor" /><span>STOP</span><KeycapBadge code={bindings[`DECK:${deckId}:STOP`]} /></Button>
      </Tooltip>
      <Tooltip content="Start the current track again">
        <Button variant="outline" data-keybind-action={`DECK:${deckId}:RESTART`} onClick={onRestart}><RotateCcw size={14} /><span>RESTART</span><KeycapBadge code={bindings[`DECK:${deckId}:RESTART`]} /></Button>
      </Tooltip>
    </div>
  );
}
