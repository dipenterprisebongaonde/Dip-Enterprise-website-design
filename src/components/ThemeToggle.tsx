"use client";

import { Monitor, Moon, Sun } from "lucide-react";
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

const CYCLE: ThemePreference[] = ["light", "dark", "system"];

function nextPreference(current: ThemePreference): ThemePreference {
  const index = CYCLE.indexOf(current);
  return CYCLE[(index + 1) % CYCLE.length];
}

function preferenceLabel(value: ThemePreference) {
  return OPTIONS.find((option) => option.value === value)?.label || value;
}

function PreferenceIcon({ value, size = 16 }: { value: ThemePreference; size?: number }) {
  if (value === "dark") return <Moon size={size} />;
  if (value === "system") return <Monitor size={size} />;
  return <Sun size={size} />;
}

export function ThemeToggle({
  variant = "icon",
}: {
  variant?: "icon" | "panel";
}) {
  const { preference, setPreference } = useTheme();

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

  const next = nextPreference(preference);

  return (
    <div className="theme-toggle">
      <button
        className="util"
        type="button"
        aria-label={`Theme ${preferenceLabel(preference)}. Tap to switch to ${preferenceLabel(next)}.`}
        title={`Theme: ${preferenceLabel(preference)} · tap to change`}
        onClick={() => setPreference(next)}
      >
        <PreferenceIcon value={preference} size={16} />
      </button>
    </div>
  );
}
