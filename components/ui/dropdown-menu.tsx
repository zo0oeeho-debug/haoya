"use client"

import * as React from "react"
import { Check, ChevronRight, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

// Simple DropdownMenu implementation using standard React state
// Note: This is a simplified version without advanced keyboard navigation/focus management of Radix

const DropdownMenuContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({ open: false, setOpen: () => {} })

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const { open, setOpen } = React.useContext(DropdownMenuContext)
  
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<any>
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e)
        setOpen(!open)
      },
      "aria-expanded": open,
      ...props
    })
  }

  return (
    <button
      ref={ref}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" | "center" }
>(({ className, align = "center", ...props }, ref) => {
  const { open } = React.useContext(DropdownMenuContext)

  if (!open) return null

  const alignmentClass = {
    start: "left-0",
    end: "right-0",
    center: "left-1/2 -translate-x-1/2"
  }[align]

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        alignmentClass,
        className
      )}
      {...props}
    />
  )
})
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = "DropdownMenuItem"

// Export simplified versions of other components
const DropdownMenuCheckboxItem = DropdownMenuItem
const DropdownMenuRadioItem = DropdownMenuItem
const DropdownMenuLabel = DropdownMenuItem
const DropdownMenuSeparator = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
)
const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
)
const DropdownMenuGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>
const DropdownMenuPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>
const DropdownMenuSub = ({ children }: { children: React.ReactNode }) => <>{children}</>
const DropdownMenuSubContent = DropdownMenuContent
const DropdownMenuSubTrigger = DropdownMenuItem
const DropdownMenuRadioGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
