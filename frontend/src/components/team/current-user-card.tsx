import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { AuthUser } from "@/types/auth"

function initialsFromUser(user: AuthUser): string {
  const first = user.first_name.trim().charAt(0)
  const last = user.last_name.trim().charAt(0)
  const value = `${first}${last}`.toUpperCase()
  return value || user.email.trim().charAt(0).toUpperCase() || "?"
}

function Field({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

type CurrentUserCardProps = {
  user: AuthUser
}

export function CurrentUserCard({ user }: CurrentUserCardProps) {
  const initials = initialsFromUser(user)
  const fullName = `${user.first_name} ${user.last_name}`.trim()

  return (
    <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Your account</CardTitle>
            <CardDescription className="mt-1">
              Signed-in workspace account from authentication. This is not a
              team directory.
            </CardDescription>
          </div>
          <Avatar className="size-10 rounded-2xl">
            <AvatarFallback className="rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-foreground">{fullName}</p>
          <Badge
            variant={user.is_active ? "secondary" : "outline"}
            className="rounded-full"
          >
            {user.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" value={user.first_name} />
          <Field label="Last name" value={user.last_name} />
          <Field label="Email" value={user.email} />
          <Field label="Company name" value={user.company_name} />
        </div>
      </CardContent>
    </Card>
  )
}
