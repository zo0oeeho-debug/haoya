"use client";

import React, { useEffect, useState } from "react";
import { BrandLogo } from "@/components/ui/logo";

import { useMode } from "@/context/mode-context";
import clsx from "clsx";

export function TopNav() {
  const { mode, setMode } = useMode();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={clsx(
        "sticky top-0 z-30 transition-all duration-300 w-full",
        isScrolled ? "bg-white/80 backdrop-blur-md border-b border-slate-200/50 dark:bg-slate-950/80 dark:border-white/5" : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="relative mx-auto flex h-16 sm:h-20 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex-shrink-0">
          <BrandLogo />
        </div>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 md:flex items-center gap-2 rounded-lg px-2 py-1.5">
          <button 
            onClick={() => setMode('pdf')}
            className={clsx(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-300",
              mode === 'pdf' 
                ? "text-slate-900 font-bold hover:bg-slate-500/[0.08] dark:text-white dark:hover:bg-slate-400/[0.08]" 
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-500/[0.08] dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-400/[0.08]"
            )}
          >
            PDF处理
          </button>
          <button 
            onClick={() => setMode('image')}
            className={clsx(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-300",
              mode === 'image' 
                ? "text-slate-900 font-bold hover:bg-slate-500/[0.08] dark:text-white dark:hover:bg-slate-400/[0.08]" 
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-500/[0.08] dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-400/[0.08]"
            )}
          >
            图片压缩
          </button>
        </nav>


      </div>
    </header>
  );
}
