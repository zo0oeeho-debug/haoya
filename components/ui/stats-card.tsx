"use client";

import React from "react";
import { formatBytes } from "@/lib/utils/file";

export function StatsCard({
  fileName,
  originalSize,
  compressedSize
}: {
  fileName: string;
  originalSize: number;
  compressedSize: number;
}) {
  const ratio = originalSize > 0 ? 1 - compressedSize / originalSize : 0;
  const compressedPercent = originalSize > 0 ? (compressedSize / originalSize) * 100 : 0;

  return (
    <div className="grid gap-4 rounded-2xl bg-slate-900/70 p-4 ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
        <span className="truncate">{fileName}</span>
        <span className="shrink-0 text-slate-500">
          {formatBytes(originalSize)} →{" "}
          <span className="text-cyan-400">{formatBytes(compressedSize)}</span>
        </span>
      </div>

      <div className="flex gap-3 text-xs text-slate-400">
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between">
            <span>原始体积</span>
            <span>{formatBytes(originalSize)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between">
            <span>压缩后</span>
            <span>{formatBytes(compressedSize)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              style={{ width: `${Math.max(0, Math.min(100, compressedPercent))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-emerald-400/90">
        <span>压缩率</span>
        <span>{ratio > 0 ? `减少 ${(ratio * 100).toFixed(1)}%` : "无明显变化"}</span>
      </div>
    </div>
  );
}

