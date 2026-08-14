export function UnavailablePanel({
  title = "Not available",
  message,
}: {
  title?: string
  message: string
}) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {message}
      </p>
    </div>
  )
}
