import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FormFieldProps = {
  id: string
  label: string
  error?: string
  className?: string
  children: ReactNode
  hint?: ReactNode
  labelAside?: ReactNode
}

export function FormField({
  id,
  label,
  error,
  className,
  children,
  hint,
  labelAside,
}: FormFieldProps) {
  const errorId = `${id}-error`

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  )
}
