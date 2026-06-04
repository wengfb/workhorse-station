import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

export type UiTheme = "dark" | "light";
export type TerminalThemeName = "dark" | "light";
export type TerminalThemeMode = "follow" | TerminalThemeName;

type ThemeSettingsContextValue = {
  uiTheme: UiTheme;
  terminalTheme: TerminalThemeName;
  terminalThemeMode: TerminalThemeMode;
  setUiTheme: (theme: UiTheme) => void;
  toggleUiTheme: () => void;
  setTerminalThemeMode: (theme: TerminalThemeMode) => void;
};

const UI_THEME_STORAGE_KEY = "workhorse:ui-theme";
const TERMINAL_THEME_STORAGE_KEY = "workhorse:terminal-theme";
const uiThemeValues = new Set<UiTheme>(["dark", "light"]);
const terminalThemeModeValues = new Set<TerminalThemeMode>(["follow", "dark", "light"]);

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null);

function readStoredValue<T extends string>(storageKey: string, values: Set<T>): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    return value && values.has(value as T) ? (value as T) : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): UiTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTerminalTheme(mode: TerminalThemeMode, uiTheme: UiTheme): TerminalThemeName {
  return mode === "follow" ? uiTheme : mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => readStoredValue(UI_THEME_STORAGE_KEY, uiThemeValues) ?? getSystemTheme());
  const [terminalThemeMode, setTerminalThemeMode] = useState<TerminalThemeMode>(
    () => readStoredValue(TERMINAL_THEME_STORAGE_KEY, terminalThemeModeValues) ?? "follow"
  );
  const terminalTheme = resolveTerminalTheme(terminalThemeMode, uiTheme);

  const toggleUiTheme = useCallback(() => {
    setUiTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.uiTheme = uiTheme;
    root.style.colorScheme = uiTheme;
    root.classList.toggle("dark", uiTheme === "dark");
    root.classList.toggle("light", uiTheme === "light");

    try {
      window.localStorage.setItem(UI_THEME_STORAGE_KEY, uiTheme);
    } catch {
      // ignore storage failures
    }
  }, [uiTheme]);

  useLayoutEffect(() => {
    document.documentElement.dataset.terminalTheme = terminalTheme;
  }, [terminalTheme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TERMINAL_THEME_STORAGE_KEY, terminalThemeMode);
    } catch {
      // ignore storage failures
    }
  }, [terminalThemeMode]);

  const value = useMemo(
    () => ({
      uiTheme,
      terminalTheme,
      terminalThemeMode,
      setUiTheme,
      toggleUiTheme,
      setTerminalThemeMode
    }),
    [terminalTheme, terminalThemeMode, toggleUiTheme, uiTheme]
  );

  return <ThemeSettingsContext.Provider value={value}>{children}</ThemeSettingsContext.Provider>;
}

export function useThemeSettings() {
  const value = useContext(ThemeSettingsContext);

  if (!value) {
    throw new Error("useThemeSettings must be used within ThemeProvider");
  }

  return value;
}
