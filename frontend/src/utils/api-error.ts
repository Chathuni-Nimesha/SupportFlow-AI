import { isAxiosError } from "axios"

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

    if (error.message) {
      return error.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
