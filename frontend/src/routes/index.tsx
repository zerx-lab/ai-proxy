import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { auditApi, type AuditStats } from '../lib/api'
import { useToast } from '../contexts/toast'
import { useAuth } from '../contexts/auth'
import { useI18n } from '../contexts/i18n'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' })
    }
  },
  component: DashboardPage,
})

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="card group" style={{ transition: 'transform 0.2s ease, border-color 0.2s ease' }}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-4xl font-bold mt-3 tracking-tight" style={{ color: accent ?? 'var(--text)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function DashboardPage() {
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const { toast } = useToast()
  const { loading, token } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!token) {
      void navigate({ to: '/login' })
      return
    }
    auditApi
      .stats()
      .then(setStats)
      .catch((e: Error) =>
        toast({ title: t('dash.statsFailed'), description: e.message, variant: 'error' }),
      )
      .finally(() => setLoadingStats(false))
  }, [loading, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const errPct =
    stats && stats.totalRequests > 0
      ? ((stats.errorRequests / stats.totalRequests) * 100).toFixed(1) + '%'
      : '0%'

  return (
    <Layout>
      <div className="mb-7">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          {t('dash.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
          {t('dash.subtitle')}
        </p>
      </div>

      {loadingStats ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label={t('dash.totalRequests')} value={stats.totalRequests.toLocaleString()} />
          <StatCard
            label={t('dash.inputTokens')}
            value={stats.totalInputTokens.toLocaleString()}
            sub={t('dash.cumulative')}
          />
          <StatCard
            label={t('dash.outputTokens')}
            value={stats.totalOutputTokens.toLocaleString()}
            sub={t('dash.cumulative')}
          />
          <StatCard
            label={t('dash.errorRequests')}
            value={stats.errorRequests.toLocaleString()}
            sub={`${errPct} ${t('dash.errorRate')}`}
            accent={stats.errorRequests > 0 ? 'var(--danger)' : undefined}
          />
        </div>
      ) : (
        <p style={{ color: 'var(--text-faint)' }}>{t('dash.noStats')}</p>
      )}
    </Layout>
  )
}
