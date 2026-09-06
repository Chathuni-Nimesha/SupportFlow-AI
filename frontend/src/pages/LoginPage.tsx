import { AuthShell, LoginForm } from "@/components/auth"

export function LoginPage() {
  return (
    <AuthShell footer="Email and password login. Google sign-in is not available.">
      <LoginForm />
    </AuthShell>
  )
}
