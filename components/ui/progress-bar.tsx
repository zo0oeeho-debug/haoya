"use client";

import React from "react";

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>压缩进度</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/90">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 transition-[width] duration-150"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

