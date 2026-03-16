"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CustomSliderProps {
  value: number;
  onChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  trackClassName?: string;
  thumbClassName?: string;
  rangeClassName?: string;
  renderThumb?: (value: number) => React.ReactNode;
}

export function CustomSlider({
  value,
  onChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  className,
  trackClassName,
  thumbClassName,
  rangeClassName,
  renderThumb,
}: CustomSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local value with prop value when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const updateValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.min(Math.max(x / rect.width, 0), 1);
      
      const rawValue = min + percentage * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      const finalValue = Math.min(Math.max(steppedValue, min), max);
      
      setLocalValue(finalValue);
      onChange?.(finalValue);
    },
    [min, max, step, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    trackRef.current?.setPointerCapture(e.pointerId);
    updateValue(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      e.preventDefault();
      updateValue(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(false);
    trackRef.current?.releasePointerCapture(e.pointerId);
    // Ensure final value is synced
    onChange?.(localValue);
    onValueCommit?.(localValue);
  };

  const percentage = ((localValue - min) / (max - min)) * 100;

  return (
    <div
      className={cn(
        "relative flex w-full items-center touch-none select-none py-4 cursor-pointer group",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      // onPointerLeave is not needed if we use setPointerCapture
    >
      {/* Track Background */}
      <div
        ref={trackRef}
        className={cn(
          "relative h-4 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 transition-colors",
          trackClassName
        )}
      >
        {/* Fill Gradient */}
        <div
          className={cn(
            "absolute h-full rounded-full bg-brand-blue transition-all duration-75 ease-out",
            "group-hover:bg-brand-blue/90 group-active:bg-brand-blue/80",
            rangeClassName
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Thumb Knob */}
      <div
        className={cn(
          "pointer-events-none absolute h-7 w-7 flex items-center justify-center rounded-full bg-white shadow-[0_4px_10px_rgba(0,0,0,0.15)] ring-1 ring-black/5 transition-all duration-75 ease-out dark:bg-slate-200",
          "group-hover:scale-110 group-active:scale-110 group-active:shadow-[0_0_0_4px_rgba(59,130,246,0.2)]",
          thumbClassName
        )}
        style={{
          left: `${percentage}%`,
          transform: `translateX(-50%)`,
        }}
      >
        {renderThumb ? renderThumb(localValue) : <div className="h-2 w-2 rounded-full bg-brand-blue/80" />}
      </div>
    </div>
  );
}
