import * as React from "react"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    value?: number[]
    onValueChange?: (value: number[]) => void
    max?: number
    step?: number
  }
>(({ className, value, onValueChange, max = 100, step = 1, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onValueChange) {
      onValueChange([parseFloat(e.target.value)])
    }
  }

  return (
    <input
      type="range"
      className={cn(
        "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary",
        className
      )}
      ref={ref}
      value={value ? value[0] : 0}
      onChange={handleChange}
      max={max}
      step={step}
      {...props}
    />
  )
})
Slider.displayName = "Slider"

export { Slider }
