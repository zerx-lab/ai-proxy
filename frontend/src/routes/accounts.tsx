import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Switch from '@radix-ui/react-switch'
import { Layout } from '../components/Layout'
import { accountsApi, type AccountInfo } from '../lib/api'
import { useToast } from '../contexts/toast'
import { useAuth } from '../contexts/auth'
import { useI18n } from '../contexts/i18n'
import { TrashIcon } from '../components/icons'

export const Route = createFileRoute('/accounts')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' })
    }
  },
  component: AccountsPage,
})

// ---------------------------------------------------------------------------
// Add Account form — three tabs
// ---------------------------------------------------------------------------

function AddAccountPanel({ onAdded }: { onAdded: (acc: AccountInfo) => void }) {
  const { toast } = useToast()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)

  const [oauthState, setOauthState] = useState('')
  const [oauthName, setOauthName] = useState('')
  const [oauthCode, setOauthCode] = useState('')
  const [oauthStarted, setOauthStarted] = useState(false)

  const [skName, setSkName] = useState('')
  const [skValue, setSkValue] = useState('')

  const [akName, setAkName] = useState('')
  const [akValue, setAkValue] = useState('')

  const handleOAuthStart = async () => {
    setBusy(true)
    try {
      const res = await accountsApi.oauthStart()
      setOauthState(res.state)
      setOauthStarted(true)
      window.open(res.authorizeUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast({ title: t('acc.oauth.startFailed'), description: e instanceof Error ? e.message : String(e), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleOAuthComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oauthName.trim() || !oauthCode.trim()) return
    setBusy(true)
    try {
      const acc = await accountsApi.oauthComplete(oauthName.trim(), oauthState, oauthCode.trim())
      toast({ title: t('acc.oauth.started'), variant: 'success' })
      onAdded(acc)
      setOauthName('')
      setOauthCode('')
      setOauthState('')
      setOauthStarted(false)
    } catch (e) {
      toast({ title: t('acc.oauth.completeFailed'), description: e instanceof Error ? e.message : String(e), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleSessionKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!skName.trim() || !skValue.trim()) return
    setBusy(true)
    try {
      const acc = await accountsApi.oauthSessionKey(skName.trim(), skValue.trim())
      toast({ title: t('acc.session.added'), variant: 'success' })
      onAdded(acc)
      setSkName('')
      setSkValue('')
    } catch (e) {
      toast({ title: t('acc.session.failed'), description: e instanceof Error ? e.message : String(e), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleApiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!akName.trim() || !akValue.trim()) return
    setBusy(true)
    try {
      const acc = await accountsApi.addApiKey(akName.trim(), akValue.trim())
      toast({ title: t('acc.apikey.added'), variant: 'success' })
      onAdded(acc)
      setAkName('')
      setAkValue('')
    } catch (e) {
      toast({ title: t('acc.apikey.failed'), description: e instanceof Error ? e.message : String(e), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const labelCls = 'block text-sm mb-1.5'
  const labelStyle = { color: 'var(--text-muted)' }

  return (
    <div className="card mt-8">
      <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>
        {t('acc.add')}
      </h2>

      <Tabs.Root defaultValue="oauth">
        <Tabs.List className="flex mb-5 -mx-1" style={{ borderBottom: '1px solid var(--border)' }}>
          <Tabs.Trigger value="oauth" className="acc-tab">
            {t('acc.tab.oauth')}
          </Tabs.Trigger>
          <Tabs.Trigger value="sessionkey" className="acc-tab">
            {t('acc.tab.session')}
          </Tabs.Trigger>
          <Tabs.Trigger value="apikey" className="acc-tab">
            {t('acc.tab.apikey')}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="oauth">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {t('acc.oauth.desc')}
          </p>

          {!oauthStarted ? (
            <button onClick={() => void handleOAuthStart()} disabled={busy} className="btn-primary">
              {busy ? t('acc.adding') : t('acc.oauth.start')}
            </button>
          ) : (
            <form onSubmit={(e) => void handleOAuthComplete(e)} className="space-y-3">
              <div>
                <label className={labelCls} style={labelStyle}>
                  {t('acc.name')}
                </label>
                <input type="text" required value={oauthName} onChange={(e) => setOauthName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>
                  {t('acc.oauth.code')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('acc.oauth.codePlaceholder')}
                  value={oauthCode}
                  onChange={(e) => setOauthCode(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOauthStarted(false)
                    setOauthState('')
                  }}
                  className="btn-secondary"
                >
                  {t('acc.oauth.restart')}
                </button>
                <button type="submit" disabled={busy} className="btn-primary">
                  {busy ? t('acc.adding') : t('acc.oauth.complete')}
                </button>
              </div>
            </form>
          )}
        </Tabs.Content>

        <Tabs.Content value="sessionkey">
          <form onSubmit={(e) => void handleSessionKey(e)} className="space-y-3">
            <div>
              <label className={labelCls} style={labelStyle}>
                {t('acc.name')}
              </label>
              <input type="text" required value={skName} onChange={(e) => setSkName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>
                {t('acc.session.label')}
              </label>
              <input
                type="password"
                required
                placeholder="sk-ant-sid-…"
                value={skValue}
                onChange={(e) => setSkValue(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? t('acc.adding') : t('acc.add')}
            </button>
          </form>
        </Tabs.Content>

        <Tabs.Content value="apikey">
          <form onSubmit={(e) => void handleApiKey(e)} className="space-y-3">
            <div>
              <label className={labelCls} style={labelStyle}>
                {t('acc.name')}
              </label>
              <input type="text" required value={akName} onChange={(e) => setAkName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>
                {t('acc.apikey.label')}
              </label>
              <input
                type="password"
                required
                placeholder="sk-ant-api03-…"
                value={akValue}
                onChange={(e) => setAkValue(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? t('acc.adding') : t('acc.add')}
            </button>
          </form>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const AUTH_TYPE_LABEL: Record<string, string> = {
  oauth: 'OAuth',
  sessionKey: 'Session Key',
  apiKey: 'API Key',
}

function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user, token, loading: authLoading } = useAuth()
  const { t, lang } = useI18n()
  const navigate = useNavigate()

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await accountsApi.list()
      setAccounts(res.accounts)
    } catch (e) {
      toast({ title: t('acc.loadFailed'), description: e instanceof Error ? e.message : String(e), variant: 'error' })
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
    if (user && user.role !== 'admin') {
      void navigate({ to: '/' })
      return
    }
    void fetchAccounts()
  }, [authLoading, token, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async (acc: AccountInfo, enabled: boolean) => {
    try {
      await accountsApi.toggle(acc.id, enabled)
      setAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, enabled } : a)))
    } catch (e) {
      toast({ title: t('acc.updateFailed'), description: e instanceof Error ? e.message : String(e), variant: 'error' })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('acc.removeConfirm'))) return
    try {
      await accountsApi.delete(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      toast({ title: t('acc.removed'), variant: 'success' })
    } catch (e) {
      toast({ title: t('acc.removeFailed'), description: e instanceof Error ? e.message : String(e), variant: 'error' })
    }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          {t('acc.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
          {t('acc.subtitle')}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--text-faint)' }}>
          <p className="text-lg">{t('acc.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate" style={{ color: 'var(--text)' }}>
                    {acc.name}
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 shrink-0"
                    style={{ background: 'var(--surface-strong)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    {AUTH_TYPE_LABEL[acc.authType] ?? acc.authType}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 shrink-0"
                    style={
                      acc.status === 'active'
                        ? { background: 'var(--success-soft)', color: 'var(--success)' }
                        : { background: 'var(--danger-soft)', color: 'var(--warning)' }
                    }
                  >
                    {acc.status === 'active' ? t('acc.status.active') : acc.status}
                  </span>
                </div>
                {acc.email && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    {acc.email}
                  </p>
                )}
              </div>
              <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-faint)' }}>
                <p>
                  {t('acc.added')}: {fmtDate(acc.createdAt)}
                </p>
                {acc.lastUsedAt && (
                  <p>
                    {t('acc.lastUsed')}: {fmtDate(acc.lastUsedAt)}
                  </p>
                )}
                {acc.expiresAt && (
                  <p style={{ color: 'var(--warning)' }}>
                    {t('acc.expires')}: {fmtDate(acc.expiresAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch.Root checked={acc.enabled} onCheckedChange={(v) => void handleToggle(acc, v)} className="ui-switch">
                  <Switch.Thumb className="ui-switch-thumb" />
                </Switch.Root>
                <button
                  onClick={() => void handleDelete(acc.id)}
                  className="btn-ghost"
                  style={{ color: 'var(--text-faint)' }}
                  title={t('acc.remove')}
                >
                  <TrashIcon width={17} height={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddAccountPanel onAdded={(acc) => setAccounts((prev) => [acc, ...prev])} />
    </Layout>
  )
}
