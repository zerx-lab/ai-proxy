import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '../contexts/auth'
import { useToast } from '../contexts/toast'
import { useTheme } from '../contexts/theme'
import { useI18n } from '../contexts/i18n'
import { SunIcon, MoonIcon, LangIcon } from '../components/icons'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const { login, signup } = useAuth()
  const { toast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const { t, lang, toggleLang } = useI18n()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password)
      }
      void navigate({ to: '/' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: mode === 'login' ? t('login.failed') : t('login.signupFailed'),
        description: msg,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-5 right-5 flex gap-1.5">
        <button className="btn-ghost glass" onClick={toggleTheme} title={t('common.lang')}>
          {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
        </button>
        <button className="btn-ghost glass flex items-center gap-1.5" onClick={toggleLang}>
          <LangIcon width={18} height={18} />
          <span className="text-xs font-semibold">{lang === 'zh' ? '中' : 'EN'}</span>
        </button>
      </div>

      <div className="card w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 40, height: 40, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 18 }}
          >
            A
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {t('login.title')}
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-faint)' }}>
              {mode === 'login' ? t('login.signIn') : t('login.signUp')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" htmlFor="email" style={{ color: 'var(--text-muted)' }}>
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5" htmlFor="password" style={{ color: 'var(--text-muted)' }}>
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full mt-2">
            {busy ? t('common.loading') : mode === 'login' ? t('login.signIn') : t('login.signUp')}
          </button>
        </form>

        <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="font-medium"
            style={{ color: 'var(--accent-text)' }}
          >
            {mode === 'login' ? t('login.toSignup') : t('login.toLogin')}
          </button>
        </p>
      </div>
    </div>
  )
}
