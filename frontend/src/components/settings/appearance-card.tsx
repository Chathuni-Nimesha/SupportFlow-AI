import { ThemeToggle } from "@/components/dashboard/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTheme } from "@/context/theme-provider"

export function AppearanceCard() {
  const { theme } = useTheme()
  const label = theme === "dark" ? "Dark" : "Light"

  return (
    <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-lg">Appearance</CardTitle>
        <CardDescription className="mt-1">
          Theme is stored in this browser only. It is the same control as the
          dashboard header and is not saved to the backend.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 pt-5">
        <div>
          <p className="text-sm font-medium text-foreground">Color theme</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Current mode: {label}
          </p>
        </div>
        <ThemeToggle className="rounded-2xl border border-border/70 bg-background" />
      </CardContent>
    </Card>
  )
}
