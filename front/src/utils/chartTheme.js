// Tema común de Chart.js para Greenborn.
// - applyChartDefaults(Chart): setea Chart.defaults una vez (fuente, colores, tooltips, grillas).
// - withTheme(type, data, options): colorea datasets sin color y mergea opciones.
// - CHART_PALETTE: colores de serie en orden.

export const CHART_COLORS = {
  primary: '#16a34a',
  accent: '#0f766e',
  info: '#0284c7',
  warning: '#d97706',
  danger: '#dc2626',
  violet: '#7c3aed',
  slate: '#64748b',
  text: '#334155',
  muted: '#64748b',
  grid: 'rgba(148, 163, 184, 0.18)',
  border: '#e2e8f0',
  tooltipBg: '#0f172a'
}

export const CHART_PALETTE = [
  CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.info,
  CHART_COLORS.warning, CHART_COLORS.violet, CHART_COLORS.danger, CHART_COLORS.slate
]

export function alpha(hex, a) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

let applied = false
export function applyChartDefaults(Chart) {
  if (applied) return
  applied = true
  const d = Chart.defaults
  d.font.family = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  d.font.size = 12
  d.color = CHART_COLORS.muted
  d.borderColor = CHART_COLORS.grid
  d.maintainAspectRatio = true
  d.interaction = { mode: 'index', intersect: false }

  d.plugins.legend.labels.usePointStyle = true
  d.plugins.legend.labels.boxWidth = 8
  d.plugins.legend.labels.boxHeight = 8
  d.plugins.legend.labels.padding = 16
  d.plugins.legend.labels.color = CHART_COLORS.text

  const t = d.plugins.tooltip
  t.backgroundColor = CHART_COLORS.tooltipBg
  t.titleColor = '#f8fafc'
  t.bodyColor = '#e2e8f0'
  t.borderColor = 'rgba(255,255,255,0.08)'
  t.borderWidth = 1
  t.padding = 10
  t.cornerRadius = 8
  t.boxPadding = 4
  t.usePointStyle = true
  t.titleFont = { weight: '600' }

  d.elements.line.tension = 0.3
  d.elements.line.borderWidth = 2
  d.elements.point.radius = 2.5
  d.elements.point.hoverRadius = 5
  d.elements.point.hitRadius = 8
  d.elements.bar.borderRadius = 6
  d.elements.arc.borderWidth = 2
  d.elements.arc.borderColor = '#fff'

  // Escalas: grillas suaves, sin borde de eje
  for (const k of ['linear', 'category', 'time', 'logarithmic']) {
    const s = d.scales[k]
    if (!s) continue
    s.grid = { ...(s.grid || {}), color: CHART_COLORS.grid, drawTicks: false }
    s.border = { ...(s.border || {}), display: false }
    s.ticks = { ...(s.ticks || {}), padding: 8, color: CHART_COLORS.muted }
  }
}

/** Asigna colores de marca a datasets que no los definan. No pisa colores explícitos. */
export function themeData(type, data) {
  if (!data || !Array.isArray(data.datasets)) return data
  const perPoint = ['pie', 'doughnut', 'polarArea'].includes(type)
  return {
    ...data,
    datasets: data.datasets.map((ds, i) => {
      const c = CHART_PALETTE[i % CHART_PALETTE.length]
      const out = { ...ds }
      if (perPoint) {
        if (out.backgroundColor == null) out.backgroundColor = (data.labels || []).map((_, j) => CHART_PALETTE[j % CHART_PALETTE.length])
        return out
      }
      if (out.borderColor == null) out.borderColor = c
      if (out.backgroundColor == null) out.backgroundColor = type === 'bar' ? alpha(c, 0.85) : alpha(c, 0.12)
      if (type === 'line') {
        if (out.pointBackgroundColor == null) out.pointBackgroundColor = c
        if (out.pointBorderColor == null) out.pointBorderColor = '#fff'
      }
      return out
    })
  }
}
