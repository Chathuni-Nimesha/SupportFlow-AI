import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AuthUser } from "@/types/auth"

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

type AccountCardProps = {
  user: AuthUser
}

export function AccountCard({ user }: AccountCardProps) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Account</CardTitle>
            <CardDescription className="mt-1">
              Details from your signed-in account. Profile editing is not
              available yet.
            </CardDescription>
          </div>
          <Badge
            variant={user.is_active ? "secondary" : "outline"}
            className="rounded-full"
          >
            {user.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" value={user.first_name} />
          <Field label="Last name" value={user.last_name} />
          <Field label="Email" value={user.email} />
          <Field label="Company" value={user.company_name} />
        </div>
      </CardContent>
    </Card>
  )
}
