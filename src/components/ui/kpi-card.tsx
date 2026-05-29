import React from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

export interface KPICardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  change?: { value: string; positive: boolean; label?: string }
  iconContainerClass?: string
  /** Render the filled accent variant (white text on indigo gradient). */
  highlighted?: boolean
}

// ─── Sparkline accent color from the card's existing accent hint ─────────────
// NOTE: the `icon` / `iconContainerClass` props remain in the interface for
// backward compatibility with existing call sites, but this reference design
// (label + value + corner sparkline) intentionally omits the icon badge.
function pickSparkColor(iconContainerClass?: string): string {
  const c = iconContainerClass ?? ''
  if (c.includes('emerald'))                  return '#10B981'
  if (c.includes('rose') || c.includes('red')) return '#EF4444'
  if (c.includes('amber'))                    return '#F59E0B'
  if (c.includes('blue'))                     return '#3B82F6'
  if (c.includes('indigo'))                   return '#6366F1'
  return '#6D5BF6' // app indigo accent (default)
}

// Gentle synthetic curve used as the top-right sparkline (cosmetic flourish).
const SPARK_DATA = [
  { i: 0, v: 30 }, { i: 1, v: 26 }, { i: 2, v: 40 },
  { i: 3, v: 34 }, { i: 4, v: 48 }, { i: 5, v: 42 }, { i: 6, v: 56 },
]

/**
 * KPICard — RTL-aware metric card.
 *
 * Design (matches reference):
 *   - Label on top (logical start)
 *   - Big value below
 *   - Small sparkline tucked in the top-end corner
 *   - `highlighted` renders a filled indigo-gradient card with white text
 *
 * RTL: `text-start` flips to right in Arabic; numeric value uses dir="ltr".
 */
export function KPICard({
  title,
  value,
  subtitle,
  change,
  iconContainerClass,
  highlighted = false,
}: KPICardProps) {
  const gradId = React.useId()
  const sparkColor = highlighted ? '#FFFFFF' : pickSparkColor(iconContainerClass)

  return (
    <div
      className={cn(
        'relative overflow-hidden p-5 min-h-[120px] rounded-[12px] transition-colors',
        highlighted
          ? 'border-0 text-white bg-gradient-to-br from-[#7C6BF8] via-[#6D5BF6] to-[#5B49E8] shadow-[0_12px_30px_-12px_rgba(109,91,246,0.55)]'
          : 'kpi-card',
      )}
    >
      {/* Sparkline — top-end corner */}
      <div
        className="pointer-events-none absolute top-4 end-4 w-[88px] h-[34px] opacity-90"
        dir="ltr"
        aria-hidden="true"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={SPARK_DATA} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`kpi-spark-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={highlighted ? 0.45 : 0.25} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={sparkColor}
              strokeWidth={2}
              fill={`url(#kpi-spark-${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Title — text-start = left in LTR, right in RTL */}
      <p
        className={cn(
          'relative text-[13px] font-semibold text-start leading-tight pe-24',
          highlighted ? 'text-white/90' : 'text-muted-foreground',
        )}
      >
        {title}
      </p>

      {/* Value — always LTR so DH 1,234.56 / ١٬٢٣٤٫٥٦ درهم reads correctly */}
      <p
        className={cn(
          'relative text-[26px] leading-none font-bold tracking-tight text-start mt-3',
          highlighted ? 'text-white' : 'text-card-foreground',
        )}
        dir="ltr"
      >
        {value}
      </p>

      {/* Change indicator + subtext */}
      <div className="relative flex items-center gap-1.5 mt-2.5 flex-wrap">
        {change && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-bold',
              highlighted
                ? 'text-white'
                : change.positive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
            )}
            dir="ltr"
          >
            {change.positive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {change.value}
          </span>
        )}
        <span
          className={cn(
            'text-[11px] font-medium text-start',
            highlighted ? 'text-white/80' : 'text-muted-foreground',
          )}
        >
          {change?.label ?? subtitle}
        </span>
      </div>
    </div>
  )
}
