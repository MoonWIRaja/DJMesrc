import { useCallback, useEffect, useState } from "react";

export type KeybindMap = Record<string, string>;

function readBindings(): KeybindMap {
  try {
    const stored = JSON.parse(localStorage.getItem("djmesrc-keybinds") ?? "{}") as KeybindMap;
    const result: KeybindMap = {};
    const seen = new Set<string>();
    for (const [action, code] of Object.entries(stored)) {
      if (code && code !== "Escape" && !seen.has(code)) {
        result[action] = code;
        seen.add(code);
      }
    }
    return result;
  } catch {
    return {};
  }
}

function actionName(action: string) {
  return action
    .replace(/^DECK:(left|right):/, (_, deck: string) => `${deck.toUpperCase()} DECK `)
    .replace(/^TRACK:(left|right):[^:]+:/, (_, deck: string) => `${deck.toUpperCase()} TRACK `)
    .replace(/^SFX:[^:]+/, "SOUND EFFECT")
    .replaceAll("_", " ")
    .replaceAll(":", " ");
}

export function useKeybinds(onAction: (action: string) => void, onNotice: (message: string) => void, describeAction: (action: string) => string = actionName) {
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [bindings, setBindings] = useState<KeybindMap>(readBindings);

  useEffect(() => { localStorage.setItem("djmesrc-keybinds", JSON.stringify(bindings)); }, [bindings]);

  const learn = useCallback((action: string) => {
    if (!enabled) return false;
    setPending(action);
    onNotice(`PRESS A KEY FOR ${actionName(action)} · ESC CLEARS THIS BINDING`);
    return true;
  }, [enabled, onNotice]);

  const cancel = useCallback(() => {
    setPending(null);
    onNotice("KEYBIND LEARNING CANCELLED");
  }, [onNotice]);

  const clear = useCallback((action: string) => {
    setBindings(previous => {
      const next = { ...previous };
      delete next[action];
      return next;
    });
    setPending(null);
    onNotice("KEYBIND CLEARED");
  }, [onNotice]);

  const toggleMode = useCallback(() => {
    if (enabled) {
      setPending(null);
      setEnabled(false);
    } else setEnabled(true);
  }, [enabled]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (enabled && pending) {
        event.preventDefault();
        event.stopPropagation();
        if (event.code === "Escape") {
          clear(pending);
          return;
        }
        if (["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"].includes(event.code)) {
          onNotice("CHOOSE A LETTER, NUMBER, FUNCTION KEY OR NUMPAD KEY");
          return;
        }
        if (!/^(Key[A-Z]|Digit[0-9]|Numpad([0-9]|Add|Enter)|F([1-9]|1[0-2])|Space)$/.test(event.code)) {
          onNotice("CHOOSE A LETTER, NUMBER, FUNCTION KEY OR NUMPAD KEY");
          return;
        }
        const duplicate = Object.entries(bindings).find(([action, code]) => code === event.code && action !== pending);
        if (duplicate) {
          onNotice(`${event.code} IS ALREADY USED BY ${describeAction(duplicate[0])}`);
          return;
        }
        setBindings(previous => ({ ...previous, [pending]: event.code }));
        setPending(null);
        onNotice(`${event.code} ASSIGNED TO ${describeAction(pending)}`);
        return;
      }
      if (enabled && event.code === "Escape") {
        setPending(null);
        setEnabled(false);
        onNotice("KEYBIND MODE OFF");
        return;
      }
      if (enabled || event.repeat) return;
      const action = Object.entries(bindings).find(([, code]) => code === event.code)?.[0];
      if (action) {
        event.preventDefault();
        onAction(action);
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [enabled, pending, bindings, onAction, onNotice, clear, describeAction]);

  return { enabled, setEnabled, toggleMode, pending, bindings, learn, cancel, clear };
}
