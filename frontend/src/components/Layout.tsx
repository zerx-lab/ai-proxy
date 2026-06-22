import { type ReactNode, type ComponentType, useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/auth'
import { useTheme } from '../contexts/theme'
import { useI18n, type I18nKey } from '../contexts/i18n'
import {
  DashboardIcon,
  ObsIcon,
  KeyIcon,
  AuditIcon,
  AccountsIcon,
  SunIcon,
  MoonIcon,
  LangIcon,
  CollapseIcon,
  ExpandIcon,
  LogoutIcon,
} from './icons'

type IconCmp = ComponentType<{ width?: number; height?: number }>

interface NavItem {
  to: string
  labelKey: I18nKey
  Icon: IconCmp
  admin?: boolean
}

const NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', Icon: DashboardIcon },
  { to: '/observability', labelKey: 'nav.observability', Icon: ObsIcon },
  { to: '/keys', labelKey: 'nav.keys', Icon: KeyIcon },
  { to: '/audit', labelKey: 'nav.audit', Icon: AuditIcon },
  { to: '/accounts', labelKey: 'nav.accounts', Icon: AccountsIcon, admin: true },
]

const COLLAPSE_KEY = 'ui_sidebar_collapsed'

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t, lang, toggleLang } = useI18n()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  })
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  const links = NAV.filter((l) => !l.admin || user?.role === 'admin')

  return (
    <div className="flex min-h-screen">
      <aside
        className="glass flex flex-col flex-shrink-0 sticky top-0 h-screen transition-[width] duration-300 ease-out"
        style={{ width: collapsed ? 72 : 248, borderRight: '1px solid var(--border)' }}
      >
        {/* Logo + collapse toggle */}
        <div
          className="flex items-center gap-3 px-4"
          style={{ height: 64, borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 34,
              height: 34,
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              boxShadow: '0 4px 14px var(--accent-soft)',
            }}
          >
            A
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold leading-tight truncate" style={{ color: 'var(--text)' }}>
                {t('app.name')}
              </h1>
              <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                {t('app.tagline')}
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2.5 flex flex-col gap-1 overflow-y-auto">
          {links.map(({ to, labelKey, Icon }) => (
            <Link
              key={to}
              to={to}
              title={collapsed ? t(labelKey) : undefined}
              className="nav-link"
              activeProps={{ className: 'nav-link nav-link-active' }}
              activeOptions={{ exact: to === '/' }}
            >
              <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 22 }}>
                <Icon width={19} height={19} />
              </span>
              {!collapsed && <span className="truncate">{t(labelKey)}</span>}
            </Link>
          ))}
        </nav>

        {/* Controls: theme, lang, collapse */}
        <div
          className="px-2.5 py-3 flex gap-1.5"
          style={{
            borderTop: '1px solid var(--border)',
            flexDirection: collapsed ? 'column' : 'row',
          }}
        >
          <button
            className="btn-ghost flex-1"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('common.theme.light') : t('common.theme.dark')}
          >
            {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
          </button>
          <button className="btn-ghost flex-1" onClick={toggleLang} title={t('common.lang')}>
            <span className="flex items-center gap-1.5">
              <LangIcon width={18} height={18} />
              {!collapsed && <span className="text-xs font-semibold">{lang === 'zh' ? '中' : 'EN'}</span>}
            </span>
          </button>
          <button
            className="btn-ghost flex-1"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
          >
            {collapsed ? <ExpandIcon width={18} height={18} /> : <CollapseIcon width={18} height={18} />}
          </button>
        </div>

        {/* User + logout */}
        <div className="px-2.5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          {user && !collapsed && (
            <div className="mb-2 px-1.5">
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {user.email}
              </p>
              {user.role === 'admin' && (
                <span
                  className="text-xs px-1.5 py-0.5 mt-1 inline-block font-medium"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                >
                  {t('common.admin')}
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="nav-link w-full"
            style={{ color: 'var(--danger)' }}
            title={collapsed ? t('nav.signout') : undefined}
          >
            <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 22 }}>
              <LogoutIcon width={19} height={19} />
            </span>
            {!collapsed && <span>{t('nav.signout')}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto px-8 py-8 min-w-0">{children}</main>
    </div>
  )
}
