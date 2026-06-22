import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { authApi, type AuthUser } from '../lib/api'

interface AuthContextValue {
  token: string | null
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
  loadMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  })
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const persist = useCallback((t: string | null) => {
    setToken(t)
    if (t) {
      localStorage.setItem(TOKEN_KEY, t)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }, [])

  const loadMe = useCallback(async () => {
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      persist(null)
      setUser(null)
    }
  }, [persist])

  // On mount: if we have a stored token validate it
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
    if (stored) {
      loadMe().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password)
      persist(res.token)
      setUser(res.user)
    },
    [persist],
  )

  const signup = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.signup(email, password)
      persist(res.token)
      setUser(res.user)
    },
    [persist],
  )

  const logout = useCallback(() => {
    persist(null)
    setUser(null)
  }, [persist])

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, signup, logout, loadMe }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
