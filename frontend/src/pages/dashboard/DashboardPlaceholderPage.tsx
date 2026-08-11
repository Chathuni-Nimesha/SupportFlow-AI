type DashboardPlaceholderPageProps = {
  title?: string
  description?: string
}

export function DashboardPlaceholderPage({
  title = "Dashboard",
  description = "This page is a placeholder. Content will be added in a later step.",
}: DashboardPlaceholderPageProps) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-soft sm:p-8">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">
        SupportFlow AI
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {description}
      </p>
    </section>
  )
}