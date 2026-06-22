import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { auditApi, type AuditDetail } from '../lib/api'
import { parseTrace, type ChatMessage, type Part, type Role } from '../lib/trace'
import { useToast } from '../contexts/toast'
import { useI18n, type I18nKey } from '../contexts/i18n'

const ROLE_LABEL: Record<Role, I18nKey> = {
  system: 'trace.role.system',
  user: 'trace.role.user',
  assistant: 'trace.role.assistant',
  tool: 'trace.role.tool',
}

const ROLE_ACCENT: Record<Role, string> = {
  system: 'var(--text-faint)',
  user: 'var(--accent)',
  assistant: 'var(--success)',
  tool: 'var(--warning)',
}

function pretty(text: string | null): string {
  if (!text) return ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function CodeBlock({ text }: { text: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  if (!text) return <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{t('trace.noBody')}</p>
  return (
    <div className="relative">
      <button
        className="btn-secondary text-xs absolute top-2 right-2 z-10"
        onClick={() => {
          void navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? t('common.copied') : t('trace.copy')}
      </button>
      <pre
        className="text-xs overflow-auto font-mono p-4"
        style={{
          background: 'var(--surface-strong)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          maxHeight: '60vh',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </pre>
    </div>
  )
}

function PartView({ part }: { part: Part }) {
  const { t } = useI18n()
  const tag = (label: string, color: string) => (
    <span
      className="text-xs px-1.5 py-0.5 font-medium inline-block mb-1.5"
      style={{ background: 'var(--surface-strong)', color, border: '1px solid var(--border)' }}
    >
      {label}
    </span>
  )

  switch (part.kind) {
    case 'text':
      return (
        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)', wordBreak: 'break-word' }}>
          {part.text}
        </p>
      )
    case 'thinking':
      return (
        <div>
          {tag(t('trace.part.thinking'), 'var(--text-faint)')}
          <p
            className="text-sm whitespace-pre-wrap italic"
            style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}
          >
            {part.text}
          </p>
        </div>
      )
    case 'tool_use':
      return (
        <div>
          {tag(`${t('trace.part.toolUse')}: ${part.name}`, 'var(--warning)')}
          <pre
            className="text-xs font-mono p-3 overflow-auto"
            style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}
          >
            {typeof part.input === 'string' ? part.input : JSON.stringify(part.input, null, 2)}
          </pre>
        </div>
      )
    case 'tool_result':
      return (
        <div>
          {tag(t('trace.part.toolResult'), part.isError ? 'var(--danger)' : 'var(--warning)')}
          <pre
            className="text-xs font-mono p-3 overflow-auto"
            style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: '20rem' }}
          >
            {part.content}
          </pre>
        </div>
      )
    case 'image':
      return tag(`${t('trace.part.image')}${part.mediaType ? ` (${part.mediaType})` : ''}`, 'var(--accent)')
    default:
      return (
        <pre className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
          {JSON.stringify(part.raw, null, 2)}
        </pre>
      )
  }
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const { t } = useI18n()
  const accent = ROLE_ACCENT[msg.role]
  return (
    <div className="card" style={{ padding: '0.9rem 1rem', borderLeft: `3px solid ${accent}` }}>
      <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: accent }}>
        {t(ROLE_LABEL[msg.role])}
      </p>
      <div className="flex flex-col gap-3">
        {msg.parts.map((p, i) => (
          <PartView key={i} part={p} />
        ))}
      </div>
    </div>
  )
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card" style={{ padding: '0.75rem 1rem' }}>
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        {label}
      </p>
      <p className="text-lg font-bold mt-0.5" style={{ color: accent ?? 'var(--text)' }}>
        {value}
      </p>
    </div>
  )
}

