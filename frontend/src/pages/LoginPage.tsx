import { AuthShell, LoginForm } from "@/components/auth"

export function LoginPage() {
  return (
    <AuthShell footer="By continuing, you agree to our Terms and Privacy Policy.">
      <LoginForm />
    </AuthShell>
  )
}
