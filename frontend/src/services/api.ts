import axios from "axios"

import { resolveApiBaseUrl } from "@/lib/api-base-url"

export const api = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token")
      window.dispatchEvent(new Event("auth:logout"))
    }

    return Promise.reject(error)
  },
)