export function TraceDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [detail, setDetail] = useState<AuditDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { t, lang } = useI18n()

  useEffect(() => {
    if (id == null) {
      setDetail(null)
      return
    }
    setLoading(true)
    auditApi
      .detail(id)
      .then(setDetail)
      .catch((e: Error) => toast({ title: t('trace.loadFailed'), description: e.message, variant: 'error' }))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const trace = detail ? parseTrace(detail.requestBody, detail.responseBody, detail.stream) : null
  const headers = detail?.requestHeaders ? pretty(detail.requestHeaders) : ''

  return (
    <Dialog.Root open={id != null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} />
        <Dialog.Content
          className="glass fixed top-0 right-0 z-50 h-screen flex flex-col"
          style={{ width: 'min(820px, 96vw)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          <div
            className="flex items-center justify-between px-6 flex-shrink-0"
            style={{ height: 64, borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <Dialog.Title className="text-base font-bold" style={{ color: 'var(--text)' }}>
                {t('trace.title')}
                {detail && <span className="ml-2 font-mono text-xs" style={{ color: 'var(--text-faint)' }}>#{detail.id}</span>}
              </Dialog.Title>
              {detail?.model && (
                <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {detail.model}
                </p>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="btn-ghost" title={t('common.close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          {loading ? (
            <p className="p-6" style={{ color: 'var(--text-muted)' }}>
              {t('common.loading')}
            </p>
          ) : !detail ? (
            <p className="p-6" style={{ color: 'var(--text-faint)' }}>
              {t('trace.noBody')}
            </p>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {/* Metric strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Meta
                  label={t('audit.status')}
                  value={String(detail.statusCode ?? '—')}
                  accent={
                    detail.statusCode && detail.statusCode >= 400 ? 'var(--danger)' : 'var(--success)'
                  }
                />
                <Meta label={t('audit.duration')} value={`${detail.durationMs ?? 0} ms`} />
                <Meta
                  label={t('trace.tokens')}
                  value={`${detail.inputTokens ?? 0} / ${detail.outputTokens ?? 0}`}
                />
                <Meta
                  label={t('trace.cacheRead')}
                  value={`${detail.cacheReadTokens ?? 0} / ${detail.cacheCreationTokens ?? 0}`}
                />
              </div>

              <Tabs.Root defaultValue="conversation">
                <Tabs.List className="flex mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Tabs.Trigger value="conversation" className="acc-tab">
                    {t('trace.tab.conversation')}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="request" className="acc-tab">
                    {t('trace.tab.request')}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="response" className="acc-tab">
                    {t('trace.tab.response')}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="metadata" className="acc-tab">
                    {t('trace.tab.metadata')}
                  </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="conversation">
                  {trace && trace.messages.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {trace.messages.map((m, i) => (
                        <MessageBubble key={i} msg={m} />
                      ))}
                      {trace.stopReason && (
                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                          {t('trace.stopReason')}: <span className="font-mono">{trace.stopReason}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
                      {t('trace.noConversation')}
                    </p>
                  )}
                </Tabs.Content>

                <Tabs.Content value="request">
                  <CodeBlock text={pretty(detail.requestBody)} />
                </Tabs.Content>

                <Tabs.Content value="response">
                  {detail.errorMessage && (
                    <div
                      className="card mb-3"
                      style={{ borderLeft: '3px solid var(--danger)', padding: '0.75rem 1rem' }}
                    >
                      <p className="text-sm" style={{ color: 'var(--danger)' }}>
                        {detail.errorMessage}
                      </p>
                    </div>
                  )}
                  <CodeBlock text={pretty(detail.responseBody)} />
                </Tabs.Content>

                <Tabs.Content value="metadata">
                  <div className="flex flex-col gap-4">
                    {trace && Object.keys(trace.params).length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>
                          {t('trace.params')}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(trace.params).map(([k, v]) => (
                            <div
                              key={k}
                              className="card"
                              style={{ padding: '0.5rem 0.75rem' }}
                            >
                              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                                {k}
                              </p>
                              <p className="text-sm font-mono" style={{ color: 'var(--text)' }}>
                                {String(v)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="card" style={{ padding: '0.5rem 0.75rem' }}>
                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                          {t('trace.streaming')}
                        </p>
                        <p style={{ color: 'var(--text)' }}>{detail.stream ? '✓' : '—'}</p>
                      </div>
                      <div className="card" style={{ padding: '0.5rem 0.75rem' }}>
                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                          {t('audit.created')}
                        </p>
                        <p style={{ color: 'var(--text)' }}>
                          {new Date(detail.createdAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>
                        {t('trace.headers')}
                      </h3>
                      <CodeBlock text={headers} />
                    </div>
                  </div>
                </Tabs.Content>
              </Tabs.Root>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
