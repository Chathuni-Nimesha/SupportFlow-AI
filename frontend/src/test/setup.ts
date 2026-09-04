import "@testing-library/jest-dom/vitest"

import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

import { api } from "@/services/api"

api.defaults.adapter = (config) => {
  const method = (config.method ?? "get").toUpperCase()
  const url = `${config.baseURL ?? ""}${config.url ?? ""}`
  return Promise.reject(
    new Error(`Unmocked API request in tests: ${method} ${url}`),
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub

Element.prototype.scrollIntoView = () => {}
HTMLElement.prototype.hasPointerCapture = () => false
HTMLElement.prototype.setPointerCapture = () => {}
HTMLElement.prototype.releasePointerCapture = () => {}
