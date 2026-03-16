"use client";

import React from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { Mode } from "@/lib/utils/file";

const ITEMS = [
  { key: "pdf", label: "PDF处理", desc: "文件拆分，批量压缩" },
  { key: "image", label: "图片压缩", desc: "png, jpg, gif, svg" }
] as const;

export function ModeToggle({
  mode,
  onChange
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div className="flex items-center justify-center p-1 rounded-2xl">
      {ITEMS.map((item) => {
        const isActive = mode === item.key;
        
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={clsx(
              "relative flex flex-col items-center px-6 py-2 transition-colors duration-200 rounded-xl",
              isActive
                ? "text-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
            )}
          >
            <span className="text-sm sm:text-base font-normal translate-y-1 tracking-[1px] relative z-10">{item.label}</span>
            
            {isActive && (
              <motion.div
                layoutId="mode-bg"
                className="absolute inset-x-2 inset-y-1 rounded-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
