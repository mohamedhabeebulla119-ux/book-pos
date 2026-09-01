import React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  fullWidth?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          {
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'primary',
            'bg-muted text-foreground hover:bg-muted/80': variant === 'secondary',
            'border border-border bg-transparent hover:bg-muted': variant === 'outline',
            'bg-transparent hover:bg-muted': variant === 'ghost',
            'h-8 px-3 text-xs rounded-full': size === 'sm',
            'h-10 px-5 text-sm rounded-full': size === 'md',
            'h-12 px-8 text-base rounded-full': size === 'lg',
            'h-10 w-10 rounded-full': size === 'icon',
            'w-full': fullWidth,
          },
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
