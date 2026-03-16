"use client";

import React from "react";
import clsx from "clsx";

import Image from "next/image";

export function BrandLogo() {
  return (
    <a
      href="/"
      className={clsx(
        "group inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium",
        "text-slate-800 hover:text-slate-600 dark:text-slate-100 dark:hover:text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-white"
      )}
    >
      <div className="relative h-[50px] w-[50px]">
        <Image
          src="/images/logo.png"
          alt="好压 Logo"
          fill
          className="object-contain"
          priority
          unoptimized
        />
      </div>

    </a>
  );
}
