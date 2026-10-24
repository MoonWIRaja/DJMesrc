import { Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KeycapBadge } from "./KeycapBadge";

type Props = {
  enabled: boolean;
  pending: string | null;
  pendingLabel: string;
  count: number;
  binding: string | undefined;
  onToggle: () => void;
  onCancel: () => void;
  onClear: () => void;
};

export function KeybindToolbar({ enabled, pending, pendingLabel, count, binding, onToggle, onCancel, onClear }: Props) {
  return (
    <div className="keybind-toolbar" data-tutorial-steps="6">
      <span className="keybind-title"><Keyboard size={15} aria-hidden="true" /><span>SHORTCUTS</span><b>{count}</b></span>
      {pending ? (
        <div className="keybind-learning" role="status">
          <span>PRESS A KEY FOR <strong>{pendingLabel}</strong></span>
          {binding && <span className="current-binding">CURRENT <KeycapBadge code={binding} /></span>}
          <Button size="sm" variant="ghost" data-keybind-ignore="true" onClick={onClear}>CLEAR</Button>
          <Button size="icon" variant="ghost" aria-label="Cancel key assignment" data-keybind-ignore="true" onClick={onCancel}><X size={14} /></Button>
        </div>
      ) : (
        <div className="keybind-toolbar-actions">
          <Button className="keybind-toggle" size="sm" variant={enabled ? "default" : "outline"} data-keybind-ignore="true" onClick={onToggle}>
            {enabled ? "ASSIGNING" : "KEYBIND MODE OFF"}
          </Button>
        </div>
      )}
    </div>
  );
}
