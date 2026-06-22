import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { Layout } from '../components/Layout'
import { keysApi, type ApiKey, type CreatedApiKey } from '../lib/api'
import { useToast } from '../contexts/toast'
import { useAuth } from '../contexts/auth'
import { useI18n } from '../contexts/i18n'
import { PlusIcon, TrashIcon, CopyIcon, CheckIcon } from '../components/icons'

export const Route = createFileRoute('/keys')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('auth_token')) {
      throw redirect({ to: '/login' })
    }
  },
  component: KeysPage,
})

function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)
  const [revealOpen, setRevealOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const { toast } = useToast()
  const { token, loading: authLoading } = useAuth()
  const { t, lang } = useI18n()
  const navigate = useNavigate()

  const fetchKeys = useCallback(async () => {
    try {
      const res = await keysApi.list()
      setKeys(res.keys)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast({ title: t('keys.empty'), description: msg, variant: 'error' })
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
    void fetchKeys()
  }, [authLoading, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const created = await keysApi.create(newKeyName.trim())
      setCreatedKey(created)
      setCreateOpen(false)
      setRevealOpen(true)
      setNewKeyName('')
      setKeys((prev) => [{ ...created } as ApiKey, ...prev])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({ title: t('keys.createTitle'), description: msg, variant: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (key: ApiKey, enabled: boolean) => {
    try {
      await keysApi.toggle(key.id, enabled)
      setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, enabled } : k)))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({ title: t('keys.title'), description: msg, variant: 'error' })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('keys.deleteConfirm'))) return
    try {
      await keysApi.delete(id)
      setKeys((prev) => prev.filter((k) => k.id !== id))
      toast({ title: t('common.delete'), variant: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({ title: t('keys.title'), description: msg, variant: 'error' })
    }
  }

  const copyKey = async () => {
    if (!createdKey?.key) return
    await navigator.clipboard.writeText(createdKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyExisting = async (id: number) => {
    try {
      const { key } = await keysApi.reveal(id)
      await navigator.clipboard.writeText(key)
      setCopiedId(id)
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast({ title: t('keys.copyFailed'), description: msg, variant: 'error' })
    }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')

  return (
    <Layout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {t('keys.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            {t('keys.subtitle')}
          </p>
        </div>
        <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
          <Dialog.Trigger asChild>
            <button className="btn-primary flex items-center gap-2">
              <PlusIcon width={16} height={16} />
              {t('keys.new')}
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.55)' }} />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 card w-full max-w-sm">
              <Dialog.Title className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>
                {t('keys.createTitle')}
              </Dialog.Title>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('keys.name')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('keys.namePlaceholder')}
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Dialog.Close asChild>
                    <button type="button" className="btn-secondary">
                      {t('common.cancel')}
                    </button>
                  </Dialog.Close>
                  <button type="submit" disabled={creating} className="btn-primary">
                    {creating ? t('common.loading') : t('common.create')}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Reveal key dialog — shown ONCE after creation */}
      <Dialog.Root
        open={revealOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreatedKey(null)
            setCopied(false)
          }
          setRevealOpen(o)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.55)' }} />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 card w-full max-w-md">
            <Dialog.Title className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>
              {t('keys.createdTitle')}
            </Dialog.Title>
            <p className="text-sm mb-4" style={{ color: 'var(--warning)' }}>
              ⚠ {t('keys.createdHint')}
            </p>
            <div className="flex gap-2 items-center">
              <code
                className="flex-1 text-xs px-3 py-2 break-all font-mono"
                style={{ background: 'var(--surface-strong)', color: 'var(--success)', border: '1px solid var(--border)' }}
              >
                {createdKey?.key}
              </code>
              <button onClick={copyKey} className="btn-secondary text-sm shrink-0">
                {copied ? `✓ ${t('common.copied')}` : t('common.copy')}
              </button>
            </div>
            <div className="flex justify-end mt-4">
              <Dialog.Close asChild>
                <button className="btn-primary">{t('common.close')}</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : keys.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--text-faint)' }}>
          <p className="text-lg">{t('keys.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div key={key.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--text)' }}>
                  {key.name}
                </p>
                <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-faint)' }}>
                  {key.keyPrefix}…
                </p>
              </div>
              <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-faint)' }}>
                <p>
                  {t('keys.created')}: {fmtDate(key.createdAt)}
                </p>
                <p>
                  {t('keys.lastUsed')}: {key.lastUsedAt ? fmtDate(key.lastUsedAt) : t('keys.never')}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch.Root
                  checked={key.enabled}
                  onCheckedChange={(v) => void handleToggle(key, v)}
                  className="ui-switch"
                >
                  <Switch.Thumb className="ui-switch-thumb" />
                </Switch.Root>
                <button
                  onClick={() => void copyExisting(key.id)}
                  className="btn-ghost"
                  style={{ color: copiedId === key.id ? 'var(--success)' : 'var(--text-faint)' }}
                  title={t('keys.copyKey')}
                >
                  {copiedId === key.id ? (
                    <CheckIcon width={17} height={17} />
                  ) : (
                    <CopyIcon width={17} height={17} />
                  )}
                </button>
                <button
                  onClick={() => void handleDelete(key.id)}
                  className="btn-ghost"
                  style={{ color: 'var(--text-faint)' }}
                  title={t('common.delete')}
                >
                  <TrashIcon width={17} height={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
