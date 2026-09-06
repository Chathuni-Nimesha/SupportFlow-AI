import { useId, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, Navigate, useNavigate } from "react-router-dom"

import { AuthDivider } from "@/components/auth/auth-divider"
import { FormField } from "@/components/auth/form-field"
import { PasswordInput } from "@/components/auth/password-input"
import { SocialAuthButton } from "@/components/auth/social-auth-button"
import { fadeUp, staggerContainer } from "@/components/landing/motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-provider"
import { registerSchema, type RegisterFormValues } from "@/schemas/auth"
import { getApiErrorMessage } from "@/utils/api-error"
import { cn } from "@/lib/utils"

const fieldClassName = "h-12 rounded-2xl bg-white px-3.5 text-sm shadow-soft"

type RegisterFormProps = {
  className?: string
}

export function RegisterForm({ className }: RegisterFormProps) {
  const firstNameId = useId()
  const lastNameId = useId()
  const companyId = useId()
  const emailId = useId()
  const passwordId = useId()
  const confirmPasswordId = useId()
  const navigate = useNavigate()
  const { register: registerAccount, isAuthenticated, isLoading } = useAuth()
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const onSubmit = async (values: RegisterFormValues) => {
    setApiError(null)
    try {
      await registerAccount({
        first_name: values.firstName,
        last_name: values.lastName,
        company_name: values.companyName,
        email: values.email,
        password: values.password,
      })
      navigate("/dashboard", { replace: true })
    } catch (error) {
      setApiError(getApiErrorMessage(error, "Unable to create your account."))
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={cn("w-full", className)}
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Create your account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Start resolving customer conversations with AI in minutes.
        </p>
      </motion.div>

      <motion.form
        variants={fadeUp}
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id={firstNameId}
            label="First name"
            error={errors.firstName?.message}
          >
            <Input
              id={firstNameId}
              autoComplete="given-name"
              placeholder="Maya"
              aria-invalid={!!errors.firstName}
              aria-describedby={
                errors.firstName ? `${firstNameId}-error` : undefined
              }
              className={fieldClassName}
              {...register("firstName")}
            />
          </FormField>

          <FormField
            id={lastNameId}
            label="Last name"
            error={errors.lastName?.message}
          >
            <Input
              id={lastNameId}
              autoComplete="family-name"
              placeholder="Chen"
              aria-invalid={!!errors.lastName}
              aria-describedby={
                errors.lastName ? `${lastNameId}-error` : undefined
              }
              className={fieldClassName}
              {...register("lastName")}
            />
          </FormField>
        </div>

        <FormField
          id={companyId}
          label="Company name"
          error={errors.companyName?.message}
        >
          <Input
            id={companyId}
            autoComplete="organization"
            placeholder="Acme Support Co."
            aria-invalid={!!errors.companyName}
            aria-describedby={
              errors.companyName ? `${companyId}-error` : undefined
            }
            className={fieldClassName}
            {...register("companyName")}
          />
        </FormField>

        <FormField
          id={emailId}
          label="Work email"
          error={errors.email?.message}
        >
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            className={fieldClassName}
            {...register("email")}
          />
        </FormField>

        <FormField
          id={passwordId}
          label="Password"
          error={errors.password?.message}
        >
          <PasswordInput
            id={passwordId}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? `${passwordId}-error` : undefined
            }
            {...register("password")}
          />
        </FormField>

        <FormField
          id={confirmPasswordId}
          label="Confirm password"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id={confirmPasswordId}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={
              errors.confirmPassword
                ? `${confirmPasswordId}-error`
                : undefined
            }
            {...register("confirmPassword")}
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
          className="mt-2 h-12 w-full rounded-2xl text-sm font-semibold shadow-soft"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </motion.form>

      <motion.div variants={fadeUp} className="mt-6 space-y-4">
        <AuthDivider />
        <SocialAuthButton />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-primary transition hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </motion.div>
  )
}
