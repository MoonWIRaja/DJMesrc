import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="confirm-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }
          if (event.key !== "Tab") return;
          const actions = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
          const first = actions[0];
          const last = actions.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <span className="confirm-dialog-eyebrow">CONFIRM ACTION</span>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <Button size="sm" variant="ghost" onClick={onCancel}>CANCEL</Button>
          <Button size="sm" variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
