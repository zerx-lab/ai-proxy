import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

export type Lang = 'zh' | 'en'

// Flat key -> { zh, en }. Keep keys grouped by feature with dotted names.
const DICT = {
  // Brand / chrome
  'app.name': { zh: 'AI Proxy', en: 'AI Proxy' },
  'app.tagline': { zh: '网关控制台', en: 'Gateway' },
  'nav.dashboard': { zh: '仪表盘', en: 'Dashboard' },
  'nav.observability': { zh: '可观测性', en: 'Observability' },
  'nav.keys': { zh: 'API 密钥', en: 'API Keys' },
  'nav.audit': { zh: '审计日志', en: 'Audit Log' },
  'nav.accounts': { zh: '上游账户', en: 'Accounts' },
  'nav.signout': { zh: '退出登录', en: 'Sign out' },
  'nav.collapse': { zh: '收起侧边栏', en: 'Collapse sidebar' },
  'nav.expand': { zh: '展开侧边栏', en: 'Expand sidebar' },
  'common.admin': { zh: '管理员', en: 'admin' },
  'common.theme.light': { zh: '浅色主题', en: 'Light theme' },
  'common.theme.dark': { zh: '深色主题', en: 'Dark theme' },
  'common.lang': { zh: '切换语言', en: 'Language' },
  'common.loading': { zh: '加载中…', en: 'Loading…' },
  'common.refresh': { zh: '刷新', en: 'Refresh' },
  'common.cancel': { zh: '取消', en: 'Cancel' },
  'common.delete': { zh: '删除', en: 'Delete' },
  'common.create': { zh: '创建', en: 'Create' },
  'common.close': { zh: '关闭', en: 'Close' },
  'common.copy': { zh: '复制', en: 'Copy' },
  'common.copied': { zh: '已复制', en: 'Copied' },
  'common.enabled': { zh: '已启用', en: 'Enabled' },
  'common.disabled': { zh: '已禁用', en: 'Disabled' },
  'common.none': { zh: '无', en: '—' },

  // Dashboard
  'dash.title': { zh: '仪表盘', en: 'Dashboard' },
  'dash.subtitle': { zh: '网关运行概况', en: 'Gateway overview at a glance' },
  'dash.totalRequests': { zh: '总请求数', en: 'Total Requests' },
  'dash.inputTokens': { zh: '输入 Token', en: 'Input Tokens' },
  'dash.outputTokens': { zh: '输出 Token', en: 'Output Tokens' },
  'dash.errorRequests': { zh: '错误请求', en: 'Error Requests' },
  'dash.cumulative': { zh: '累计', en: 'cumulative' },
  'dash.errorRate': { zh: '错误率', en: 'error rate' },
  'dash.noStats': { zh: '暂无统计数据', en: 'No stats available.' },
  'dash.statsFailed': { zh: '加载统计失败', en: 'Failed to load stats' },

  // Observability
  'obs.title': { zh: '可观测性', en: 'Observability' },
  'obs.subtitle': { zh: '请求趋势、延迟与分布', en: 'Traffic, latency and distributions' },
  'obs.window': { zh: '时间窗口', en: 'Window' },
  'obs.window.1h': { zh: '近 1 小时', en: 'Last 1h' },
  'obs.window.24h': { zh: '近 24 小时', en: 'Last 24h' },
  'obs.window.7d': { zh: '近 7 天', en: 'Last 7d' },
  'obs.window.30d': { zh: '近 30 天', en: 'Last 30d' },
  'obs.avgLatency': { zh: '平均延迟', en: 'Avg Latency' },
  'obs.p95Latency': { zh: 'P95 延迟', en: 'P95 Latency' },
  'obs.requests': { zh: '请求数', en: 'Requests' },
  'obs.errors': { zh: '错误数', en: 'Errors' },
  'obs.requestTrend': { zh: '请求趋势', en: 'Request Trend' },
  'obs.tokenTrend': { zh: 'Token 趋势', en: 'Token Trend' },
  'obs.topModels': { zh: '热门模型', en: 'Top Models' },
  'obs.statusDist': { zh: '状态码分布', en: 'Status Distribution' },
  'obs.model': { zh: '模型', en: 'Model' },
  'obs.in': { zh: '输入', en: 'In' },
  'obs.out': { zh: '输出', en: 'Out' },
  'obs.noData': { zh: '该时间窗口内暂无数据', en: 'No data in this window.' },
  'obs.loadFailed': { zh: '加载可观测性数据失败', en: 'Failed to load observability' },

  // API Keys
  'keys.title': { zh: 'API 密钥', en: 'API Keys' },
  'keys.subtitle': { zh: '管理分发给客户端的密钥', en: 'Keys distributed to your clients' },
  'keys.new': { zh: '新建密钥', en: 'New Key' },
  'keys.name': { zh: '名称', en: 'Name' },
  'keys.prefix': { zh: '前缀', en: 'Prefix' },
  'keys.status': { zh: '状态', en: 'Status' },
  'keys.lastUsed': { zh: '最近使用', en: 'Last Used' },
  'keys.created': { zh: '创建时间', en: 'Created' },
  'keys.actions': { zh: '操作', en: 'Actions' },
  'keys.empty': { zh: '还没有任何 API 密钥', en: 'No API keys yet.' },
  'keys.createTitle': { zh: '创建新密钥', en: 'Create API Key' },
  'keys.namePlaceholder': { zh: '例如:生产环境', en: 'e.g. production' },
  'keys.createdTitle': { zh: '密钥已创建', en: 'Key Created' },
  'keys.createdHint': {
    zh: '请立即复制并妥善保存,此密钥只显示这一次。',
    en: 'Copy it now — it will not be shown again.',
  },
  'keys.never': { zh: '从未使用', en: 'never' },
  'keys.deleteConfirm': { zh: '确定删除该密钥吗?', en: 'Delete this key?' },
  'keys.copyKey': { zh: '复制密钥', en: 'Copy key' },
  'keys.copyFailed': { zh: '无法复制(该密钥创建于不可恢复存储之前)', en: 'Cannot copy (key predates recoverable storage)' },

  // Audit
  'audit.title': { zh: '审计日志', en: 'Audit Log' },
  'audit.subtitle': { zh: '逐条记录的代理请求', en: 'One row per proxied request' },
  'audit.model': { zh: '模型', en: 'Model' },
  'audit.status': { zh: '状态', en: 'Status' },
  'audit.inTokens': { zh: '输入 Token', en: 'In Tokens' },
  'audit.outTokens': { zh: '输出 Token', en: 'Out Tokens' },
  'audit.duration': { zh: '耗时', en: 'Duration' },
  'audit.created': { zh: '时间', en: 'Created' },
  'audit.empty': { zh: '暂无审计记录', en: 'No audit entries yet.' },
  'audit.loadFailed': { zh: '加载审计日志失败', en: 'Failed to load audit log' },

  // Trace detail
  'trace.title': { zh: '请求详情', en: 'Trace Detail' },
  'trace.loadFailed': { zh: '加载详情失败', en: 'Failed to load trace' },
  'trace.tab.conversation': { zh: '对话', en: 'Conversation' },
  'trace.tab.request': { zh: '请求', en: 'Request' },
  'trace.tab.response': { zh: '响应', en: 'Response' },
  'trace.tab.metadata': { zh: '元数据', en: 'Metadata' },
  'trace.role.system': { zh: '系统', en: 'System' },
  'trace.role.user': { zh: '用户', en: 'User' },
  'trace.role.assistant': { zh: '助手', en: 'Assistant' },
  'trace.role.tool': { zh: '工具', en: 'Tool' },
  'trace.part.thinking': { zh: '思考', en: 'Thinking' },
  'trace.part.toolUse': { zh: '工具调用', en: 'Tool Call' },
  'trace.part.toolResult': { zh: '工具结果', en: 'Tool Result' },
  'trace.part.image': { zh: '图片', en: 'Image' },
  'trace.stopReason': { zh: '停止原因', en: 'Stop reason' },
  'trace.params': { zh: '参数', en: 'Parameters' },
  'trace.headers': { zh: '请求头', en: 'Request Headers' },
  'trace.noConversation': { zh: '无法解析对话内容', en: 'No conversation to display.' },
  'trace.noBody': { zh: '未捕获正文', en: 'No body captured.' },
  'trace.tokens': { zh: 'Token', en: 'Tokens' },
  'trace.cacheRead': { zh: '缓存读取', en: 'Cache Read' },
  'trace.cacheWrite': { zh: '缓存写入', en: 'Cache Write' },
  'trace.streaming': { zh: '流式', en: 'Streaming' },
  'trace.copy': { zh: '复制 JSON', en: 'Copy JSON' },
  'trace.viewDetail': { zh: '查看详情', en: 'View detail' },

  // Accounts
  'acc.title': { zh: '上游账户', en: 'Accounts' },
  'acc.subtitle': { zh: '用于轮换的上游 Claude 账户池', en: 'Pooled upstream Claude accounts' },

  // Login
  'login.title': { zh: 'AI Proxy 网关', en: 'AI Proxy Gateway' },
  'login.signIn': { zh: '登录', en: 'Sign in' },
  'login.signUp': { zh: '注册', en: 'Sign up' },
  'login.email': { zh: '邮箱', en: 'Email' },
  'login.password': { zh: '密码', en: 'Password' },
  'login.toSignup': { zh: '还没有账户?去注册', en: "Don't have an account? Sign up" },
  'login.toLogin': { zh: '已有账户?去登录', en: 'Already have an account? Sign in' },
  'login.failed': { zh: '登录失败', en: 'Login failed' },
  'login.signupFailed': { zh: '注册失败', en: 'Signup failed' },

  // Accounts (detailed)
  'acc.add': { zh: '添加账户', en: 'Add Account' },
  'acc.empty': { zh: '尚未配置任何账户', en: 'No accounts configured' },
  'acc.name': { zh: '账户名称', en: 'Account name' },
  'acc.added': { zh: '添加时间', en: 'Added' },
  'acc.lastUsed': { zh: '最近使用', en: 'Last used' },
  'acc.expires': { zh: '过期', en: 'Expires' },
  'acc.remove': { zh: '移除', en: 'Remove' },
  'acc.removeConfirm': { zh: '确定移除该账户吗?', en: 'Remove this account?' },
  'acc.loadFailed': { zh: '加载账户失败', en: 'Failed to load accounts' },
  'acc.updateFailed': { zh: '更新账户失败', en: 'Failed to update account' },
  'acc.removeFailed': { zh: '移除账户失败', en: 'Failed to remove account' },
  'acc.removed': { zh: '账户已移除', en: 'Account removed' },
  'acc.tab.oauth': { zh: 'OAuth 手动', en: 'OAuth Manual' },
  'acc.tab.session': { zh: '会话密钥', en: 'Session Key' },
  'acc.tab.apikey': { zh: 'API 密钥', en: 'API Key' },
  'acc.oauth.desc': {
    zh: '启动 OAuth 流程授权 Claude 账户。授权页将在新标签页打开,请将拿到的授权码粘贴回来。',
    en: 'Start the OAuth flow to authorize a Claude account. The page opens in a new tab — paste the code back here.',
  },
  'acc.oauth.start': { zh: '开始 OAuth 流程', en: 'Start OAuth Flow' },
  'acc.oauth.code': { zh: '授权码(从打开的页面粘贴)', en: 'Authorization code (paste from the page)' },
  'acc.oauth.codePlaceholder': { zh: '在此粘贴授权码…', en: 'Paste code here…' },
  'acc.oauth.restart': { zh: '重新开始', en: 'Restart' },
  'acc.oauth.complete': { zh: '完成', en: 'Complete' },
  'acc.oauth.started': { zh: '已通过 OAuth 添加账户', en: 'Account added via OAuth' },
  'acc.oauth.startFailed': { zh: 'OAuth 启动失败', en: 'OAuth start failed' },
  'acc.oauth.completeFailed': { zh: 'OAuth 完成失败', en: 'OAuth complete failed' },
  'acc.session.label': { zh: '会话密钥', en: 'Session key' },
  'acc.session.added': { zh: '已通过会话密钥添加账户', en: 'Account added via session key' },
  'acc.session.failed': { zh: '通过会话密钥添加失败', en: 'Failed to add session key account' },
  'acc.apikey.label': { zh: 'API 密钥', en: 'API key' },
  'acc.apikey.added': { zh: '已通过 API 密钥添加账户', en: 'Account added via API key' },
  'acc.apikey.failed': { zh: '通过 API 密钥添加失败', en: 'Failed to add API key account' },
  'acc.adding': { zh: '添加中…', en: 'Adding…' },
  'acc.status.active': { zh: '正常', en: 'active' },
} as const

export type I18nKey = keyof typeof DICT

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: I18nKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'ui_lang'

function readInitial(): Lang {
  if (typeof window === 'undefined') return 'zh'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh' || stored === 'en') return stored
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitial)

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en')
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const toggleLang = useCallback(
    () => setLangState((l) => (l === 'zh' ? 'en' : 'zh')),
    [],
  )
  const t = useCallback((key: I18nKey) => DICT[key]?.[lang] ?? key, [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
