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
          "focus-ring inline-flex items-center justify-center font-semibold tracking-tight transition-all duration-300 ease-out focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]",
          {
            'bg-gradient-cta hover:bg-gradient-cta-hover text-white shadow-glow hover:shadow-float': variant === 'primary',
            'bg-card text-primary border border-mint-deep shadow-card hover:bg-surface-strong': variant === 'secondary',
            'border border-primary/35 bg-transparent text-primary hover:bg-primary-soft': variant === 'outline',
            'bg-transparent text-foreground hover:bg-primary-soft': variant === 'ghost',
            'h-9 px-3.5 text-xs rounded-full': size === 'sm',
            'h-11 px-5 text-sm rounded-full': size === 'md',
            'h-13 px-8 text-base rounded-full': size === 'lg',
            'h-11 w-11 rounded-full': size === 'icon',
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
