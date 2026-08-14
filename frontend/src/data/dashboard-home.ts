export type TrendDirection = "up" | "down" | "neutral"

export type KpiMetric = {
  id: string
  label: string
  value: string
  change: string
  trend: TrendDirection
  helper: string
}
