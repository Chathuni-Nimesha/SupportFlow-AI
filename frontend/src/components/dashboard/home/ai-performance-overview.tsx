import { motion } from "framer-motion"
import { TrendingUp } from "lucide-react"

import { aiPerformanceSeries } from "@/data/dashboard-home"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function buildPolyline(points: typeof aiPerformanceSeries) {
  const width = 560
  const height = 180
  const padding = 16
  const values = points.map((point) => point.value)
  const min = Math.min(...values) - 8
  const max = Math.max(...values) + 8

  const coords = points.map((point, index) => {
    const x =
      padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2)
    const y =
      height -
      padding -
      ((point.value - min) / Math.max(max - min, 1)) * (height - padding * 2)
    return { x, y, label: point.label, value: point.value }
  })

  const line = coords.map((point) => `${point.x},${point.y}`).join(" ")
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`

  return { width, height, coords, line, area }
}

export function AiPerformanceOverview() {
  const chart = buildPolyline(aiPerformanceSeries)
  const latest = aiPerformanceSeries[aiPerformanceSeries.length - 1]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <CardTitle className="text-lg">AI Performance Overview</CardTitle>
            <CardDescription className="mt-1">
              Weekly resolution trend across all support channels.
            </CardDescription>
          </div>
          <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right">
            <p className="flex items-center justify-end gap-1 text-xs font-medium text-primary">
              <TrendingUp className="size-3.5" aria-hidden />
              Weekly trend
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {latest.value}%
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-primary/[0.06] to-transparent p-3 sm:p-4">
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              className="h-48 w-full"
              role="img"
              aria-label="AI resolution rate line chart for the past week"
            >
              <defs>
                <linearGradient id="aiArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6C63FF" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6C63FF" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((line) => {
                const y = 28 + line * 40
                return (
                  <line
                    key={line}
                    x1="16"
                    x2={chart.width - 16}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-border"
                    strokeDasharray="4 6"
                  />
                )
              })}
              <polygon points={chart.area} fill="url(#aiArea)" />
              <polyline
                points={chart.line}
                fill="none"
                stroke="#6C63FF"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {chart.coords.map((point) => (
                <g key={point.label}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4.5"
                    fill="#fff"
                    stroke="#6C63FF"
                    strokeWidth="2.5"
                  />
                </g>
              ))}
            </svg>
            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {aiPerformanceSeries.map((point) => (
                <span key={point.label}>{point.label}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
