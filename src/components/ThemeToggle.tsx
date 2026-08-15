"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  type ThemePreference,
  useTheme,
} from "@/components/ThemeProvider";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({
  variant = "icon",
}: {
  variant?: "icon" | "panel";
}) {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (variant === "panel") {
    return (
      <div className="theme-panel">
        <div>
          <h3>Appearance</h3>
          <p>Choose light or dark theme, or follow your device.</p>
        </div>
        <div className="theme-segment" role="group" aria-label="Theme">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={active ? "active" : undefined}
                aria-pressed={active}
                onClick={() => setPreference(option.value)}
              >
                <Icon size={15} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const ActiveIcon = resolved === "dark" ? Moon : Sun;

  return (
    <div className="theme-toggle" ref={rootRef}>
      <button
        className="util"
        type="button"
        aria-label="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ActiveIcon size={16} />
      </button>
      {open ? (
        <div className="theme-menu" role="menu" aria-label="Theme options">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={active ? "active" : undefined}
                onClick={() => {
                  setPreference(option.value);
                  setOpen(false);
                }}
              >
                <Icon size={15} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
