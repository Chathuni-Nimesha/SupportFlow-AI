import { AuthShell, RegisterForm } from "@/components/auth"

export function RegisterPage() {
  return (
    <AuthShell
      formMaxWidthClassName="max-w-lg"
      footer="Free to start · No credit card required"
    >
      <RegisterForm />
    </AuthShell>
  )
}
