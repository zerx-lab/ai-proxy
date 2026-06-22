import {
  createContext,
  useContext,
  useState,
  useRef,
  type ReactNode,
} from 'react'
import * as Toast from '@radix-ui/react-toast'

export interface ToastMessage {
  id: number
  title: string
  description?: string
  variant?: 'default' | 'error' | 'success'
}

interface ToastContextValue {
  toast: (msg: Omit<ToastMessage, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])
  const counter = useRef(0)

  const toast = (msg: Omit<ToastMessage, 'id'>) => {
    const id = ++counter.current
    setMessages((prev) => [...prev, { ...msg, id }])
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    }, 5000)
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right" duration={5000}>
        {children}

        {messages.map((msg) => (
          <Toast.Root
            key={msg.id}
            open
            className="glass flex flex-col gap-1 px-4 py-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out"
            style={{
              boxShadow: 'var(--shadow)',
              borderLeft: `3px solid ${
                msg.variant === 'error'
                  ? 'var(--danger)'
                  : msg.variant === 'success'
                    ? 'var(--success)'
                    : 'var(--accent)'
              }`,
              color: 'var(--text)',
            }}
          >
            <Toast.Title className="font-semibold text-sm">{msg.title}</Toast.Title>
            {msg.description && (
              <Toast.Description className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {msg.description}
              </Toast.Description>
            )}
          </Toast.Root>
        ))}

        <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80" />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
