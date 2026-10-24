import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type ContextMenuAction = {
  label: string;
  icon: ReactNode;
  destructive?: boolean;
  onSelect: () => void;
};

type Props = {
  x: number;
  y: number;
  label: string;
  actions: ContextMenuAction[];
  returnFocus: HTMLElement | null;
  onClose: () => void;
};

export function ContextMenu({ x, y, label, actions, returnFocus, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8)),
    });
    menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        returnFocus?.focus({ preventScroll: true });
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        items[(current + direction + items.length) % items.length]?.focus({ preventScroll: true });
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        (event.key === "Home" ? items[0] : items.at(-1))?.focus({ preventScroll: true });
      } else if (event.key === "Tab") {
        onClose();
      }
    };
    const onWindowChange = () => onClose();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("blur", onWindowChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("blur", onWindowChange);
    };
  }, [onClose, returnFocus]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label={label}
      style={{ left: position.left, top: position.top }}
      onContextMenu={event => event.preventDefault()}
    >
      {actions.map(action => (
        <button
          key={action.label}
          type="button"
          className={`context-menu-item ${action.destructive ? "context-menu-destructive" : ""}`}
          role="menuitem"
          onClick={() => {
            onClose();
            action.onSelect();
          }}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
