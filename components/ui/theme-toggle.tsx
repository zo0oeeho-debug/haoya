"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "mc-theme";

function getSystemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = theme === "dark" || (theme === "system" && getSystemPrefersDark());
  root.classList.toggle("dark", isDark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored ?? "system";
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);

    if (initial === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    return;
  }, []);

  const cycleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    applyTheme(next);
  };

  const label =
    theme === "light" ? "切换到深色模式" : theme === "dark" ? "跟随系统" : "切换到浅色模式";

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      className={clsx(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs transition",
        "border-brand-blue/10 bg-brand-white/60 text-slate-700 shadow-sm backdrop-blur",
        "hover:bg-brand-white dark:border-white/15 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-white"
      )}
    >
      {!mounted ? (
        <span className="h-3 w-3 rounded-full bg-slate-400/60" />
      ) : theme === "light" ? (
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <span className="h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]" />
        </span>
      ) : theme === "dark" ? (
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <span className="h-3 w-3 rounded-full bg-slate-900 shadow-[0_0_12px_rgba(15,23,42,0.9)]" />
          <span className="absolute -right-0.5 h-3 w-3 rounded-full bg-slate-50" />
        </span>
      ) : (
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="absolute inset-0 rounded-full border border-dashed border-slate-500/70" />
        </span>
      )}
    </button>
  );
}

