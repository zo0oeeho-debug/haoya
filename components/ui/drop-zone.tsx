"use client";

import React from "react";
import clsx from "clsx";

interface DropZoneProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  mode?: "image" | "pdf";
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

export function DropZone({
  active,
  mode = "pdf",
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  children,
  className,
  ...props
}: DropZoneProps) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      className={clsx(
        "drop-zone cursor-pointer", // Added cursor-pointer
        "relative flex flex-col items-center justify-center transition-all duration-300 ease-out",
        "py-10 px-6", // Added internal padding to ensure at least 40px spacing
        active
          ? clsx(
              "scale-[1.02] ring-4",
              mode === "image" 
                ? "border-[#72B4C3]/40 bg-[#72B4C3]/10 ring-[#72B4C3]/20 dark:border-[#72B4C3]/40 dark:bg-[#72B4C3]/20"
                : "border-[#6495ED]/40 bg-[#6495ED]/5 ring-[#6495ED]/10 dark:border-[#6495ED]/40 dark:bg-[#6495ED]/10"
            )
          : clsx(
              "hover:scale-[1.01]",
              mode === "image"
                ? "hover:border-[#72B4C3]/40 hover:bg-[#72B4C3]/10 dark:hover:border-[#72B4C3]/40 dark:hover:bg-[#72B4C3]/10"
                : "hover:border-[#6495ED]/40 hover:bg-[#6495ED]/10 dark:hover:border-[#6495ED]/30 dark:hover:bg-[#6495ED]/10"
            ),
        "rounded-3xl border-2 border-dashed border-brand-gray/30 dark:border-white/10",
        mode === "image" 
          ? "bg-[#72B4C3]/5 dark:bg-[#72B4C3]/5"
          : "bg-[#6495ED]/5 dark:bg-[#6495ED]/5",
        className
      )}
      {...props}
    >
      {children}
      
      {/* Active Overlay */}
      {active && (
        <div className={clsx(
          "pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-3xl backdrop-blur-[4px] transition-all duration-300",
          mode === "image" ? "bg-[#72B4C3]/10 dark:bg-[#72B4C3]/10" : "bg-[#6495ED]/5 dark:bg-[#6495ED]/10"
        )}>
          <div className={clsx(
            "bounce-animation relative overflow-hidden rounded-2xl px-8 py-4 text-base font-medium shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all",
            "bg-white/60 backdrop-blur-xl border border-white/40", // Glass effect
            "text-[#0F172A]/80", // Blue-black 80% opacity
            "dark:bg-slate-900/60 dark:border-white/10 dark:text-white/90"
          )}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50 dark:from-white/10" />
            <span className="relative z-10 flex items-center gap-2">
              松手即可添加
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
