import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/components/ui/utils"
import { iconButtonName } from "@/components/ui/iconButtonName"

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--color-execution))] text-black hover:bg-[hsl(var(--color-execution))]/90 shadow-sm",
        destructive: "bg-[hsl(var(--color-error))] text-white hover:bg-[hsl(var(--color-error))]/90 shadow-sm",
        outline: "border border-white/10 bg-transparent hover:bg-white/5 text-neutral-300 hover:text-white",
        secondary: "bg-[hsl(var(--layer-intent))] text-[hsl(var(--fg-intent))] hover:bg-[hsl(var(--layer-state))] shadow-sm",
        ghost: "hover:bg-[hsl(var(--color-intent))]/10 hover:text-[hsl(var(--color-intent))] text-[hsl(var(--fg-orientation))]",
        link: "text-[hsl(var(--color-intent))] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-11 w-11 lg:h-10 lg:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const iconName = size === "icon" && !asChild ? iconButtonName(props) : undefined
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      aria-label={iconName}
      {...props} />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }