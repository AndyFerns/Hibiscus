/**
 * ============================================================================
 * StatsChart — Zero-Dependency SVG Chart Component
 * ============================================================================
 *
 * Pure SVG bar chart for visualizing daily study activity.
 * No external chart libraries — keeps the bundle lean.
 *
 * FEATURES:
 * - Responsive bar chart with hover tooltips
 * - Day labels along the x-axis
 * - Gradient fill for visual polish
 * - Animated bar height on mount
 * ============================================================================
 */

import type { DailyAggregate } from "./statsTypes"

interface StatsChartProps {
  /** Daily aggregate data to display */
  data: DailyAggregate[]
  /** Chart height in pixels */
  height?: number
}

export function StatsChart({ data, height = 160 }: StatsChartProps) {
  if (data.length === 0) return null

  const padding = { top: 10, right: 10, bottom: 28, left: 10 }
  const chartWidth = 280
  const chartHeight = height
  const innerW = chartWidth - padding.left - padding.right
  const innerH = chartHeight - padding.top - padding.bottom

  // Find max value for scaling (minimum 10 to avoid flat charts)
  const maxMinutes = Math.max(10, ...data.map((d) => d.totalMinutes))

  // Bar dimensions
  const barGap = 3
  const barWidth = Math.max(4, (innerW - barGap * (data.length - 1)) / data.length)

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="stats-chart-svg"
      width="100%"
      height={chartHeight}
    >
      {/* Gradient definition */}
      <defs>
        <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent, #7aa2f7)" />
          <stop offset="100%" stopColor="var(--accent-secondary, #bb9af7)" />
        </linearGradient>
      </defs>

      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.totalMinutes / maxMinutes) * innerH
        const x = padding.left + i * (barWidth + barGap)
        const y = padding.top + innerH - barH

        // Day label (abbreviated)
        const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString("en", {
          weekday: "narrow",
        })

        return (
          <g key={d.date}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(0, barH)}
              fill={d.totalMinutes > 0 ? "url(#bar-gradient)" : "var(--border)"}
              rx={2}
              className="stats-chart-bar"
            >
              <title>{`${d.date}: ${d.totalMinutes} min (${d.sessions} sessions)`}</title>
            </rect>

            {/* Day label */}
            <text
              x={x + barWidth / 2}
              y={chartHeight - 4}
              textAnchor="middle"
              fill="var(--text-subtle, #5c6370)"
              fontSize="8"
              fontFamily="var(--font-ui)"
            >
              {dayLabel}
            </text>
          </g>
        )
      })}

      {/* Zero line */}
      <line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={chartWidth - padding.right}
        y2={padding.top + innerH}
        stroke="var(--border)"
        strokeWidth={0.5}
      />
    </svg>
  )
}
