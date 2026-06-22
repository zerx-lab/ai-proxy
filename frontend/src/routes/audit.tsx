import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { auditApi, type AuditEntry } from '../lib/api'
import { useToast } from '../contexts/toast'
import { useAuth } from '../contexts/auth'
import { useI18n } from '../contexts/i18n'
import { TraceDrawer } from '../components/TraceDrawer'

export const Route = createFileRoute('/audit')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuditPage,
})

const STATUS_COLOR: Record<string, string> = {
  '2': 'var(--success)',
  '4': 'var(--warning)',
  '5': 'var(--danger)',
}

function statusColor(code: number) {
  return STATUS_COLOR[String(code)[0]] ?? 'var(--text-muted)'
}

function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { toast } = useToast()
  const { token, loading: authLoading } = useAuth()
  const { t, lang } = useI18n()
  const navigate = useNavigate()

  const fetchEntries = useCallback(async () => {
    try {
      const res = await auditApi.list(100)
      setEntries(res.entries)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast({ title: t('audit.loadFailed'), description: msg, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      void navigate({ to: '/login' })
      return
    }
    void fetchEntries()
  }, [authLoading, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')

  return (
    <Layout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {t('audit.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            {t('audit.subtitle')}
          </p>
        </div>
        <button onClick={() => void fetchEntries()} className="btn-secondary text-sm">
          {t('common.refresh')}
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--text-faint)' }}>
          <p>{t('audit.empty')}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr
                  className="text-left text-xs"
                  style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}
                >
                  <th className="py-3 px-4 font-medium">{t('audit.model')}</th>
                  <th className="py-3 px-4 font-medium">{t('audit.status')}</th>
                  <th className="py-3 px-4 font-medium text-right">{t('audit.inTokens')}</th>
                  <th className="py-3 px-4 font-medium text-right">{t('audit.outTokens')}</th>
                  <th className="py-3 px-4 font-medium text-right">{t('audit.duration')}</th>
                  <th className="py-3 px-4 font-medium">{t('audit.created')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    className="audit-row"
                  >
                    <td
                      className="py-3 px-4 font-mono text-xs max-w-[12rem] truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {entry.model}
                    </td>
                    <td
                      className="py-3 px-4 font-mono font-semibold"
                      style={{ color: statusColor(entry.statusCode ?? 0) }}
                    >
                      {entry.statusCode ?? t('common.none')}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--text-muted)' }}>
                      {(entry.inputTokens ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--text-muted)' }}>
                      {(entry.outputTokens ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--text-faint)' }}>
                      {entry.durationMs}ms
                    </td>
                    <td className="py-3 px-4 text-xs" style={{ color: 'var(--text-faint)' }}>
                      {fmt(entry.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <TraceDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </Layout>
  )
}
