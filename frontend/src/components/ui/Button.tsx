import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant = 'solid' | 'outline' | 'ghost'
type Size = 'md' | 'sm'

const VARIANT: Record<Variant, string> = {
  solid: 'bg-ink text-bg border border-ink hover:bg-transparent hover:text-ink',
  outline: 'border border-ink text-ink hover:bg-ink hover:text-bg',
  ghost: 'border border-transparent text-muted hover:text-ink',
}

const SIZE: Record<Size, string> = {
  md: 'h-12 px-5 type-body',
  sm: 'h-9 px-3 type-small',
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-[2px] font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-40'

interface CommonProps {
  variant?: Variant
  size?: Size
  children: ReactNode
  className?: string
}

export const Button = forwardRef<HTMLButtonElement, CommonProps & ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button({ variant = 'solid', size = 'md', className = '', type = 'button', children, ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={`${base} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
        {children}
      </button>
    )
  },
)

/** Same look as Button, for navigation. */
export function ButtonLink({ variant = 'solid', size = 'md', className = '', children, ...rest }: CommonProps & LinkProps) {
  return (
    <Link className={`${base} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {children}
    </Link>
  )
}
