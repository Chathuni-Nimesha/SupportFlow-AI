import { isAxiosError } from "axios"

function isGenericAxiosMessage(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return true
  return (
    /^network error$/i.test(trimmed) ||
    /^timeout of \d+ms exceeded$/i.test(trimmed) ||
    /^request failed with status code \d+$/i.test(trimmed)
  )
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (typeof detail === "string" && detail.trim()) {
      return detail
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0]
      if (typeof first?.msg === "string") {
        return first.msg.replace(/^Value error,\s*/i, "")
      }
    }

    return fallback
  }

  if (error instanceof Error && error.message && !isGenericAxiosMessage(error.message)) {
    return error.message
  }

  return fallback
}
