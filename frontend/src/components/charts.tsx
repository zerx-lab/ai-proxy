// Dependency-free SVG charts tuned for the glass UI. All colors via CSS vars.

interface BarPoint {
  label: string
  value: number
  hint?: string
}

export function BarChart({
  data,
  height = 160,
  color = 'var(--accent)',
}: {
  data: BarPoint[]
  height?: number
  color?: string
}) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.value), 1)
  const gap = 3
  const w = 100 / data.length

  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 8)
        return (
          <g key={i}>
            <rect
              x={i * w + gap / 2}
              y={height - h}
              width={w - gap}
              height={h}
              fill={color}
              opacity={0.85}
            >
              <title>
                {d.label}: {d.value.toLocaleString()}
                {d.hint ? ` · ${d.hint}` : ''}
              </title>
            </rect>
          </g>
        )
      })}
    </svg>
  )
}

interface LineSeries {
  values: number[]
  color: string
}

export function LineChart({
  series,
  labels,
  height = 180,
}: {
  series: LineSeries[]
  labels: string[]
  height?: number
}) {
  const n = Math.max(...series.map((s) => s.values.length), 0)
  if (n === 0) return null
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const pad = 6
  const W = 100
  const H = height
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * (W - pad * 2) + pad)
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2)

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={0}
          x2={W}
          y1={H - pad - g * (H - pad * 2)}
          y2={H - pad - g * (H - pad * 2)}
          stroke="var(--border)"
          strokeWidth={0.4}
        />
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
        const area = `${x(0)},${H - pad} ${pts} ${x(s.values.length - 1)},${H - pad}`
        return (
          <g key={si}>
            <polygon points={area} fill={s.color} opacity={0.1} />
            <polyline
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
      <title>{labels.join(' · ')}</title>
    </svg>
  )
}
