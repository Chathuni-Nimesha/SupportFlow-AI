import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

type BrandLogoProps = {
  to?: string
  className?: string
  markClassName?: string
  showWordmark?: boolean
}

export function BrandLogo({
  to = "/",
  className,
  markClassName,
  showWordmark = true,
}: BrandLogoProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      aria-label="SupportFlow AI home"
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-soft transition-transform group-hover:scale-105",
          markClassName,
        )}
      >
        SF
      </span>
      {showWordmark ? (
        <span className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          SupportFlow AI
        </span>
      ) : null}
    </Link>
  )
}
