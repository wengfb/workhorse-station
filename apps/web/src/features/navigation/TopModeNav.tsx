import React from "react";
import type { HomeMode } from "../../lib/types";

export function TopModeNav({
  value,
  modes,
  onChange
}: {
  value: HomeMode | null;
  modes: Array<{ id: HomeMode; label: string; description: string }>;
  onChange: (value: HomeMode) => void;
}) {
  return (
    <nav className="app-input app-border flex rounded-lg border p-1">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          className={`rounded-md px-3 py-1.5 text-sm ${value === mode.id ? "app-button-primary" : "app-text-faint app-hover-accent app-hover-text"}`}
        >
          {mode.label}
        </button>
      ))}
    </nav>
  );
}
