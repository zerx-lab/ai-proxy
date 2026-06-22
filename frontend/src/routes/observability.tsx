import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { LineChart, BarChart } from '../components/charts'
import { auditApi, type Observability } from '../lib/api'
import { useToast } from '../contexts/toast'
import { useAuth } from '../contexts/auth'
import { useI18n } from '../contexts/i18n'

export const Route = createFileRoute('/observability')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' })
    }
  },
  component: ObservabilityPage,
})

const WINDOWS = [
  { hours: 1, key: 'obs.window.1h' as const },
  { hours: 24, key: 'obs.window.24h' as const },
  { hours: 168, key: 'obs.window.7d' as const },
  { hours: 720, key: 'obs.window.30d' as const },
]

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-3xl font-bold mt-2" style={{ color: accent ?? 'var(--text)' }}>
        {value}
      </p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  '2xx': 'var(--success)',
  '4xx': 'var(--warning)',
  '5xx': 'var(--danger)',
  '—': 'var(--text-faint)',
}

function ObservabilityPage() {
  const [data, setData] = useState<Observability | null>(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const { toast } = useToast()
  const { token, loading: authLoading } = useAuth()
  const { t, lang } = useI18n()
  const navigate = useNavigate()

  const fetchData = useCallback(
    async (h: number) => {
      setLoading(true)
      try {
        setData(await auditApi.observability(h))
      } catch (e) {
        toast({
          title: t('obs.loadFailed'),
          description: e instanceof Error ? e.message : String(e),
          variant: 'error',
        })
      } finally {
        setLoading(false)
      }
    },
    [toast, t],
  )

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      void navigate({ to: '/login' })
      return
    }
    void fetchData(hours)
  }, [authLoading, token, hours]) // eslint-disable-line react-hooks/exhaustive-deps

  const errPct =
    data && data.totalRequests > 0
      ? ((data.errorRequests / data.totalRequests) * 100).toFixed(1) + '%'
      : '0%'

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
    })

  return (
    <Layout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {t('obs.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            {t('obs.subtitle')}
          </p>
        </div>
        <div className="glass flex" style={{ padding: 3 }}>
          {WINDOWS.map((w) => (
            <button
              key={w.hours}
              onClick={() => setHours(w.hours)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                hours === w.hours
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {t(w.key)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : !data ? (
        <p style={{ color: 'var(--text-faint)' }}>{t('obs.noData')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label={t('obs.requests')} value={data.totalRequests.toLocaleString()} />
            <MetricCard
              label={t('obs.errors')}
              value={`${data.errorRequests.toLocaleString()} · ${errPct}`}
              accent={data.errorRequests > 0 ? 'var(--danger)' : undefined}
            />
            <MetricCard label={t('obs.avgLatency')} value={`${data.avgDurationMs} ms`} />
            <MetricCard label={t('obs.p95Latency')} value={`${data.p95DurationMs} ms`} />
          </div>

          {data.series.length === 0 ? (
            <div className="card text-center py-12" style={{ color: 'var(--text-faint)' }}>
              {t('obs.noData')}
            </div>
          ) : (
            <>
              {/* Trends */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Panel title={t('obs.requestTrend')}>
                  <LineChart
                    labels={data.series.map((p) => fmtTime(p.bucket))}
                    series={[
                      { values: data.series.map((p) => p.requests), color: 'var(--accent)' },
                      { values: data.series.map((p) => p.errors), color: 'var(--danger)' },
                    ]}
                  />
                </Panel>
                <Panel title={t('obs.tokenTrend')}>
                  <LineChart
                    labels={data.series.map((p) => fmtTime(p.bucket))}
                    series={[
                      { values: data.series.map((p) => p.inputTokens), color: 'var(--accent)' },
                      { values: data.series.map((p) => p.outputTokens), color: 'var(--success)' },
                    ]}
                  />
                </Panel>
              </div>

              {/* Breakdowns */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Panel title={t('obs.topModels')}>
                  {data.models.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
                      {t('obs.noData')}
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ color: 'var(--text-faint)' }} className="text-left text-xs">
                          <th className="pb-2 font-medium">{t('obs.model')}</th>
                          <th className="pb-2 font-medium text-right">{t('obs.requests')}</th>
                          <th className="pb-2 font-medium text-right">{t('obs.in')}</th>
                          <th className="pb-2 font-medium text-right">{t('obs.out')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.models.map((m) => (
                          <tr key={m.model} style={{ borderTop: '1px solid var(--border)' }}>
                            <td className="py-2 font-mono text-xs truncate max-w-[12rem]" style={{ color: 'var(--text)' }}>
                              {m.model}
                            </td>
                            <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>
                              {m.requests.toLocaleString()}
                            </td>
                            <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>
                              {m.inputTokens.toLocaleString()}
                            </td>
                            <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>
                              {m.outputTokens.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
                <Panel title={t('obs.statusDist')}>
                  {data.statuses.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
                      {t('obs.noData')}
                    </p>
                  ) : (
                    <>
                      <BarChart
                        height={120}
                        data={data.statuses.map((s) => ({ label: s.statusClass, value: s.requests }))}
                      />
                      <div className="flex flex-wrap gap-3 mt-4">
                        {data.statuses.map((s) => (
                          <div key={s.statusClass} className="flex items-center gap-2 text-xs">
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                background: STATUS_COLOR[s.statusClass] ?? 'var(--text-faint)',
                                display: 'inline-block',
                              }}
                            />
                            <span style={{ color: 'var(--text-muted)' }}>
                              {s.statusClass} · {s.requests.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Panel>
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  )
}
