"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export const THEME_STORAGE_KEY = "ticketground:theme";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<Theme, "system">;

type ThemeState = {
  readonly theme: Theme;
  readonly resolvedTheme: ResolvedTheme;
};

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function themeState(theme: Theme): ThemeState {
  return {
    theme,
    resolvedTheme: theme === "system" ? systemTheme() : theme,
  };
}

function storedTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : "system";
}

function applyResolvedTheme(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
}

function initialThemeState(): ThemeState {
  if (typeof window === "undefined") {
    return { theme: "system", resolvedTheme: "light" };
  }

  const theme = storedTheme();
  const activeTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  const resolvedTheme = theme === "system" ? activeTheme : theme;
  return { theme, resolvedTheme };
}

export function useTheme() {
  const [state, setState] = useState<ThemeState>(initialThemeState);

  useLayoutEffect(() => {
    const syncTheme = () => {
      const nextState = themeState(storedTheme());
      applyResolvedTheme(nextState.resolvedTheme);
      setState(nextState);
    };

    syncTheme();
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      const nextState = themeState(storedTheme());
      applyResolvedTheme(nextState.resolvedTheme);
      setState(nextState);
    };

    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  useEffect(() => {
    if (state.theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      const currentTheme = storedTheme();
      if (currentTheme !== "system") {
        const nextState = themeState(currentTheme);
        applyResolvedTheme(nextState.resolvedTheme);
        setState(nextState);
        return;
      }

      const nextState = themeState("system");
      applyResolvedTheme(nextState.resolvedTheme);
      setState(nextState);
    };

    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [state.theme]);

  const setTheme = useCallback((theme: Theme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    const nextState = themeState(theme);
    applyResolvedTheme(nextState.resolvedTheme);
    setState(nextState);
  }, []);

  return { ...state, setTheme };
}
