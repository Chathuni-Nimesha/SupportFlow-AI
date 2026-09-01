import { useId, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"

import { AuthDivider } from "@/components/auth/auth-divider"
import { FormField } from "@/components/auth/form-field"
import { PasswordInput } from "@/components/auth/password-input"
import { SocialAuthButton } from "@/components/auth/social-auth-button"
import { fadeUp, staggerContainer } from "@/components/landing/motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-provider"
import { loginSchema, type LoginFormValues } from "@/schemas/auth"
import { getApiErrorMessage } from "@/utils/api-error"
import { cn } from "@/lib/utils"

type LoginFormProps = {
  className?: string
}

export function LoginForm({ className }: LoginFormProps) {
  const emailId = useId()
  const passwordId = useId()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, isLoading } = useAuth()
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const onSubmit = async (values: LoginFormValues) => {
    setApiError(null)
    try {
      await login({
        email: values.email,
        password: values.password,
      })
      const redirectTo =
        typeof location.state === "object" &&
        location.state &&
        "from" in location.state &&
        typeof location.state.from === "string"
          ? location.state.from
          : "/dashboard"
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setApiError(getApiErrorMessage(error, "Unable to sign in."))
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={cn("w-full max-w-md", className)}
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Sign in to manage conversations, knowledge, and AI performance.
        </p>
      </motion.div>

      <motion.form
        variants={fadeUp}
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 space-y-5"
        noValidate
      >
        <FormField id={emailId} label="Email" error={errors.email?.message}>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            className="h-12 rounded-2xl bg-white px-3.5 text-sm shadow-soft"
            {...register("email")}
          />
        </FormField>

        <FormField
          id={passwordId}
          label="Password"
          error={errors.password?.message}
          labelAside={
            <span className="text-xs font-medium text-muted-foreground">
              Password reset is not available yet.
            </span>
          }
        >
          <PasswordInput
            id={passwordId}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? `${passwordId}-error` : undefined
            }
            {...register("password")}
          />
        </FormField>

        {apiError ? (
          <p
            className="rounded-2xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {apiError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-2xl text-sm font-semibold shadow-soft"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </motion.form>

      <motion.div variants={fadeUp} className="mt-6 space-y-4">
        <AuthDivider />
        <SocialAuthButton />
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-primary transition hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Create account
          </Link>
        </p>
      </motion.div>
    </motion.div>
  )
}
